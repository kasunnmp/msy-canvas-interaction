import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import searchIcon from '../assets/search/search.svg';
import closeIcon from '../assets/search/close.svg';
import checkIcon from '../assets/search/check.svg';
import chevronIcon from '../assets/search/chevron-down.svg';
import returnIcon from '../assets/search/return.svg';
import pdfPage from '../assets/search/pdf-page.svg';
import pdfMark from '../assets/search/pdf-mark.svg';
import maiseyAvatar from '../assets/dock/a156c.png';
import maiseyGlow from '../assets/dock/ee361.png';
import messagesIcon from '../assets/dock/264ec.png';
import { CATEGORY_ORDER, SEARCH_INDEX, rank, type Category, type SearchItem, type Visual } from './searchIndex';

/* Spec "Quick Search" (ClickUp Ext - MSY Documentation) · Figma Maisey OS – Core 2364:13466 */

const NETWORK_DEBOUNCE_MS = 800; // §3 deep-index debounce
const NETWORK_MIN_CHARS = 3; // §3 minimum network threshold
const SIMULATED_LATENCY_MS = 450; // stand-in for the cloud index round-trip
const MEMORY_MS = 10 * 60 * 1000; // §1 10-minute state persistence
const MAX_VISIBLE_PILLS = 4;
const PAGE_STEP = 8;

type Filter = 'All' | Category;

/** §1 short-term memory, shared across openings. */
const memory = { query: '', filter: 'All' as Filter, at: 0 };

interface Props {
  onClose: () => void;
  onOpenItem: (item: SearchItem) => void;
  onAskMaisey: (query: string) => void;
}

