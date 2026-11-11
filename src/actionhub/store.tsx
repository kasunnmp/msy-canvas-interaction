import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { seedItems, seedLists, isOpen, MAX_LISTS, SECTIONS, type Item, type List, type Section, type TypeTag } from './model';

export type View = { kind: 'all' } | { kind: 'section'; id: Section } | { kind: 'list'; id: string };

export type Modal =
  | { kind: 'newTask'; mode: 'task' | 'brain'; listId?: string }
  | { kind: 'newList'; moveItemIds?: string[] }
  | { kind: 'editList'; listId: string }
  | { kind: 'deleteList'; listId: string }
  | { kind: 'move'; itemIds: string[] }
  | { kind: 'maisey'; text: string; listId: string }
  | null;

export interface Toast {
  id: number;
  text: string;
  icon?: string;
  action?: { label: string; run: () => void };
}

export type Chip = TypeTag | 'Snoozed';

function useActionHubStore() {
  const [items, setItems] = useState<Item[]>(seedItems);
  const [lists, setLists] = useState<List[]>(seedLists);
  const [view, setViewState] = useState<View>({ kind: 'all' });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [query, setQuery] = useState('');
  const [chips, setChips] = useState<Chip[]>([]);
  const [sort, setSort] = useState<'priority' | 'date'>('priority');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [bump, setBump] = useState<Record<string, number>>({});
  const [summaryNote, setSummaryNote] = useState<string | null>(null);
  const seq = useRef(1);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const setView = useCallback((v: View) => {
    setViewState(v);
    setChips([]);
    setSelecting(false);
    setSelected([]);
    setQuery('');
  }, []);

  const toast = useCallback((t: Omit<Toast, 'id'>, ttl = 4200) => {
    const id = seq.current++;
    setToasts((x) => [...x.slice(-2), { ...t, id }]);
    window.setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), ttl);
  }, []);
  const dismissToast = (id: number) => setToasts((x) => x.filter((y) => y.id !== id));

  const patch = useCallback((id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x))), []);
  const patchMany = useCallback((ids: string[], p: Partial<Item>) => setItems((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, ...p } : x))), []);

  const pulse = useCallback((key: string) => setBump((b) => ({ ...b, [key]: (b[key] ?? 0) + 1 })), []);

  // ── counts (§3) ──
  const counts = useMemo(() => {
    const open = items.filter(isOpen);
    const sec = Object.fromEntries(SECTIONS.map((s) => [s.id, open.filter((i) => i.section === s.id).length])) as Record<Section, number>;
    const all = open.filter((i) => i.section).length;
    const list = Object.fromEntries(lists.map((l) => [l.id, open.filter((i) => i.kind === 'task' && i.listId === l.id).length]));
    return { sec, all, list };
  }, [items, lists]);

  const listName = (id?: string) => lists.find((l) => l.id === id)?.name ?? 'Backlog';
  const listIcon = (id?: string) => lists.find((l) => l.id === id)?.icon ?? 'checklist';

  const toggleDone = useCallback(
    (id: string) => {
      const it = itemsRef.current.find((x) => x.id === id);
      if (!it) return;
      patch(id, { done: !it.done, doneDay: !it.done ? 0 : undefined });
    },
    [patch],
  );

  /** §5.3 Move to Trash (tasks only) with Undo. */
  const trash = useCallback(
    (ids: string[]) => {
      const tasks = itemsRef.current.filter((i) => ids.includes(i.id) && i.kind === 'task');
      if (!tasks.length) return;
      patchMany(
        tasks.map((t) => t.id),
        { trashed: true },
      );
      setDetailId((d) => (d && tasks.some((t) => t.id === d) ? null : d));
      toast({
        text: tasks.length === 1 ? 'Task trashed!' : `${tasks.length} tasks trashed!`,
        action: { label: 'Undo', run: () => patchMany(tasks.map((t) => t.id), { trashed: false }) },
      });
    },
    [patchMany, toast],
  );

  /** §5.1 Snooze: the item stays visible with a snooze icon and moves below the others. */
  const snooze = useCallback((ids: string[], at: string | undefined) => patchMany(ids, { snoozedUntil: at }), [patchMany]);

  /** §7 Move to list. */
  const moveToList = useCallback(
    (ids: string[], listId: string, opts: { navigate?: boolean } = {}) => {
      setItems((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, listId } : x)));
      pulse(listId);
      const l = lists.find((x) => x.id === listId);
      if (opts.navigate) {
        setView({ kind: 'list', id: listId });
        setDetailId(null);
      } else
        toast({
          text: `Moved ${ids.length} ${ids.length === 1 ? 'item' : 'items'} to ${l?.name ?? 'list'}`,
          icon: l?.icon,
          action: { label: 'Go to list', run: () => (setView({ kind: 'list', id: listId }), setDetailId(null)) },
        });
    },
    [lists, pulse, toast, setView],
  );

  const createList = useCallback(
    (name: string, icon: string) => {
      const id = `l${Date.now().toString(36)}`;
      setLists((ls) => [...ls, { id, name, icon }]);
      return id;
    },
    [],
  );
  const canCreateList = lists.length - 1 < MAX_LISTS;

  const updateList = (id: string, p: Partial<List>) => setLists((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)));

  /** §6.5 Deleting a list: move its open items elsewhere, or delete along with its items. Backlog can't be deleted. */
  const deleteList = (id: string, moveTo: string | null) => {
    if (id === 'backlog') return;
    setItems((xs) =>
      xs.map((x) => (x.listId !== id ? x : moveTo ? (x.done ? { ...x, trashed: true } : { ...x, listId: moveTo }) : { ...x, trashed: true })),
    );
    setLists((ls) => ls.filter((l) => l.id !== id));
    setView({ kind: 'all' });
  };

  const addTask = useCallback(
    (t: Partial<Item> & { title: string; listId: string }, opts: { toast?: boolean } = {}) => {
      const id = `n${Date.now().toString(36)}${seq.current++}`;
      const item: Item = {
        id,
        kind: 'task',
        typeTag: 'Task',
        ago: 'Now',
        day: 0,
        weight: 200,
        priority: 0,
        tags: [],
        assignees: [],
        attachments: [],
        subtasks: [],
        comments: [],
        activity: ['You created this task'],
        done: false,
        trashed: false,
        ...t,
      };
      // Tasks assigned to others surface under People; High priority under Needs you.
      if (!item.section) item.section = item.priority === 1 ? 'needsYou' : item.assignees.some((a) => a !== 'me') ? 'people' : undefined;
      setItems((xs) => [item, ...xs]);
      pulse(t.listId);
      if (opts.toast !== false) {
        const l = lists.find((x) => x.id === t.listId);
        toast({
          text: `Task added to ${l?.name ?? 'Backlog'}`,
          icon: l?.icon,
          action: { label: 'Go to list', run: () => setView({ kind: 'list', id: t.listId }) },
        });
      }
      return id;
    },
    [lists, pulse, toast, setView],
  );

  return {
    items,
    setItems,
    lists,
    view,
    setView,
    detailId,
    setDetailId,
    modal,
    setModal,
    toasts,
    toast,
    dismissToast,
    query,
    setQuery,
    chips,
    setChips,
    sort,
    setSort,
    selecting,
    setSelecting,
    selected,
    setSelected,
    feedbackFor,
    setFeedbackFor,
    bump,
    pulse,
    counts,
    listName,
    listIcon,
    patch,
    patchMany,
    toggleDone,
    trash,
    snooze,
    moveToList,
    createList,
    canCreateList,
    updateList,
    deleteList,
    addTask,
    summaryNote,
    setSummaryNote,
  };
}

type Ctx = ReturnType<typeof useActionHubStore>;
const C = createContext<Ctx | null>(null);

export function ActionHubProvider({ children }: { children: ReactNode }) {
  const s = useActionHubStore();
  return <C.Provider value={s}>{children}</C.Provider>;
}

export function useHub() {
  const c = useContext(C);
  if (!c) throw new Error('useHub outside provider');
  return c;
}
