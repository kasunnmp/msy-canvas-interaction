/** Reporting object model — ClickUp "Reporting App Design Spec" §2–§6. */

export type TileType =
  // Comparisons
  | 'simpleBar'
  | 'groupedBar'
  | 'floatingBar'
  | 'lollipop'
  | 'bubble'
  | 'radar'
  | 'stat'
  | 'statGroup'
  // Trends
  | 'line'
  | 'area'
  | 'boxplot'
  | 'histogram'
  | 'stream'
  // Part to whole
  | 'donut'
  | 'pie'
  | 'stackedBar'
  | 'bullet'
  | 'stackedArea'
  | 'meter'
  | 'gauge'
  | 'treemap'
  | 'circlePack'
  // Correlations
  | 'scatter'
  | 'heatmap'
  // Ungrouped
  | 'table'
  | 'keyValue'
  | 'rankedList'
  | 'funnel'
  // Builder Text tool (§8.7) — not a library Tile
  | 'text';

export type TileStatus = 'ok' | 'failed' | 'noData' | 'unbound' | 'collecting';

export type SourceKind = 'app' | 'os' | 'minion';

export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  icon: string;
}

export interface Tile {
  id: string;
  type: TileType;
  /** Tile name (§2) — independent of type and source. */
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sources: string[];
  status: TileStatus;
  /** For failed tiles: which source ids failed (others succeeded). */
  failedSources?: string[];
  /** Visual emphasis for alerting stats (e.g. Flagged anomalies). */
  tone?: 'default' | 'alert';
  /** Own refresh time when refreshed independently of the card (§18.2). */
  refreshedAt?: number;
  /** Seed for deterministic sample data. */
  seed: number;
  /** Stat flavour: delta (vs comparison) or share-of-total or alert. */
  statMode?: 'delta' | 'share' | 'alert';
  /** Text element content. */
  text?: string;
  /** Fixed sample figures for the default (Today) view, so seeded cards match the design. */
  preset?: { value?: number; delta?: number; share?: number; series?: number[]; labels?: string[] };
  /** Unit suffix for values, e.g. "%", "h", "pp". */
  unit?: string;
}

export type Role = 'owner' | 'editor' | 'viewer';
export type Access = 'Owner' | 'Editor' | 'Viewer';

export interface Person {
  id: string;
  name: string;
  avatar: string;
  access: Access;
  external?: boolean;
}

export type Category = 'mine' | 'shared';
export type TagColor = 'red' | 'green';

export interface ReportCard {
  id: string;
  name: string;
  tags: TagColor[];
  category: Category;
  /** The current user's role on this card. */
  role: Role;
  createdAt: number;
  createdBy: string;
  schedule: string;
  sharing: Person[];
  linkAccess: 'private' | 'org';
  autoRefresh: boolean;
  refreshedAt: number;
  tiles: Tile[];
  /** Stazy-written summary (§13) — owner-only, context not numbers. */
  summary?: string;
  description?: string;
  pinned: boolean;
  inTrash: boolean;
  trashReason?: string;
}

export type RangeKey = 'today' | 'week' | 'month' | 'lastWeek' | 'lastMonth' | 'thisYear' | 'range';

export interface ViewRange {
  key: RangeKey;
  start?: string; // ISO date for custom range
  end?: string;
}
