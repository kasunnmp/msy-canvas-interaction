import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { MaiseyOrb } from '../orb/MaiseyOrb';
import { Composer, type ComposerHandle } from './Composer';
import { AppTag, AvatarStack, Rich } from './parts';
import {
  MINION_AVATAR, buildBlueprint, daysLabel, describe, firstName, isMinionShaped, joinNames, parseDays, parseTime, person, plain,
  shortTime, timeLabel, titleFor, txt, type Blueprint, type Seg,
} from './model';
import redoIcon from './assets/redo.svg';
import moreIcon from './assets/more-vert.svg';
import chevronDown from './assets/chevron-down.svg';
import chevronRight from './assets/chevron-right.svg';
import backIcon from './assets/chevron-back.svg';
import fwdIcon from './assets/chevron-forward.svg';
import returnIcon from './assets/return.svg';
import renameIcon from './assets/rename.svg';
import dotSep from './assets/dot-sep.svg';
import dotGreen from './assets/dot-green.svg';
import './maisey.css';

/* ───────── conversation model ───────── */

type Card = { type: 'blueprint'; bp: Blueprint } | { type: 'activated'; bp: Blueprint } | { type: 'testrun'; ok: boolean; bp: Blueprint };
interface UserMsg { id: number; role: 'user'; segs: Seg[]; lines?: string[]; extras?: string[] }
interface MaiseyMsg {
  id: number;
  role: 'maisey';
  phase: 'thinking' | 'done' | 'stopped';
  label: string;
  status: string;
  compact?: boolean;
  reasoning: string[];
  shown: number;
  steps?: Seg[][];
  stepsShown?: number;
  body: Seg[];
  card?: Card;
  open: boolean;
  feedback?: 'up' | 'down';
}
type Msg = UserMsg | MaiseyMsg;

interface Question { id: 'time' | 'days' | 'recipients'; title: string; options: string[]; answer?: string; skippable: boolean }
type GateAction = 'test' | 'send' | 'change' | 'retry' | 'dropUnmatched';
type Prompt =
  | { kind: 'questions'; qs: Question[]; index: number; hi: number; typing: boolean; error?: string }
  | { kind: 'gate'; title: string; options: { label: string; action: GateAction }[]; hi: number };

interface Conv { id: number; title: string; messages: Msg[]; prompt: Prompt | null; bp: Blueprint | null; draft: Blueprint | null }
const emptyConv = (id: number): Conv => ({ id, title: 'New chat', messages: [], prompt: null, bp: null, draft: null });

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, reduced() ? ms * 0.25 : ms));
const app = (id: 'reporting' | 'nexus', label?: string): Seg => ({ t: 'app', id, label });
const reportShort = (b: Blueprint) => b.report.replace(/\s+report$/i, '');

/* ───────── component ───────── */

interface Props {
  open: boolean;
  onClose(): void;
  /** "View Minion" → fly to Maisey Minions. */
  onViewMinion(): void;
  /** Text handed over from Quick Search's "Ask Maisey". */
  seed?: { text: string; key: number } | null;
}

