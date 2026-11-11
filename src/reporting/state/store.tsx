import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { Person, ReportCard, Tile, TileType, ViewRange } from '../model/types';
import { createSampleReports } from '../model/sampleReports';
import { clampTile, findSpot, pushDown, tidy } from '../model/grid';
import { kindOf } from '../model/catalog';

export type Mode = 'preview' | 'builder';

export interface Toast {
  id: number;
  kind: 'progress' | 'success' | 'info' | 'error';
  text: string;
  cancellable?: boolean;
}

export type Modal =
  | { kind: 'share' }
  | { kind: 'info'; tab?: 'details' | 'people' | 'content' }
  | { kind: 'trash' }
  | { kind: 'templates' }
  | { kind: 'leave' }
  | { kind: 'save' }
  | { kind: 'discard' }
  | { kind: 'datePicker' }
  | null;

export interface Draft {
  reportId: string;
  name: string;
  tiles: Tile[];
  /** Committed data edits waiting for save (§8.4). */
  pendingDataEdits: string[];
  dirty: boolean;
  undo: { name: string; tiles: Tile[] }[];
}

export interface State {
  reports: ReportCard[];
  activeId: string | null;
  mode: Mode;
  draft: Draft | null;
  selectedTileId: string | null;
  ranges: Record<string, ViewRange>;
  savedViews: Record<string, ViewRange>;
  cardRefreshing: Record<string, boolean>;
  tileRefreshing: Record<string, boolean>;
  toasts: Toast[];
  modal: Modal;
  chatOpen: boolean;
  /** Owner's last visit per card, for the §13 summary cadence. */
  lastVisit: Record<string, number>;
  insertOpen: boolean;
}

type Action =
  | { type: 'select'; id: string | null }
  | { type: 'setMode'; mode: Mode }
  | { type: 'openBuilder' }
  | { type: 'closeBuilder' }
  | { type: 'draftTiles'; tiles: Tile[]; record?: boolean }
  | { type: 'draftName'; name: string }
  | { type: 'draftDataEdit'; note: string }
  | { type: 'undo' }
  | { type: 'saveDraft' }
  | { type: 'selectTile'; id: string | null }
  | { type: 'updateReport'; id: string; patch: Partial<ReportCard> }
  | { type: 'updateTile'; reportId: string; tileId: string; patch: Partial<Tile> }
  | { type: 'addReport'; report: ReportCard }
  | { type: 'setRange'; id: string; range: ViewRange }
  | { type: 'saveView'; id: string; range: ViewRange }
  | { type: 'cardRefreshing'; id: string; on: boolean }
  | { type: 'tileRefreshing'; id: string; on: boolean }
  | { type: 'toast'; toast: Toast }
  | { type: 'updateToast'; id: number; patch: Partial<Toast> }
  | { type: 'dismissToast'; id: number }
  | { type: 'modal'; modal: Modal }
  | { type: 'chat'; open: boolean }
  | { type: 'insert'; open: boolean }
  | { type: 'visit'; id: string };

