import { MaiseyOrb } from '../orb/MaiseyOrb';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { useHub } from './store';
import { ASSETS, PEOPLE, SNOOZE_OPTIONS, TAGS, canFeedback, canSnooze, type Item } from './model';
import { Av, I, MItem, Pop, Rich, plain } from './ui';
import report from './assets/report-vector.svg';
import reportMask from './assets/report-mask.svg';
import reportLayer from './assets/report-layer.svg';
import stickyNote from '../assets/launcher/placeholder.png';

/* §5 Action item types. One card, everywhere it appears. */

function MiniIcon({ kind }: { kind: 'report' | 'calendar' | 'note' | 'person' }) {
  if (kind === 'report')
    return (
      <span className="ah-mini__icon ah-mini__icon--report">
        <img src={report} alt="" />
        <span style={{ maskImage: `url(${reportMask})`, WebkitMaskImage: `url(${reportMask})` }}>
          <img src={reportLayer} alt="" />
        </span>
      </span>
    );
  if (kind === 'calendar') return <img className="ah-mini__icon" src={ASSETS.calendarIcon} alt="" />;
  return <img className="ah-mini__icon ah-mini__icon--note" src={stickyNote} alt="" />;
}

function useActions(item: Item) {
  const hub = useHub();
  const resolve = (msg: string) => {
    hub.patch(item.id, { done: true, doneDay: 0 });
    hub.toast({ text: msg, action: { label: 'Undo', run: () => hub.patch(item.id, { done: false, doneDay: undefined }) } });
  };
  return (label: string) => {
    switch (label) {
      case 'Approve':
        return resolve(`Approved · ${item.mini?.title ?? item.title}`);
      case 'Reject':
        return resolve(`Rejected · ${item.mini?.title ?? item.title}`);
      case '$12k':
      case '$15k':
        return resolve(`Marked ${label} as correct. Glazy will update the thread.`);
      case 'Remind me tomorrow':
        hub.snooze([item.id], 'Thu 9:00 AM');
        return hub.toast({ text: 'We’ll remind you tomorrow at 9:00 AM' });
      case 'Share Now':
        return resolve('Shared the doc with Dave');
      case 'Secure account':
        return resolve('Signed out the unrecognised device. Change your password next.');
      case 'It was me':
        return resolve('Thanks — marked this sign-in as yours');
      case 'Send now':
        return resolve('Draft sent to Dave');
      case 'Show tasks':
        hub.setView({ kind: 'list', id: 'backlog' });
        return hub.setQuery('Buy the app');
      case 'Take action':
        return resolve('Kept on your list');
      case 'Send a message':
      case 'Set a reminder':
        return resolve(label === 'Send a message' ? 'Opening Nexus with Pasindu…' : 'Reminder set for this Friday');
      default:
        return hub.toast({ text: `Opening ${item.mini?.title ?? item.title}…` });
    }
  };
}

function MiniCard({ item, run }: { item: Item; run: (a: string) => void }) {
  const m = item.mini!;
  const footer = item.kind === 'approval' || item.kind === 'suggestion' ? null : item.actions?.[0];
  return (
    <div className={`ah-mini${m.icon === 'person' ? ' is-person' : ''}`}>
      {m.icon === 'person' ? <img className="ah-mini__avatar" src={m.avatar} alt="" /> : <MiniIcon kind={m.icon} />}
      <div className="ah-mini__text">
        {m.icon === 'person' ? (
          <>
            <div className="ah-mini__head">
              <strong>{m.title}</strong>
              {m.ago && <span className="ah-ago">{m.ago}</span>}
            </div>
            <p>
              <Rich text={m.text} />
            </p>
          </>
        ) : (
          <>
            {m.ago && <span className="ah-ago">{m.ago}</span>}
            <strong>{m.title}</strong>
          </>
        )}
      </div>
      {m.icon !== 'person' && (
        <button type="button" className="ah-pill-btn" onClick={(e) => (e.stopPropagation(), run(footer ?? 'Open'))}>
          {footer ?? 'Open'}
        </button>
      )}
      {m.icon === 'person' && item.kind === 'meeting' && (
        <button type="button" className="ah-pill-btn" onClick={(e) => (e.stopPropagation(), run('View'))}>
          View
        </button>
      )}
    </div>
  );
}

