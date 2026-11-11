import { useMemo, useState, type ReactNode } from 'react';
import { useHub, type Chip } from './store';
import { SECTIONS, SNOOZE_OPTIONS, dayParts, isOpen, type Item, type Section } from './model';
import { Deck, Row } from './Cards';
import { I, ListIcon, MItem, Pop, plain } from './ui';
import maiseyAvatar from '../assets/dock/a156c.png';

const CHIP_DEFS: { chip: Chip; label: string }[] = [
  { chip: 'Task', label: 'Tasks' },
  { chip: 'Reminder', label: 'Reminders' },
  { chip: 'Mention', label: 'Mentions' },
  { chip: 'Minion', label: 'Actions' },
];
const OVERFLOW: { chip: Chip; label: string }[] = [
  { chip: 'Alert', label: 'Alerts' },
  { chip: 'Other', label: 'Notifications' },
];

/** Sorted by Priority: critical first, then weight; snoozed items move below the others (§5.1). */
function sortItems(items: Item[], sort: 'priority' | 'date') {
  return [...items].sort((a, b) => {
    const sa = a.snoozedUntil ? 1 : 0;
    const sb = b.snoozedUntil ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (sort === 'priority') {
      const ca = a.critical ? 1 : 0;
      const cb = b.critical ? 1 : 0;
      if (ca !== cb) return cb - ca;
      const pa = a.priority || 4;
      const pb = b.priority || 4;
      if (a.kind === 'task' && b.kind === 'task' && pa !== pb) return pa - pb;
    }
    return b.weight - a.weight;
  });
}

function applyChips(items: Item[], chips: Chip[], apps: string[]) {
  let out = items;
  if (chips.length) {
    out = out.filter((i) => chips.some((c) => (c === 'Snoozed' ? !!i.snoozedUntil : c === i.typeTag)));
  }
  if (apps.length) out = out.filter((i) => i.app && apps.includes(i.app));
  return out;
}

function matches(i: Item, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [i.title, i.body, i.description, i.mini?.title, i.mini?.text].some((x) => x && plain(x).toLowerCase().includes(s));
}

// ───────────────── header ─────────────────

export function Header() {
  const hub = useHub();
  const { view } = hub;
  const [listMenu, setListMenu] = useState(false);
  let title: ReactNode = 'Good morning!';
  if (view.kind === 'section') title = SECTIONS.find((s) => s.id === view.id)!.label;
  if (view.kind === 'list') {
    const l = hub.lists.find((x) => x.id === view.id);
    title = (
      <span className="ah-head__list">
        <ListIcon icon={l?.icon ?? 'checklist'} size={24} />
        {l?.name}
        <button type="button" className="ah-head__edit" title="Edit list" aria-label="Edit list" onClick={() => hub.setModal({ kind: 'editList', listId: view.id })}>
          {I.pencil}
        </button>
        <span className="ah-head__menu-wrap">
          <button type="button" className="ah-head__edit" aria-label="List options" onClick={() => setListMenu((v) => !v)}>
            {I.vmore}
          </button>
          {listMenu && (
            <Pop className="ah-list-menu" onClose={() => setListMenu(false)}>
              <MItem icon={I.pencil} onClick={() => (setListMenu(false), hub.setModal({ kind: 'editList', listId: view.id }))}>
                Edit list
              </MItem>
              <MItem
                danger
                icon={I.trash}
                disabled={view.id === 'backlog'}
                onClick={() => (setListMenu(false), hub.setModal({ kind: 'deleteList', listId: view.id }))}
              >
                {view.id === 'backlog' ? 'Backlog can’t be deleted' : 'Delete list'}
              </MItem>
            </Pop>
          )}
        </span>
      </span>
    );
  }
  return (
    <header className="ah-head">
      <div key={JSON.stringify(view)} className="ah-head__title">
        {view.kind === 'section' && (
          <button type="button" className="ah-back" aria-label="Back to All" onClick={() => hub.setView({ kind: 'all' })}>
            {I.back}
          </button>
        )}
        <h1>{title}</h1>
      </div>
      <label className="ah-search">
        {I.search}
        <input value={hub.query} onChange={(e) => hub.setQuery(e.target.value)} placeholder="Search Action Hub" aria-label="Find in Action Hub" />
        {hub.query && (
          <button type="button" aria-label="Clear search" onClick={() => hub.setQuery('')}>
            {I.close}
          </button>
        )}
      </label>
    </header>
  );
}

// ───────────────── toolbar (filters / select / sort) ─────────────────

