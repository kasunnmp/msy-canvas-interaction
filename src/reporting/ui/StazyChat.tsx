import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useReporting } from '../state/store';
import type { ReportCard, Tile, TileType } from '../model/types';
import { ME, SOURCES, readmissionReport } from '../model/sampleReports';
import { TILE_KINDS, kindOf } from '../model/catalog';
import { comparisonLabel, formatNumber, tileData } from '../model/data';
import { StazyAvatar } from './common';
import redoIcon from '../assets/redo.svg';
import moreIcon from '../assets/more-vert.svg';
import chevDown from '../assets/chevron-down-sm.svg';
import chevBack from '../assets/chevron-back.svg';
import chevFwd from '../assets/chevron-forward.svg';
import returnIcon from '../assets/return.svg';
import renameIcon from '../assets/rename.svg';
import add2 from '../assets/add-2.svg';
import chipIcon from '../assets/chip-report.svg';
import emojiIcon from '../assets/emoji.svg';
import sendIcon from '../assets/send.svg';
import lockIcon from '../assets/lock.svg';
import checkGreen from '../assets/check-green.svg';
import arrowUpRight from '../assets/arrow-up-right.svg';

/* §11, §22 — Stazy's floating chat: the only way to make data edits, set schedules and add sources. */

interface Question {
  q: string;
  options: string[];
}

type Msg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'stazy'; text: ReactNode; list?: string[]; seconds?: number; reasoning?: string }
  | { id: number; role: 'thinking'; label: string }
  | { id: number; role: 'clarify'; questions: Question[]; index: number; answers: (string | null)[]; done: boolean }
  | { id: number; role: 'done'; reportId: string; title: string; description: string; schedule: string; sources: string[] }
  | { id: number; role: 'proposal'; title: string; detail: string; status: 'pending' | 'approved' | 'declined'; action: string };

type NewMsg = Msg extends infer M ? (M extends Msg ? Omit<M, 'id'> : never) : never;

let seq = 1;

const SCHEDULE_RE = /(every (?:morning|day|weekday|week|hour|monday|tuesday|wednesday|thursday|friday)(?: at [\d:]+ ?(?:am|pm)?)?|weekdays(?: only)?|daily|hourly|before rounds)/gi;

