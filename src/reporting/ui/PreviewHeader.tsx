import { useEffect, useRef, useState } from 'react';
import { useReporting } from '../state/store';
import type { ReportCard } from '../model/types';
import { exportCardFile, relativeTime, type CardFormat } from '../model/export';
import { Avatar, Icon, Menu, MenuDivider, MenuItem, Tags } from './common';
import caretIcon from '../assets/caret-down.svg';
import pinIcon from '../assets/pin.svg';
import pencilIcon from '../assets/pencil.svg';
import exportIcon from '../assets/export.svg';
import reloadIcon from '../assets/reload.svg';

const CARD_FORMATS: CardFormat[] = ['PDF', 'HTML', 'Markdown', 'CSV', 'Print'];

/** Shared export dropdown — the header button and the title menu offer the same list (§18.3). */
export function CardExportMenu({ card, onClose }: { card: ReportCard; onClose: () => void }) {
  const { runExport, state } = useReporting();
  const [fmt, setFmt] = useState<CardFormat | null>(null);
  // §16: whole-card export always uses the saved default range & filters, not the viewer's view.
  const defaultRange = state.savedViews[`default:${card.id}`] ?? { key: 'today' as const };
  const go = (f: CardFormat, dest: 'device' | 'Apollo') => {
    onClose();
    if (f === 'Print') {
      void exportCardFile('Print', card, defaultRange);
      return;
    }
    runExport(f, dest, () => void exportCardFile(f, card, defaultRange));
  };
  return (
    <Menu className="rh-export-menu" onClose={onClose}>
      {!fmt ? (
        CARD_FORMATS.map((f) => (
          <MenuItem key={f} icon={f === 'Print' ? Icon.download : undefined} onClick={() => (f === 'Print' ? go('Print', 'device') : setFmt(f))}>
            {f === 'Print' ? 'Print' : `Export as ${f}`}
          </MenuItem>
        ))
      ) : (
        <>
          <div className="r-menu__label">Export {fmt} to</div>
          <MenuItem onClick={() => go(fmt, 'device')}>Your device</MenuItem>
          <MenuItem onClick={() => go(fmt, 'Apollo')}>Apollo</MenuItem>
        </>
      )}
    </Menu>
  );
}

export function PreviewHeader({ card }: { card: ReportCard }) {
  const { state, dispatch, refreshCard } = useReporting();
  const [menu, setMenu] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(card.name);
  const [, tick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const role = card.role;
  const refreshing = !!state.cardRefreshing[card.id];

  useEffect(() => setName(card.name), [card.name]);
  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);
  // keep relative times fresh
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const commitRename = () => {
    const v = name.trim();
    if (v && v !== card.name) dispatch({ type: 'updateReport', id: card.id, patch: { name: v } });
    setRenaming(false);
  };
  const togglePin = () => dispatch({ type: 'updateReport', id: card.id, patch: { pinned: !card.pinned } });
  const share = () => dispatch({ type: 'modal', modal: { kind: 'share' } });

  const people = card.sharing;
  const shown = people.slice(0, 4);
  const extra = people.length - shown.length;

  return (
    <header className="rh">
      <div className="rh-top">
        <div className="rh-info">
          <div className="rh-title-row">
            {renaming ? (
              <input
                ref={inputRef}
                className="rh-title-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') {
                    setName(card.name);
                    setRenaming(false);
                  }
                }}
                aria-label="Report title"
              />
            ) : (
              <button type="button" className="rh-title" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu}>
                <span className="rh-title__text">{card.name}</span>
                <Tags tags={card.tags} />
                <span className="rh-caret">
                  <img src={caretIcon} alt="" width={24} height={24} />
                </span>
              </button>
            )}
            <button type="button" className={`rh-pin${card.pinned ? ' is-on' : ''}`} onClick={togglePin} aria-pressed={card.pinned} aria-label={card.pinned ? 'Unpin report' : 'Pin report'} title={card.pinned ? 'Unpin' : 'Pin'}>
              <img src={pinIcon} alt="" width={20} height={20} />
            </button>
            {menu && (
              <Menu className="rh-title-menu" onClose={() => setMenu(false)}>
                {/* Identity */}
                <MenuItem icon={Icon.info} onClick={() => (setMenu(false), dispatch({ type: 'modal', modal: { kind: 'info' } }))}>
                  Info
                </MenuItem>
                {role !== 'viewer' && (
                  <MenuItem icon={Icon.pencil} onClick={() => (setMenu(false), setRenaming(true))}>
                    Rename
                  </MenuItem>
                )}
                <MenuItem icon={Icon.pin} onClick={() => (setMenu(false), togglePin())}>
                  {card.pinned ? 'Unpin' : 'Pin'}
                </MenuItem>
                {role !== 'viewer' && (
                  <MenuItem icon={Icon.share} onClick={() => (setMenu(false), share())}>
                    Share
                  </MenuItem>
                )}
                <MenuDivider />
                {/* Data */}
                {role !== 'viewer' && (
                  <MenuItem
                    icon={Icon.refresh}
                    onClick={() => dispatch({ type: 'updateReport', id: card.id, patch: { autoRefresh: !card.autoRefresh } })}
                    right={<span className={`r-switch${card.autoRefresh ? ' is-on' : ''}`} aria-hidden />}
                  >
                    Auto refresh
                  </MenuItem>
                )}
                <MenuItem icon={Icon.download} onClick={() => (setMenu(false), setExportOpen(true))}>
                  Export
                </MenuItem>
                {role !== 'viewer' && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      icon={Icon.copy}
                      onClick={() => {
                        setMenu(false);
                        dispatch({ type: 'chat', open: true });
                        window.dispatchEvent(new CustomEvent('stazy:duplicate', { detail: card.id }));
                      }}
                    >
                      Duplicate
                    </MenuItem>
                  </>
                )}
                {role === 'owner' && (
                  <>
                    <MenuDivider />
                    <MenuItem icon={Icon.trash} danger onClick={() => (setMenu(false), dispatch({ type: 'modal', modal: { kind: 'trash' } }))}>
                      Move to Trash
                    </MenuItem>
                  </>
                )}
              </Menu>
            )}
          </div>
          <button type="button" className="rh-refreshed" onClick={() => refreshCard(card.id)} disabled={refreshing} aria-live="polite">
            <span>{refreshing ? 'Refreshing…' : `Refreshed ${relativeTime(card.refreshedAt)}`}</span>
            {refreshing ? <span className="r-spinner" aria-hidden /> : <img src={reloadIcon} alt="" width={20} height={20} />}
          </button>
        </div>

        <div className="rh-actions">
          {role !== 'viewer' && (
            <button type="button" className="r-btn" onClick={() => dispatch({ type: 'openBuilder' })}>
              <img src={pencilIcon} alt="" width={20} height={20} />
              Edit
            </button>
          )}
          <button type="button" className="rh-stack" onClick={share} aria-label={`Shared with ${people.length} people`}>
            {shown.map((p) => (
              <Avatar key={p.id} src={p.avatar} size={24} ring title={p.name} />
            ))}
            {extra > 0 && <span className="rh-stack__more">+{extra}</span>}
          </button>
          <div className="rh-export-wrap">
            <button type="button" className="r-icon-btn r-icon-btn--outlined" aria-label="Export report" aria-haspopup="menu" aria-expanded={exportOpen} onClick={() => setExportOpen((v) => !v)}>
              <img src={exportIcon} alt="" width={20} height={20} />
            </button>
            {exportOpen && <CardExportMenu card={card} onClose={() => setExportOpen(false)} />}
          </div>
        </div>
      </div>
    </header>
  );
}
