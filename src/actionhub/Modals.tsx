import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useHub } from './store';
import { EMOJI_SET, ICON_SET, PEOPLE, TAGS, type Priority } from './model';
import { Av, I, ListIcon, MItem, Pop, PriorityIcon, plain } from './ui';
import { PriorityChip } from './Detail';
import maiseyAvatar from '../assets/dock/a156c.png';

function Modal({ title, onClose, children, footer, className = '', headRight }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; className?: string; headRight?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.ah-pop')) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, [onClose]);
  return (
    <div className="ah-modal-layer" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`ah-modal ${className}`} role="dialog" aria-modal="true">
        <div className="ah-modal__head">
          <div className="ah-modal__title">{title}</div>
          {headRight}
          <button type="button" className="ah-iconbtn" aria-label="Close" onClick={onClose}>
            {I.close}
          </button>
        </div>
        <div className="ah-modal__body">{children}</div>
        {footer && <div className="ah-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

function ListPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const hub = useHub();
  const [open, setOpen] = useState(false);
  return (
    <span className="ah-chip-wrap">
      <button type="button" className="ah-prop" onClick={() => setOpen((v) => !v)}>
        <ListIcon icon={hub.listIcon(value)} size={18} /> {hub.listName(value)} {I.chevron}
      </button>
      {open && (
        <Pop className="ah-prop-pop ah-prop-pop--up" onClose={() => setOpen(false)}>
          {hub.lists.map((l) => (
            <MItem key={l.id} icon={<ListIcon icon={l.icon} size={18} />} right={l.id === value ? I.check : undefined} onClick={() => (onChange(l.id), setOpen(false))}>
              {l.name}
            </MItem>
          ))}
        </Pop>
      )}
    </span>
  );
}

function PeoplePick({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="ah-chip-wrap">
      <button type="button" className="ah-prop" onClick={() => setOpen((v) => !v)}>
        {value.length ? (
          <>
            <span className="ah-prop__stack">{value.slice(0, 3).map((a) => <Av key={a} id={a} size={18} />)}</span>
            {PEOPLE[value[0]]?.name.split(' ')[0]}
            {value.length > 1 && ` +${value.length - 1}`}
          </>
        ) : (
          <>{I.user} Assign</>
        )}
      </button>
      {open && (
        <Pop className="ah-prop-pop" onClose={() => setOpen(false)}>
          {Object.values(PEOPLE).map((p) => (
            <MItem key={p.id} icon={<Av id={p.id} size={20} />} right={value.includes(p.id) ? I.check : undefined} onClick={() => onChange(value.includes(p.id) ? value.filter((x) => x !== p.id) : [...value, p.id])}>
              {p.id === 'me' ? `${p.name} (you)` : p.name}
            </MItem>
          ))}
        </Pop>
      )}
    </span>
  );
}

function TagPick({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="ah-chip-wrap">
      <button type="button" className="ah-prop" onClick={() => setOpen((v) => !v)}>
        {value.length ? (
          <>
            <span className="ah-tagdot" style={{ background: TAGS[value[0]]?.color }} />
            {TAGS[value[0]]?.name}
            {value.length > 1 && ` +${value.length - 1}`}
          </>
        ) : (
          <>{I.tag} Tag</>
        )}
      </button>
      {open && (
        <Pop className="ah-prop-pop" onClose={() => setOpen(false)}>
          {Object.values(TAGS).map((t) => (
            <MItem key={t.id} icon={<span className="ah-tagdot" style={{ background: t.color }} />} right={value.includes(t.id) ? I.check : undefined} onClick={() => onChange(value.includes(t.id) ? value.filter((x) => x !== t.id) : [...value, t.id])}>
              {t.name}
            </MItem>
          ))}
        </Pop>
      )}
    </span>
  );
}

/** Voice input (§6.2) using the Web Speech API when the browser has it. */
function useVoice(onText: (t: string) => void) {
  const [on, setOn] = useState(false);
  const rec = useRef<{ stop: () => void } | null>(null);
  const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  const toggle = () => {
    if (!Ctor) return false;
    if (on) {
      rec.current?.stop();
      return true;
    }
    const r = new Ctor();
    r.interimResults = false;
    r.onresult = (e: any) => onText(Array.from(e.results).map((x: any) => x[0].transcript).join(' '));
    r.onend = () => setOn(false);
    r.start();
    rec.current = r;
    setOn(true);
    return true;
  };
  return { on, toggle, supported: !!Ctor };
}

/** §6.2 New task / §6.3 Brain dump. */
export function NewTaskModal({ mode: initialMode, listId: initialList }: { mode: 'task' | 'brain'; listId?: string }) {
  const hub = useHub();
  const [mode, setMode] = useState(initialMode);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [dump, setDump] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority>(0);
  const [files, setFiles] = useState<string[]>([]);
  const [listId, setListId] = useState(initialList ?? (hub.view.kind === 'list' ? hub.view.id : 'backlog'));
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const voice = useVoice((t) => (mode === 'task' ? setTitle((x) => (x ? `${x} ${t}` : t)) : setDump((x) => (x ? `${x} ${t}` : t))));
  const close = () => hub.setModal(null);

  useEffect(() => {
    titleRef.current?.focus(); // cursor in the title when the modal opens
  }, [mode]);

  const submit = () => {
    if (mode === 'task') {
      if (!title.trim()) return titleRef.current?.focus();
      hub.addTask({
        title: title.trim(),
        description: desc.trim() || undefined,
        listId,
        assignees,
        tags,
        priority,
        attachments: files.map((f) => ({ id: f, name: f })),
      });
      close();
    } else {
      if (!dump.trim()) return;
      hub.setModal({ kind: 'maisey', text: dump.trim(), listId });
    }
  };

  return (
    <div
      className="ah-modal-layer"
      onPointerDown={(e) => {
        // Clicking outside without a title creates nothing.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="ah-modal ah-modal--task" role="dialog" aria-modal="true" aria-label={mode === 'task' ? 'New task' : 'Brain dump'}>
        <div className="ah-modal__head">
          <div className="ah-toggle" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'task'} className={mode === 'task' ? 'is-on' : ''} onClick={() => setMode('task')}>
              Task
            </button>
            <button type="button" role="tab" aria-selected={mode === 'brain'} className={mode === 'brain' ? 'is-on' : ''} onClick={() => setMode('brain')}>
              Brain dump
            </button>
          </div>
          <button
            type="button"
            className={`ah-iconbtn ah-voice${voice.on ? ' is-on' : ''}`}
            title="Voice input"
            aria-label="Voice input"
            onClick={() => {
              if (!voice.toggle()) hub.toast({ text: 'Voice input isn’t available in this browser' });
            }}
          >
            {I.mic}
          </button>
        </div>
        <div className="ah-modal__body">
          {mode === 'task' ? (
            <>
              <input ref={titleRef} className="ah-task-title" placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} aria-required />
              <textarea className="ah-task-desc" placeholder="Add a description" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
            </>
          ) : (
            <textarea
              autoFocus
              className="ah-task-desc ah-task-desc--dump"
              placeholder="What’s on your mind? Write it all down — Maisey will turn it into actions."
              value={dump}
              onChange={(e) => setDump(e.target.value)}
              rows={6}
            />
          )}
          <div className="ah-modal__props">
            <PeoplePick value={assignees} onChange={setAssignees} />
            <TagPick value={tags} onChange={setTags} />
            <button type="button" className="ah-prop" onClick={() => fileRef.current?.click()}>
              {I.attach} {files.length ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'Attach'}
            </button>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => setFiles([...files, ...[...(e.target.files ?? [])].map((f) => f.name)])} />
            <PriorityChip value={priority} onChange={setPriority} />
          </div>
        </div>
        <div className="ah-modal__foot">
          <ListPicker value={listId} onChange={setListId} />
          <span className="ah-spacer" />
          <button type="button" className="ah-btn" onClick={close}>
            Cancel
          </button>
          <button type="button" className="ah-btn ah-btn--primary" disabled={mode === 'task' ? !title.trim() : !dump.trim()} onClick={submit}>
            {mode === 'task' ? 'Add task' : 'Generate Actions'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** §6.3 Ask Maisey continuation: organizing → question card → plan → confirm. */
export function MaiseyFlow({ text, listId }: { text: string; listId: string }) {
  const hub = useHub();
  const [step, setStep] = useState<'thinking' | 'question' | 'plan' | 'done'>('thinking');
  const [hi, setHi] = useState(0);
  const [person, setPerson] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const plan = useMemo(() => {
    const parts = text
      .split(/[.\n;]|\band\b/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 3)
      .slice(0, 3);
    const tasks = (parts.length ? parts : [text]).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
    return { tasks: tasks.slice(0, 2), calendar: /meet|call|sync|review|tomorrow|friday|monday/i.test(text) ? 1 : 0, delegate: Math.max(0, tasks.length - 2) + (/report|send|share/i.test(text) ? 1 : 0) };
  }, [text]);
  const candidates = ['hayden', 'teresa'];

  useEffect(() => {
    if (step !== 'thinking') return;
    const t = window.setTimeout(() => setStep(/\bhayden|molnar|dave|teresa\b/i.test(text) ? 'question' : 'plan'), 1400);
    return () => window.clearTimeout(t);
  }, [step, text]);
  useEffect(() => {
    setHi(0);
    cardRef.current?.focus();
  }, [step]);

  const confirm = () => {
    plan.tasks.forEach((t, i) => hub.addTask({ title: t, listId, assignees: person ? [person] : [], weight: 300 - i }, { toast: false }));
    hub.setSummaryNote(`Added ${plan.tasks.length} ${plan.tasks.length === 1 ? 'task' : 'tasks'} from your brain dump${plan.calendar ? ', blocked time on your calendar' : ''}${plan.delegate ? ` and delegated ${plan.delegate} to Minions` : ''}.`);
    hub.toast({ text: `${plan.tasks.length} actions added to ${hub.listName(listId)}`, action: { label: 'Go to list', run: () => hub.setView({ kind: 'list', id: listId }) } });
    hub.setModal(null);
    hub.setView({ kind: 'all' });
  };

  const options = step === 'question' ? [...candidates.map((c) => PEOPLE[c].name), 'Create new contact'] : ['Confirm & Add', 'Review Details'];
  const choose = (i: number) => {
    if (step === 'question') {
      setPerson(i < candidates.length ? candidates[i] : null);
      setStep('plan');
    } else if (i === 0) confirm();
    else hub.setModal({ kind: 'newTask', mode: 'brain', listId });
  };

  return (
    <Modal
      className="ah-modal--maisey"
      onClose={() => hub.setModal(null)}
      title={
        <span className="ah-maisey-title">
          <img src={maiseyAvatar} alt="" /> Ask Maisey
        </span>
      }
    >
      <div className="ah-chat">
        <div className="ah-chat__user">{text}</div>
        {step === 'thinking' ? (
          <div className="ah-chat__status">
            <img src={maiseyAvatar} alt="" />
            <span className="ah-shimmer">Organizing your day...</span>
          </div>
        ) : (
          <>
            <div className="ah-chat__status">
              <img src={maiseyAvatar} alt="" /> Thought for 4 seconds
            </div>
            {step === 'plan' && (
              <div className="ah-chat__text">
                Here’s what I’ll create:
                <ul>
                  <li>
                    {plan.tasks.length} {plan.tasks.length === 1 ? 'task' : 'tasks'} for Action Hub ({hub.listName(listId)}){person && <> linked to {PEOPLE[person].name}</>}
                    <ul>
                      {plan.tasks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </li>
                  {plan.calendar > 0 && <li>1 calendar block</li>}
                  {plan.delegate > 0 && <li>{plan.delegate} Minion {plan.delegate === 1 ? 'delegation' : 'delegations'}</li>}
                </ul>
              </div>
            )}
            <div
              ref={cardRef}
              className="ah-qcard"
              tabIndex={0}
              role="listbox"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') (e.preventDefault(), setHi((h) => Math.min(options.length - 1, h + 1)));
                if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(0, h - 1)));
                if (e.key === 'Enter') (e.preventDefault(), choose(hi));
              }}
            >
              <div className="ah-qcard__head">
                <strong>{step === 'question' ? 'Which one should I link to this task?' : 'Confirm plan?'}</strong>
                {step === 'question' && <span>1 of 2</span>}
              </div>
              {options.map((o, i) => (
                <button key={o} type="button" role="option" aria-selected={hi === i} className={`ah-qopt${hi === i ? ' is-hi' : ''}`} onMouseEnter={() => setHi(i)} onClick={() => choose(i)}>
                  <span className="ah-qopt__n">{step === 'question' && i < candidates.length ? <Av id={candidates[i]} size={20} /> : i + 1}</span>
                  {o}
                  {hi === i && <span className="ah-qopt__key">↵</span>}
                </button>
              ))}
              <div className="ah-qopt ah-qopt--else">
                <span className="ah-qopt__n">{I.pencil}</span>
                <span>Something else</span>
                <button type="button" className="ah-btn ah-btn--sm" onClick={() => (step === 'question' ? (setPerson(null), setStep('plan')) : hub.setModal(null))}>
                  Skip
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** §6.4 icon/emoji picker. */
function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'icons' | 'emoji'>('icons');
  const [q, setQ] = useState('');
  const set = tab === 'icons' ? ICON_SET : EMOJI_SET;
  return (
    <span className="ah-chip-wrap">
      <button type="button" className="ah-iconpick" aria-label="Choose icon" onClick={() => setOpen((v) => !v)}>
        <ListIcon icon={value} size={22} />
      </button>
      {open && (
        <Pop className="ah-picker" onClose={() => setOpen(false)}>
          <div className="ah-toggle ah-toggle--sm">
            <button type="button" className={tab === 'icons' ? 'is-on' : ''} onClick={() => setTab('icons')}>
              Icons
            </button>
            <button type="button" className={tab === 'emoji' ? 'is-on' : ''} onClick={() => setTab('emoji')}>
              Emoji
            </button>
          </div>
          <input className="ah-pop__search" placeholder={tab === 'icons' ? 'Search icons' : 'Search emoji'} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="ah-picker__grid">
            {set
              .filter((x) => !q || x.includes(q) || (x === 'checklist' && 'checklist'.includes(q.toLowerCase())))
              .map((x) => (
                <button key={x} type="button" className={`ah-picker__opt${x === value ? ' is-on' : ''}`} onClick={() => (onChange(x), setOpen(false))}>
                  <ListIcon icon={x} size={20} />
                </button>
              ))}
          </div>
        </Pop>
      )}
    </span>
  );
}

/** §6.4 New list, §6.5 Edit list, §7.3 Create & Move. */
export function ListModal({ editId, moveItemIds }: { editId?: string; moveItemIds?: string[] }) {
  const hub = useHub();
  const existing = hub.lists.find((l) => l.id === editId);
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'checklist');
  const moving = moveItemIds?.length ? hub.items.find((i) => i.id === moveItemIds[0]) : null;
  const ok = name.trim().length > 0;
  const submit = () => {
    if (!ok) return;
    if (existing) {
      hub.updateList(existing.id, { name: name.trim(), icon });
      hub.setModal(null);
      return;
    }
    const id = hub.createList(name.trim(), icon);
    hub.setModal(null);
    if (moveItemIds?.length) hub.moveToList(moveItemIds, id, { navigate: true });
    else hub.setView({ kind: 'list', id });
  };
  return (
    <Modal
      title={existing ? 'Edit list' : 'New list'}
      onClose={() => hub.setModal(null)}
      footer={
        <>
          <span className="ah-spacer" />
          <button type="button" className="ah-btn" onClick={() => hub.setModal(null)}>
            Cancel
          </button>
          <button type="button" className="ah-btn ah-btn--primary" disabled={!ok} onClick={submit}>
            {existing ? 'Update' : moveItemIds?.length ? 'Create & Move' : 'Create'}
          </button>
        </>
      }
    >
      {moving && (
        <div className="ah-banner">
          Task <strong>{plain(moving.title)}</strong> will be moved to this list
        </div>
      )}
      <label className="ah-field">
        <span>List name</span>
        <div className="ah-field__row">
          <IconPicker value={icon} onChange={setIcon} />
          <input autoFocus maxLength={30} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="e.g. Marketing" />
          <span className="ah-field__count">{name.length}/30</span>
        </div>
      </label>
    </Modal>
  );
}

/** §6.5 Delete list: move open items elsewhere, or delete along with items. */
export function DeleteListModal({ listId }: { listId: string }) {
  const hub = useHub();
  const list = hub.lists.find((l) => l.id === listId);
  const others = hub.lists.filter((l) => l.id !== listId);
  const [target, setTarget] = useState(others[0]?.id ?? 'backlog');
  const [mode, setMode] = useState<'move' | 'delete'>('move');
  const open = hub.counts.list[listId] ?? 0;
  if (!list) return null;
  return (
    <Modal
      title={`Delete “${list.name}”?`}
      onClose={() => hub.setModal(null)}
      footer={
        <>
          <span className="ah-spacer" />
          <button type="button" className="ah-btn" onClick={() => hub.setModal(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="ah-btn ah-btn--danger"
            onClick={() => {
              hub.deleteList(listId, mode === 'move' ? target : null);
              hub.setModal(null);
              hub.toast({ text: `Deleted ${list.name}` });
            }}
          >
            Delete list
          </button>
        </>
      }
    >
      <p className="ah-text">This list has {open} open {open === 1 ? 'task' : 'tasks'}. What should happen to them?</p>
      <label className="ah-radio">
        <input type="radio" checked={mode === 'move'} onChange={() => setMode('move')} />
        Move open items to
        <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={mode !== 'move'}>
          {others.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label className="ah-radio">
        <input type="radio" checked={mode === 'delete'} onChange={() => setMode('delete')} />
        Delete the list permanently, with its items
      </label>
    </Modal>
  );
}

/** §7.2 Move to list. */
export function MoveModal({ itemIds }: { itemIds: string[] }) {
  const hub = useHub();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const first = hub.items.find((i) => i.id === itemIds[0]);
  const current = itemIds.length === 1 ? first?.listId : undefined;
  const lists = hub.lists.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()));
  const ordered = [...lists.filter((l) => l.id === current), ...lists.filter((l) => l.id !== current)];
  return (
    <Modal
      title="Move to list"
      onClose={() => hub.setModal(null)}
      footer={
        <>
          <button
            type="button"
            className="ah-btn ah-btn--ghost"
            onClick={() => (hub.canCreateList ? hub.setModal({ kind: 'newList', moveItemIds: itemIds }) : hub.toast({ text: 'You’ve reached 10 lists.' }))}
          >
            {I.plus} Create list
          </button>
          <span className="ah-spacer" />
          <button type="button" className="ah-btn" onClick={() => hub.setModal(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="ah-btn ah-btn--primary"
            disabled={!sel}
            onClick={() => {
              hub.moveToList(itemIds, sel!);
              hub.setModal(null);
              hub.setSelected([]);
            }}
          >
            Move to list
          </button>
        </>
      }
    >
      <div className="ah-banner">
        {itemIds.length === 1 ? (
          <>
            {first?.kind === 'task' ? 'Task' : 'Item'} <strong>{plain(first?.title)}</strong> will be moved
          </>
        ) : (
          <>{itemIds.length} items will be moved</>
        )}
      </div>
      <input className="ah-input" placeholder="Search lists" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="ah-movelist" role="listbox">
        {ordered.map((l) => {
          const isCur = l.id === current;
          return (
            <button key={l.id} type="button" role="option" aria-selected={sel === l.id} disabled={isCur} className={`ah-moverow${sel === l.id ? ' is-on' : ''}`} onClick={() => setSel(l.id)}>
              <ListIcon icon={l.icon} size={20} />
              <span>{l.name}</span>
              {isCur ? <em>Current list</em> : sel === l.id ? I.check : null}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

const YES = ['Right priority or order', 'Correct details', 'Caught something I’d have missed', 'Clear and easy to act on', 'Other'];
const NO = ['Wrong priority or order', 'Incorrect details', 'Not relevant to me', 'Hard to understand', 'Other'];

/** §5.2 Feedback card, bottom right. */
export function FeedbackCard() {
  const hub = useHub();
  const [vote, setVote] = useState<'yes' | 'no' | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [more, setMore] = useState('');
  if (!hub.feedbackFor) return null;
  const close = () => {
    hub.setFeedbackFor(null);
    setVote(null);
    setReasons([]);
    setMore('');
  };
  return (
    <div className="ah-feedback" role="dialog" aria-label="Give feedback">
      <strong>Was this helpful for you?</strong>
      <div className="ah-feedback__vote">
        <button type="button" className={`ah-btn${vote === 'yes' ? ' is-on' : ''}`} aria-pressed={vote === 'yes'} onClick={() => (setVote('yes'), setReasons([]))}>
          👍 Yes
        </button>
        <button type="button" className={`ah-btn${vote === 'no' ? ' is-on' : ''}`} aria-pressed={vote === 'no'} onClick={() => (setVote('no'), setReasons([]))}>
          👎 No
        </button>
      </div>
      {vote && (
        <>
          {(vote === 'yes' ? YES : NO).map((r) => (
            <label key={r} className="ah-checkrow">
              <input type="checkbox" checked={reasons.includes(r)} onChange={() => setReasons((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))} />
              {r}
            </label>
          ))}
          <textarea className="ah-input" rows={2} placeholder="Tell us more (Optional)" value={more} onChange={(e) => setMore(e.target.value)} />
        </>
      )}
      <div className="ah-feedback__foot">
        <button type="button" className="ah-btn" onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          className="ah-btn ah-btn--primary"
          disabled={!vote}
          onClick={() => {
            close();
            hub.toast({ text: 'Thanks for your feedback!' });
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

export function PriorityLegend() {
  return <PriorityIcon p={1} />;
}
