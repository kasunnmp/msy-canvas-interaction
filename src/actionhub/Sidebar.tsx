import { useState } from 'react';
import { useHub } from './store';
import { SECTIONS, type Section } from './model';
import { I, ListIcon, MItem, Pop } from './ui';
import navHub from './assets/nav-hub.svg';
import navChat from './assets/nav-chat.svg';
import navExternal from './assets/nav-external.svg';
import navApps from './assets/nav-apps.svg';
import navSupport from './assets/nav-support.svg';
import navSearch from './assets/nav-search.svg';
import navDivider from './assets/nav-divider.svg';
import onlineDot from './assets/online-dot.svg';
import plusIcon from './assets/plus.svg';
import meAvatar from '../assets/dock/a156c.png';

function Badge({ n, tone, bumpKey }: { n: number; tone: string; bumpKey?: string }) {
  const { bump } = useHub();
  if (!n) return null; // counts hide when a view is empty (§3, §9)
  // Re-keying on change replays the subtle count animation (§3, §6.2).
  return (
    <span key={`${n}-${bumpKey ? bump[bumpKey] ?? 0 : ''}`} className={`ah-badge ah-badge--${tone}`}>
      {n}
    </span>
  );
}

/** Nexus app rail (Action Hub is the first tab, §2). */
function NexusRail() {
  const { counts } = useHub();
  const items = [
    { icon: navHub, badge: counts.all, label: 'Action Hub', active: true },
    { divider: true },
    { icon: navChat, badge: 10, label: 'Chats' },
    { icon: navExternal, badge: 22, label: 'Inbox' },
    { divider: true },
    { icon: navApps, badge: 4, label: 'Apps' },
    { icon: navSupport, label: 'Support' },
  ];
  return (
    <div className="ah-rail">
      <div className="ah-rail__top">
        {items.map((it, i) =>
          'divider' in it ? (
            <img key={i} src={navDivider} alt="" className="ah-rail__div" />
          ) : (
            <button key={i} type="button" className={`ah-rail__btn${it.active ? ' is-active' : ''}`} title={it.label} aria-label={it.label} aria-current={it.active ? 'page' : undefined}>
              <img src={it.icon} alt="" width={24} height={24} />
              {it.badge ? <span className="ah-rail__badge">{it.badge}</span> : null}
            </button>
          ),
        )}
        <span className="ah-rail__marker" aria-hidden />
      </div>
      <div className="ah-rail__bottom">
        <button type="button" className="ah-rail__btn" title="Nexus search" aria-label="Nexus search">
          <img src={navSearch} alt="" width={24} height={24} />
        </button>
        <span className="ah-rail__me">
          <img src={meAvatar} alt="You" />
          <img src={onlineDot} alt="" className="ah-rail__online" />
        </span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const hub = useHub();
  const { view, counts, lists } = hub;
  const [plus, setPlus] = useState(false);
  const isSec = (id: Section) => view.kind === 'section' && view.id === id;

  const newList = () => {
    if (!hub.canCreateList) {
      hub.toast({ text: 'You’ve reached 10 lists. Rename or delete one to make room.' });
      return;
    }
    hub.setModal({ kind: 'newList' });
  };

  return (
    <aside className="ah-side">
      <div className="ah-traffic" aria-hidden>
        <span className="ah-light ah-light--r" />
        <span className="ah-light ah-light--y" />
        <span className="ah-light ah-light--g" />
      </div>
      <div className="ah-side__body">
        <NexusRail />
        <nav className="ah-nav" aria-label="Action Hub">
          <div className="ah-nav__head">
            <h2>
              Action
              <br />
              Hub
            </h2>
            <div className="ah-plus-wrap">
              <button type="button" className="ah-plus" aria-label="Create" aria-haspopup="menu" aria-expanded={plus} onClick={() => setPlus((v) => !v)}>
                <img src={plusIcon} alt="" width={24} height={24} />
              </button>
              {plus && (
                <Pop className="ah-plus-menu" onClose={() => setPlus(false)}>
                  <MItem icon={I.task} right="⌘T" onClick={() => (setPlus(false), hub.setModal({ kind: 'newTask', mode: 'task' }))}>
                    New task
                  </MItem>
                  <MItem icon={I.brain} right="⌘B" onClick={() => (setPlus(false), hub.setModal({ kind: 'newTask', mode: 'brain' }))}>
                    Brain dump
                  </MItem>
                  <MItem icon={I.list} right="⌘L" onClick={() => (setPlus(false), newList())}>
                    New list
                  </MItem>
                </Pop>
              )}
            </div>
          </div>

          <div className="ah-nav__group">
            <button type="button" className={`ah-node${view.kind === 'all' ? ' is-active' : ''}`} onClick={() => hub.setView({ kind: 'all' })}>
              <span>All</span>
              <Badge n={counts.all} tone="dark" />
            </button>
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" className={`ah-node${isSec(s.id) ? ' is-active' : ''}`} onClick={() => hub.setView({ kind: 'section', id: s.id })}>
                <span>{s.label}</span>
                <Badge n={counts.sec[s.id]} tone={s.badge} />
              </button>
            ))}
          </div>

          <div className="ah-nav__lists-head">
            <span>My Lists</span>
            <button type="button" className="ah-nav__lists-add" aria-label="New list" title="New list" onClick={newList}>
              {I.plus}
            </button>
          </div>
          <div className="ah-nav__group">
            {lists.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`ah-node ah-node--list${view.kind === 'list' && view.id === l.id ? ' is-active' : ''}`}
                onClick={() => hub.setView({ kind: 'list', id: l.id })}
              >
                <span className="ah-node__icon">
                  <ListIcon icon={l.icon} />
                </span>
                <span className="ah-node__name">{l.name}</span>
                <Badge n={counts.list[l.id]} tone="list" bumpKey={l.id} />
              </button>
            ))}
          </div>
        </nav>
      </div>
    </aside>
  );
}
