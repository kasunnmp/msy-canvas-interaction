import type { TileType } from './types';

/** Insert panel groups (§9). */
export type LibraryGroup = 'Comparisons' | 'Trends' | 'Part to whole' | 'Correlations' | 'More';

export interface Size {
  w: number;
  h: number;
}

export interface TileKind {
  type: TileType;
  label: string;
  group: LibraryGroup;
  min: Size;
  def: Size;
  max: Size;
  /** Short description used by the Insert panel and screen-reader text. */
  renders: string;
}

// §10 size classes (columns × rows).
const STAT = { min: { w: 2, h: 3 }, def: { w: 3, h: 3 }, max: { w: 6, h: 4 } };
const STAT_GROUP = { min: { w: 4, h: 3 }, def: { w: 6, h: 3 }, max: { w: 12, h: 4 } };
const CHART = { min: { w: 4, h: 3 }, def: { w: 6, h: 4 }, max: { w: 12, h: 8 } };
const PROPORTION = { min: { w: 3, h: 3 }, def: { w: 4, h: 4 }, max: { w: 6, h: 6 } };
const TABLE = { min: { w: 6, h: 3 }, def: { w: 8, h: 6 }, max: { w: 12, h: 12 } };
const KEY_VALUE = { min: { w: 3, h: 2 }, def: { w: 4, h: 4 }, max: { w: 6, h: 8 } };
const PROGRESS = { min: { w: 2, h: 2 }, def: { w: 3, h: 3 }, max: { w: 6, h: 5 } };
const HEATMAP = { min: { w: 6, h: 3 }, def: { w: 8, h: 4 }, max: { w: 12, h: 6 } };
const RANKED = { min: { w: 3, h: 3 }, def: { w: 4, h: 5 }, max: { w: 6, h: 10 } };
const FUNNEL = { min: { w: 3, h: 4 }, def: { w: 4, h: 6 }, max: { w: 8, h: 8 } };
const TEXT = { min: { w: 2, h: 1 }, def: { w: 4, h: 1 }, max: { w: 12, h: 4 } };

const k = (
  type: TileType,
  label: string,
  group: LibraryGroup,
  size: { min: Size; def: Size; max: Size },
  renders: string,
): TileKind => ({ type, label, group, ...size, renders });

/** The 28 library Tile types (v1) plus the Text element. */
export const TILE_KINDS: TileKind[] = [
  k('simpleBar', 'Simple bar', 'Comparisons', CHART, 'Values compared across categories'),
  k('groupedBar', 'Grouped bar', 'Comparisons', CHART, 'Two series compared per category'),
  k('floatingBar', 'Floating bar', 'Comparisons', CHART, 'Ranges from a start to an end value'),
  k('lollipop', 'Lollipop', 'Comparisons', CHART, 'Values compared as points on stems'),
  k('bubble', 'Bubble', 'Comparisons', CHART, 'Three measures as positioned circles'),
  k('radar', 'Radar', 'Comparisons', PROPORTION, 'Several measures on radial axes'),
  k('stat', 'Stat', 'Comparisons', STAT, 'A single metric with an optional delta'),
  k('statGroup', 'Stat group', 'Comparisons', STAT_GROUP, 'Two to four metrics side by side'),
  k('line', 'Line', 'Trends', CHART, 'A trend over time'),
  k('area', 'Area', 'Trends', CHART, 'A trend over time'),
  k('boxplot', 'Boxplot', 'Trends', CHART, 'Spread and median per group'),
  k('histogram', 'Histogram', 'Trends', CHART, 'Distribution of values in bins'),
  k('stream', 'Stream', 'Trends', CHART, 'Stacked trends around a baseline'),
  k('donut', 'Donut', 'Part to whole', PROPORTION, 'Part-to-whole, as a donut'),
  k('pie', 'Pie', 'Part to whole', PROPORTION, 'Part-to-whole, as a pie'),
  k('stackedBar', 'Stacked bar', 'Part to whole', CHART, 'Composition per category'),
  k('bullet', 'Bullet', 'Part to whole', PROGRESS, 'A value against target bands'),
  k('stackedArea', 'Stacked area', 'Part to whole', CHART, 'Composition over time'),
  k('meter', 'Meter', 'Part to whole', PROGRESS, 'A value as a share of capacity'),
  k('gauge', 'Gauge', 'Part to whole', PROGRESS, 'A value against a target'),
  k('treemap', 'Tree map', 'Part to whole', PROPORTION, 'Nested parts as rectangles'),
  k('circlePack', 'Circle pack', 'Part to whole', PROPORTION, 'Nested parts as circles'),
  k('scatter', 'Scatterplot', 'Correlations', CHART, 'Relationship between two measures'),
  k('heatmap', 'Heatmap', 'Correlations', HEATMAP, 'Activity density over a period'),
  k('table', 'Table', 'More', TABLE, 'Rows and columns'),
  k('keyValue', 'Key-value list', 'More', KEY_VALUE, 'Label and value pairs'),
  k('rankedList', 'Ranked list', 'More', RANKED, 'Top N with a value bar'),
  k('funnel', 'Funnel', 'More', FUNNEL, 'Sequential step drop-off'),
];

export const TEXT_KIND: TileKind = k('text', 'Text', 'More', TEXT, 'A label or note');

export const LIBRARY_GROUPS: LibraryGroup[] = ['Comparisons', 'Trends', 'Part to whole', 'Correlations', 'More'];

export function kindOf(type: TileType): TileKind {
  return type === 'text' ? TEXT_KIND : TILE_KINDS.find((t) => t.type === type)!;
}