export function MaiseyChat({ open, onClose, onViewMinion, seed }: Props) {
  const [conv, setConv] = useState<Conv>(() => emptyConv(1));
  const [past, setPast] = useState<Conv[]>([]);
  const [busy, setBusy] = useState(false);
  const [tall, setTall] = useState(false);
  const [menu, setMenu] = useState<null | 'history' | 'plus' | { msg: number }>(null);
  const [mode, setMode] = useState<null | 'Deep Research' | 'Summaries'>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [elseText, setElseText] = useState('');
  const nextId = useRef(1);
  const run = useRef(0);
  const live = useRef<number | null>(null);
  const convRef = useRef(conv);
  convRef.current = conv;
  const composer = useRef<ComposerHandle>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [bottomH, setBottomH] = useState(125);
  useLayoutEffect(() => {
    const el = bottom.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBottomH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const elseInput = useRef<HTMLInputElement>(null);

  /* helpers */
  const add = (m: Msg) => setConv((c) => ({ ...c, messages: [...c.messages, m] }));
  const patch = (id: number, p: Partial<MaiseyMsg> | ((m: MaiseyMsg) => Partial<MaiseyMsg>)) =>
    setConv((c) => ({ ...c, messages: c.messages.map((m) => (m.id === id && m.role === 'maisey' ? { ...m, ...(typeof p === 'function' ? p(m) : p) } : m)) }));
  const setPrompt = (p: Prompt | null) => setConv((c) => ({ ...c, prompt: p }));

  useLayoutEffect(() => {
    if (open) composer.current?.focus();
    else setMenu(null);
  }, [open]);

  // Keep the newest content in view.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' });
  }, [conv.messages, conv.prompt?.kind]);

  /** Thinking bubble: shimmering status (§5.2) + streamed reasoning. Resolves to the message id, or null if stopped. */
  const think = async (token: number, o: { status: string[]; reasoning: string[]; ms: number; compact?: boolean }) => {
    const id = nextId.current++;
    add({ id, role: 'maisey', phase: 'thinking', label: 'Thinking', status: o.status[0], reasoning: o.reasoning, shown: 0, body: [], open: false, compact: o.compact });
    live.current = id;
    const n = Math.max(o.status.length, o.reasoning.length, 1);
    for (let i = 1; i <= n; i++) {
      await sleep(o.ms / n);
      if (run.current !== token) return null;
      patch(id, (m) => ({ status: o.status[Math.min(i, o.status.length - 1)], shown: Math.min(i, m.reasoning.length) }));
    }
    return id;
  };
  const finish = (id: number, p: Partial<MaiseyMsg>) => {
    patch(id, (m) => ({ phase: 'done', shown: m.reasoning.length, ...p }));
    live.current = null;
  };
  const begin = () => {
    const token = ++run.current;
    setBusy(true);
    return token;
  };
  const end = (token: number) => {
    if (run.current === token) setBusy(false);
  };

  const stop = () => {
    run.current++;
    setBusy(false);
    composer.current?.focus();
    if (live.current !== null) {
      patch(live.current, { phase: 'stopped', label: 'Stopped', body: [txt('You stopped this response.')], open: false });
      live.current = null;
    }
  };

  /* ── the commit gate (§5.7) — re-surfaced after every create / change ── */
  const gate = (bp: Blueprint) =>
    setPrompt({
      kind: 'gate',
      title: bp.active ? `Update ${bp.name} with these changes?` : `Activate the ${bp.days === 'weekdays' ? 'weekday' : 'daily'} ${shortTime(bp)} ${bp.report}`,
      options: [
        { label: 'Run a test', action: 'test' },
        { label: 'Send to work', action: 'send' },
        { label: 'Make changes', action: 'change' },
      ],
      hi: 0,
    });

  /** §5.5 Blueprint summary card. */
  const presentPlan = async (bp: Blueprint, header?: Seg[], compact?: boolean) => {
    const token = begin();
    const id = await think(token, {
      compact,
      status: ['Thinking', 'Checking permissions', 'Preparing the Blueprint'],
      reasoning: [
        `Schedule: ${daysLabel(bp.days)} at ${timeLabel(bp)} (${bp.timezone}).`,
        `Skills: Reporting → generate the ${bp.report}; Nexus → message ${bp.recipients.length} recipient${bp.recipients.length === 1 ? '' : 's'}; Scheduling → recurring trigger.`,
        'Permissions: read Reporting data, send Nexus messages on your behalf.',
      ],
      ms: 2000,
    });
    if (id === null) return;
    finish(id, {
      label: compact ? 'Thought for 13s' : 'Thought for 4 seconds',
      body: header ?? [txt('The plan is ready. It will extract data from '), app('reporting'), txt(' and sends by '), app('nexus'), txt(' .')],
      card: { type: 'blueprint', bp },
    });
    setConv((c) => ({ ...c, bp, draft: null, title: titleFor(bp, '') }));
    gate(bp);
    end(token);
  };

  /** §5.1–5.3 A Minion-shaped request: think, then clarify only what changes behaviour. */
  const minionFlow = async (segs: Seg[]) => {
    const bp = buildBlueprint(segs);
    const token = begin();
    const who = [...bp.recipients.map(firstName), ...bp.unresolved];
    const id = await think(token, {
      status: ['Thinking', 'Checking connected apps', 'Validating recipients', 'Preparing the Blueprint'],
      reasoning: [
        'This repeats on a schedule, so it should be a Minion rather than a one-off answer.',
        `Source: Reporting → ${bp.report}. Delivery: Nexus message${who.length ? ` to ${who.join(', ')}` : ''}.`,
        bp.ampm ? `Time is clear: ${timeLabel(bp)}.` : `“${bp.hour}” has no AM/PM — I need to confirm it.`,
        bp.days === 'weekdays' ? 'Runs on weekdays.' : 'Confirm whether weekends are included.',
      ],
      ms: 2600,
    });
    if (id === null) return;
    const qs: Question[] = [];
    const t = `${bp.hour}:${String(bp.minute).padStart(2, '0')}`;
    if (!bp.ampm) qs.push({ id: 'time', title: `You said ${bp.hour}, morning or evening?`, options: [`${t} AM`, `${t} PM`], skippable: false });
    if (bp.days !== 'weekdays') qs.push({ id: 'days', title: 'Run it every day, or weekdays only?', options: ['Every day', 'Weekday only (Mon-Fri)'], skippable: false });
    if (!bp.recipients.length && !bp.unresolved.length)
      qs.push({ id: 'recipients', title: 'Who should receive it?', options: ['Just me', 'Hayden, Yomal & Pasindu'], skippable: false });
    if (!qs.length) {
      finish(id, { label: 'Thought for 4 seconds', body: [txt('Everything I need is here.')] });
      end(token);
      return presentPlan(bp);
    }
    const what = qs[0].id === 'time' ? 'the exact time' : qs[0].id === 'days' ? 'which days it runs' : 'who receives it';
    finish(id, {
      label: 'Thought for 4 seconds',
      body: [txt(`Let's get this Minion ready to roll. To finalise this blueprint, I just need to clarify ${what}. It will pull from Reporting and deliver via Nexus message.`)],
    });
    setConv((c) => ({ ...c, draft: bp, title: titleFor(bp, ''), prompt: { kind: 'questions', qs, index: 0, hi: 0, typing: false } }));
    end(token);
  };

  /** One-off requests stay a standard Maisey conversation (§5.1). */
  const oneOff = async (segs: Seg[], m: string | null) => {
    const token = begin();
    const text = plain(segs);
    const id = await think(token, { status: ['Thinking'], reasoning: ['This is a one-off request, not recurring work — answering directly.'], ms: 1600 });
    if (id === null) return;
    const people = segs.filter((s): s is Extract<Seg, { t: 'person' }> => s.t === 'person').map((s) => s.id);
    finish(id, {
      label: 'Thought for 2 seconds',
      body: people.length
        ? [txt(`${m ? `${m}: ` : ''}Here’s what I have on `), { t: 'person', id: people[0] }, txt(` — 3 open items in Action Hub, 1 report shared this week and their last Nexus message was this morning. Want me to keep an eye on this every day? Just say “every day at 9 …”.`)]
        : [txt(`${m ? `${m}: ` : ''}On it — “${text}”. If this should happen on a schedule, tell me when (e.g. “every day at 8 send the daily login report to @Hayden”) and I’ll set up a Minion for it.`)],
    });
    end(token);
  };

  /** §5.6 Editing before (or after) commit — plain-language changes with @mentions. */
  const editFlow = async (segs: Seg[], bp: Blueprint) => {
    const text = plain(segs);
    const mentioned = [...new Set(segs.filter((s): s is Extract<Seg, { t: 'person' }> => s.t === 'person').map((s) => s.id))];
    const raw = segs.filter((s): s is Extract<Seg, { t: 'raw' }> => s.t === 'raw').map((s) => s.v.replace(/^@/, ''));
    const removing = /\b(remove|drop|exclude|without|take off)\b/i.test(text);
    const time = /\d/.test(text) ? parseTime(text) : null;
    const days = parseDays(text);
    let next: Blueprint = { ...bp, version: bp.version + 1 };
    const header: Seg[] = [];
    if (mentioned.length || raw.length) {
      if (removing) {
        next.recipients = next.recipients.filter((r) => !mentioned.includes(r));
        next.unresolved = next.unresolved.filter((r) => !raw.includes(r));
        header.push(txt('I have removed '), ...mentioned.flatMap((id, i) => [...(i ? [txt(i === mentioned.length - 1 ? ' & ' : ', ')] : []), { t: 'person', id } as Seg]), txt(' from the report, here’s the summary.'));
      } else {
        next.recipients = [...new Set([...next.recipients, ...mentioned])];
        next.unresolved = [...new Set([...next.unresolved, ...raw])];
        const added: Seg[] = [...mentioned.map((id) => ({ t: 'person', id }) as Seg), ...raw.map((v) => txt(`@${v}`))];
        header.push(txt('I have included '), ...added.flatMap((s, i) => [...(i ? [txt(i === added.length - 1 ? ' & ' : ', ')] : []), s]), txt(' for the report, here’s the summary.'));
      }
    }
    if (time) {
      next = { ...next, hour: time.hour, minute: time.minute, ampm: time.ampm ?? next.ampm ?? 'AM' };
      if (!header.length) header.push(txt(`Moved it to ${timeLabel(next)}, here’s the summary.`));
    }
    if (days && days !== bp.days) {
      next.days = days;
      if (!header.length) header.push(txt(`It will now run ${daysLabel(days)}, here’s the summary.`));
    }
    if (!header.length) {
      const token = begin();
      const id = await think(token, { status: ['Thinking'], reasoning: ['Looking for a change to the Blueprint…'], ms: 1100, compact: true });
      if (id === null) return;
      finish(id, { label: 'Thought for 1s', body: [txt('I didn’t catch a change to the Blueprint. Try “include @Name”, “at 9 AM” or “weekdays only”.')] });
      gate(bp);
      end(token);
      return;
    }
    return presentPlan(next, header, true);
  };

  /* ── sending ── */
  const send = (segs: Seg[]) => {
    if (busy) return;
    const c = convRef.current;
    const text = plain(segs);
    if (!text) return;
    // "or type above": a typed reply answers the open question.
    if (c.prompt?.kind === 'questions') return answer(text, true);
    setMenu(null);
    const extras = [...(mode ? [mode] : []), ...files.map((f) => `📎 ${f}`)];
    add({ id: nextId.current++, role: 'user', segs, extras: extras.length ? extras : undefined });
    setFiles([]);
    setConv((cv) => ({ ...cv, prompt: null, title: cv.messages.length <= 1 ? titleFor(null, text) : cv.title }));
    if (c.bp) return void editFlow(segs, c.bp);
    if (isMinionShaped(text)) return void minionFlow(segs);
    void oneOff(segs, mode);
  };

  /* ── clarifying questions (§5.3) ── */
  const answer = (value: string, typed = false) => {
    const c = convRef.current;
    if (c.prompt?.kind !== 'questions' || !c.draft) return;
    const p = c.prompt;
    const q = p.qs[p.index];
    let label = value;
    if (q.id === 'time' && typed) {
      const t = parseTime(value);
      if (!t) return setPrompt({ ...p, error: 'Try a time like 10:30 AM', typing: true });
      label = timeLabel({ ...t, ampm: t.ampm ?? 'AM' });
    }
    const qs = p.qs.map((x, i) => (i === p.index ? { ...x, answer: label } : x));
    setElseText('');
    composer.current?.focus();
    const nextIdx = qs.findIndex((x) => !x.answer);
    if (nextIdx !== -1) return setPrompt({ kind: 'questions', qs, index: nextIdx, hi: 0, typing: false });
    // §5.4 Recap of the Q&A, then the Blueprint.
    let bp = { ...c.draft };
    for (const x of qs) {
      if (x.id === 'time') {
        const t = parseTime(x.answer!);
        if (t) bp = { ...bp, hour: t.hour, minute: t.minute, ampm: t.ampm ?? 'AM' };
      } else if (x.id === 'days') bp.days = /weekday/i.test(x.answer!) ? 'weekdays' : 'daily';
      else if (x.id === 'recipients') bp.recipients = /just me/i.test(x.answer!) ? [] : ['hayden', 'yomal', 'pasindu'];
    }
    setConv((cv) => ({ ...cv, prompt: null }));
    add({ id: nextId.current++, role: 'user', segs: [], lines: qs.flatMap((x, i) => [...(i ? [''] : []), `Q: ${x.title}`, `A: ${x.answer}`]) });
    void presentPlan(bp);
  };

  /* ── test run / commit (§5.7–5.8) ── */
  const testRun = async (bp: Blueprint) => {
    const token = begin();
    const fail = bp.unresolved.length > 0;
    const steps: Seg[][] = fail
      ? [[txt('Preparing test run')], [txt('Connecting to '), app('reporting')], [txt('Resolving recipients from Contacts')], [txt('Test run failed')]]
      : [[txt('Preparing test run')], [txt('Connecting to '), app('reporting')], [txt('Generating '), app('reporting', reportShort(bp).replace(/^daily\s+/i, '') + ' report')], [txt('Send to '), app('nexus', 'Nexus')], [txt('Test run completed')]];
    const id = nextId.current++;
    add({ id, role: 'maisey', phase: 'thinking', label: 'Test run in progress', status: 'Test run in progress', reasoning: [], shown: 0, steps, stepsShown: 0, body: [], open: true });
    live.current = id;
    for (let i = 1; i <= steps.length; i++) {
      await sleep(700);
      if (run.current !== token) return;
      patch(id, { stepsShown: i });
    }
    await sleep(500);
    if (run.current !== token) return;
    const total = bp.recipients.length + bp.unresolved.length;
    if (fail) {
      finish(id, {
        label: 'Test run failed',
        open: false,
        body: [txt(`Test run failed while resolving recipients from Contacts. ${bp.unresolved.length} of ${total} recipients could not be matched. No message was generated or sent.`)],
        card: { type: 'testrun', ok: false, bp },
      });
      setPrompt({ kind: 'gate', title: 'Test run didn’t complete', options: [{ label: 'Retry test', action: 'retry' }, { label: 'Make Changes', action: 'change' }], hi: 0 });
    } else {
      finish(id, {
        label: `Test run completed ${steps.length + 4} steps`,
        open: false,
        body: [txt(`Test run completed successfully. Generated a ${bp.report} for ${total} user${total === 1 ? '' : 's'}. This was a test run.`)],
        card: { type: 'testrun', ok: true, bp },
      });
      setPrompt({ kind: 'gate', title: `Put a Minion on the ${reportShort(bp)} check?`, options: [{ label: 'Send to work', action: 'send' }, { label: 'Make Changes', action: 'change' }], hi: 0 });
    }
    end(token);
  };

  const commit = async (bp: Blueprint) => {
    const token = begin();
    const id = await think(token, {
      compact: true,
      status: ['Validating the Blueprint', 'Checking permissions', 'Deploying to Nexus'],
      reasoning: ['Skills available · apps connected · permissions valid.', bp.unresolved.length ? `Recipients: ${bp.unresolved.length} unmatched.` : 'Recipients valid.', 'Schedule and timezone complete.'],
      ms: 2000,
    });
    if (id === null) return;
    if (bp.unresolved.length) {
      finish(id, {
        label: 'Thought for 3s',
        body: [txt(`Activation is blocked — ${bp.unresolved.map((u) => `@${u}`).join(', ')} couldn’t be matched to a contact. Your draft is saved and nothing went live.`)],
      });
      setPrompt({ kind: 'gate', title: 'Fix recipients to activate', options: [{ label: 'Remove unmatched recipients', action: 'dropUnmatched' }, { label: 'Make Changes', action: 'change' }], hi: 0 });
      end(token);
      return;
    }
    const was = bp.active;
    const live2: Blueprint = { ...bp, active: true };
    finish(id, {
      label: 'Thought for 13s',
      body: [txt(`${bp.name} is ${was ? 'updated' : 'activated'}. It runs ${bp.days === 'weekdays' ? 'every weekday' : 'daily'} at ${timeLabel(bp)} and posts its own thread in `), app('nexus'), txt(' .')],
      card: { type: 'activated', bp: live2 },
    });
    setConv((c) => ({ ...c, bp: live2 }));
    end(token);
  };

  const makeChanges = async () => {
    const token = begin();
    const id = await think(token, { status: ['Thinking'], reasoning: [], ms: 600, compact: true });
    if (id === null) return;
    finish(id, { label: 'Thought for 1s', body: [txt('Sure — what should change? Add people with @, or tell me a new time or days.')] });
    end(token);
    composer.current?.focus();
  };

  const choose = (action: GateAction, label: string) => {
    const c = convRef.current;
    if (busy || !c.bp) return;
    setConv((cv) => ({ ...cv, prompt: null }));
    add({ id: nextId.current++, role: 'user', segs: [txt(label)] });
    composer.current?.focus();
    if (action === 'test' || action === 'retry') void testRun(c.bp);
    else if (action === 'send') void commit(c.bp);
    else if (action === 'change') void makeChanges();
    else if (action === 'dropUnmatched') void presentPlan({ ...c.bp, unresolved: [], version: c.bp.version + 1 }, [txt('I removed the unmatched recipients, here’s the summary.')], true);
  };

  /* ── question / gate keyboard (↑↓ · Enter · 1–9) ── */
  const promptKey = useCallback((e: ReactKeyboardEvent | KeyboardEvent) => {
    const p = convRef.current.prompt;
    if (!p || busy) return false;
    const n = p.kind === 'gate' ? p.options.length : p.qs[p.index].options.length + 1;
    const move = (d: number) => setPrompt({ ...p, hi: (p.hi + d + n) % n } as Prompt);
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return true; }
    const pickAt = (i: number) => {
      if (p.kind === 'gate') choose(p.options[i].action, p.options[i].label);
      else if (i < p.qs[p.index].options.length) answer(p.qs[p.index].options[i]);
      else { setPrompt({ ...p, hi: i, typing: true }); requestAnimationFrame(() => elseInput.current?.focus()); }
    };
    if (e.key === 'Enter') { e.preventDefault(); pickAt(p.hi); return true; }
    if (/^[1-9]$/.test(e.key) && Number(e.key) <= n) { e.preventDefault(); pickAt(Number(e.key) - 1); return true; }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  /* ── header / chrome ── */
  const newChat = () => {
    stop();
    setPast((p) => (convRef.current.messages.length ? [convRef.current, ...p.filter((x) => x.id !== convRef.current.id)] : p));
    setConv(emptyConv(Date.now()));
    setMenu(null);
    setTall(false);
    composer.current?.focus();
  };
  const restore = (c: Conv) => {
    stop();
    setPast((p) => [...(convRef.current.messages.length ? [convRef.current] : []), ...p.filter((x) => x.id !== c.id && x.id !== convRef.current.id)]);
    setConv(c);
    setMenu(null);
    composer.current?.focus();
  };
  const closeChat = () => {
    // Red light: end this conversation (it stays in history).
    newChat();
    onClose();
  };

  // Quick Search hand-off: open with the query already asked.
  const lastSeed = useRef<number | null>(null);
  useEffect(() => {
    if (!seed || !open || lastSeed.current === seed.key) return;
    lastSeed.current = seed.key;
    if (convRef.current.messages.length) newChat();
    requestAnimationFrame(() => send([txt(seed.text)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, open]);

  // Esc + ↑↓/Enter/1–9 work wherever focus is while the chat is open (inputs keep their own keys).
  const keyState = useRef({ menu, onClose, promptKey });
  keyState.current = { menu, onClose, promptKey };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const k = keyState.current;
      const c = convRef.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (k.menu) return setMenu(null);
        if (c.prompt?.kind === 'questions' && c.prompt.typing) return setPrompt({ ...c.prompt, typing: false });
        return k.onClose();
      }
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      k.promptKey(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const hasChat = conv.messages.length > 0;
  const panelH = hasChat ? (tall ? 800 : 720) : bottomH + 2;
  const p = conv.prompt;
  const hint =
    p && !busy ? (
      <>
        ↑↓ to navigate <img src={dotSep} alt="" width={3} height={3} /> Enter to select <img src={dotSep} alt="" width={3} height={3} /> {p.kind === 'questions' && p.typing ? 'or type below' : 'or type above'}
      </>
    ) : (
      'Maisey is an AI and may make mistakes'
    );

  return (
    <div className={`mc${open ? ' is-open' : ''}${hasChat ? ' has-chat' : ''}${tall ? ' is-tall' : ''}`} aria-hidden={!open}>
      <div className="mc-scrim" onMouseDown={onClose} />
      <section ref={panel} className="mc-panel" role="dialog" aria-label="Ask Maisey" style={{ height: panelH }}>
        {hasChat && (
          <header className="mc-head">
            <div className="mc-lights">
              <button type="button" className="mc-light mc-light--r" aria-label="Close chat" onClick={closeChat} />
              <button type="button" className="mc-light mc-light--y" aria-label="Minimise to Dock" onClick={onClose} />
              <button type="button" className="mc-light mc-light--g" aria-label={tall ? 'Restore size' : 'Expand'} onClick={() => setTall((v) => !v)} />
            </div>
            <div className="mc-head__title">{conv.title}</div>
            <button type="button" className="mc-head__expand" aria-label={tall ? 'Restore size' : 'Expand'} onClick={() => setTall((v) => !v)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                {tall ? (
                  <path d="M6.5 2.5v4h-4M9.5 13.5v-4h4M6.5 6.5 2 2M9.5 9.5 14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M10 2.5h3.5V6M6 13.5H2.5V10M13.5 2.5 9 7M2.5 13.5 7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          </header>
        )}

        {hasChat && (
          <div ref={scroller} className="mc-history" aria-live="polite">
            <div className="mc-history__inner">
              {conv.messages.map((m) =>
                m.role === 'user' ? (
                  <UserBubble key={m.id} m={m} />
                ) : (
                  <MaiseyBubble
                    key={m.id}
                    m={m}
                    menuOpen={typeof menu === 'object' && menu?.msg === m.id}
                    onToggle={() => patch(m.id, (x) => ({ open: !x.open }))}
                    onRedo={() => {
                      if (busy) return;
                      patch(m.id, { phase: 'thinking', label: 'Thinking', status: 'Thinking' });
                      setTimeout(() => patch(m.id, (x) => ({ phase: 'done', label: x.label === 'Thinking' ? 'Thought for 2 seconds' : x.label })), 1100);
                    }}
                    onMore={() => setMenu((v) => (typeof v === 'object' && v?.msg === m.id ? null : { msg: m.id }))}
                    onCopy={() => { void navigator.clipboard?.writeText(plain(m.body)); setMenu(null); }}
                    onFeedback={(f) => { patch(m.id, { feedback: f }); setMenu(null); }}
                    onViewMinion={onViewMinion}
                  />
                ),
              )}
            </div>
          </div>
        )}

        {p && !busy && (
          <div className="mc-answers">
            <div className="mc-qcard" role="listbox" aria-label={p.kind === 'gate' ? p.title : p.qs[p.index].title}>
              <div className="mc-qcard__head">
                <p>{p.kind === 'gate' ? p.title : p.qs[p.index].title}</p>
                {p.kind === 'questions' && p.qs.length > 1 && (
                  <div className="mc-qcard__nav">
                    <button type="button" aria-label="Previous question" disabled={p.index === 0} onClick={() => setPrompt({ ...p, index: p.index - 1, hi: 0, typing: false })}>
                      <img src={backIcon} alt="" width={24} height={24} />
                    </button>
                    <span>{p.index + 1} of {p.qs.length}</span>
                    <button
                      type="button"
                      aria-label="Next question"
                      disabled={p.index === p.qs.length - 1 || !p.qs[p.index].answer}
                      onClick={() => setPrompt({ ...p, index: p.index + 1, hi: 0, typing: false })}
                    >
                      <img src={fwdIcon} alt="" width={24} height={24} />
                    </button>
                  </div>
                )}
              </div>
              <div className="mc-qcard__list">
                {(p.kind === 'gate' ? p.options.map((o) => o.label) : p.qs[p.index].options).map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    role="option"
                    aria-selected={p.hi === i}
                    className={`mc-ans${p.hi === i ? ' is-hi' : ''}${p.kind === 'questions' && p.qs[p.index].answer === label ? ' is-picked' : ''}`}
                    onMouseMove={() => p.hi !== i && setPrompt({ ...p, hi: i } as Prompt)}
                    onClick={() => (p.kind === 'gate' ? choose(p.options[i].action, label) : answer(label))}
                  >
                    <span className="mc-ans__n">{i + 1}</span>
                    <span className="mc-ans__t">{label}</span>
                    {p.hi === i && (
                      <span className="mc-key" aria-hidden>
                        <img src={returnIcon} alt="" />
                      </span>
                    )}
                  </button>
                ))}
                {p.kind === 'questions' && (
                  <div
                    className={`mc-ans mc-ans--else${p.hi === p.qs[p.index].options.length ? ' is-hi' : ''}${p.typing ? ' is-typing' : ''}`}
                    onMouseMove={() => p.hi !== p.qs[p.index].options.length && setPrompt({ ...p, hi: p.qs[p.index].options.length })}
                    onClick={() => { if (!p.typing) { setPrompt({ ...p, typing: true, hi: p.qs[p.index].options.length }); requestAnimationFrame(() => elseInput.current?.focus()); } }}
                  >
                    <span className="mc-ans__n mc-ans__n--icon">
                      <img src={renameIcon} alt="" width={20} height={20} />
                    </span>
                    {p.typing ? (
                      <input
                        ref={elseInput}
                        autoFocus
                        className="mc-ans__input"
                        value={elseText}
                        placeholder="Something else"
                        aria-label="Something else"
                        onChange={(e) => setElseText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && elseText.trim()) { e.preventDefault(); answer(elseText.trim(), true); }
                          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPrompt({ ...p, typing: false }); }
                        }}
                      />
                    ) : (
                      <span className="mc-ans__t mc-ans__t--muted">Something else</span>
                    )}
                    {p.typing ? (
                      <button type="button" className="mc-btn" disabled={!elseText.trim()} onClick={(e) => { e.stopPropagation(); answer(elseText.trim(), true); }}>
                        Enter
                      </button>
                    ) : (
                      p.qs[p.index].skippable && (
                        <button type="button" className="mc-btn" onClick={(e) => { e.stopPropagation(); answer('Assumed default'); }}>
                          Skip
                        </button>
                      )
                    )}
                  </div>
                )}
                {p.kind === 'questions' && p.error && p.typing && <div className="mc-qcard__error">{p.error}</div>}
              </div>
            </div>
          </div>
        )}

        <div ref={bottom} className="mc-bottom">
          {menu === 'plus' && (
            <div className="mc-pop mc-pop--plus" role="menu">
              <button type="button" role="menuitem" className="mc-pop__item" onClick={() => { fileInput.current?.click(); setMenu(null); }}>Attach file</button>
              {(['Deep Research', 'Summaries'] as const).map((m) => (
                <button key={m} type="button" role="menuitemcheckbox" aria-checked={mode === m} className={`mc-pop__item${mode === m ? ' is-on' : ''}`} onClick={() => { setMode((v) => (v === m ? null : m)); setMenu(null); composer.current?.focus(); }}>
                  {m}
                </button>
              ))}
            </div>
          )}
          {menu === 'history' && (
            <div className="mc-pop mc-pop--history" role="menu">
              <div className="mc-pop__label">Recent</div>
              <button type="button" role="menuitem" className="mc-pop__item is-current">{conv.title}</button>
              {past.map((c) => (
                <button key={c.id} type="button" role="menuitem" className="mc-pop__item" onClick={() => restore(c)}>{c.title}</button>
              ))}
              <div className="mc-pop__sep" />
              <button type="button" role="menuitem" className="mc-pop__item" onClick={newChat}>New chat</button>
            </div>
          )}
          <input ref={fileInput} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles((x) => [...x, f.name]); e.target.value = ''; }} />
          {(mode || files.length > 0) && (
            <div className="mc-extras">
              {mode && <button type="button" className="mc-extra" onClick={() => setMode(null)} aria-label={`Remove ${mode}`}>{mode} ×</button>}
              {files.map((f) => <button key={f} type="button" className="mc-extra" onClick={() => setFiles((x) => x.filter((y) => y !== f))} aria-label={`Remove ${f}`}>📎 {f} ×</button>)}
            </div>
          )}
          <Composer
            ref={composer}
            busy={busy}
            onSend={send}
            onStop={stop}
            onHistory={() => setMenu((m) => (m === 'history' ? null : 'history'))}
            onPlus={() => setMenu((m) => (m === 'plus' ? null : 'plus'))}
            onKeyNav={(e) => promptKey(e)}
          />
          <div className="mc-hint">{hint}</div>
        </div>
      </section>
    </div>
  );
}