const initial = (): State => {
  const reports = createSampleReports();
  return {
    reports,
    activeId: 'security',
    mode: 'preview',
    draft: null,
    selectedTileId: null,
    ranges: {},
    savedViews: {},
    cardRefreshing: {},
    tileRefreshing: {},
    toasts: [],
    modal: null,
    chatOpen: false,
    lastVisit: {},
    insertOpen: false,
  };
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'select':
      return { ...s, activeId: a.id, mode: 'preview', draft: null, selectedTileId: null, modal: null, insertOpen: false };
    case 'setMode':
      return { ...s, mode: a.mode };
    case 'openBuilder': {
      const r = s.reports.find((x) => x.id === s.activeId);
      if (!r) return s;
      return {
        ...s,
        mode: 'builder',
        selectedTileId: null,
        draft: s.draft?.reportId === r.id ? s.draft : { reportId: r.id, name: r.name, tiles: r.tiles.map((t) => ({ ...t })), pendingDataEdits: [], dirty: false, undo: [] },
      };
    }
    case 'closeBuilder':
      return { ...s, mode: 'preview', draft: null, selectedTileId: null, insertOpen: false, modal: null };
    case 'draftTiles': {
      if (!s.draft) return s;
      const undo = a.record === false ? s.draft.undo : [...s.draft.undo, { name: s.draft.name, tiles: s.draft.tiles }].slice(-50);
      return { ...s, draft: { ...s.draft, tiles: a.tiles, dirty: true, undo } };
    }
    case 'draftName':
      if (!s.draft) return s;
      return { ...s, draft: { ...s.draft, name: a.name, dirty: true, undo: [...s.draft.undo, { name: s.draft.name, tiles: s.draft.tiles }] } };
    case 'draftDataEdit':
      if (!s.draft) return s;
      return { ...s, draft: { ...s.draft, dirty: true, pendingDataEdits: [...s.draft.pendingDataEdits, a.note] } };
    case 'undo': {
      if (!s.draft || !s.draft.undo.length) return s;
      const prev = s.draft.undo[s.draft.undo.length - 1];
      return { ...s, draft: { ...s.draft, name: prev.name, tiles: prev.tiles, undo: s.draft.undo.slice(0, -1), dirty: true } };
    }
    case 'saveDraft': {
      if (!s.draft) return s;
      const d = s.draft;
      return {
        ...s,
        reports: s.reports.map((r) => (r.id === d.reportId ? { ...r, name: d.name, tiles: d.tiles } : r)),
        draft: { ...d, dirty: false, undo: [], pendingDataEdits: [] }, // §8.9 undo clears on Save
        modal: null,
      };
    }
    case 'selectTile':
      return { ...s, selectedTileId: a.id };
    case 'updateReport':
      return { ...s, reports: s.reports.map((r) => (r.id === a.id ? { ...r, ...a.patch } : r)) };
    case 'updateTile':
      return {
        ...s,
        reports: s.reports.map((r) =>
          r.id === a.reportId ? { ...r, tiles: r.tiles.map((t) => (t.id === a.tileId ? { ...t, ...a.patch } : t)) } : r,
        ),
        draft:
          s.draft?.reportId === a.reportId
            ? { ...s.draft, tiles: s.draft.tiles.map((t) => (t.id === a.tileId ? { ...t, ...a.patch } : t)) }
            : s.draft,
      };
    case 'addReport':
      return { ...s, reports: [...s.reports, a.report] };
    case 'setRange':
      return { ...s, ranges: { ...s.ranges, [a.id]: a.range } };
    case 'saveView':
      return { ...s, savedViews: { ...s.savedViews, [a.id]: a.range } };
    case 'cardRefreshing':
      return { ...s, cardRefreshing: { ...s.cardRefreshing, [a.id]: a.on } };
    case 'tileRefreshing':
      return { ...s, tileRefreshing: { ...s.tileRefreshing, [a.id]: a.on } };
    case 'toast':
      return { ...s, toasts: [...s.toasts.filter((t) => t.id !== a.toast.id), a.toast].slice(-3) };
    case 'updateToast':
      return { ...s, toasts: s.toasts.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t)) };
    case 'dismissToast':
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
    case 'modal':
      return { ...s, modal: a.modal };
    case 'chat':
      return { ...s, chatOpen: a.open };
    case 'insert':
      return { ...s, insertOpen: a.open };
    case 'visit':
      return { ...s, lastVisit: { ...s.lastVisit, [a.id]: Date.now() } };
  }
}

type Ctx = ReturnType<typeof useReportingStore>;
const ReportingContext = createContext<Ctx | null>(null);

