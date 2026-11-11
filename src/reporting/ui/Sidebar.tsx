import { useState } from 'react';
import { useReporting } from '../state/store';
import type { ReportCard } from '../model/types';
import { Icon, Menu, MenuItem, StazyAvatar, Tags } from './common';
import addIcon from '../assets/add.svg';
import docIcon from '../assets/doc.svg';
import hashIcon from '../assets/hash.svg';
import keepOffIcon from '../assets/keep-off.svg';
import treeIcon from '../assets/tree-indicator.svg';

const VISIBLE = 6;

interface Props {
  onNewReport: () => void;
  onBrowseTemplates: () => void;
  creatingName?: string | null;
}

/** §15 App navigation: My Reports (always), Shared with me (only once something is shared), per-category pins. */
export function Sidebar({ onNewReport, onBrowseTemplates, creatingName }: Props) {
  const { state, dispatch } = useReporting();
  const [plusOpen, setPlusOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const live = state.reports.filter((r) => !r.inTrash);
  const mine = live.filter((r) => r.category === 'mine');
  const shared = live.filter((r) => r.category === 'shared');

  const section = (items: ReportCard[]) => {
    const pinned = items.filter((r) => r.pinned);
    const rest = items.filter((r) => !r.pinned);
    return { pinned, rest };
  };
  const m = section(mine);
  const s = section(shared);
  const restMine = showAll ? m.rest : m.rest.slice(0, Math.max(0, VISIBLE - m.pinned.length));

  const Row = ({ r }: { r: ReportCard }) => {
    const active = r.id === state.activeId;
    return (
      <div className={`rs-row${active ? ' is-active' : ''}`}>
        <button type="button" className="rs-row__main" onClick={() => dispatch({ type: 'select', id: r.id })} aria-current={active ? 'page' : undefined}>
          <span className="rs-row__icon">
            <img src={active ? hashIcon : docIcon} alt="" width={20} height={20} />
          </span>
          <span className="rs-row__name">{r.name}</span>
          <Tags tags={r.tags} />
        </button>
        {r.pinned && (
          <button
            type="button"
            className="rs-row__pin"
            title="Unpin"
            aria-label={`Unpin ${r.name}`}
            onClick={() => dispatch({ type: 'updateReport', id: r.id, patch: { pinned: false } })}
          >
            <img src={keepOffIcon} alt="" width={16} height={16} />
          </button>
        )}
      </div>
    );
  };

  return (
    <aside className="rs">
      <div className="rs-traffic" aria-hidden>
        <span className="r-light r-light--red" />
        <span className="r-light r-light--yellow" />
        <span className="r-light r-light--green" />
      </div>
      <div className="rs-head">
        <h2 className="rs-title">Reports</h2>
        <div className="rs-plus-wrap">
          <button type="button" className="rs-plus" aria-label="New" aria-haspopup="menu" aria-expanded={plusOpen} onClick={() => setPlusOpen((v) => !v)}>
            <img src={addIcon} alt="" width={24} height={24} />
          </button>
          {plusOpen && (
            <Menu className="rs-plus-menu" onClose={() => setPlusOpen(false)}>
              <MenuItem
                icon={Icon.plus}
                onClick={() => {
                  setPlusOpen(false);
                  onNewReport();
                }}
              >
                New Report
              </MenuItem>
              <MenuItem
                icon={Icon.template}
                onClick={() => {
                  setPlusOpen(false);
                  onBrowseTemplates();
                }}
              >
                Browse Templates
              </MenuItem>
            </Menu>
          )}
        </div>
      </div>

      <nav className="rs-nav" aria-label="Reports">
        {mine.length === 0 && !creatingName ? (
          <div className="rs-empty">
            <img src={docIcon} alt="" width={20} height={20} />
            <span>Your reports will show up here</span>
          </div>
        ) : (
          <>
            <div className="rs-section">My Reports</div>
            {m.pinned.map((r) => (
              <Row key={r.id} r={r} />
            ))}
            {restMine.map((r) => (
              <Row key={r.id} r={r} />
            ))}
            {creatingName && (
              <div className="rs-row is-creating" aria-live="polite">
                <span className="rs-row__icon">
                  <span className="r-spinner" />
                </span>
                <span className="rs-row__name">{creatingName}</span>
              </div>
            )}
            {m.rest.length > restMine.length || showAll ? (
              <button type="button" className="rs-more" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                {showAll ? 'Show less' : 'View all'}
                <img src={treeIcon} alt="" width={20} height={20} className={showAll ? 'is-open' : ''} />
              </button>
            ) : null}
          </>
        )}
        {shared.length > 0 && (
          <>
            <div className="rs-section rs-section--gap">Shared with me</div>
            {s.pinned.map((r) => (
              <Row key={r.id} r={r} />
            ))}
            {s.rest.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </>
        )}
      </nav>

      <div className="rs-foot">
        <button
          type="button"
          className={`rs-minion${state.chatOpen ? ' is-open' : ''}`}
          onClick={() => dispatch({ type: 'chat', open: !state.chatOpen })}
          aria-pressed={state.chatOpen}
          aria-label="Chat with Stazy, the Report Minion"
        >
          <span className="rs-minion__darker" aria-hidden />
          <StazyAvatar size={32} />
          <span className="rs-minion__text">
            <strong>Stazy</strong>
            <span>Reporter</span>
          </span>
        </button>
      </div>
    </aside>
  );
}
