import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import backIcon from '../assets/launcher/back.svg';
import wallpaper from '../assets/wallpaper.png';
import { LAUNCHER_APPS, searchApps, type LauncherApp } from './launcherApps';

/** 1440 × 900: max 4 rows × 7 items per page (ClickUp spec §3.4). */
const COLS = 7;
const ROWS = 4;
const PAGE_SIZE = COLS * ROWS;

const CLOSE_MS = 220;
const PRESS_MS = 120;

interface Props {
  open: boolean;
  onClose: () => void;
  onLaunch: (app: LauncherApp) => void;
}

/**
 * Full-screen App Launcher (ClickUp "App Launcher" spec, Figma Maisey OS – Core 139:3745).
 * Sits above the canvas with a blurred backdrop, below the status bar. The dock is hidden by
 * the parent while this is open.
 */
export function AppLauncher({ open, onClose, onLaunch }: Props) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  if (!mounted) return null;
  return <LauncherSurface closing={closing} onClose={onClose} onLaunch={onLaunch} />;
}

function LauncherSurface({
  closing,
  onClose,
  onLaunch,
}: {
  closing: boolean;
  onClose: () => void;
  onLaunch: (app: LauncherApp) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wheelLock = useRef(0);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);

  const results = useMemo(() => searchApps(LAUNCHER_APPS, query), [query]);
  const pages = useMemo(() => {
    const out: LauncherApp[][] = [];
    for (let i = 0; i < results.length; i += PAGE_SIZE) out.push(results.slice(i, i + PAGE_SIZE));
    return out;
  }, [results]);
  const pageCount = Math.max(1, pages.length);

  // Search is focused as soon as the launcher opens (spec §7).
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Results change → back to the first page; highlight the best match while searching.
  useEffect(() => {
    setPage(0);
    setSelected(query.trim() && results.length ? 0 : null);
  }, [query, results.length]);

  const goToPage = (p: number) => setPage(Math.max(0, Math.min(pageCount - 1, p)));

  const launch = (app: LauncherApp) => {
    if (pressed || closing) return;
    setPressed(app.id);
    window.setTimeout(() => onLaunch(app), PRESS_MS);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'Enter') {
      const app = results[selected ?? 0];
      if (app) launch(app);
      return;
    }
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
    if (step === undefined || !results.length) return;
    // Left/Right inside the search text should still move the caret when there's text.
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && query && selected === null) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(results.length - 1, (selected ?? -step) + step));
    setSelected(next);
    setPage(Math.floor(next / PAGE_SIZE));
  };

  // Scroll / trackpad swipe → next or previous page.
  const onWheel = (e: ReactWheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const now = performance.now();
    if (Math.abs(delta) < 12 || now < wheelLock.current) return;
    wheelLock.current = now + 550;
    goToPage(page + (delta > 0 ? 1 : -1));
  };

  // Pointer swipe on the grid.
  const onPointerDown = (e: ReactPointerEvent) => {
    drag.current = { x: e.clientX, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (drag.current && Math.abs(e.clientX - drag.current.x) > 8) drag.current.moved = true;
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 60) goToPage(page + (dx < 0 ? 1 : -1));
  };

  return (
    <div
      className={`launcher${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="App Launcher"
      onKeyDown={onKeyDown}
      onWheel={onWheel}
    >
      <div
        className="launcher__backdrop"
        style={{ ['--launcher-wallpaper' as string]: `url(${wallpaper})` }}
        aria-hidden
      />

      <div className="launcher__surface">
        <div className="launcher__top">
          <button type="button" className="launcher__back" onClick={onClose} aria-label="Close launcher">
            <img src={backIcon} alt="" width={24} height={24} />
          </button>
          <div className="launcher__search">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search apps"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>

        {results.length === 0 ? (
          <div className="launcher__empty">No apps found</div>
        ) : (
          <div
            className="launcher__viewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (drag.current = null)}
          >
            <div className="launcher__track" style={{ transform: `translateX(${-page * 100}%)` }}>
              {pages.map((items, p) => (
                <div className="launcher__page" key={p} aria-hidden={p !== page}>
                  <div className="launcher__grid">
                    {items.map((app, i) => {
                      const index = p * PAGE_SIZE + i;
                      return (
                        <button
                          key={app.id}
                          type="button"
                          className={`launcher-app${selected === index ? ' is-selected' : ''}${
                            pressed === app.id ? ' is-pressed' : ''
                          }`}
                          tabIndex={p === page ? 0 : -1}
                          onClick={() => {
                            if (drag.current?.moved) return;
                            launch(app);
                          }}
                          onMouseEnter={() => setSelected(index)}
                        >
                          <span className="launcher-app__icon">
                            <img src={app.icon} alt="" draggable={false} />
                          </span>
                          <span className="launcher-app__label">{app.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {results.length > 0 && pageCount > 1 && (
          <div className="launcher__dots" role="tablist" aria-label="Launcher pages">
            {pages.map((_, p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={p === page}
                aria-label={`Page ${p + 1}`}
                className={`launcher__dot${p === page ? ' is-active' : ''}`}
                onClick={() => goToPage(p)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