export function QuickSearch({ onClose, onOpenItem, onAskMaisey }: Props) {
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  const remembered = Date.now() - memory.at < MEMORY_MS && memory.query;
  const [query, setQuery] = useState(remembered ? memory.query : '');
  const [filter, setFilter] = useState<Filter>(remembered ? memory.filter : 'All');
  const [selected, setSelected] = useState(0);
  const [networkFor, setNetworkFor] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announce, setAnnounce] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.trim();

  // Open: focus input; a remembered query comes back fully selected ("highlight-to-overwrite").
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (remembered) input.select();
  }, []);

  // Persist state for the next opening.
  useEffect(() => {
    memory.query = query;
    memory.filter = filter;
    memory.at = query ? Date.now() : 0; // Backspace to empty = hard reset
  }, [query, filter]);

  // §3 network index: 3+ chars, 800 ms debounce, then a simulated round-trip.
  useEffect(() => {
    if (q.length < NETWORK_MIN_CHARS) {
      setPending(false);
      return;
    }
    if (networkFor === q) return;
    setPending(true);
    let fetchTimer = 0;
    const debounce = window.setTimeout(() => {
      fetchTimer = window.setTimeout(() => {
        setNetworkFor(q);
        setPending(false);
      }, SIMULATED_LATENCY_MS);
    }, NETWORK_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(debounce);
      window.clearTimeout(fetchTimer);
    };
  }, [q, networkFor]);

  // Local results are instant (0 ms); network results join once loaded for this exact query.
  const results = useMemo(() => {
    if (!q) return [];
    const available = SEARCH_INDEX.filter((i) => i.local || networkFor === q);
    return rank(available, q);
  }, [q, networkFor]);

  // §4 dynamic pills: only categories that have results; shown only when there's more than one.
  const categories = useMemo(() => {
    const present = new Set(results.map((r) => r.category));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [results]);
  const showPills = categories.length > 1;
  const pillList: Filter[] = ['All', ...categories];
  const visiblePills = categories.slice(0, MAX_VISIBLE_PILLS);
  const overflowPills = categories.slice(MAX_VISIBLE_PILLS);

  // A filter whose category vanished falls back to All.
  useEffect(() => {
    if (filter !== 'All' && !categories.includes(filter)) setFilter('All');
  }, [categories, filter]);

  const shown = filter === 'All' ? results : results.filter((r) => r.category === filter);
  const noMatches = q.length > 0 && results.length === 0 && !pending;
  const skeleton = q.length > 0 && results.length === 0 && pending;
  const active = q.length > 0;

  // First item selected by default whenever the list changes (§8).
  useEffect(() => {
    setSelected(0);
  }, [q, filter, results.length]);

  // Keep the selected row in view.
  useEffect(() => {
    document.getElementById(optionId(selected))?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  // Polite, debounced result-count announcements (§8).
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!q) setAnnounce('');
      else if (noMatches) setAnnounce(`No matches for ${q}. Ask Maisey available.`);
      else if (!skeleton) setAnnounce(`${shown.length} results`);
    }, 500);
    return () => window.clearTimeout(t);
  }, [q, shown.length, noMatches, skeleton]);

  const execute = () => {
    if (noMatches) {
      onAskMaisey(q);
      return;
    }
    const item = shown[selected];
    if (item) onOpenItem(item);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const input = inputRef.current;
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        if (menuOpen) setMenuOpen(false);
        else onClose();
        return;
      case 'Enter':
        if (e.target === input || e.target === dialogRef.current) {
          e.preventDefault();
          execute();
        }
        return;
      case 'ArrowDown':
      case 'ArrowUp':
      case 'PageDown':
      case 'PageUp':
      case 'Home':
      case 'End': {
        if (!shown.length) return;
        e.preventDefault();
        const last = shown.length - 1;
        const next = {
          ArrowDown: Math.min(last, selected + 1),
          ArrowUp: Math.max(0, selected - 1),
          PageDown: Math.min(last, selected + PAGE_STEP),
          PageUp: Math.max(0, selected - PAGE_STEP),
          Home: 0,
          End: last,
        }[e.key];
        setSelected(next);
        return;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        // Pills move with Left/Right once the caret sits at the end of the query (§8).
        if (!showPills || !input) return;
        const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
        if (e.target === input && !atEnd) return;
        e.preventDefault();
        const i = pillList.indexOf(filter);
        const n = e.key === 'ArrowRight' ? Math.min(pillList.length - 1, i + 1) : Math.max(0, i - 1);
        setFilter(pillList[n]);
        return;
      }
      case 'Tab': {
        // Focus trap (§8).
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'input, button:not([tabindex="-1"]), [tabindex="0"]',
        );
        if (!focusables?.length) return;
        const list = Array.from(focusables);
        const idx = list.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (idx <= 0 ? list.length - 1 : idx - 1) : idx === list.length - 1 ? 0 : idx + 1;
        e.preventDefault();
        list[next].focus();
        return;
      }
    }
  };

  const clear = () => {
    setQuery('');
    setFilter('All');
    inputRef.current?.focus();
  };

  return (
    <div className="qs-layer">
      {/* Click anywhere outside the container dismisses (§1). */}
      <div className="qs-scrim" onClick={onClose} aria-hidden />

      <div
        ref={dialogRef}
        className={`qs${active ? ' is-active' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Quick Search"
        onKeyDown={onKeyDown}
      >
        <div className="qs__bar">
          <div className="qs__field">
            <img className="qs__search-icon" src={searchIcon} alt="" width={36} height={18} />
            <input
              ref={inputRef}
              className="qs__input"
              type="text"
              value={query}
              placeholder="Search Anything"
              onChange={(e) => setQuery(e.target.value)}
              role="combobox"
              aria-expanded={active}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active && (shown.length || noMatches) ? optionId(selected) : undefined}
              spellCheck={false}
              autoComplete="off"
            />
            {active && (
              <button type="button" className="qs__clear" onClick={clear} aria-label="Clear search">
                <img src={closeIcon} alt="" width={24} height={24} />
              </button>
            )}
          </div>
        </div>

        {active && (
          <div className="qs__body">
            {showPills && !noMatches && (
              <div className="qs__pills" role="toolbar" aria-label="Filter results">
                <div className="qs__pill-row">
                  <Pill label="All" selected={filter === 'All'} onClick={() => setFilter('All')} check />
                  {visiblePills.map((c) => (
                    <Pill key={c} label={c} selected={filter === c} onClick={() => setFilter(c)} />
                  ))}
                </div>
                {overflowPills.length > 0 && (
                  <div className="qs__more-wrap">
                    <button
                      type="button"
                      className={`qs__more${overflowPills.includes(filter as Category) ? ' is-selected' : ''}`}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen((v) => !v)}
                    >
                      <span>+{overflowPills.length}</span>
                      <img src={chevronIcon} alt="" width={20} height={20} />
                    </button>
                    {menuOpen && (
                      <div className="qs__menu" role="menu">
                        {overflowPills.map((c) => (
                          <button
                            key={c}
                            type="button"
                            role="menuitemradio"
                            aria-checked={filter === c}
                            className={`qs__menu-item${filter === c ? ' is-selected' : ''}`}
                            onClick={() => {
                              setFilter(c);
                              setMenuOpen(false);
                            }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="qs__header">
              {noMatches ? `No matches for '${q}'` : skeleton ? 'Searching…' : `Results (${shown.length})`}
            </div>

            <div ref={listRef} id={listId} className="qs__list" role="listbox" aria-label="Search results">
              {skeleton &&
                Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="qs-skeleton" aria-hidden>
                    <span className="qs-skeleton__icon" />
                    <span className="qs-skeleton__line" style={{ width: `${46 - i * 6}%` }} />
                    <span className="qs-skeleton__tail" />
                  </div>
                ))}

              {noMatches && (
                <Row
                  id={optionId(0)}
                  selected
                  onClick={() => onAskMaisey(q)}
                  visual={<MaiseyAvatar />}
                  title="Ask Maisey"
                  meta={[q]}
                  ariaLabel={`Ask Maisey AI about ${q}`}
                />
              )}

              {!noMatches &&
                shown.map((item, i) => (
                  <Row
                    key={item.id}
                    id={optionId(i)}
                    selected={i === selected}
                    onClick={() => onOpenItem(item)}
                    visual={<ItemVisual visual={item.visual} />}
                    title={item.title}
                    meta={item.meta}
                    source={item.source}
                  />
                ))}
            </div>

            {pending && results.length > 0 && <div className="qs__streaming">Showing available results...</div>}
          </div>
        )}

        <div className="sr-only" aria-live="polite">
          {announce}
        </div>
      </div>
    </div>
  );
}

function Pill({ label, selected, onClick, check }: { label: string; selected: boolean; onClick: () => void; check?: boolean }) {
  return (
    <button
      type="button"
      className={`qs-pill${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      aria-label={`${label} filter, ${selected ? 'selected' : 'unselected'}`}
      onClick={onClick}
    >
      {check && selected && (
        <span className="qs-pill__check">
          <img src={checkIcon} alt="" width={20} height={20} />
        </span>
      )}
      <span>{label}</span>
    </button>
  );
}

function Row({
  id,
  selected,
  onClick,
  visual,
  title,
  meta,
  source,
  ariaLabel,
}: {
  id: string;
  selected: boolean;
  onClick: () => void;
  visual: ReactNode;
  title: string;
  meta: string[];
  source?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-label={ariaLabel}
      className={`qs-row${selected ? ' is-selected' : ''}`}
      onPointerDown={(e) => e.preventDefault()} // keep focus in the input
      onClick={onClick}
    >
      <span className="qs-row__visual">{visual}</span>
      <span className="qs-row__text">
        <span className="qs-row__title">{title}</span>
        <span className="qs-row__meta">
          {meta.map((m, i) => (
            <span key={i} className="qs-row__meta-part">
              {i > 0 && <span className="qs-row__dot" />}
              {m}
            </span>
          ))}
        </span>
      </span>
      <span className="qs-row__right">
        {selected && (
          <span className="qs-row__return" aria-hidden>
            <img src={returnIcon} alt="" />
          </span>
        )}
        {source && <span className="qs-row__source">{source}</span>}
      </span>
    </div>
  );
}

function ItemVisual({ visual }: { visual: Visual }) {
  switch (visual.kind) {
    case 'avatar':
      return <img className="qs-avatar" src={visual.src} alt="" />;
    case 'message':
      return (
        <span className="qs-msg">
          <img className="qs-avatar" src={visual.src} alt="" />
          <img className="qs-msg__badge" src={messagesIcon} alt="" />
        </span>
      );
    case 'pdf':
      return (
        <span className="qs-pdf">
          <img className="qs-pdf__page" src={pdfPage} alt="" />
          <img className="qs-pdf__mark" src={pdfMark} alt="" />
        </span>
      );
    case 'app':
      return <img className="qs-app" src={visual.src} alt="" />;
  }
}

function MaiseyAvatar() {
  return (
    <span className="qs-maisey">
      <img src={maiseyAvatar} alt="" />
      <span className="qs-maisey__glow">
        <img src={maiseyGlow} alt="" />
      </span>
    </span>
  );
}
