import { useEffect, useRef, useState } from 'react';
import { useHub } from './store';
import { PEOPLE, PRIORITIES, TAGS, type Item, type Priority } from './model';
import { Av, I, ListIcon, MItem, Pop, PriorityIcon } from './ui';
import { Circle } from './Cards';

/* Task details (sub-page §8): a drawer over the right side of Action Hub. */

const short = (id: string) => {
  const n = PEOPLE[id]?.name ?? id;
  const [f, l] = n.split(' ');
  return l ? `${f} ${l[0]}.` : f;
};

function AssignChip({ item }: { item: Item }) {
  const hub = useHub();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  // Name shown = first assignee alphabetically, "First L."; the rest as +N (§8.3).
  const sorted = [...item.assignees].sort((a, b) => (PEOPLE[a]?.name ?? a).localeCompare(PEOPLE[b]?.name ?? b));
  const toggle = (id: string) => hub.patch(item.id, { assignees: item.assignees.includes(id) ? item.assignees.filter((x) => x !== id) : [...item.assignees, id] });
  const people = Object.values(PEOPLE).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  const me = people.find((p) => p.id === 'me');
  const assigned = people.filter((p) => p.id !== 'me' && item.assignees.includes(p.id));
  const rest = people.filter((p) => p.id !== 'me' && !item.assignees.includes(p.id));
  const row = (id: string) => (
    <MItem key={id} icon={<Av id={id} size={20} />} right={item.assignees.includes(id) ? I.check : undefined} onClick={() => toggle(id)}>
      {id === 'me' ? `${PEOPLE.me.name} (you)` : PEOPLE[id].name}
    </MItem>
  );
  return (
    <span className="ah-chip-wrap">
      <button type="button" className="ah-prop" onClick={() => setOpen((v) => !v)} aria-haspopup="menu">
        {sorted.length ? (
          <>
            <span className="ah-prop__stack">
              {sorted.slice(0, 4).map((a) => (
                <Av key={a} id={a} size={20} />
              ))}
            </span>
            {short(sorted[0])}
            {sorted.length > 1 && ` +${sorted.length - 1}`}
          </>
        ) : (
          <>
            {I.user} Assign
          </>
        )}
      </button>
      {open && (
        <Pop className="ah-prop-pop" onClose={() => setOpen(false)}>
          <input className="ah-pop__search" autoFocus placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
          {me && row('me')}
          {assigned.length > 0 && <div className="ah-pop__label">Assigned to</div>}
          {assigned.map((p) => row(p.id))}
          {rest.length > 0 && <div className="ah-pop__label">People</div>}
          {rest.map((p) => row(p.id))}
        </Pop>
      )}
    </span>
  );
}

function TagChip({ item }: { item: Item }) {
  const hub = useHub();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const toggle = (id: string) => hub.patch(item.id, { tags: item.tags.includes(id) ? item.tags.filter((x) => x !== id) : [...item.tags, id] });
  const all = Object.values(TAGS).filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  const sel = all.filter((t) => item.tags.includes(t.id));
  const recent = all.filter((t) => !item.tags.includes(t.id));
  const add = () => {
    const name = q.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\W+/g, '-');
    TAGS[id] = TAGS[id] ?? { id, name, color: '#0090ff' };
    if (!item.tags.includes(id)) hub.patch(item.id, { tags: [...item.tags, id] });
    setQ('');
  };
  const first = item.tags[0];
  return (
    <span className="ah-chip-wrap">
      <button type="button" className="ah-prop" onClick={() => setOpen((v) => !v)} aria-haspopup="menu">
        {first ? (
          <>
            <span className="ah-prop__dots">
              {item.tags.slice(0, 2).map((t) => (
                <span key={t} className="ah-tagdot" style={{ background: TAGS[t]?.color }} />
              ))}
            </span>
            {TAGS[first]?.name}
            {item.tags.length > 1 && ` +${item.tags.length - 1}`}
          </>
        ) : (
          <>
            {I.tag} Tag
          </>
        )}
      </button>
      {open && (
        <Pop className="ah-prop-pop" onClose={() => setOpen(false)}>
          <div className="ah-pop__searchrow">
            <input className="ah-pop__search" autoFocus placeholder="Search tags" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button type="button" className="ah-iconbtn" aria-label="Add tag" onClick={add}>
              {I.plus}
            </button>
          </div>
          {sel.map((t) => (
            <MItem key={t.id} icon={<span className="ah-tagdot" style={{ background: t.color }} />} right={I.check} onClick={() => toggle(t.id)}>
              {t.name}
            </MItem>
          ))}
          {recent.length > 0 && <div className="ah-pop__label">Recent tags</div>}
          {recent.map((t) => (
            <MItem key={t.id} icon={<span className="ah-tagdot" style={{ background: t.color }} />} onClick={() => toggle(t.id)}>
              {t.name}
            </MItem>
          ))}
        </Pop>
      )}
    </span>
  );
}

