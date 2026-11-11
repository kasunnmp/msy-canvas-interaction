import { useMemo, useRef, useState } from 'react';
import { useReporting } from '../state/store';
import type { Access, Person, ReportCard } from '../model/types';
import { ME, PEOPLE_DIRECTORY, SOURCES, TEMPLATES, createSampleReports } from '../model/sampleReports';
import { relativeTime } from '../model/export';
import { Avatar, Icon, Menu, MenuItem, Modal, StazyAvatar } from './common';
import avatarFallback from '../assets/avatar-c.png';

const ORG_DOMAIN = 'maisey.health';
const ORG_NAME = 'Maisey';

function AccessDropdown({ person, canEdit, onChange }: { person: Person; canEdit: boolean; onChange: (a: Access | 'remove') => void }) {
  const [open, setOpen] = useState(false);
  if (person.access === 'Owner') return <span className="r-badge">Owner</span>;
  if (!canEdit) return <span className="rm-access-static">{person.access}</span>;
  const options: (Access | 'remove')[] = person.external ? ['Viewer', 'remove'] : ['Viewer', 'Editor', 'remove'];
  return (
    <div className="rm-access">
      <button type="button" className="rm-access__btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {person.access} {Icon.chevron}
      </button>
      {open && (
        <Menu className="rm-access__menu" onClose={() => setOpen(false)}>
          {options.map((o) => (
            <MenuItem
              key={o}
              danger={o === 'remove'}
              onClick={() => {
                setOpen(false);
                onChange(o);
              }}
              right={o === person.access ? <span className="r-menu__check">✓</span> : undefined}
            >
              {o === 'remove' ? 'Remove access' : o}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
  );
}

function usePeopleEditing(card: ReportCard) {
  const { dispatch } = useReporting();
  const [confirm, setConfirm] = useState<Person | null>(null);
  const change = (p: Person, a: Access | 'remove') => {
    if (a === 'remove') {
      setConfirm(p); // removing access asks for confirmation; Editor → Viewer does not
      return;
    }
    dispatch({ type: 'updateReport', id: card.id, patch: { sharing: card.sharing.map((x) => (x.id === p.id ? { ...x, access: a } : x)) } });
  };
  const confirmRemove = () => {
    if (!confirm) return;
    dispatch({ type: 'updateReport', id: card.id, patch: { sharing: card.sharing.filter((x) => x.id !== confirm.id) } });
    setConfirm(null);
  };
  const confirmEl = confirm && (
    <div className="rm-confirm" role="alertdialog" aria-label="Remove access">
      <p>
        Remove access for <strong>{confirm.name}</strong>?
      </p>
      <div className="rm-confirm__actions">
        <button type="button" className="r-btn r-btn--ghost" onClick={() => setConfirm(null)}>
          Cancel
        </button>
        <button type="button" className="r-btn r-btn--danger" onClick={confirmRemove}>
          Remove access
        </button>
      </div>
    </div>
  );
  return { change, confirmEl };
}

/** §4.1 The share modal — the one share surface for Share, Add People and the avatar stack. */
export function ShareModal({ card }: { card: ReportCard }) {
  const { dispatch, toast } = useReporting();
  const canManage = card.role === 'owner';
  const canAdd = card.role !== 'viewer';
  const [q, setQ] = useState('');
  const [pending, setPending] = useState<Person[]>([]);
  const [notify, setNotify] = useState(true);
  const [linkMenu, setLinkMenu] = useState(false);
  const { change, confirmEl } = usePeopleEditing(card);

  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const taken = new Set([...card.sharing, ...pending].map((p) => p.id));
    const matches = PEOPLE_DIRECTORY.filter((p) => !taken.has(p.id) && p.name.toLowerCase().includes(s));
    const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
    if (isEmail && !taken.has(s)) {
      const external = !s.endsWith(`@${ORG_DOMAIN}`);
      matches.push({ id: s, name: s, avatar: avatarFallback, access: 'Viewer', external });
    }
    return matches.slice(0, 5);
  }, [q, card.sharing, pending]);

  const add = () => {
    if (!pending.length) return;
    dispatch({ type: 'updateReport', id: card.id, patch: { sharing: [...card.sharing, ...pending] } });
    const ext = pending.filter((p) => p.external).length;
    toast({ kind: 'success', text: `${notify ? 'Shared and notified' : 'Shared with'} ${pending.length} ${pending.length === 1 ? 'person' : 'people'}${ext ? ` (${ext} outside ${ORG_NAME}, view-only)` : ''}` });
    setPending([]);
    setQ('');
  };

  return (
    <Modal title={<>Share “{card.name}”</>} onClose={() => dispatch({ type: 'modal', modal: null })}>
      {canAdd && (
        <div className="rm-add">
          <div className="rm-add__field">
            {pending.map((p) => (
              <span key={p.id} className="rm-chip">
                {p.name}
                {p.external && <em> · Viewer</em>}
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))}>
                  ×
                </button>
              </span>
            ))}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={pending.length ? '' : 'Add team members or emails'}
              aria-label="Add team members or emails"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && suggestions[0]) {
                  setPending((x) => [...x, suggestions[0]]);
                  setQ('');
                }
              }}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="rm-suggest" role="listbox">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="rm-suggest__row"
                  onClick={() => {
                    setPending((x) => [...x, p]);
                    setQ('');
                  }}
                >
                  <Avatar src={p.avatar} size={24} />
                  <span>{p.name}</span>
                  {p.external && <span className="r-badge r-badge--muted">Outside {ORG_NAME} · Viewer only</span>}
                </button>
              ))}
            </div>
          )}
          <div className="rm-add__row">
            <label className="r-check">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              Notify people
            </label>
            <button type="button" className="r-btn r-btn--primary" disabled={!pending.length} onClick={add}>
              Add
            </button>
          </div>
        </div>
      )}

      <div className="rm-label">People with access</div>
      <ul className="rm-people">
        {card.sharing.map((p) => (
          <li key={p.id} className="rm-person">
            <Avatar src={p.avatar} size={28} />
            <span className="rm-person__name">{p.id === ME.id ? `${p.name} (you)` : p.name}</span>
            <AccessDropdown person={p} canEdit={canManage} onChange={(a) => change(p, a)} />
          </li>
        ))}
      </ul>
      {confirmEl}

      <div className="rm-link">
        <div className="rm-link__access">
          {card.linkAccess === 'private' ? Icon.lock : Icon.globe}
          {canManage ? (
            <div className="rm-access">
              <button type="button" className="rm-access__btn" onClick={() => setLinkMenu((v) => !v)} aria-haspopup="menu" aria-expanded={linkMenu}>
                {card.linkAccess === 'private' ? 'Private (Only you)' : `Anyone at ${ORG_NAME}`} {Icon.chevron}
              </button>
              {linkMenu && (
                <Menu className="rm-access__menu" onClose={() => setLinkMenu(false)}>
                  <MenuItem onClick={() => (setLinkMenu(false), dispatch({ type: 'updateReport', id: card.id, patch: { linkAccess: 'private' } }))}>Private (Only you)</MenuItem>
                  <MenuItem onClick={() => (setLinkMenu(false), dispatch({ type: 'updateReport', id: card.id, patch: { linkAccess: 'org' } }))}>
                    Anyone at {ORG_NAME} · view-only
                  </MenuItem>
                </Menu>
              )}
            </div>
          ) : (
            <span>{card.linkAccess === 'private' ? 'Private' : `Anyone at ${ORG_NAME}`}</span>
          )}
        </div>
        <button
          type="button"
          className="r-btn"
          onClick={() => {
            const link = `${location.origin}${location.pathname}#report-${card.id}`;
            navigator.clipboard?.writeText(link).catch(() => undefined);
            toast({ kind: 'success', text: 'Link copied' });
          }}
        >
          {Icon.link} Copy link
        </button>
      </div>
    </Modal>
  );
}

