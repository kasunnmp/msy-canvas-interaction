import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useReporting } from '../state/store';
import type { ReportCard, Tile } from '../model/types';
import { COLS, GUTTER, ROW, findSpot } from '../model/grid';
import { exportTileFile, relativeTime } from '../model/export';
import { TileView } from '../tiles/TileView';
import { PreviewHeader } from './PreviewHeader';
import { RangeControl } from './RangeControl';
import { StazyAvatar } from './common';

/** Pixel geometry for a 12-column fluid grid with a fixed 64px row (§10). */
export function gridGeometry(width: number) {
  const colW = (width - GUTTER * (COLS - 1)) / COLS;
  return {
    colW,
    rect: (t: Pick<Tile, 'x' | 'y' | 'w' | 'h'>) => ({
      left: t.x * (colW + GUTTER),
      top: t.y * (ROW + GUTTER),
      width: t.w * colW + (t.w - 1) * GUTTER,
      height: t.h * ROW + (t.h - 1) * GUTTER,
    }),
    height: (rows: number) => rows * ROW + Math.max(0, rows - 1) * GUTTER,
  };
}

/** When the window is narrow (e.g. Stazy's chat is docked), small Tiles take two columns' worth (matches design). */
function reflow(tiles: Tile[], width: number): Tile[] {
  if (width >= 720) return tiles;
  const ordered = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: Tile[] = [];
  for (const t of ordered) {
    const w = t.w <= 3 ? Math.min(COLS, t.w * 2) : t.w;
    const spot = findSpot(placed, w, t.h);
    placed.push({ ...t, w, ...spot });
  }
  return placed;
}

function useWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w] as const;
}

/** §13 summary: owner-only, Report-Card-level, context not numbers; shown when returning after a while. */
function Summary({ card }: { card: ReportCard }) {
  const { state, dispatch } = useReporting();
  const [dismissed, setDismissed] = useState(false);
  const last = state.lastVisit[card.id];
  if (card.role !== 'owner' || !card.summary || dismissed || last) return null;
  const failed = card.tiles.some((t) => t.status === 'failed');
  return (
    <div className="rp-summary" role="note">
      <StazyAvatar size={24} />
      <div className="rp-summary__text">
        <strong>While you were away</strong>
        <p>
          {card.summary}
          {failed && ' One Tile failed on the last run.'}
        </p>
      </div>
      <button
        type="button"
        className="r-icon-btn"
        aria-label="Dismiss summary"
        onClick={() => {
          setDismissed(true);
          dispatch({ type: 'visit', id: card.id });
        }}
      >
        ×
      </button>
    </div>
  );
}

export function ReportPreview({ card }: { card: ReportCard }) {
  const { state, dispatch, range, refreshTile, runExport } = useReporting();
  const [ref, width] = useWidth();
  // Leaving the card marks this visit, so the summary isn't shown again until the next long absence (§13).
  useEffect(() => () => dispatch({ type: 'visit', id: card.id }), [card.id, dispatch]);
  const geo = gridGeometry(width);
  const tiles = useMemo(() => reflow(card.tiles, width), [card.tiles, width]);
  const rows = tiles.reduce((m, t) => Math.max(m, t.y + t.h), 0);
  const refreshing = !!state.cardRefreshing[card.id];

  return (
    <div className="rp">
      <PreviewHeader card={card} />
      <RangeControl reportId={card.id} />
      <div className="rp-scroll">
        <Summary card={card} />
        <div className="rp-grid" ref={ref} style={{ height: geo.height(rows) }}>
          {width > 0 &&
            tiles.map((t) => {
              const refreshedAt = t.refreshedAt ?? card.refreshedAt;
              const text = relativeTime(refreshedAt);
              return (
                <div key={t.id} className="rp-cell" style={geo.rect(t)} data-tile-id={t.id}>
                  <TileView
                    tile={t}
                    range={range}
                    mode="preview"
                    refreshedText={text}
                    refreshing={refreshing || !!state.tileRefreshing[t.id]}
                    onRefresh={t.type === 'text' ? undefined : () => refreshTile(card.id, t.id)}
                    onExport={(format, dest, el) => runExport(format, dest, () => void exportTileFile(format, el, t, range, text))}
                  />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