function Toolbar({ withSnoozed, apps, appFilter, setAppFilter, visibleIds }: { withSnoozed: boolean; apps: string[]; appFilter: string[]; setAppFilter: (a: string[]) => void; visibleIds: string[] }) {
  const hub = useHub();
  const [appsOpen, setAppsOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [bulk, setBulk] = useState<'snooze' | null>(null);
  const toggle = (c: Chip) => hub.setChips((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const sel = hub.selected;
  const selItems = hub.items.filter((i) => sel.includes(i.id));
  const anyTasks = selItems.some((i) => i.kind === 'task');
  const moveable = selItems.filter((i) => i.kind === 'task' || i.kind === 'approval');

  return (
    <div className="ah-toolbar">
      {sel.length > 0 ? (
        <div className="ah-chips" role="toolbar" aria-label="Bulk actions">
          <button type="button" className="ah-chip" onClick={() => (selItems.forEach((i) => !i.done && hub.toggleDone(i.id)), hub.setSelected([]))}>
            {I.task} Mark as done
          </button>
          <span className="ah-chip-wrap">
            <button type="button" className="ah-chip" onClick={() => setBulk(bulk ? null : 'snooze')} disabled={selItems.every((i) => i.critical)}>
              {I.alarm} Snooze
            </button>
            {bulk === 'snooze' && (
              <Pop className="ah-snooze" onClose={() => setBulk(null)}>
                <div className="ah-pop__label">Snooze for</div>
                {SNOOZE_OPTIONS.map((o) => (
                  <MItem
                    key={o.id}
                    right={o.at}
                    onClick={() => {
                      hub.snooze(
                        selItems.filter((i) => !i.critical).map((i) => i.id),
                        o.at,
                      );
                      setBulk(null);
                      hub.setSelected([]);
                    }}
                  >
                    {o.label}
                  </MItem>
                ))}
              </Pop>
            )}
          </span>
          {moveable.length > 0 && (
            <button type="button" className="ah-chip" onClick={() => hub.setModal({ kind: 'move', itemIds: moveable.map((i) => i.id) })}>
              {I.move} Move to list
            </button>
          )}
          {anyTasks && (
            <button type="button" className="ah-chip ah-chip--danger" onClick={() => (hub.trash(sel), hub.setSelected([]))}>
              {I.trash} Move to Trash
            </button>
          )}
        </div>
      ) : (
        <div className="ah-chips" role="toolbar" aria-label="Filters">
          {CHIP_DEFS.map((c) => (
            <button key={c.chip} type="button" aria-pressed={hub.chips.includes(c.chip)} className={`ah-chip${hub.chips.includes(c.chip) ? ' is-on' : ''}`} onClick={() => toggle(c.chip)}>
              {c.label}
            </button>
          ))}
          <span className="ah-chip-wrap">
            <button type="button" aria-expanded={appsOpen} className={`ah-chip${appFilter.length ? ' is-on' : ''}`} onClick={() => setAppsOpen((v) => !v)}>
              Apps{appFilter.length ? ` · ${appFilter.length}` : ''} {I.chevron}
            </button>
            {appsOpen && (
              <Pop className="ah-apps-menu" onClose={() => setAppsOpen(false)}>
                {apps.length === 0 && <div className="ah-pop__label">No apps in this view</div>}
                {apps.map((a) => (
                  <MItem key={a} right={appFilter.includes(a) ? '✓' : undefined} onClick={() => setAppFilter(appFilter.includes(a) ? appFilter.filter((x) => x !== a) : [...appFilter, a])}>
                    {a}
                  </MItem>
                ))}
              </Pop>
            )}
          </span>
          {withSnoozed && (
            <button type="button" aria-pressed={hub.chips.includes('Snoozed')} className={`ah-chip${hub.chips.includes('Snoozed') ? ' is-on' : ''}`} onClick={() => toggle('Snoozed')}>
              Snoozed
            </button>
          )}
          <span className="ah-chip-wrap">
            <button type="button" className={`ah-chip${OVERFLOW.some((o) => hub.chips.includes(o.chip)) ? ' is-on' : ''}`} onClick={() => setMore((v) => !v)}>
              +{OVERFLOW.length} {I.chevron}
            </button>
            {more && (
              <Pop className="ah-apps-menu" onClose={() => setMore(false)}>
                {OVERFLOW.map((o) => (
                  <MItem key={o.chip} right={hub.chips.includes(o.chip) ? '✓' : undefined} onClick={() => toggle(o.chip)}>
                    {o.label}
                  </MItem>
                ))}
              </Pop>
            )}
          </span>
        </div>
      )}
      <div className="ah-toolbar__right">
        {hub.selecting ? (
          sel.length > 0 ? (
            <span className="ah-selected">
              {sel.length} Selected
              <button type="button" aria-label="Clear selection" onClick={() => hub.setSelected([])}>
                {I.close}
              </button>
            </span>
          ) : (
            <>
              <button type="button" className="ah-tbtn" onClick={() => hub.setSelected(visibleIds)}>
                Select all
              </button>
              <button type="button" className="ah-tbtn" onClick={() => hub.setSelecting(false)}>
                Done
              </button>
            </>
          )
        ) : (
          <button type="button" className="ah-tbtn" onClick={() => hub.setSelecting(true)}>
            Select
          </button>
        )}
        <span className="ah-chip-wrap">
          <button type="button" className="ah-tbtn" onClick={() => setSortOpen((v) => !v)} aria-haspopup="menu">
            {I.sort} Sorted by {hub.sort === 'priority' ? 'Priority' : 'Date'} {I.chevron}
          </button>
          {sortOpen && (
            <Pop className="ah-sort-menu" onClose={() => setSortOpen(false)}>
              <MItem right={hub.sort === 'priority' ? '✓' : undefined} onClick={() => (hub.setSort('priority'), setSortOpen(false))}>
                Priority
              </MItem>
              <MItem right={hub.sort === 'date' ? '✓' : undefined} onClick={() => (hub.setSort('date'), setSortOpen(false))}>
                Date
              </MItem>
            </Pop>
          )}
        </span>
      </div>
    </div>
  );
}

// ───────────────── date-grouped list (section & list views) ─────────────────

function CompletedPill({ items, label }: { items: Item[]; label: string }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="ah-completed">
      <button type="button" className="ah-countpill" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="ah-countpill__n">{items.length}</span>
        {label}
      </button>
      {open && (
        <div className="ah-completed__list">
          {items.map((i) => (
            <Row key={i.id} item={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayGroups({ items, rightNow }: { items: Item[]; rightNow?: boolean }) {
  const hub = useHub();
  const days = [...new Set(items.map((i) => i.day))].sort((a, b) => b - a);
  const today = items.filter((i) => i.day === 0);
  return (
    <div className="ah-days">
      {days.map((d) => {
        const dayItems = items.filter((i) => i.day === d);
        const open = sortItems(
          dayItems.filter((i) => !i.done),
          hub.sort,
        );
        const done = dayItems.filter((i) => i.done);
        return (
          <section key={d} className="ah-day">
            <h3 className="ah-day__head">
              {dayParts(d).map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="ah-sep" aria-hidden />}
                  {p}
                </span>
              ))}
            </h3>
            <div className="ah-day__rows">
              {open.map((i) => (
                <Row key={i.id} item={i} />
              ))}
            </div>
            {/* §9: completed items sit in a pill under their date block; today's go to "Earlier today". */}
            {d !== 0 && <CompletedPill items={done} label="Completed items" />}
          </section>
        );
      })}
      {(rightNow || days.includes(0)) && <CompletedPill items={today.filter((i) => i.done)} label="Earlier today" />}
    </div>
  );
}

function CaughtUp() {
  const hub = useHub();
  return (
    <div className="ah-empty">
      <div className="ah-empty__art" aria-hidden>
        ☕️
      </div>
      <strong>You’re all caught up!</strong>
      <p>Take a well-deserved break, or get a head start on your next big idea.</p>
      <button type="button" className="ah-btn ah-btn--primary" onClick={() => hub.setModal({ kind: 'newTask', mode: 'task' })}>
        Create a task
      </button>
    </div>
  );
}

function EmptyList({ listId }: { listId: string }) {
  const hub = useHub();
  return (
    <div className="ah-empty">
      <div className="ah-empty__art" aria-hidden>
        🗒️
      </div>
      <strong>No items here yet</strong>
      <p>Start building your list by adding tasks.</p>
      <button type="button" className="ah-btn ah-btn--primary" onClick={() => hub.setModal({ kind: 'newTask', mode: 'task', listId })}>
        Create a task
      </button>
    </div>
  );
}

export function SectionView({ id }: { id: Section }) {
  const hub = useHub();
  const [appFilter, setAppFilter] = useState<string[]>([]);
  const all = hub.items.filter((i) => !i.trashed && i.section === id && matches(i, hub.query));
  const apps = [...new Set(all.map((i) => i.app).filter(Boolean) as string[])];
  const filtered = applyChips(all, hub.chips, appFilter);
  const open = filtered.filter((i) => !i.done);
  const caughtUp = !hub.query && !hub.chips.length && all.every((i) => i.done) && (id === 'needsYou' || id === 'rightNow');
  return (
    <>
      <Toolbar withSnoozed apps={apps} appFilter={appFilter} setAppFilter={setAppFilter} visibleIds={open.map((i) => i.id)} />
      <div className="ah-scroll">{caughtUp ? <CaughtUp /> : filtered.length ? <DayGroups items={filtered} rightNow={id === 'rightNow'} /> : <p className="ah-none">Nothing matches these filters.</p>}</div>
    </>
  );
}

export function ListView({ id }: { id: string }) {
  const hub = useHub();
  const [appFilter, setAppFilter] = useState<string[]>([]);
  const all = hub.items.filter((i) => !i.trashed && i.listId === id && matches(i, hub.query));
  const apps = [...new Set(all.map((i) => i.app).filter(Boolean) as string[])];
  const filtered = applyChips(all, hub.chips, appFilter);
  return (
    <>
      <Toolbar withSnoozed={false} apps={apps} appFilter={appFilter} setAppFilter={setAppFilter} visibleIds={filtered.filter((i) => !i.done).map((i) => i.id)} />
      <div className="ah-scroll">{!all.length && !hub.query ? <EmptyList listId={id} /> : filtered.length ? <DayGroups items={filtered} /> : <p className="ah-none">Nothing matches these filters.</p>}</div>
    </>
  );
}

/** §4.1 All feed: one stacked deck per section; headings navigate. */
export function AllFeed() {
  const hub = useHub();
  const open = hub.items.filter((i) => isOpen(i) && i.section && matches(i, hub.query));
  const earlier = hub.items.filter((i) => !i.trashed && i.done && i.day === 0 && i.section === 'rightNow');
  if (!open.length && !hub.query) return <div className="ah-scroll"><CaughtUp /></div>;
  return (
    <div className="ah-scroll ah-scroll--all">
      {SECTIONS.map((s) => {
        const items = sortItems(
          open.filter((i) => i.section === s.id),
          'priority',
        );
        if (!items.length) return null;
        return (
          <section key={s.id} className="ah-feed">
            <button type="button" className="ah-feed__head" onClick={() => hub.setView({ kind: 'section', id: s.id })}>
              {s.label}
              <span className="ah-sep" aria-hidden />
              {items.length}
            </button>
            <Deck items={items} onOpen={() => hub.setView({ kind: 'section', id: s.id })} />
            {s.id === 'rightNow' && earlier.length > 0 && (
              <div className="ah-feed__pill">
                <button type="button" className="ah-countpill" onClick={() => hub.setView({ kind: 'section', id: 'rightNow' })}>
                  <span className="ah-countpill__n">{earlier.length}</span>
                  Earlier Today
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ───────────────── Maisey Summary (§2) ─────────────────

export function Summary() {
  const hub = useHub();
  const [menu, setMenu] = useState(false);
  const [hidden, setHidden] = useState(false);
  const text = useMemo(() => {
    const open = hub.items.filter(isOpen);
    const high = open.filter((i) => i.kind === 'task' && i.priority === 1);
    const from = [...new Set(high.flatMap((h) => h.assignees.slice(0, 1)))].map((id) => id.charAt(0).toUpperCase() + id.slice(1));
    const decisions = open.filter((i) => i.section === 'needsYou' && i.kind !== 'task').length;
    const quick = open.filter((i) => i.kind !== 'task').length;
    return {
      lead:
        quick * 2 > open.length
          ? 'The day is front-loaded with heavy analytical and presentation work, but over half the items are quick communication checks or 1-click system automations.'
          : 'Most of today is focused task work; only a few items need a quick reply or a 1-click decision.',
      high: high.length ? `You have ${high.length} High priority ${high.length === 1 ? 'task' : 'tasks'}${from.length ? ` from ${from.join(' and ')}` : ''}.` : 'No High priority tasks are waiting.',
      decisions: decisions ? `${decisions} ${decisions === 1 ? 'decision is' : 'decisions are'} waiting on you.` : null,
    };
  }, [hub.items]);
  if (hidden)
    return (
      <aside className="ah-summary ah-summary--hidden">
        <button type="button" className="ah-tbtn" onClick={() => setHidden(false)}>
          Show summary
        </button>
      </aside>
    );
  return (
    <aside className="ah-summary" aria-label="Maisey Summary">
      <img className="ah-summary__avatar" src={maiseyAvatar} alt="" />
      <div className="ah-summary__head">
        MAISEY SUMMARY
        <span className="ah-chip-wrap">
          <button type="button" className="ah-summary__menu" aria-label="Summary options" onClick={() => setMenu((v) => !v)}>
            {I.vmore}
          </button>
          {menu && (
            <Pop className="ah-sum-menu" onClose={() => setMenu(false)}>
              <MItem onClick={() => (setMenu(false), hub.setFeedbackFor('summary'))}>Give feedback</MItem>
              <MItem onClick={() => (setMenu(false), setHidden(true))}>Hide summary</MItem>
            </Pop>
          )}
        </span>
      </div>
      <p>{text.lead}</p>
      <p>{text.high}</p>
      {text.decisions && <p>{text.decisions}</p>}
      {hub.summaryNote && <p className="ah-summary__note">{hub.summaryNote}</p>}
    </aside>
  );
}