function highlight(text: string) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(SCHEDULE_RE)) {
    out.push(text.slice(last, m.index));
    out.push(
      <span key={m.index} className="sc-hl">
        {m[0]}
      </span>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function nameFromPrompt(text: string) {
  if (/readmission|cardiolog/i.test(text)) return 'Readmission risk for cardiology';
  const m = text.match(/(?:tracking|track|report (?:on|for|about)|showing)\s+([^.,;!?]+)/i);
  const raw = (m?.[1] ?? text).split(/\s+/).slice(0, 5).join(' ');
  return titleCase(raw.replace(/^(the|a|an)\s+/i, '')).slice(0, 42) || 'New Report';
}

function questionsFor(text: string): Question[] {
  if (/readmission|cardiolog/i.test(text))
    return [
      { q: 'For readmission risk — aggregate ward-level rate, or a patient-level list flagged by risk score?', options: ['Ward-level rate', 'Patient-level'] },
      { q: 'Bed occupancy — cardiology only, or the wider unit it sits within?', options: ['Cardiology only', 'The wider unit'] },
      { q: 'Lab turnaround — a specific test panel, or overall average across all pending orders?', options: ['A specific test panel', 'Overall average'] },
    ];
  return [
    { q: 'Should figures be broken down by department, or shown as one total?', options: ['By department', 'One total'] },
    { q: 'When should it run?', options: ['Every day at 8:00 am', 'Weekdays at 7:00 am'] },
    { q: 'Who is it for?', options: ['Just me', 'My team'] },
  ];
}

function genericReport(name: string, schedule: string): ReportCard {
  const base = readmissionReport();
  const types: TileType[] = ['stat', 'stat', 'stat', 'area', 'rankedList'];
  return {
    ...base,
    name,
    schedule,
    description: `${name} — key figures, the trend over time and the top contributors.`,
    tiles: base.tiles.map((t, i) => ({ ...t, type: types[i], name: ['Total', 'Change', 'Open items', `${name} over time`, 'Top contributors'][i], unit: i === 1 ? '%' : undefined, preset: undefined })),
  };
}

function findTile(tiles: Tile[], text: string) {
  const t = text.toLowerCase();
  return [...tiles].sort((a, b) => b.name.length - a.name.length).find((x) => t.includes(x.name.toLowerCase()) || (x.type === 'text' && x.text && t.includes(x.text.toLowerCase())));
}

function findType(text: string): TileType | null {
  const t = text.toLowerCase();
  const byLabel = [...TILE_KINDS].sort((a, b) => b.label.length - a.label.length).find((k) => t.includes(k.label.toLowerCase()));
  if (byLabel) return byLabel.type;
  if (/\bchart\b|trend/.test(t)) return 'line';
  if (/\bnumber|metric|kpi/.test(t)) return 'stat';
  return null;
}

export function StazyChat({ onClose }: { onClose: () => void }) {
  const store = useReporting();
  const { state, dispatch, active } = store;
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    {
      id: seq++,
      role: 'stazy',
      seconds: 4,
      reasoning: 'Checked which Report Cards you own and what sources are connected.',
      text: state.reports.some((r) => r.category === 'mine' && !r.inTrash)
        ? 'Ask me to build a report, change this one, or explain what you’re looking at.'
        : 'Let’s build your first report. Tell me what to track and I’ll pull it together.',
    },
  ]);
  const [input, setInput] = useState('');
  const [chip, setChip] = useState<string | null>(active ? active.name : 'New Report');
  const [creating, setCreating] = useState<{ prompt: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handlers = useRef(new Map<string, () => void>());
  const stateRef = useRef(state);
  stateRef.current = state;

  const push = useCallback((m: NewMsg) => {
    const id = seq++;
    setMsgs((x) => [...x, { ...m, id } as Msg]);
    return id;
  }, []);
  const patch = (id: number, p: Partial<Msg>) => setMsgs((x) => x.map((m) => (m.id === id ? ({ ...m, ...p } as Msg) : m)));
  const removeMsg = (id: number) => setMsgs((x) => x.filter((m) => m.id !== id));
  const later = (ms: number, fn: () => void) => window.setTimeout(fn, ms);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  // Keep the context chip in sync with the open Report Card unless a new one is being drafted.
  useEffect(() => {
    if (!creating) setChip(active ? active.name : 'New Report');
  }, [active?.id, active?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose sidebar "creating" row to the parent window.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('stazy:creating', { detail: creating?.name ?? null }));
  }, [creating]);

  const reply = (text: ReactNode, opts: { seconds?: number; list?: string[]; delay?: number } = {}) => {
    const t = push({ role: 'thinking', label: 'Thinking' });
    later(opts.delay ?? 700, () => {
      removeMsg(t);
      push({ role: 'stazy', text, list: opts.list, seconds: opts.seconds ?? 2 });
    });
  };

  /** Commit gate (§8.4): data edits are proposed and approved before they apply. */
  const propose = (title: string, detail: string, apply: () => void) => {
    const action = `p${seq}`;
    handlers.current.set(action, apply);
    const t = push({ role: 'thinking', label: 'Thinking' });
    later(800, () => {
      removeMsg(t);
      push({ role: 'proposal', title, detail, status: 'pending', action });
    });
  };

  // ── New Report flow (§22) ──
  const startCreate = (prompt: string) => {
    const name = nameFromPrompt(prompt);
    const qs = questionsFor(prompt);
    setCreating({ prompt, name });
    setChip(name);
    const t = push({ role: 'thinking', label: 'Thinking' });
    later(1100, () => {
      removeMsg(t);
      push({ role: 'stazy', seconds: 4, reasoning: 'The request mixes three metrics with different grains; confirming before building.', text: 'I can set that up. Before I do —', list: qs.map((q) => q.q) });
      push({ role: 'clarify', questions: qs, index: 0, answers: qs.map(() => null), done: false });
    });
  };

  const finishClarify = (m: Extract<Msg, { role: 'clarify' }>, answers: (string | null)[]) => {
    patch(m.id, { done: true, answers });
    const lines = m.questions.map((q, i) => `Q: ${q.q}\nA: ${answers[i] ?? 'Skipped'}`).join('\n\n');
    push({ role: 'user', text: lines });
    build(answers);
  };

  const build = (answers: (string | null)[]) => {
    if (!creating) return;
    const schedule = answers.find((a) => a && /every|weekday/i.test(a)) ?? (/every morning|before rounds/i.test(creating.prompt) ? 'Every day at 8:00 am' : 'Every day at 8:00 am');
    const report = /readmission|cardiolog/i.test(creating.prompt) ? { ...readmissionReport(), schedule } : genericReport(creating.name, schedule);
    const t = push({ role: 'thinking', label: 'Thinking' });
    const collectId = push({ role: 'stazy', text: <CollectingRow sources={report.tiles.flatMap((x) => x.sources)} /> });

    later(600, () => {
      dispatch({ type: 'addReport', report });
      dispatch({ type: 'select', id: report.id });
      dispatch({ type: 'openBuilder' });
      setCreating(null);
      // Tiles fill in one by one as Stazy collects their data.
      report.tiles.forEach((tile, i) => {
        later(900 + i * 650, () => {
          const d = stateRef.current.draft;
          if (!d || d.reportId !== report.id) return;
          dispatch({ type: 'draftTiles', record: false, tiles: d.tiles.map((x) => (x.id === tile.id ? { ...x, status: 'ok', refreshedAt: Date.now() } : x)) });
        });
      });
      later(900 + report.tiles.length * 650 + 300, () => {
        removeMsg(t);
        removeMsg(collectId);
        push({ role: 'stazy', seconds: 40, text: '' });
        push({
          role: 'done',
          reportId: report.id,
          title: report.name,
          description: report.description ?? '',
          schedule: report.schedule,
          sources: [...new Set(report.tiles.flatMap((x) => x.sources))],
        });
      });
    });
  };

  // ── Edits through chat (§11) ──
  const ensureBuilder = (): boolean => {
    const s = stateRef.current;
    const card = s.reports.find((r) => r.id === s.activeId);
    if (!card) return false;
    if (card.role === 'viewer') return false;
    if (s.mode !== 'builder') dispatch({ type: 'openBuilder' }); // §11: in Preview, an edit switches to the builder first
    return true;
  };

  const currentTiles = () => stateRef.current.draft?.tiles ?? stateRef.current.reports.find((r) => r.id === stateRef.current.activeId)?.tiles ?? [];

  const handle = (text: string) => {
    const t = text.toLowerCase();
    const card = stateRef.current.reports.find((r) => r.id === stateRef.current.activeId) ?? null;
    const viewer = card?.role === 'viewer';

    // A "New Report" context, or an explicit build request, always starts a new Report Card —
    // schedule words inside it ("refresh every morning") belong to the new report.
    const newContext = !chip || chip === 'New Report';
    const buildRequest = /\b(build|create|make|start)\b.*\breport\b/.test(t);
    const isEdit = /\b(add|remove|delete|rename|move|resize|wider|bigger|smaller|narrower|taller|tidy|connect|bind|source|schedule|run (it )?(every|daily|weekdays)|refresh every)\b/.test(t);

    if ((newContext || buildRequest) && !viewer) return startCreate(text);
    if (!card) return startCreate(text);

    if (isEdit && viewer) {
      return reply('You have view access to this Report Card, so I can’t change it. I can answer questions about what it shows.');
    }

    // Schedule (data edit, set only through chat — §12)
    const sched = text.match(/(every (?:day|weekday|morning|monday|hour)[^.,]*|weekdays[^.,]*|daily[^.,]*)/i);
    if (sched && /schedule|run|refresh every|every/i.test(t) && !/add|remove|rename/.test(t)) {
      const value = titleCase(sched[1].trim()).replace(/^Every/, 'Every');
      return propose('Change schedule', `Run “${card.name}” ${value.toLowerCase()} and notify everyone on the sharing list when it’s ready.`, () => {
        dispatch({ type: 'updateReport', id: card.id, patch: { schedule: value } });
        push({ role: 'stazy', text: `Done — it now runs ${value.toLowerCase()}.`, seconds: 1 });
      });
    }

    // Data edit: connect / bind / add a source
    if (/\b(connect|bind|source)\b/.test(t)) {
      if (!ensureBuilder()) return;
      const tile = findTile(currentTiles(), text) ?? currentTiles().find((x) => x.status === 'unbound');
      if (!tile) return reply('Which Tile should I connect? Name it, e.g. “connect Locked accounts to Glazy”.');
      if (/payroll|hr system/.test(t)) return reply('I can’t reach Payroll with your access, so I can’t connect it. Ask its owner to share it with you first.');
      const srcIds = Object.keys(SOURCES).filter((id) => t.includes(SOURCES[id].name.split(' ')[0].toLowerCase()));
      const sources = srcIds.length ? srcIds : ['glazy'];
      const merged = sources.length + tile.sources.filter((s) => !sources.includes(s)).length > 1;
      return propose(
        tile.status === 'unbound' ? 'Connect data' : 'Add a source',
        `${tile.name} ← ${[...new Set([...tile.sources, ...sources])].map((s) => SOURCES[s].name).join(' + ')}${merged ? ', merged by period' : ''}. Waits in the draft until you save.`,
        () => {
          const d = stateRef.current.draft;
          if (!d) return;
          dispatch({ type: 'draftTiles', tiles: d.tiles.map((x) => (x.id === tile.id ? { ...x, sources: [...new Set([...x.sources, ...sources])], status: 'ok', refreshedAt: Date.now() } : x)) });
          dispatch({ type: 'draftDataEdit', note: `connect ${tile.name}` });
          push({ role: 'stazy', text: `Connected. ${tile.name} goes live when you save.`, seconds: 1 });
        },
      );
    }

    // Layout edits (no commit gate)
    if (/\btidy\b/.test(t)) {
      if (!ensureBuilder()) return;
      later(50, () => store.tidyUp());
      return reply('Tidied the layout into an ordered grid.');
    }
    if (/\b(remove|delete)\b/.test(t)) {
      if (!ensureBuilder()) return;
      const tile = findTile(currentTiles(), text);
      if (!tile) return reply('I couldn’t find that Tile. Which one should I remove?');
      later(50, () => store.removeTile(tile.id));
      return reply(`Removed “${tile.name}” from the draft. Undo brings it back until you save.`);
    }
    const ren = text.match(/rename\s+(.+?)\s+to\s+(.+)/i);
    if (ren) {
      if (!ensureBuilder()) return;
      const tile = findTile(currentTiles(), ren[1]);
      if (!tile) return reply('Which Tile should I rename?');
      later(50, () => store.renameTile(tile.id, ren[2].replace(/["“”.]/g, '').trim()));
      return reply(`Renamed to “${ren[2].replace(/["“”.]/g, '').trim()}”.`);
    }
    if (/\b(wider|bigger|larger|smaller|narrower|taller|shorter|resize)\b/.test(t)) {
      if (!ensureBuilder()) return;
      const tile = findTile(currentTiles(), text);
      if (!tile) return reply('Which Tile should I resize?');
      const k = kindOf(tile.type);
      const grow = /wider|bigger|larger|taller/.test(t);
      const next = {
        ...tile,
        w: /taller|shorter/.test(t) ? tile.w : tile.w + (grow ? 2 : -2),
        h: /wider|narrower/.test(t) ? tile.h : tile.h + (grow ? 1 : -1),
      };
      later(50, () => store.placeTile(next));
      return reply(`Resized “${tile.name}” (it stays within ${k.min.w}×${k.min.h} to ${k.max.w}×${k.max.h}).`);
    }
    if (/\bmove\b/.test(t)) {
      if (!ensureBuilder()) return;
      const tile = findTile(currentTiles(), text);
      if (!tile) return reply('Which Tile should I move?');
      const y = /top|up/.test(t) ? 0 : /bottom|down/.test(t) ? 99 : tile.y;
      const x = /right/.test(t) ? 12 : /left/.test(t) ? 0 : tile.x;
      later(50, () => store.placeTile({ ...tile, x, y }));
      return reply(`Moved “${tile.name}”.`);
    }
    if (/\badd\b/.test(t)) {
      if (!ensureBuilder()) return;
      const textMatch = text.match(/add (?:a )?(?:text|label|note)[^"“]*["“](.+?)["”]/i);
      if (textMatch || /add (a )?(text|label|note)\b/.test(t)) {
        later(50, () => {
          const id = store.addTile('text');
          if (textMatch) store.setTileText(id, textMatch[1]);
        });
        return reply('Added a Text element. I don’t fill text with data — type your label or note into it.');
      }
      const type = findType(text);
      if (!type) return reply('Which kind of Tile? For example a Stat, Line, Donut, Table or Funnel.');
      later(50, () => store.addTile(type));
      return reply(`Added an unbound ${kindOf(type).label} Tile. Tell me what it should show and I’ll connect it.`);
    }

    // Questions — answered from what the Report Card already shows (§11).
    const tile = findTile(card.tiles, text);
    if (tile && tile.status === 'ok') {
      const range = stateRef.current.ranges[card.id] ?? { key: 'today' as const };
      const d = tileData(tile, range);
      const dir = d.delta >= 0 ? 'up' : 'down';
      return reply(`${tile.name} is ${formatNumber(d.value)}${tile.unit ?? ''}, ${dir} ${Math.abs(d.delta)}% ${comparisonLabel(range.key)}. Source: ${tile.sources.map((s) => SOURCES[s]?.name).join(' + ')}.`);
    }
    if (tile && tile.status === 'failed') return reply(`${tile.name} failed on the last run: ${tile.failedSources?.map((s) => SOURCES[s]?.name).join(', ')} couldn’t be reached, so I won’t show partial figures.`);
    return reply(
      viewer
        ? 'I can only answer from the Tiles this Report Card shows. Ask about one of them, e.g. “what is Logins today?”.'
        : 'I can build a new report, change this one (add, move, resize, rename or remove Tiles, connect data, set the schedule), or answer questions about its Tiles.',
    );
  };

  // Builder "Bind with Stazy" and title-menu Duplicate entry points.
  useEffect(() => {
    const onBind = (e: Event) => {
      const { name } = (e as CustomEvent).detail as { name: string };
      push({ role: 'user', text: `Connect ${name} to data` });
      propose('Connect data', `${name} ← Glazy · Access Control. Waits in the draft until you save.`, () => {
        const d = stateRef.current.draft;
        if (!d) return;
        const tile = d.tiles.find((x) => x.name === name && x.status === 'unbound') ?? d.tiles.find((x) => x.name === name);
        if (!tile) return;
        dispatch({ type: 'draftTiles', tiles: d.tiles.map((x) => (x.id === tile.id ? { ...x, sources: ['glazy'], status: 'ok', refreshedAt: Date.now() } : x)) });
        dispatch({ type: 'draftDataEdit', note: `connect ${name}` });
        push({ role: 'stazy', text: `Connected ${name}. It goes live when you save.`, seconds: 1 });
      });
    };
    const onDup = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      const card = stateRef.current.reports.find((r) => r.id === id);
      if (!card) return;
      push({ role: 'user', text: `Duplicate “${card.name}”` });
      // §8.6: Stazy asks to confirm the copy's schedule and sharing rather than carrying them over silently.
      propose('Duplicate report', `New copy “${card.name} (copy)”, owned by you. Schedule: ${card.schedule}. Sharing: just you (the original’s ${card.sharing.length - 1} collaborators are not added).`, () => {
        const copy: ReportCard = {
          ...card,
          id: `r${Date.now().toString(36)}`,
          name: `${card.name} (copy)`,
          category: 'mine',
          role: 'owner',
          sharing: [ME],
          createdAt: Date.now(),
          createdBy: ME.name,
          pinned: false,
          summary: undefined,
          tiles: card.tiles.map((x) => ({ ...x, id: `${x.id}d${Date.now().toString(36)}` })),
        };
        dispatch({ type: 'addReport', report: copy });
        dispatch({ type: 'select', id: copy.id });
        push({ role: 'stazy', text: `Created “${copy.name}”. Change its schedule or sharing any time.`, seconds: 1 });
      });
    };
    const onNew = () => {
      setChip('New Report');
      setCreating(null);
      inputRef.current?.focus();
    };
    window.addEventListener('stazy:bind', onBind);
    window.addEventListener('stazy:duplicate', onDup);
    window.addEventListener('stazy:new', onNew);
    return () => {
      window.removeEventListener('stazy:bind', onBind);
      window.removeEventListener('stazy:duplicate', onDup);
      window.removeEventListener('stazy:new', onNew);
    };
  }, [push, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    const v = input.trim();
    if (!v) return;
    const pendingClarify = msgs.find((m): m is Extract<Msg, { role: 'clarify' }> => m.role === 'clarify' && !m.done);
    setInput('');
    if (pendingClarify) {
      // Typed answer = "Something else" for the current question.
      answerClarify(pendingClarify, v);
      return;
    }
    push({ role: 'user', text: v });
    handle(v);
  };

  const answerClarify = (m: Extract<Msg, { role: 'clarify' }>, answer: string | null) => {
    const answers = [...m.answers];
    answers[m.index] = answer;
    const nextIdx = answers.findIndex((a, i) => a === null && i > m.index);
    if (m.index >= m.questions.length - 1 || nextIdx === -1) finishClarify(m, answers);
    else patch(m.id, { answers, index: nextIdx });
  };

  const newReportChip = () => {
    setChip('New Report');
    setCreating(null);
    inputRef.current?.focus();
  };

  return (
    <aside className="sc" aria-label="Stazy chat">
      <header className="sc-head">
        <StazyAvatar size={24} />
        <strong>Stazy</strong>
        <span className="sc-head__role">Report Minion</span>
        <button type="button" className="r-icon-btn sc-head__close" aria-label="Close chat" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="sc-scroll" ref={scrollRef}>
        <div className="sc-day">
          <span>Today</span>
        </div>
        {msgs.map((m) => {
          switch (m.role) {
            case 'user':
              return (
                <div key={m.id} className="sc-user">
                  <div className="sc-bubble">{highlight(m.text)}</div>
                </div>
              );
            case 'thinking':
              return (
                <div key={m.id} className="sc-stazy">
                  <div className="sc-reason">
                    <StazyAvatar size={24} />
                    <span className="sc-shimmer">{m.label}</span>
                    <img src={chevDown} alt="" width={16} height={16} />
                  </div>
                </div>
              );
            case 'stazy':
              return <StazyMsg key={m.id} m={m} />;
            case 'clarify':
              return m.done ? null : (
                <ClarifyCard
                  key={m.id}
                  m={m}
                  onAnswer={(a) => answerClarify(m, a)}
                  onNav={(i) => patch(m.id, { index: i })}
                  onSomethingElse={() => inputRef.current?.focus()}
                />
              );
            case 'proposal':
              return (
                <div key={m.id} className={`sc-proposal is-${m.status}`}>
                  <div className="sc-proposal__head">
                    <StazyAvatar size={20} />
                    <strong>{m.title}</strong>
                    <span className="sc-proposal__gate">Needs approval</span>
                  </div>
                  <p>{m.detail}</p>
                  {m.status === 'pending' ? (
                    <div className="sc-proposal__actions">
                      <button type="button" className="r-btn r-btn--ghost r-btn--sm" onClick={() => patch(m.id, { status: 'declined' })}>
                        Decline
                      </button>
                      <button
                        type="button"
                        className="r-btn r-btn--primary r-btn--sm"
                        onClick={() => {
                          patch(m.id, { status: 'approved' });
                          handlers.current.get(m.action)?.();
                        }}
                      >
                        Approve
                      </button>
                    </div>
                  ) : (
                    <div className="sc-proposal__status">{m.status === 'approved' ? 'Approved' : 'Declined'}</div>
                  )}
                </div>
              );
            case 'done':
              return (
                <div key={m.id} className="sc-done">
                  <div className="sc-done__card">
                    <div className="sc-done__head">
                      <StazyAvatar size={24} />
                      <div className="sc-done__title">
                        <strong>{m.title}</strong>
                        <span>Private Report</span>
                      </div>
                      <span className="sc-done__status">
                        <img src={checkGreen} alt="" width={20} height={20} /> Done
                      </span>
                    </div>
                    <div className="sc-done__body">
                      <p>{m.description}</p>
                      <span className="sc-done__schedule">{m.schedule}</span>
                    </div>
                    <div className="sc-done__cta">
                      <button
                        type="button"
                        className="r-btn"
                        onClick={() => {
                          const s = stateRef.current;
                          if (s.draft?.reportId === m.reportId) {
                            dispatch({ type: 'saveDraft' });
                            dispatch({ type: 'closeBuilder' });
                          } else dispatch({ type: 'select', id: m.reportId });
                        }}
                      >
                        <img src={arrowUpRight} alt="" width={20} height={20} /> View Report
                      </button>
                    </div>
                  </div>
                  <div className="sc-done__sources">
                    Sources
                    <span className="sc-done__avatars">
                      {m.sources.map((id) => (
                        <img key={id} src={SOURCES[id]?.icon} alt={SOURCES[id]?.name} title={SOURCES[id]?.name} className={SOURCES[id]?.kind === 'minion' ? 'is-round' : 'is-squircle'} />
                      ))}
                    </span>
                  </div>
                </div>
              );
          }
        })}
      </div>

      <div className="sc-input">
        <div className="sc-input__row">
          <div className="sc-field">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              placeholder={chip === 'New Report' || !chip ? 'Ask Stazy to create a custom report' : `Ask Stazy about ${chip}`}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              aria-label="Message Stazy"
            />
            <div className="sc-field__bottom">
              <button type="button" className="sc-icon" aria-label="New report" title="Start a new report" onClick={newReportChip}>
                <img src={add2} alt="" width={24} height={24} />
              </button>
              {chip && (
                <span className="sc-chip">
                  <img src={chipIcon} alt="" width={20} height={20} className="sc-chip__icon" />
                  <button type="button" className="sc-chip__x" aria-label={`Remove ${chip}`} onClick={() => setChip(null)}>
                    ×
                  </button>
                  <span className="sc-chip__text">{chip}</span>
                </span>
              )}
              <span className="sc-spacer" />
              <button type="button" className="sc-icon" aria-label="Emoji" tabIndex={-1}>
                <img src={emojiIcon} alt="" width={24} height={24} />
              </button>
            </div>
          </div>
          <button type="button" className={`sc-send${input.trim() ? ' is-ready' : ''}`} onClick={send} aria-label="Send" disabled={!input.trim()}>
            <img src={sendIcon} alt="" width={24} height={24} />
          </button>
        </div>
        <div className="sc-secure">
          <img src={lockIcon} alt="" width={18} height={18} />
          All chats are secure, private, and fully encrypted
        </div>
      </div>
    </aside>
  );
}

function StazyMsg({ m }: { m: Extract<Msg, { role: 'stazy' }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sc-stazy">
      {m.seconds !== undefined && (
        <button type="button" className="sc-reason" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <StazyAvatar size={24} />
          <span>Thought for {m.seconds} seconds</span>
          <img src={chevDown} alt="" width={16} height={16} className={open ? 'is-open' : ''} />
        </button>
      )}
      {open && <div className="sc-reason__text">{m.reasoning ?? 'Read the Report Card and the request, then picked the smallest change that answers it.'}</div>}
      {m.text && (
        <div className="sc-text">
          {m.text}
          {m.list && (
            <ol>
              {m.list.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      {m.text && (
        <div className="sc-actions">
          <button type="button" className="sc-icon sc-icon--sm" aria-label="Regenerate">
            <img src={redoIcon} alt="" width={20} height={20} />
          </button>
          <button type="button" className="sc-icon sc-icon--sm" aria-label="More">
            <img src={moreIcon} alt="" width={20} height={20} />
          </button>
        </div>
      )}
    </div>
  );
}

function CollectingRow({ sources }: { sources: string[] }) {
  const ids = [...new Set(sources)].slice(0, 3);
  return (
    <span className="sc-collect">
      <StazyAvatar size={24} />
      <span className="sc-collect__who">
        <strong>Stazy</strong>
        <span>{ids.map((id) => SOURCES[id]?.name.split(' ·')[0]).join(', ')}</span>
      </span>
      <span className="sc-shimmer">Collecting Data...</span>
    </span>
  );
}

/** §22.1 Clarifying-question card: one at a time, "1 of 3", numbered options, Something else, Skip. */
function ClarifyCard({
  m,
  onAnswer,
  onNav,
  onSomethingElse,
}: {
  m: Extract<Msg, { role: 'clarify' }>;
  onAnswer: (a: string | null) => void;
  onNav: (i: number) => void;
  onSomethingElse: () => void;
}) {
  const q = m.questions[m.index];
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setHi(0);
    ref.current?.focus({ preventScroll: true });
  }, [m.index]);
  const count = q.options.length + 1;
  return (
    <div
      ref={ref}
      className="sc-clarify"
      tabIndex={0}
      role="listbox"
      aria-label={q.q}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') (e.preventDefault(), setHi((h) => Math.min(count - 1, h + 1)));
        else if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(0, h - 1)));
        else if (e.key === 'Enter') {
          e.preventDefault();
          if (hi < q.options.length) onAnswer(q.options[hi]);
          else onSomethingElse();
        } else if (/^[1-9]$/.test(e.key) && +e.key <= q.options.length) onAnswer(q.options[+e.key - 1]);
      }}
    >
      <div className="sc-clarify__head">
        <p>{q.q}</p>
        <div className="sc-clarify__nav">
          <button type="button" aria-label="Previous question" disabled={m.index === 0} onClick={() => onNav(m.index - 1)}>
            <img src={chevBack} alt="" width={24} height={24} />
          </button>
          <span>
            {m.index + 1} of {m.questions.length}
          </span>
          <button type="button" aria-label="Next question" disabled={m.index === m.questions.length - 1} onClick={() => onNav(m.index + 1)}>
            <img src={chevFwd} alt="" width={24} height={24} />
          </button>
        </div>
      </div>
      <div className="sc-clarify__opts">
        {q.options.map((o, i) => (
          <button key={o} type="button" role="option" aria-selected={hi === i} className={`sc-opt${hi === i ? ' is-hi' : ''}`} onMouseEnter={() => setHi(i)} onClick={() => onAnswer(o)}>
            <span className="sc-opt__n">{i + 1}</span>
            <span className="sc-opt__text">{o}</span>
            {hi === i && (
              <span className="sc-opt__key" aria-hidden>
                <img src={returnIcon} alt="" />
              </span>
            )}
          </button>
        ))}
        <div className={`sc-opt sc-opt--else${hi === q.options.length ? ' is-hi' : ''}`} onMouseEnter={() => setHi(q.options.length)}>
          <button type="button" className="sc-opt__else" onClick={onSomethingElse}>
            <span className="sc-opt__n">
              <img src={renameIcon} alt="" width={14} height={14} />
            </span>
            <span className="sc-opt__text">Something else</span>
          </button>
          <button type="button" className="r-btn r-btn--sm" onClick={() => onAnswer(null)}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