function Stamp({ item }: { item: Item }) {
  return (
    <span className="ah-stamp">
      {item.snoozedUntil && (
        <span className="ah-stamp__snooze" title={`Snoozed till ${item.snoozedUntil}`} aria-label={`Snoozed till ${item.snoozedUntil}`}>
          {I.alarm}
        </span>
      )}
      {item.liveDot && !item.done && <span className="ah-dot" aria-hidden />}
      <span className="ah-ago">{item.ago}</span>
    </span>
  );
}

function Visual({ item }: { item: Item }) {
  switch (item.visual) {
    case 'alert':
      return <span className="ah-vis ah-vis--alert">{I.warning}</span>;
    case 'app':
      return <img className="ah-vis ah-vis--app" src={item.avatar} alt="" />;
    case 'people':
      return (
        <span className="ah-vis ah-vis--people" aria-hidden>
          <img src={ASSETS.dazy} alt="" />
          <img src={ASSETS.teal} alt="" />
          <img src={PEOPLE.hayden.avatar} alt="" />
        </span>
      );
    case 'minion':
      return (
        <span className="ah-vis ah-vis--minion">
          <img src={item.avatar} alt="" />
          {item.kind === 'completion' && <img className="ah-vis__badge" src={ASSETS.meetIcon} alt="" />}
        </span>
      );
    default:
      return null;
  }
}

function TaskMeta({ item }: { item: Item }) {
  const a = item.assignees[0];
  const t = item.tags[0];
  if (!a && !t) return null;
  return (
    <div className="ah-meta">
      {a && (
        <span className="ah-meta__who">
          <Av id={a} size={18} />
          {PEOPLE[a]?.name}
          {item.assignees.length > 1 && <em>+{item.assignees.length - 1}</em>}
        </span>
      )}
      {t && (
        <span className="ah-meta__tag">
          <span className="ah-tagdot" style={{ background: TAGS[t]?.color }} />
          {TAGS[t]?.name}
        </span>
      )}
      {item.comments.some((c) => c.unread) && <span className="ah-unread" title="Unread comment" />}
    </div>
  );
}

