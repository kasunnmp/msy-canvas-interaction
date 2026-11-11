import type { Tile } from './types';
import { kindOf } from './catalog';

/** §10: twelve fluid columns, fixed 64px row unit, fixed gutter. */
export const COLS = 12;
export const ROW = 64;
export const GUTTER = 10;

type Box = Pick<Tile, 'x' | 'y' | 'w' | 'h'>;

export const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const gridHeight = (tiles: Box[]) => tiles.reduce((m, t) => Math.max(m, t.y + t.h), 0);

/** Clamp a tile's size to its type's declared min/max and keep it inside the 12 columns (§8.5). */
export function clampTile<T extends Tile>(tile: T): T {
  const k = kindOf(tile.type);
  const w = Math.min(Math.max(tile.w, k.min.w), k.max.w, COLS);
  const h = Math.min(Math.max(tile.h, k.min.h), k.max.h);
  const x = Math.min(Math.max(0, tile.x), COLS - w);
  const y = Math.max(0, tile.y);
  return { ...tile, x, y, w, h };
}

/**
 * §8.5: when a dragged or resized Tile overlaps another, the Tiles below it shift down
 * to make room. A drop is never refused.
 */
export function pushDown(tiles: Tile[], anchorId: string): Tile[] {
  const out = tiles.map((t) => ({ ...t }));
  const anchor = out.find((t) => t.id === anchorId);
  if (!anchor) return out;
  const settled: Tile[] = [anchor];
  const rest = out.filter((t) => t.id !== anchorId).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const t of rest) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const s of settled) {
        if (overlaps(t, s)) {
          t.y = s.y + s.h;
          moved = true;
        }
      }
    }
    settled.push(t);
  }
  return out;
}

/** First free slot scanning rows top-down, left-to-right. */
export function findSpot(tiles: Box[], w: number, h: number, fromY = 0): { x: number; y: number } {
  for (let y = fromY; y < 500; y++) {
    for (let x = 0; x + w <= COLS; x++) {
      const box = { x, y, w, h };
      if (!tiles.some((t) => overlaps(box, t))) return { x, y };
    }
  }
  return { x: 0, y: gridHeight(tiles) };
}

/** §8.7 Tidy up: re-arrange placements into an ordered, gap-free layout (reading order preserved). */
export function tidy(tiles: Tile[]): Tile[] {
  const ordered = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: Tile[] = [];
  for (const t of ordered) {
    const spot = findSpot(placed, t.w, t.h);
    placed.push({ ...t, ...spot });
  }
  return placed;
}