function useReportingStore() {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const toastSeq = useRef(1);
  const timers = useRef(new Map<number, number>());

  const active = useMemo(() => state.reports.find((r) => r.id === state.activeId) ?? null, [state.reports, state.activeId]);
  const range: ViewRange = (active && (state.ranges[active.id] ?? state.savedViews[active.id])) || { key: 'today' };

  const toast = useCallback((t: Omit<Toast, 'id'>, ttl = 3200) => {
    const id = toastSeq.current++;
    dispatch({ type: 'toast', toast: { ...t, id } });
    if (t.kind !== 'progress') window.setTimeout(() => dispatch({ type: 'dismissToast', id }), ttl);
    return id;
  }, []);

  /** §18.2 Run now: refresh the whole Report Card. */
  const refreshCard = useCallback((id: string) => {
    if (stateRef.current.cardRefreshing[id]) return;
    dispatch({ type: 'cardRefreshing', id, on: true });
    window.setTimeout(() => {
      const r = stateRef.current.reports.find((x) => x.id === id);
      dispatch({
        type: 'updateReport',
        id,
        patch: {
          refreshedAt: Date.now(),
          tiles: r?.tiles.map((t) => ({ ...t, refreshedAt: undefined })),
        },
      });
      dispatch({ type: 'cardRefreshing', id, on: false });
    }, 1400);
  }, []);

  /** §19 per-Tile refresh — touches only that Tile's own footer. */
  const refreshTile = useCallback((reportId: string, tileId: string) => {
    if (stateRef.current.tileRefreshing[tileId]) return;
    dispatch({ type: 'tileRefreshing', id: tileId, on: true });
    window.setTimeout(() => {
      dispatch({ type: 'updateTile', reportId, tileId, patch: { refreshedAt: Date.now() } });
      dispatch({ type: 'tileRefreshing', id: tileId, on: false });
    }, 1100);
  }, []);

  /** Simulated export job with progress toast and Cancel (§17.3). */
  const runExport = useCallback(
    (format: string, destination: 'device' | 'Apollo', work?: () => void) => {
      const id = toast({ kind: 'progress', text: `Generating a ${format}…`, cancellable: true });
      const timer = window.setTimeout(() => {
        timers.current.delete(id);
        if (destination === 'device') work?.();
        dispatch({
          type: 'updateToast',
          id,
          patch: { kind: 'success', text: `${format} exported to ${destination === 'device' ? 'your device' : 'Apollo'}`, cancellable: false },
        });
        window.setTimeout(() => dispatch({ type: 'dismissToast', id }), 3200);
      }, 1300);
      timers.current.set(id, timer);
    },
    [toast],
  );

  const cancelToast = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    dispatch({ type: 'dismissToast', id });
  }, []);

  // ── Builder layout edits (§8.4: applied instantly to the draft, no commit gate) ──
  const draftTiles = () => stateRef.current.draft?.tiles ?? [];

  const placeTile = useCallback((tile: Tile, record = true) => {
    const clamped = clampTile(tile);
    const others = draftTiles().filter((t) => t.id !== tile.id);
    dispatch({ type: 'draftTiles', tiles: pushDown([...others, clamped], clamped.id), record });
  }, []);

  const addTile = useCallback((type: TileType, at?: { x: number; y: number }) => {
    const k = kindOf(type);
    const tiles = draftTiles();
    const spot = at ?? findSpot(tiles, k.def.w, k.def.h);
    const id = `t${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`;
    const tile: Tile = {
      id,
      type,
      name: type === 'text' ? 'Text' : k.label,
      x: spot.x,
      y: spot.y,
      w: k.def.w,
      h: k.def.h,
      sources: [],
      // §8.4: adding from the library places an unbound Tile; binding goes through Stazy.
      status: type === 'text' ? 'ok' : 'unbound',
      seed: Math.floor(Math.random() * 1e6),
      text: type === 'text' ? '' : undefined,
    };
    const clamped = clampTile(tile);
    dispatch({ type: 'draftTiles', tiles: pushDown([...tiles, clamped], clamped.id) });
    dispatch({ type: 'selectTile', id });
    return id;
  }, []);

  const removeTile = useCallback((id: string) => {
    dispatch({ type: 'draftTiles', tiles: draftTiles().filter((t) => t.id !== id) });
    dispatch({ type: 'selectTile', id: null });
  }, []);

  /** §8.8 Duplicate: lands directly below the original, pushing Tiles below it down. */
  const duplicateTile = useCallback((id: string) => {
    const tiles = draftTiles();
    const src = tiles.find((t) => t.id === id);
    if (!src) return;
    const copy: Tile = { ...src, id: `${src.id}c${Date.now().toString(36)}`, y: src.y + src.h, seed: src.seed + 1 };
    dispatch({ type: 'draftTiles', tiles: pushDown([...tiles, copy], copy.id) });
    dispatch({ type: 'selectTile', id: copy.id });
  }, []);

  const renameTile = useCallback((id: string, name: string) => {
    dispatch({ type: 'draftTiles', tiles: draftTiles().map((t) => (t.id === id ? { ...t, name } : t)) });
  }, []);

  const setTileText = useCallback((id: string, text: string) => {
    dispatch({ type: 'draftTiles', tiles: draftTiles().map((t) => (t.id === id ? { ...t, text } : t)), record: false });
  }, []);

  const tidyUp = useCallback(() => dispatch({ type: 'draftTiles', tiles: tidy(draftTiles()) }), []);

  const sharePerson = useCallback((reportId: string, person: Person) => {
    const r = stateRef.current.reports.find((x) => x.id === reportId);
    if (!r || r.sharing.some((p) => p.id === person.id)) return;
    dispatch({ type: 'updateReport', id: reportId, patch: { sharing: [...r.sharing, person] } });
  }, []);

  // §16 Auto refresh: every 30 minutes while the card is open (and not in Trash).
  useEffect(() => {
    if (!active?.autoRefresh || active.inTrash || state.mode !== 'preview') return;
    const t = window.setInterval(() => refreshCard(active.id), 30 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [active?.id, active?.autoRefresh, active?.inTrash, state.mode, refreshCard]);

  return {
    state,
    dispatch,
    active,
    range,
    toast,
    cancelToast,
    refreshCard,
    refreshTile,
    runExport,
    placeTile,
    addTile,
    removeTile,
    duplicateTile,
    renameTile,
    setTileText,
    tidyUp,
    sharePerson,
  };
}

export function ReportingProvider({ children }: { children: ReactNode }) {
  const store = useReportingStore();
  return <ReportingContext.Provider value={store}>{children}</ReportingContext.Provider>;
}

export function useReporting() {
  const ctx = useContext(ReportingContext);
  if (!ctx) throw new Error('useReporting must be used inside ReportingProvider');
  return ctx;
}
