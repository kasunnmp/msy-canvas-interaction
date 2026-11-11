import type { RangeKey, Tile, ViewRange } from './types';
import { SOURCES } from './sampleReports';

/* Deterministic sample data for every Tile type, driven by the viewer's date range (§20). */

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** x-axis labels for a range. */
export function rangeLabels(range: ViewRange): string[] {
  switch (range.key) {
    case 'today':
      return ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'];
    case 'week':
    case 'lastWeek':
      return DAYS;
    case 'month':
    case 'lastMonth':
      return ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5'];
    case 'thisYear':
      return MONTHS.slice(0, 7);
    case 'range': {
      if (!range.start || !range.end) return DAYS;
      const s = new Date(range.start);
      const e = new Date(range.end);
      const days = Math.max(1, Math.round((+e - +s) / 864e5) + 1);
      const step = Math.max(1, Math.ceil(days / 8));
      const out: string[] = [];
      for (let i = 0; i < days; i += step) {
        const d = new Date(+s + i * 864e5);
        out.push(`${d.getDate()} ${MONTHS[d.getMonth()]}`);
      }
      return out;
    }
  }
}

/** §20: the comparison period follows the date range automatically. */
export function comparisonLabel(key: RangeKey): string {
  return {
    today: 'vs yesterday',
    week: 'vs last week',
    month: 'vs last month',
    lastWeek: 'vs the week before',
    lastMonth: 'vs the month before',
    thisYear: 'vs last year',
    range: 'vs previous period',
  }[key];
}

const scaleFor = (key: RangeKey) =>
  ({ today: 1, week: 6.5, month: 27, lastWeek: 6.2, lastMonth: 26, thisYear: 160, range: 9 })[key];

export interface CategoryDatum {
  group: string;
  key: string;
  value: number;
}

export interface TileData {
  labels: string[];
  value: number;
  previous: number;
  delta: number; // percent change vs comparison period
  share?: number;
  series: number[];
  series2: number[];
  categories: { label: string; value: number }[];
  /** Flat rows for CSV export / text equivalent (§7.4, §17.2). */
  rows: Record<string, string | number>[];
}

const CATS = ['Cardiology', 'Oncology', 'Neurology', 'Surgery', 'Pediatrics', 'Emergency', 'Radiology', 'ICU'];

export function tileData(tile: Tile, range: ViewRange): TileData {
  const rnd = mulberry32(tile.seed * 977 + hash(range.key + (range.start ?? '') + (range.end ?? '')));
  const labels = rangeLabels(range);
  const isDefault = range.key === 'today' && tile.preset;
  const scale = scaleFor(range.key);

  const base = Math.max(3, Math.round((tile.preset?.value ?? 40 + rnd() * 300) * (isDefault ? 1 : scale * (0.7 + rnd() * 0.5))));
  const delta = isDefault && tile.preset?.delta !== undefined ? tile.preset.delta : Math.round((rnd() * 24 - 8) * 10) / 10;
  const previous = Math.round(base / (1 + delta / 100));

  const series =
    isDefault && tile.preset?.series
      ? tile.preset.series
      : labels.map((_, i) => Math.max(0, Math.round((base / labels.length) * (0.4 + rnd() * 1.4) + Math.sin(i / 1.3) * 6)));
  const series2 = series.map((v) => Math.max(0, Math.round(v * (0.5 + rnd() * 0.6))));
  const categories = CATS.slice(0, 5 + Math.floor(rnd() * 3)).map((label) => ({
    label,
    value: Math.max(1, Math.round(base * (0.15 + rnd() * 0.9))),
  }));
  const share = tile.preset?.share ?? Math.round(rnd() * 400) / 10;
  const value = tile.unit === '%' ? Math.round((tile.preset?.value ?? 5 + rnd() * 40) * 10) / 10 : base;

  const src = tile.sources.map((id) => SOURCES[id]?.name ?? id).join(' + ');
  const comparison = comparisonLabel(range.key);
  const rows: Record<string, string | number>[] =
    tile.type === 'stat' || tile.type === 'gauge' || tile.type === 'meter' || tile.type === 'bullet'
      ? [{ label: tile.name, value, delta: `${delta}%`, Source: src, Comparison: comparison }]
      : ['donut', 'pie', 'simpleBar', 'lollipop', 'rankedList', 'keyValue', 'treemap', 'circlePack', 'funnel', 'radar', 'table'].includes(tile.type)
        ? categories.map((c) => ({ category: c.label, value: c.value, Source: src, Comparison: comparison }))
        : labels.map((l, i) => ({ period: l, value: series[i] ?? 0, previous: series2[i] ?? 0, Source: src, Comparison: comparison }));

  return { labels, value, previous, delta, share, series, series2, categories, rows };
}

export function formatNumber(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 10000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k`;
  return n.toLocaleString('en-US');
}
