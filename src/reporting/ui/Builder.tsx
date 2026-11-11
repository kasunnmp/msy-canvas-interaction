import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useReporting } from '../state/store';
import type { ReportCard, Tile, TileType } from '../model/types';
import { COLS, GUTTER, ROW, clampTile } from '../model/grid';
import { LIBRARY_GROUPS, TILE_KINDS, kindOf } from '../model/catalog';
import { relativeTime } from '../model/export';
import { TileView } from '../tiles/TileView';
import { gridGeometry } from './ReportPreview';
import { Avatar, Menu, MenuItem, Modal, StazyAvatar, useDismiss } from './common';
import { ME } from '../model/sampleReports';
import railBack from '../assets/rail-back.svg';
import railAdd from '../assets/rail-add.svg';
import railDivider from '../assets/rail-divider.svg';
import railTidy from '../assets/rail-tidy.svg';
import railSettings from '../assets/rail-settings.svg';

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const HANDLES: Handle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

interface Gesture {
  id: string;
  kind: 'move' | Handle;
  startX: number;
  startY: number;
  orig: Tile;
  moved: boolean;
}

function TextIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** §9 Insert panel: Tile types grouped under Comparisons, Trends, Part to whole, Correlations. */
function InsertPanel({ onAdd, onClose, onDragStart }: { onAdd: (t: TileType) => void; onClose: () => void; onDragStart: (t: TileType, e: React.DragEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, ref);
  const [q, setQ] = useState('');
  return (
    <div ref={ref} className="rb-insert" role="dialog" aria-label="Insert a Tile">
      <input className="r-input" placeholder="Search tiles" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search tiles" />
      <div className="rb-insert__scroll">
        {LIBRARY_GROUPS.map((g) => {
          const items = TILE_KINDS.filter((k) => k.group === g && k.label.toLowerCase().includes(q.toLowerCase()));
          if (!items.length) return null;
          return (
            <section key={g}>
              <h4>{g === 'More' ? 'Tables & lists' : g}</h4>
              <div className="rb-insert__grid">
                {items.map((k) => (
                  <button
                    key={k.type}
                    type="button"
                    className="rb-insert__item"
                    draggable
                    onDragStart={(e) => onDragStart(k.type, e)}
                    onClick={() => onAdd(k.type)}
                    title={`${k.renders} · default ${k.def.w}×${k.def.h}`}
                  >
                    <span className={`rb-glyph rb-glyph--${k.type}`} aria-hidden />
                    <span>{k.label}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** §8.8 floating label above a selected Tile with Rename / Duplicate / Delete tile. */
function TileLabel({ tile, onRename, onDuplicate, onDelete }: { tile: Tile; onRename: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const kind = kindOf(tile.type);
  return (
    <div className="rb-label" onPointerDown={(e) => e.stopPropagation()}>
      <span>
        {kind.label}
        {tile.type !== 'text' && ` – ${tile.name}`}
      </span>
      <button type="button" className="rb-label__btn" aria-label="Tile settings" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <img src={railSettings} alt="" width={16} height={16} />
      </button>
      {open && (
        <Menu className="rb-label__menu" onClose={() => setOpen(false)}>
          {tile.type !== 'text' && <MenuItem onClick={() => (setOpen(false), onRename())}>Rename</MenuItem>}
          <MenuItem onClick={() => (setOpen(false), onDuplicate())}>Duplicate</MenuItem>
          <MenuItem danger onClick={() => (setOpen(false), onDelete())}>
            Delete tile
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}

export function Builder({ card, onExit }: { card: ReportCard; onExit: () => void }) {
  const { state, dispatch, placeTile, addTile, removeTile, duplicateTile, renameTile, setTileText, tidyUp } = useReporting();
  const draft = state.draft!;
  const tiles = draft.tiles;
  const selected = tiles.find((t) => t.id === state.selectedTileId) ?? null;
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [preview, setPreview] = useState<Tile | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [titleEdit, setTitleEdit] = useState(false);
  const [dropGhost, setDropGhost] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragType = useRef<TileType | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  useDismiss(settings, () => setSettings(false), settingsRef);

  useLayoutEffect(() => {
    if (!gridEl) return;
    setWidth(gridEl.clientWidth);
    const ro = new ResizeObserver(() => setWidth(gridEl.clientWidth));
    ro.observe(gridEl);
    return () => ro.disconnect();
  }, [gridEl]);

  const geo = gridGeometry(width);
  const pitchX = geo.colW + GUTTER;
  const pitchY = ROW + GUTTER;
  const rows = Math.max(10, tiles.reduce((m, t) => Math.max(m, t.y + t.h), 0) + 4);

  // ── keyboard: undo, delete, nudge ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        dispatch({ type: 'undo' });
        return;
      }
      if (!selected || typing) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeTile(selected.id);
      } else if (e.key === 'Escape') {
        dispatch({ type: 'selectTile', id: null });
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        placeTile({ ...selected, x: selected.x + dx, y: selected.y + dy });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, dispatch, removeTile, placeTile]);

  // ── pointer gestures: move & 8-handle resize, snapped to whole columns/rows ──
  const begin = (e: RPointerEvent, tile: Tile, kind: Gesture['kind']) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dispatch({ type: 'selectTile', id: tile.id });
    setGesture({ id: tile.id, kind, startX: e.clientX, startY: e.clientY, orig: tile, moved: false });
  };

  const scaleFactor = useCallback(() => {
    // the stage may be CSS-scaled; convert screen px to layout px
    if (!gridEl) return 1;
    return gridEl.getBoundingClientRect().width / (gridEl.offsetWidth || 1) || 1;
  }, [gridEl]);

  const onMove = (e: RPointerEvent) => {
    if (!gesture) return;
    const k = scaleFactor();
    const dxPx = (e.clientX - gesture.startX) / k;
    const dyPx = (e.clientY - gesture.startY) / k;
    if (!gesture.moved && Math.hypot(dxPx, dyPx) < 4) return;
    const dx = Math.round(dxPx / pitchX);
    const dy = Math.round(dyPx / pitchY);
    const o = gesture.orig;
    let next: Tile = { ...o };
    if (gesture.kind === 'move') next = { ...o, x: o.x + dx, y: o.y + dy };
    else {
      const h = gesture.kind;
      if (h.includes('e')) next.w = o.w + dx;
      if (h.includes('s')) next.h = o.h + dy;
      if (h.includes('w')) {
        next.w = o.w - dx;
        next.x = o.x + dx;
      }
      if (h.includes('n')) {
        next.h = o.h - dy;
        next.y = o.y + dy;
      }
      // Handles enforce min/max: anchor the opposite edge when clamped.
      const kd = kindOf(o.type);
      const cw = Math.min(Math.max(next.w, kd.min.w), kd.max.w);
      const ch = Math.min(Math.max(next.h, kd.min.h), kd.max.h);
      if (h.includes('w')) next.x = o.x + o.w - cw;
      if (h.includes('n')) next.y = o.y + o.h - ch;
      next.w = cw;
      next.h = ch;
    }
    setGesture({ ...gesture, moved: true });
    setPreview(clampTile(next));
  };

  const end = () => {
    if (gesture && preview && gesture.moved) placeTile(preview);
    setGesture(null);
    setPreview(null);
  };

  // ── drag from the library onto the canvas ──
  const cellAt = (clientX: number, clientY: number, w: number) => {
    const r = gridEl!.getBoundingClientRect();
    const k = scaleFactor();
    const x = Math.min(COLS - w, Math.max(0, Math.floor((clientX - r.left) / k / pitchX)));
    const y = Math.max(0, Math.floor((clientY - r.top) / k / pitchY));
    return { x, y };
  };

  const shown = useMemo(() => (preview ? tiles.map((t) => (t.id === preview.id ? { ...t, x: preview.x, y: preview.y } : t)) : tiles), [tiles, preview]);

  const askStazyToBind = (t: Tile) => {
    dispatch({ type: 'chat', open: true });
    window.dispatchEvent(new CustomEvent('stazy:bind', { detail: { tileId: t.id, name: t.name, type: t.type } }));
  };

  return (
    <div className="rb">
      <div className="rb-top">
        <div className="rs-traffic" aria-hidden>
          <span className="r-light r-light--red" />
          <span className="r-light r-light--yellow" />
          <span className="r-light r-light--green" />
        </div>
        <div className="rb-title">
          {titleEdit ? (
            <input
              autoFocus
              className="rb-title__input"
              defaultValue={draft.name}
              aria-label="Report title"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== draft.name) dispatch({ type: 'draftName', name: v });
                setTitleEdit(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setTitleEdit(false);
              }}
            />
          ) : (
            <button type="button" className="rb-title__btn" onClick={() => setTitleEdit(true)} title="Rename report">
              {draft.name}
              {draft.dirty ? '*' : ''}
            </button>
          )}
        </div>
        <div className="rb-top__actions">
          {draft.undo.length > 0 && (
            <button type="button" className="r-btn r-btn--ghost r-btn--sm" onClick={() => dispatch({ type: 'undo' })} title="Undo (⌘Z)">
              Undo
            </button>
          )}
          <button type="button" className="r-btn r-btn--primary" disabled={!draft.dirty} onClick={() => dispatch({ type: 'modal', modal: { kind: 'save' } })}>
            Save
          </button>
        </div>
      </div>

      <div className="rb-body">
        <nav className="rb-rail" aria-label="Builder tools">
          <div className="rb-rail__top">
            <button type="button" className="rb-back" onClick={onExit} aria-label="Exit builder">
              <img src={railBack} alt="" width={24} height={24} />
            </button>
            <div className="rb-tools">
              <button type="button" className={`rb-tool${state.insertOpen ? ' is-on' : ''}`} aria-label="Insert" title="Insert" onClick={() => dispatch({ type: 'insert', open: !state.insertOpen })}>
                <img src={railAdd} alt="" width={24} height={24} />
              </button>
              <button
                type="button"
                className="rb-tool"
                aria-label="Text"
                title="Text"
                onClick={() => {
                  const id = addTile('text');
                  setEditingText(id);
                }}
              >
                <TextIcon />
              </button>
              <img className="rb-rail__divider" src={railDivider} alt="" width={22} height={6} />
              <button type="button" className="rb-tool" aria-label="Tidy up" title="Tidy up" onClick={tidyUp}>
                <img src={railTidy} alt="" width={24} height={24} />
              </button>
              <div className="rb-settings-wrap" ref={settingsRef}>
                <button type="button" className={`rb-tool${settings ? ' is-on' : ''}`} aria-label="Settings" title="Settings" onClick={() => setSettings((v) => !v)}>
                  <img src={railSettings} alt="" width={24} height={24} />
                </button>
                {settings && (
                  <div className="r-menu rb-settings" role="menu">
                    <button type="button" className="r-menu__item" onClick={() => setShowGrid((v) => !v)}>
                      <span className="r-menu__text">Show grid</span>
                      <span className={`r-switch${showGrid ? ' is-on' : ''}`} aria-hidden />
                    </button>
                    <button type="button" className="r-menu__item" disabled={!draft.undo.length} onClick={() => dispatch({ type: 'undo' })}>
                      <span className="r-menu__text">Undo last change</span>
                    </button>
                    <div className="r-menu__divider" />
                    <button type="button" className="r-menu__item is-danger" disabled={!draft.dirty} onClick={() => (setSettings(false), dispatch({ type: 'modal', modal: { kind: 'discard' } }))}>
                      <span className="r-menu__text">Discard draft…</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {state.insertOpen && (
              <InsertPanel
                onClose={() => dispatch({ type: 'insert', open: false })}
                onAdd={(t) => {
                  addTile(t);
                  dispatch({ type: 'insert', open: false });
                }}
                onDragStart={(t, e) => {
                  dragType.current = t;
                  e.dataTransfer.setData('text/plain', t);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              />
            )}
          </div>
          <button type="button" className={`rb-stazy${state.chatOpen ? ' is-on' : ''}`} onClick={() => dispatch({ type: 'chat', open: !state.chatOpen })} aria-label="Chat with Stazy" aria-pressed={state.chatOpen}>
            <StazyAvatar size={32} />
          </button>
        </nav>

        <div className="rb-scroll" onPointerDown={() => (dispatch({ type: 'selectTile', id: null }), setEditingText(null), setRenaming(null))}>
          <div
            ref={setGridEl}
            className={`rb-grid${showGrid ? ' has-grid' : ''}`}
            style={{ height: geo.height(rows), ['--pitch-x' as string]: `${pitchX}px`, ['--pitch-y' as string]: `${pitchY}px`, ['--col-w' as string]: `${geo.colW}px` }}
            onPointerMove={onMove}
            onPointerUp={end}
            onPointerCancel={end}
            onDragOver={(e) => {
              const t = dragType.current;
              if (!t) return;
              e.preventDefault();
              const k = kindOf(t);
              setDropGhost({ ...cellAt(e.clientX, e.clientY, k.def.w), w: k.def.w, h: k.def.h });
            }}
            onDragLeave={() => setDropGhost(null)}
            onDrop={(e) => {
              const t = dragType.current;
              dragType.current = null;
              setDropGhost(null);
              if (!t) return;
              e.preventDefault();
              const k = kindOf(t);
              addTile(t, cellAt(e.clientX, e.clientY, k.def.w));
              dispatch({ type: 'insert', open: false });
            }}
          >
            {width > 0 &&
              shown.map((t) => {
                const isSel = t.id === state.selectedTileId;
                const box = preview && preview.id === t.id ? geo.rect(preview) : geo.rect(t);
                return (
                  <div
                    key={t.id}
                    className={`rb-cell${isSel ? ' is-selected' : ''}${gesture?.id === t.id && gesture.moved ? ' is-dragging' : ''}`}
                    style={box}
                    onPointerDown={(e) => begin(e, t, 'move')}
                    onDoubleClick={() => t.type === 'text' && setEditingText(t.id)}
                  >
                    <TileView
                      tile={t}
                      range={state.ranges[card.id] ?? { key: 'today' }}
                      mode="builder"
                      refreshedText={relativeTime(t.refreshedAt ?? card.refreshedAt)}
                      editingText={editingText === t.id}
                      onTextChange={(v) => setTileText(t.id, v)}
                      onAskStazy={() => askStazyToBind(t)}
                    />
                    {isSel && !gesture?.moved && (
                      <>
                        {renaming === t.id ? (
                          <input
                            className="rb-rename"
                            autoFocus
                            defaultValue={t.name}
                            aria-label="Tile name"
                            onPointerDown={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v && v !== t.name) renameTile(t.id, v);
                              setRenaming(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') setRenaming(null);
                            }}
                          />
                        ) : (
                          <TileLabel tile={t} onRename={() => setRenaming(t.id)} onDuplicate={() => duplicateTile(t.id)} onDelete={() => removeTile(t.id)} />
                        )}
                        {HANDLES.map((h) => (
                          <span key={h} className={`rb-handle rb-handle--${h}`} onPointerDown={(e) => begin(e, t, h)} aria-hidden />
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            {preview && <div className="rb-ghost" style={geo.rect(preview)} aria-hidden />}
            {dropGhost && <div className="rb-ghost" style={geo.rect(dropGhost)} aria-hidden />}
          </div>
        </div>
      </div>

      {state.modal?.kind === 'save' && (
        <Modal
          title="Save changes?"
          onClose={() => dispatch({ type: 'modal', modal: null })}
          footer={
            <>
              <button type="button" className="r-btn r-btn--ghost" onClick={() => dispatch({ type: 'modal', modal: null })}>
                Cancel
              </button>
              <button type="button" className="r-btn r-btn--primary" onClick={() => dispatch({ type: 'saveDraft' })}>
                Save
              </button>
            </>
          }
        >
          <p className="rm-text">Saving publishes the shared draft. Readers see it right away.</p>
          <div className="rm-label">Changes included</div>
          <ul className="rm-people">
            <li className="rm-person">
              <Avatar src={ME.avatar} size={28} />
              <span className="rm-person__name">
                You · {draft.undo.length} layout {draft.undo.length === 1 ? 'edit' : 'edits'}
                {draft.pendingDataEdits.length > 0 && `, ${draft.pendingDataEdits.length} data ${draft.pendingDataEdits.length === 1 ? 'edit' : 'edits'} via Stazy`}
              </span>
            </li>
          </ul>
        </Modal>
      )}

      {(state.modal?.kind === 'discard' || state.modal?.kind === 'leave') && (
        <Modal
          title={state.modal.kind === 'leave' ? 'Leave without saving?' : 'Discard draft?'}
          onClose={() => dispatch({ type: 'modal', modal: null })}
          footer={
            <>
              <button type="button" className="r-btn r-btn--ghost" onClick={() => dispatch({ type: 'modal', modal: null })}>
                Cancel
              </button>
              {state.modal.kind === 'leave' && (
                <button
                  type="button"
                  className="r-btn"
                  onClick={() => {
                    dispatch({ type: 'saveDraft' });
                    dispatch({ type: 'closeBuilder' });
                  }}
                >
                  Save & leave
                </button>
              )}
              <button
                type="button"
                className="r-btn r-btn--danger"
                onClick={() => {
                  const leaving = state.modal?.kind === 'leave';
                  dispatch({ type: 'closeBuilder' });
                  if (!leaving) dispatch({ type: 'openBuilder' }); // Discard keeps you in a fresh builder
                }}
              >
                Discard{state.modal.kind === 'leave' ? ' & leave' : ''}
              </button>
            </>
          }
        >
          <p className="rm-text">This throws away the unsaved changes below. Readers keep seeing the last saved version.</p>
          <ul className="rm-people">
            <li className="rm-person">
              <span className="rm-person__name">You · {draft.undo.length} {draft.undo.length === 1 ? 'change' : 'changes'}</span>
            </li>
          </ul>
        </Modal>
      )}
    </div>
  );
}