export function PriorityChip({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  const [open, setOpen] = useState(false);
  const cur = PRIORITIES.find((p) => p.id === value)!;
  return (
    <span className="ah-chip-wrap">
      <button type="button" className="ah-prop" onClick={() => setOpen((v) => !v)} aria-haspopup="menu">
        <PriorityIcon p={value} /> {cur.label}
      </button>
      {open && (
        <Pop className="ah-prop-pop" onClose={() => setOpen(false)}>
          <div className="ah-pop__label">Set priority</div>
          {PRIORITIES.map((p) => (
            <MItem key={p.id} icon={<PriorityIcon p={p.id} />} right={p.id === value ? I.check : undefined} onClick={() => (onChange(p.id), setOpen(false))}>
              {p.label}
            </MItem>
          ))}
        </Pop>
      )}
    </span>
  );
}

function Ring({ done, total }: { done: number; total: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-label={`${done} of ${total} done`}>
      <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
      <circle cx="9" cy="9" r={r} fill="none" stroke="#0aba20" strokeWidth="2" strokeDasharray={`${(done / Math.max(1, total)) * c} ${c}`} transform="rotate(-90 9 9)" strokeLinecap="round" />
    </svg>
  );
}

export function TaskDetail({ id }: { id: string }) {
  const hub = useHub();
  const item = hub.items.find((i) => i.id === id);
  const [activity, setActivity] = useState(true);
  const [listMenu, setListMenu] = useState(false);
  const [more, setMore] = useState(false);
  const [attOpen, setAttOpen] = useState(true);
  const [subOpen, setSubOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newSub, setNewSub] = useState('');
  const [comment, setComment] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input, textarea, .ah-pop')) hub.setDetailId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hub]);

  // Viewing the activity panel clears unread markers (§8.6).
  const hasUnread = !!item?.comments.some((c) => c.unread);
  useEffect(() => {
    if (!item || !activity || !hasUnread) return;
    const t = window.setTimeout(() => hub.patch(item.id, { comments: item.comments.map((c) => ({ ...c, unread: false })) }), 2500);
    return () => window.clearTimeout(t);
  }, [activity, hasUnread, item, hub]);

  if (!item) return null;
  const empty = !item.description && !item.attachments.length && !item.subtasks.length && !item.comments.length && item.activity.length <= 1;
  const showActivity = activity && !empty;
  const doneSubs = item.subtasks.filter((s) => s.done).length;

  const addSubtask = () => {
    const t = newSub.trim();
    if (!t) return setAdding(false);
    hub.patch(item.id, { subtasks: [...item.subtasks, { id: `s${Date.now()}`, title: t, done: false }] });
    hub.pulse(item.listId ?? 'backlog');
    setNewSub('');
  };
  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const add = [...files].map((f) => ({ id: `a${Date.now()}${f.name}`, name: f.name, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined }));
    hub.patch(item.id, { attachments: [...item.attachments, ...add], activity: [...item.activity, 'You added attachments'] });
  };
  const postComment = () => {
    const t = comment.trim();
    if (!t) return;
    hub.patch(item.id, { comments: [...item.comments, { id: `c${Date.now()}`, author: 'me', at: 'Just now', text: t }] });
    setComment('');
  };

  return (
    <div className="ah-detail-layer" onPointerDown={(e) => e.target === e.currentTarget && hub.setDetailId(null)}>
      <div ref={ref} className={`ah-detail${showActivity ? ' has-activity' : ''}`} role="dialog" aria-label="Task details">
        <div className="ah-detail__main">
          <div className="ah-detail__bar">
            <button type="button" className="ah-iconbtn" aria-label="Close task details" onClick={() => hub.setDetailId(null)}>
              {I.back}
            </button>
            <span className="ah-chip-wrap">
              <button type="button" className="ah-listchip" onClick={() => setListMenu((v) => !v)}>
                <ListIcon icon={hub.listIcon(item.listId)} size={18} />
                {hub.listName(item.listId)}
              </button>
              {listMenu && (
                <Pop className="ah-listchip-menu" onClose={() => setListMenu(false)}>
                  <MItem onClick={() => (setListMenu(false), hub.setDetailId(null), hub.setView({ kind: 'list', id: item.listId ?? 'backlog' }))}>Go to list</MItem>
                  <MItem onClick={() => (setListMenu(false), hub.setModal({ kind: 'move', itemIds: [item.id] }))}>Move task to…</MItem>
                </Pop>
              )}
            </span>
            <span className="ah-detail__bar-right">
              <button
                type="button"
                className="ah-iconbtn"
                title="Copy task link"
                aria-label="Copy task link"
                onClick={() => {
                  navigator.clipboard?.writeText(`${location.origin}${location.pathname}#task-${item.id}`).catch(() => undefined);
                  hub.toast({ text: 'Link copied' });
                }}
              >
                {I.link}
              </button>
              <span className="ah-chip-wrap">
                <button type="button" className="ah-iconbtn" aria-label="More" onClick={() => setMore((v) => !v)}>
                  {I.vmore}
                </button>
                {more && (
                  <Pop className="ah-detail-more" onClose={() => setMore(false)}>
                    <MItem icon={I.move} onClick={() => (setMore(false), hub.setModal({ kind: 'move', itemIds: [item.id] }))}>
                      Move
                    </MItem>
                    <MItem danger icon={I.trash} onClick={() => (setMore(false), hub.trash([item.id]))}>
                      Move to Trash
                    </MItem>
                  </Pop>
                )}
              </span>
              <button type="button" className={`ah-iconbtn${showActivity ? ' is-on' : ''}`} title="Show activity" aria-label="Show activity" aria-pressed={showActivity} onClick={() => setActivity((v) => !v)}>
                {I.comment}
                {hasUnread && <span className="ah-unread ah-unread--icon" />}
              </button>
            </span>
          </div>

          <div className="ah-detail__scroll">
            <div className="ah-detail__title">
              <Circle item={item} onToggle={() => hub.toggleDone(item.id)} />
              <h2
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => {
                  const t = e.currentTarget.textContent?.trim();
                  if (t && t !== item.title) hub.patch(item.id, { title: t });
                }}
              >
                {item.title}
              </h2>
            </div>
            <div className="ah-detail__props">
              <AssignChip item={item} />
              <TagChip item={item} />
              <PriorityChip value={item.priority} onChange={(p) => hub.patch(item.id, { priority: p })} />
            </div>
            {item.description && <p className="ah-detail__desc">{item.description}</p>}

            <input ref={fileRef} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
            {item.attachments.length ? (
              <div className="ah-detail__section">
                <div className="ah-detail__sechead">
                  <button type="button" onClick={() => setAttOpen((v) => !v)} aria-expanded={attOpen}>
                    Attachments <span className={attOpen ? '' : 'is-closed'}>{I.chevron}</span> <em>{item.attachments.length}</em>
                  </button>
                  <button type="button" className="ah-iconbtn ah-iconbtn--sm" aria-label="Attach file" onClick={() => fileRef.current?.click()}>
                    {I.plus}
                  </button>
                </div>
                {attOpen && (
                  <div className="ah-files">
                    {item.attachments.map((a) => (
                      <figure key={a.id} className="ah-file">
                        <div className="ah-file__prev">{a.url ? <img src={a.url} alt="" /> : <span>{a.name.split('.').pop()?.toUpperCase()}</span>}</div>
                        <figcaption title={a.name}>{a.name}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button type="button" className="ah-addrow" onClick={() => fileRef.current?.click()}>
                {I.attach} Attach file <span className="ah-addrow__plus">{I.plus}</span>
              </button>
            )}

            {item.subtasks.length ? (
              <div className="ah-detail__section">
                <div className="ah-detail__sechead">
                  <button type="button" onClick={() => setSubOpen((v) => !v)} aria-expanded={subOpen}>
                    Subtasks <span className={subOpen ? '' : 'is-closed'}>{I.chevron}</span>
                    <Ring done={doneSubs} total={item.subtasks.length} /> <em>{item.subtasks.length}</em>
                  </button>
                </div>
                {subOpen && (
                  <div className="ah-subs">
                    {item.subtasks.map((s) => (
                      <div key={s.id} className={`ah-sub-row${s.done ? ' is-done' : ''}`}>
                        <button
                          type="button"
                          className={`ah-circle is-none${s.done ? ' is-done' : ''}`}
                          aria-label={s.done ? 'Mark not done' : 'Mark done'}
                          onClick={() => hub.patch(item.id, { subtasks: item.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}
                        >
                          {s.done && I.check}
                        </button>
                        <span className="ah-sub-row__t">{s.title}</span>
                        {s.assignee ? <Av id={s.assignee} size={20} /> : <span className="ah-sub-row__empty">{I.user}</span>}
                      </div>
                    ))}
                    {adding ? (
                      <SubInput value={newSub} onChange={setNewSub} onDone={addSubtask} onCancel={() => (setAdding(false), setNewSub(''))} />
                    ) : (
                      <button type="button" className="ah-addrow ah-addrow--sub" onClick={() => setAdding(true)}>
                        {I.plus} Add task
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : adding ? (
              <SubInput value={newSub} onChange={setNewSub} onDone={addSubtask} onCancel={() => (setAdding(false), setNewSub(''))} />
            ) : (
              <button type="button" className="ah-addrow" onClick={() => setAdding(true)}>
                {I.subtask} Add subtask <span className="ah-addrow__plus">{I.plus}</span>
              </button>
            )}
          </div>
        </div>

        {showActivity && (
          <aside className="ah-activity" aria-label="Activity">
            <h3>Activity</h3>
            <div className="ah-activity__scroll">
              <ul className="ah-activity__sys">
                {item.activity.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
              {item.comments.map((c) => (
                <div key={c.id} className="ah-comment">
                  <div className="ah-comment__head">
                    <Av id={c.author} size={18} />
                    <strong>{c.author === 'me' ? 'You' : PEOPLE[c.author]?.name}</strong>
                    <span className="ah-sep" aria-hidden />
                    <span>{c.at}</span>
                    {c.unread && <span className="ah-unread" aria-label="Unread" />}
                  </div>
                  <p>{c.text}</p>
                </div>
              ))}
            </div>
            <input
              className="ah-comment-input"
              placeholder="Write a comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && postComment()}
              aria-label="Write a comment"
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function SubInput({ value, onChange, onDone, onCancel }: { value: string; onChange: (v: string) => void; onDone: () => void; onCancel: () => void }) {
  return (
    <div className="ah-sub-row ah-sub-row--new">
      <span className="ah-circle is-none" aria-hidden />
      <input autoFocus value={value} placeholder="Subtask name" onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' ? onDone() : e.key === 'Escape' && onCancel())} />
      <button type="button" className="ah-iconbtn ah-iconbtn--sm" aria-label="Add subtask" onClick={onDone}>
        {I.check}
      </button>
      <button type="button" className="ah-iconbtn ah-iconbtn--sm" aria-label="Cancel" onClick={onCancel}>
        {I.close}
      </button>
    </div>
  );
}