/** §16.1 Info modal — Details, People, Content. */
export function InfoModal({ card, tab: initialTab = 'details' }: { card: ReportCard; tab?: 'details' | 'people' | 'content' }) {
  const { dispatch } = useReporting();
  const [tab, setTab] = useState(initialTab);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.name);
  const [search, setSearch] = useState('');
  const { change, confirmEl } = usePeopleEditing(card);
  const canEdit = card.role !== 'viewer';
  const isOwner = card.role === 'owner';
  const people = card.sharing.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const sourceIds = [...new Set(card.tiles.flatMap((t) => t.sources))];
  const created = new Date(card.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const commit = () => {
    const v = title.trim();
    if (v) dispatch({ type: 'updateReport', id: card.id, patch: { name: v } });
    setEditing(false);
  };

  return (
    <Modal
      wide
      onClose={() => dispatch({ type: 'modal', modal: null })}
      title={
        <span className="ri-title">
          {editing ? (
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} aria-label="Report title" />
          ) : (
            <>
              {card.name}
              {canEdit && (
                <button type="button" className="r-icon-btn" aria-label="Edit title" onClick={() => setEditing(true)}>
                  {Icon.pencil}
                </button>
              )}
            </>
          )}
        </span>
      }
    >
      <div className="ri-tabs" role="tablist">
        {(['details', 'people', 'content'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`ri-tab${tab === t ? ' is-on' : ''}`} onClick={() => setTab(t)}>
            {t === 'details' ? 'Details' : t === 'people' ? `People ${card.sharing.length}` : 'Content'}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <dl className="ri-details">
          {isOwner && card.summary && <p className="ri-desc">{card.summary}</p>}
          <div className="ri-row">
            <dt>Created by</dt>
            <dd>
              <span className="r-nametag">{card.createdBy}</span> · {created}
            </dd>
          </div>
          <div className="ri-row">
            <dt>Schedule</dt>
            <dd>{card.schedule}</dd>
          </div>
          <div className="ri-row">
            <dt>Last update</dt>
            <dd>Refreshed {relativeTime(card.refreshedAt)}</dd>
          </div>
        </dl>
      )}

      {tab === 'people' && (
        <div className="ri-people">
          <input className="r-input" placeholder="Search people" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search people" />
          {canEdit && (
            <button type="button" className="ri-add" onClick={() => dispatch({ type: 'modal', modal: { kind: 'share' } })}>
              <span className="ri-add__plus">{Icon.plus}</span>
              Add People
            </button>
          )}
          <ul className="rm-people">
            {people.map((p) => (
              <li key={p.id} className="rm-person">
                <Avatar src={p.avatar} size={28} />
                <span className="rm-person__name">{p.name}</span>
                {p.access === 'Owner' ? <span className="r-badge">Owner</span> : isOwner ? <AccessDropdown person={p} canEdit onChange={(a) => change(p, a)} /> : null}
              </li>
            ))}
          </ul>
          {confirmEl}
        </div>
      )}

      {tab === 'content' && (
        <div className="ri-content">
          <div className="rm-label">Maintained by</div>
          <div className="ri-minion">
            <StazyAvatar size={32} />
            <div>
              <strong>Stazy</strong>
              <span>Reporter</span>
            </div>
            <span className="r-badge r-badge--muted">Minion</span>
          </div>
          <div className="rm-label">Data sources · {sourceIds.length}</div>
          <div className="ri-chips">
            {sourceIds.map((id) => {
              const s = SOURCES[id];
              if (!s) return null;
              return (
                <span key={id} className="ri-chip">
                  <img src={s.icon} alt="" className={s.kind === 'minion' ? 'is-round' : 'is-squircle'} />
                  {s.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** §16 Move to Trash confirmation; shared cards require a reason shown to collaborators. */
export function TrashDialog({ card, onTrashed }: { card: ReportCard; onTrashed: () => void }) {
  const { dispatch, toast } = useReporting();
  const shared = card.sharing.length > 1;
  const [reason, setReason] = useState('');
  return (
    <Modal
      title={card.name}
      onClose={() => dispatch({ type: 'modal', modal: null })}
      footer={
        <>
          <button type="button" className="r-btn r-btn--ghost" onClick={() => dispatch({ type: 'modal', modal: null })}>
            Cancel
          </button>
          <button
            type="button"
            className="r-btn r-btn--danger"
            disabled={shared && !reason.trim()}
            onClick={() => {
              dispatch({ type: 'updateReport', id: card.id, patch: { inTrash: true, pinned: false, trashReason: reason.trim() || undefined, autoRefresh: false } });
              dispatch({ type: 'modal', modal: null });
              toast({ kind: 'info', text: `“${card.name}” moved to Trash` });
              onTrashed();
            }}
          >
            Move to Trash
          </button>
        </>
      }
    >
      <p className="rm-text">It’ll move to Trash. You can restore it any time from there.</p>
      {shared && (
        <label className="r-field">
          <span>Reason for deleting</span>
          <textarea className="r-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
          <small>Shown to people this report is shared with</small>
        </label>
      )}
    </Modal>
  );
}

/** §8.6 Browse Templates with header search. */
export function TemplatesModal({ onUse }: { onUse: (card: ReportCard) => void }) {
  const { dispatch } = useReporting();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [applied, setApplied] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const matches = TEMPLATES.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const shown = applied !== null ? TEMPLATES.filter((t) => t.name.toLowerCase().includes(applied.toLowerCase())) : TEMPLATES;
  const options = q.trim() ? [{ id: '__all', name: `Show results for “${q.trim()}”`, group: '' }, ...matches] : [];

  const use = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id)!;
    const sample = createSampleReports().find((r) => r.name.startsWith(tpl.name.split(' ')[0])) ?? createSampleReports()[1];
    onUse({
      ...sample,
      id: `r${Date.now().toString(36)}`,
      name: tpl.name,
      category: 'mine',
      role: 'owner',
      createdAt: Date.now(),
      createdBy: ME.name,
      sharing: [ME],
      pinned: false,
      summary: undefined,
      refreshedAt: Date.now(),
    });
  };

  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    if (o.id === '__all') setApplied(q.trim());
    else use(o.id);
    setQ('');
  };

  return (
    <Modal
      wide
      onClose={() => dispatch({ type: 'modal', modal: null })}
      title={
        <div className="rtpl-search">
          <input
            value={q}
            placeholder="Search for Templates"
            aria-label="Search for Templates"
            role="combobox"
            aria-expanded={options.length > 0}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(options.length - 1, a + 1)));
              if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
              if (e.key === 'Enter') choose(active);
            }}
          />
          {options.length > 0 && (
            <div className="rtpl-drop" ref={listRef} role="listbox">
              <div className="rtpl-drop__count">Results ({matches.length})</div>
              {options.map((o, i) => (
                <button key={o.id} type="button" role="option" aria-selected={i === active} className={`rtpl-drop__row${i === active ? ' is-active' : ''}`} onClick={() => choose(i)}>
                  <span>{o.name}</span>
                  {o.group && <span className="r-badge r-badge--muted">{o.group}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      }
    >
      {applied && (
        <div className="rtpl-applied">
          Showing results for “{applied}” <button type="button" className="r-link" onClick={() => setApplied(null)}>Clear</button>
        </div>
      )}
      <div className="rtpl-grid">
        {shown.map((t) => (
          <div key={t.id} className="rtpl-card">
            <div className="rtpl-card__thumb" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <strong>{t.name}</strong>
            <p>{t.description}</p>
            <div className="rtpl-card__foot">
              <span className="r-badge r-badge--muted">{t.group}</span>
              <button type="button" className="r-btn r-btn--sm" onClick={() => use(t.id)}>
                Use template
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