/** Card body only (no completion circle). */
export function ItemBody({ item }: { item: Item }) {
  const run = useActions(item);
  const actionsFooter =
    item.actions && (item.kind === 'approval' || item.kind === 'suggestion' || item.kind === 'conflict' || item.kind === 'alert') ? item.actions : null;

  if (item.kind === 'task') {
    return (
      <div className={`ah-card ah-card--task${item.done ? ' is-done' : ''}`}>
        <div className="ah-card__head">
          <strong className="ah-title">{item.title}</strong>
          <Stamp item={item} />
        </div>
        {item.body && <p className="ah-sub">{item.body}</p>}
        <TaskMeta item={item} />
      </div>
    );
  }

  if (item.kind === 'celebration') {
    return (
      <div className="ah-card ah-card--celebrate">
        <span className="ah-confetti" aria-hidden>
          <img src={ASSETS.teal} alt="" className="ah-confetti__balloon" />
          <img src={ASSETS.confetti} alt="" className="ah-confetti__bits" />
        </span>
        <div className="ah-card__col">
          <strong className="ah-title">{item.title}</strong>
          <p className="ah-sub">{item.body}</p>
          {item.actions?.map((a) => (
            <button key={a} type="button" className="ah-pill-btn ah-pill-btn--outline" onClick={(e) => (e.stopPropagation(), run(a))}>
              {a}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (item.kind === 'suggestion') {
    return (
      <div className="ah-card ah-card--glass ah-card--suggestion">
        <div className="ah-card__head">
          <span className="ah-sugg-label">
            <MaiseyOrb size={24} /> SUGGESTIONS
          </span>
          <Stamp item={item} />
        </div>
        <p className="ah-sugg-title">
          <Rich text={item.title} />
        </p>
        {item.mini && <MiniCard item={item} run={run} />}
        {actionsFooter && <Footer actions={actionsFooter} run={run} />}
      </div>
    );
  }

  return (
    <div className={`ah-card ah-card--glass ah-card--${item.kind}${item.critical ? ' is-critical' : ''}`}>
      <div className="ah-card__row">
        <Visual item={item} />
        <div className="ah-card__col">
          <div className="ah-card__head">
            <strong className="ah-title">{item.title}</strong>
            <Stamp item={item} />
          </div>
          {item.label && (
            <span className={`ah-label ah-label--${item.label.toLowerCase()}`}>
              {item.label === 'Approval' ? I.task : I.warning} {item.label}
            </span>
          )}
          {item.body && (
            <p className="ah-sub">
              <Rich text={item.body} />
            </p>
          )}
        </div>
      </div>
      {item.mini && (
        <div className="ah-card__mini">
          <MiniCard item={item} run={run} />
          {item.kind === 'approval' && actionsFooter && <Footer actions={actionsFooter} run={run} attached />}
        </div>
      )}
      {actionsFooter && !(item.mini && item.kind === 'approval') && <Footer actions={actionsFooter} run={run} />}
    </div>
  );
}

function Footer({ actions, run, attached }: { actions: string[]; run: (a: string) => void; attached?: boolean }) {
  return (
    <div className={`ah-foot${attached ? ' is-attached' : ''}`}>
      {actions.map((a, i) => (
        <button key={a} type="button" className={`ah-foot__btn${i === actions.length - 1 ? ' is-primary' : ''}`} onClick={(e) => (e.stopPropagation(), run(a))}>
          {a}
        </button>
      ))}
    </div>
  );
}

/** Completion circle: red for critical / High (§4.1); priority colours for tasks. */
export function Circle({ item, selecting, selected, onToggle }: { item: Item; selecting?: boolean; selected?: boolean; onToggle: () => void }) {
  if (selecting)
    return (
      <button type="button" role="checkbox" aria-checked={!!selected} className={`ah-check${selected ? ' is-on' : ''}`} onClick={(e) => (e.stopPropagation(), onToggle())} aria-label={`Select ${plain(item.title)}`}>
        {selected && I.check}
      </button>
    );
  const tone = item.critical || item.priority === 1 ? 'red' : item.priority === 2 ? 'orange' : item.priority === 3 ? 'blue' : 'none';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={item.done}
      aria-label={`${item.done ? 'Mark not done' : 'Mark done'}: ${plain(item.title)}`}
      className={`ah-circle is-${tone}${item.done ? ' is-done' : ''}`}
      onClick={(e) => (e.stopPropagation(), onToggle())}
    >
      {item.done && I.check}
    </button>
  );
}

/** Hover tools: snooze above "...", per §5.1 / §7.1. */
function Tools({ item }: { item: Item }) {
  const hub = useHub();
  const [menu, setMenu] = useState<'snooze' | 'more' | null>(null);
  const snoozable = canSnooze(item) && item.kind !== 'celebration' && !item.done;
  return (
    <div className={`ah-tools${menu ? ' is-open' : ''}`} onClick={(e) => e.stopPropagation()}>
      {snoozable && (
        <button type="button" className="ah-tool" title="Snooze" aria-label="Snooze" onClick={() => setMenu(menu === 'snooze' ? null : 'snooze')}>
          {I.alarm}
        </button>
      )}
      {item.kind === 'task' && (
        <button type="button" className="ah-tool" title="Comments" aria-label="Comments" onClick={() => hub.setDetailId(item.id)}>
          {I.comment}
        </button>
      )}
      <button type="button" className="ah-tool" title="More" aria-label="More actions" onClick={() => setMenu(menu === 'more' ? null : 'more')}>
        {I.more}
      </button>
      {menu === 'snooze' && (
        <Pop className="ah-snooze" onClose={() => setMenu(null)}>
          <div className="ah-pop__label">Snooze for</div>
          {SNOOZE_OPTIONS.map((o) => (
            <MItem
              key={o.id}
              right={o.at}
              onClick={() => {
                hub.snooze([item.id], o.at);
                setMenu(null);
              }}
            >
              {o.label}
            </MItem>
          ))}
          {item.snoozedUntil && (
            <MItem
              danger
              onClick={() => {
                hub.snooze([item.id], undefined);
                setMenu(null);
              }}
            >
              Clear snooze
            </MItem>
          )}
        </Pop>
      )}
      {menu === 'more' && (
        <Pop className="ah-more" onClose={() => setMenu(null)}>
          {(item.kind === 'task' || item.kind === 'approval') && (
            <MItem icon={I.move} onClick={() => (setMenu(null), hub.setModal({ kind: 'move', itemIds: [item.id] }))}>
              Move to list
            </MItem>
          )}
          {item.kind === 'task' && (
            <MItem icon={I.task} onClick={() => (setMenu(null), hub.toggleDone(item.id))}>
              {item.done ? 'Mark as not done' : 'Mark as done'}
            </MItem>
          )}
          {canFeedback(item) && (
            <MItem icon={I.comment} onClick={() => (setMenu(null), hub.setFeedbackFor(item.id))}>
              Give feedback
            </MItem>
          )}
          {item.kind === 'task' && (
            <MItem danger icon={I.trash} onClick={() => (setMenu(null), hub.trash([item.id]))}>
              Move to Trash
            </MItem>
          )}
        </Pop>
      )}
    </div>
  );
}

/** A row on a section page or list view: completion circle + card + hover tools. */
export function Row({ item, showActions = true }: { item: Item; showActions?: boolean }) {
  const hub = useHub();
  const sel = hub.selected.includes(item.id);
  const toggleSel = () => hub.setSelected((s) => (s.includes(item.id) ? s.filter((x) => x !== item.id) : [...s, item.id]));
  const onClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    if (hub.selecting) return toggleSel();
    if (item.kind === 'task') hub.setDetailId(item.id);
  };
  const noCircle = item.kind === 'celebration';
  return (
    <div className={`ah-row${item.done ? ' is-done' : ''}${sel ? ' is-selected' : ''}${item.kind === 'task' ? ' is-task' : ''}`} onClick={onClick} data-item={item.id}>
      <div className="ah-row__circle">{!noCircle && <Circle item={item} selecting={hub.selecting} selected={sel} onToggle={hub.selecting ? toggleSel : () => hub.toggleDone(item.id)} />}</div>
      <div className="ah-row__card">
        {showActions || item.kind === 'task' ? <ItemBody item={item} /> : <ItemBody item={{ ...item, actions: undefined, mini: item.mini && { ...item.mini } }} />}
        {!hub.selecting && <Tools item={item} />}
      </div>
    </div>
  );
}

/** §5 Stacks: on the All feed a section with several items shows edge cards beneath. */
export function Deck({ items, onOpen, children }: { items: Item[]; onOpen: () => void; children?: ReactNode }) {
  const hub = useHub();
  const top = items[0];
  const multi = items.length > 1;
  const onClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    if (multi) onOpen();
    else if (top.kind === 'task') hub.setDetailId(top.id);
  };
  return (
    <div className={`ah-deck${multi ? ' is-stacked' : ''}`} onClick={onClick} role={multi ? 'link' : undefined} aria-label={multi ? 'Open section' : undefined}>
      {multi && <span className="ah-deck__edge ah-deck__edge--1" aria-hidden />}
      {multi && items.length > 2 && <span className="ah-deck__edge ah-deck__edge--2" aria-hidden />}
      <div className="ah-deck__top">
        <ItemBody item={top} />
      </div>
      {children}
    </div>
  );
}