/* ───────── bubbles ───────── */

function UserBubble({ m }: { m: UserMsg }) {
  return (
    <div className="mc-row mc-row--user">
      <div className="mc-user">
        {m.lines ? m.lines.map((l, i) => <p key={i}>{l || ' '}</p>) : <p className="mc-user__rich"><Rich segs={m.segs} /></p>}
        {m.extras && <div className="mc-user__extras">{m.extras.map((x) => <span key={x}>{x}</span>)}</div>}
      </div>
    </div>
  );
}

interface BubbleProps {
  m: MaiseyMsg;
  menuOpen: boolean;
  onToggle(): void;
  onRedo(): void;
  onMore(): void;
  onCopy(): void;
  onFeedback(f: 'up' | 'down'): void;
  onViewMinion(): void;
}

function MaiseyBubble({ m, menuOpen, onToggle, onRedo, onMore, onCopy, onFeedback, onViewMinion }: BubbleProps) {
  const thinking = m.phase === 'thinking';
  const label = thinking ? m.status : m.label;
  const expandable = m.reasoning.length > 0 || !!m.steps;
  return (
    <div className="mc-row mc-row--maisey">
      <div className="mc-maisey">
        {m.compact ? (
          <button type="button" className={`mc-thought${m.open ? ' is-open' : ''}`} onClick={onToggle} aria-expanded={m.open} disabled={!expandable}>
            <span className={thinking ? 'mc-shimmer' : ''}>{label}</span>
            {expandable && <img src={chevronRight} alt="" width={20} height={20} />}
          </button>
        ) : (
          <button type="button" className={`mc-reason${m.open ? ' is-open' : ''}`} onClick={onToggle} aria-expanded={m.open} disabled={!expandable}>
            <MaiseyOrb size={24} state={thinking ? 'thinking' : 'idle'} />
            <span className={thinking ? 'mc-shimmer' : ''}>{label}</span>
            {expandable && <img className="mc-reason__chev" src={chevronDown} alt="" width={16} height={16} />}
          </button>
        )}
        {m.open && m.reasoning.length > 0 && (
          <div className="mc-reasoning">
            {m.reasoning.slice(0, m.shown).map((l, i) => <p key={i} className="mc-fadein">{l}</p>)}
          </div>
        )}
        {m.open && m.steps && (
          <ol className="mc-steps">
            {m.steps.slice(0, m.stepsShown ?? m.steps.length).map((s, i) => (
              <li key={i} className="mc-fadein"><Rich segs={s} /></li>
            ))}
          </ol>
        )}
        {m.body.length > 0 && (
          <div className="mc-body mc-fadein">
            <Rich segs={m.body} />
          </div>
        )}
        {m.card && <CardView card={m.card} onViewMinion={onViewMinion} />}
        {!thinking && (
          <div className="mc-foot">
            <button type="button" className="mc-sbtn" aria-label="Regenerate" onClick={onRedo}>
              <img src={redoIcon} alt="" width={20} height={20} />
            </button>
            <span className="mc-foot__more">
              <button type="button" className="mc-sbtn" aria-label="More actions" aria-expanded={menuOpen} onClick={onMore}>
                <img src={moreIcon} alt="" width={20} height={20} />
              </button>
              {menuOpen && (
                <span className="mc-pop mc-pop--msg" role="menu">
                  <button type="button" role="menuitem" className="mc-pop__item" onClick={onCopy}>Copy</button>
                  <button type="button" role="menuitem" className="mc-pop__item" onClick={() => onFeedback('up')}>Good response</button>
                  <button type="button" role="menuitem" className="mc-pop__item" onClick={() => onFeedback('down')}>Bad response</button>
                </span>
              )}
            </span>
            {m.feedback && <span className="mc-foot__thanks">Thanks for the feedback</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function CardView({ card, onViewMinion }: { card: Card; onViewMinion(): void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) wrap.current?.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  }, [open]);
  const bp = card.bp;
  if (card.type === 'testrun') {
    return (
      <div ref={wrap} className="mc-cardwrap">
        <div className={`mc-run${open ? ' is-open' : ''}`}>
          <button type="button" className="mc-run__head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <img className="mc-run__av" src={MINION_AVATAR} alt="" />
            <span className="mc-run__name">Maisey test run</span>
            <span className={`mc-badge${card.ok ? '' : ' mc-badge--err'}`}>
              {card.ok ? <img src={dotGreen} alt="" width={6} height={6} /> : <span className="mc-badge__dot" />}
              {card.ok ? 'Completed' : 'Error'}
            </span>
            <img className="mc-run__chev" src={chevronDown} alt="" width={16} height={16} />
          </button>
          {open && (
            <div className="mc-run__body">
              {card.ok ? (
                <>
                  <p>Reads the daily login report <br />from <AppTag id="reporting" /></p>
                  <p>Generate a report <AppTag id="reporting" label="Performance report" /></p>
                  <p>Send to <AppTag id="nexus" label="Nexus" /></p>
                  <p>to {bp.recipients.length} recipient{bp.recipients.length === 1 ? '' : 's'}</p>
                </>
              ) : (
                <>
                  <p>Reads the daily login report <br />from <AppTag id="reporting" /></p>
                  <p>Resolving recipients from Contacts</p>
                  <p className="mc-run__err">Not matched: {bp.unresolved.map((u) => `@${u}`).join(', ')}</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (card.type === 'activated') {
    return (
      <div ref={wrap} className="mc-cardwrap">
        <div className="mc-active">
          <img className="mc-active__av" src={MINION_AVATAR} alt="" />
          <div className="mc-active__text">
            <strong>{bp.name}</strong>
            <p>I will deliver the {bp.report} to {bp.recipients.length > 3 ? 'all users' : joinNames(bp.recipients)} {daysLabel(bp.days)} at {timeLabel(bp)}.</p>
            <AvatarStack ids={bp.recipients} max={3} />
          </div>
          <button type="button" className="mc-pill" onClick={onViewMinion}>View Minion</button>
        </div>
      </div>
    );
  }
  // §5.5 Blueprint summary card — tap to inspect every field before committing.
  const rows: [string, ReactNode, boolean?][] = [
    ['Schedule', `${daysLabel(bp.days).replace(/^./, (c) => c.toUpperCase())} at ${timeLabel(bp)}`],
    ['Timezone', bp.timezone, bp.assumed.includes('Timezone')],
    ['Recipients', bp.recipients.length || bp.unresolved.length ? <>{bp.recipients.map((id) => person(id).name).join(', ')}{bp.unresolved.length ? <span className="mc-bp__bad">{bp.recipients.length ? ', ' : ''}{bp.unresolved.map((u) => `@${u}`).join(', ')} (unmatched)</span> : null}</> : 'You'],
    ['Delivery', <><AppTag id="nexus" /> message</>],
    ['Skills', 'Reporting → generate report · Nexus → message recipients · Scheduling → recurring trigger'],
    ['Permissions', 'Read Reporting data · Send Nexus messages'],
    ['Data source', <AppTag id="reporting" />],
    ['Instructions', describe(bp)],
    ['Output', `${bp.report.replace(/^./, (c) => c.toUpperCase())} as a Nexus message`],
    ['External effects', `Messages ${bp.recipients.length || 1} ${bp.recipients.length === 1 ? 'person' : 'people'}`],
  ];
  return (
    <div ref={wrap} className="mc-cardwrap">
      <div className={`mc-bp${open ? ' is-open' : ''}`}>
        <button type="button" className="mc-bp__main" aria-expanded={open} onClick={() => setOpen((v) => !v)} aria-label={`${bp.name} Blueprint — ${open ? 'hide' : 'show'} details`}>
          <img className="mc-bp__av" src={MINION_AVATAR} alt="" />
          <span className="mc-bp__text">
            <strong>{bp.name}</strong>
            <span className="mc-bp__desc">{describe(bp)}</span>
            {bp.recipients.length > 0 && <AvatarStack ids={bp.recipients} max={3} />}
          </span>
        </button>
        {open && (
          <dl className="mc-bp__rows">
            {rows.map(([k, v, assumed]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}{assumed && <span className="mc-assumed">Assumed</span>}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

