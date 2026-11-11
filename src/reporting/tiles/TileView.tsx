import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Tile, ViewRange } from '../model/types';
import { comparisonLabel, formatNumber, tileData, type TileData } from '../model/data';
import { SOURCES, STAZY_AVATAR } from '../model/sampleReports';
import { kindOf } from '../model/catalog';
import { Chart, CARBON_TYPES, type Ladder } from './Charts';
import type { TileFormat } from '../model/export';
import arrowUp from '../assets/arrow-up-green.svg';
import warningIcon from '../assets/warning.svg';
import tileReload from '../assets/tile-reload.svg';

export type TileMode = 'preview' | 'builder';

interface Props {
  tile: Tile;
  range: ViewRange;
  mode: TileMode;
  refreshedText: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  onExport?: (format: TileFormat, destination: 'device' | 'Apollo', el: HTMLElement | null) => void;
  /** Builder-only: edit the Text element in place. */
  editingText?: boolean;
  onTextChange?: (text: string) => void;
  onAskStazy?: () => void;
}

/** Observe the Tile's own box (§7: a Tile responds to its own box, not the viewport). */
function useBox<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox({ w: el.offsetWidth || r.width, h: el.offsetHeight || r.height });
    const ro = new ResizeObserver(() => setBox({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, box] as const;
}

/** §7.1 priority ladder from the Tile's own box (not the viewport). */
function ladderFor(w: number, h: number) {
  const collapsed = w > 0 && (w < 150 || h < 104);
  return {
    collapsed,
    tier1: !collapsed,
    tier2: w >= 250 && h >= 170,
    tier3: w >= 420 && h >= 250,
    fullFooter: w >= 170 && h >= 140,
    wide: w > h * 1.6,
  };
}

const DeltaArrow = ({ down }: { down: boolean }) =>
  down ? (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path d="M10 4v11m0 0-4.5-4.5M10 15l4.5-4.5" fill="none" stroke="#ce2c31" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <img src={arrowUp} alt="" width={20} height={20} />
  );

function Delta({ d, compare, showCompare }: { d: TileData; compare: string; showCompare: boolean }) {
  const down = d.delta < 0;
  return (
    <div className="rt-delta">
      <DeltaArrow down={down} />
      <span className={`rt-delta__v${down ? ' is-down' : ''}`}>{Math.abs(d.delta).toFixed(1)}%</span>
      {showCompare && <span className="rt-delta__cmp">{compare}</span>}
    </div>
  );
}

function StatBody({ tile, d, l, compare }: { tile: Tile; d: TileData; l: ReturnType<typeof ladderFor>; compare: string }) {
  const alert = tile.statMode === 'alert';
  return (
    <div className="rt-stat">
      <div className={`rt-value${alert ? ' is-alert' : ''}`}>
        {formatNumber(d.value, !l.tier2)}
        {tile.unit}
      </div>
      {alert ? (
        <div className="rt-alert">
          <img src={warningIcon} alt="" width={20} height={20} />
          <span>Needs review</span>
        </div>
      ) : tile.statMode === 'share' ? (
        <div className="rt-share">{d.share}% of total</div>
      ) : (
        <Delta d={d} compare={compare} showCompare={l.tier2} />
      )}
    </div>
  );
}

function StatGroupBody({ tile, d, compare, l }: { tile: Tile; d: TileData; compare: string; l: ReturnType<typeof ladderFor> }) {
  const metrics = [
    { label: 'Total', value: d.value, delta: d.delta },
    { label: 'Password', value: Math.round(d.value * 0.62), delta: d.delta - 2.1 },
    { label: 'SSO', value: Math.round(d.value * 0.31), delta: d.delta + 3.4 },
  ];
  return (
    <div className={`rt-statgroup${tile.w < 6 || !l.wide ? ' is-wrapped' : ''}`}>
      {metrics.map((m) => (
        <div key={m.label} className="rt-statgroup__item">
          <div className="rt-statgroup__label">{m.label}</div>
          <div className="rt-value rt-value--sm">{formatNumber(m.value, true)}</div>
          {l.tier2 && <Delta d={{ ...d, delta: Math.round(m.delta * 10) / 10 }} compare={compare} showCompare={false} />}
        </div>
      ))}
      {l.tier2 && <div className="rt-statgroup__cmp">{compare}</div>}
    </div>
  );
}

function TableBody({ d }: { d: TileData }) {
  return (
    <div className="rt-table-wrap">
      <table className="rt-table">
        <thead>
          <tr>
            <th>Department</th>
            <th>Value</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {d.categories.map((c, i) => {
            const ch = ((i * 37) % 19) - 7;
            return (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td>{formatNumber(c.value)}</td>
                <td className={ch < 0 ? 'is-down' : 'is-up'}>
                  {ch > 0 ? '+' : ''}
                  {ch}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KeyValueBody({ d }: { d: TileData }) {
  return (
    <dl className="rt-kv">
      {d.categories.map((c) => (
        <div key={c.label} className="rt-kv__row">
          <dt>{c.label}</dt>
          <dd>{formatNumber(c.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function RankedBody({ d }: { d: TileData }) {
  const sorted = [...d.categories].sort((a, b) => b.value - a.value);
  const max = sorted[0]?.value || 1;
  return (
    <ol className="rt-ranked">
      {sorted.map((c, i) => (
        <li key={c.label}>
          <span className="rt-ranked__n">{i + 1}</span>
          <span className="rt-ranked__label">{c.label}</span>
          <span className="rt-ranked__bar">
            <span style={{ width: `${(c.value / max) * 100}%` }} />
          </span>
          <span className="rt-ranked__v">{formatNumber(c.value, true)}</span>
        </li>
      ))}
    </ol>
  );
}

function FunnelBody({ d, l }: { d: TileData; l: ReturnType<typeof ladderFor> }) {
  const steps = ['Attempted', 'Credentials OK', 'MFA passed', 'Session started'];
  const top = d.value * 1.4;
  const vals = [top, top * 0.82, top * 0.66, top * 0.6].map(Math.round);
  return (
    <div className="rt-funnel">
      {steps.map((s, i) => (
        <div key={s} className="rt-funnel__step">
          <div className="rt-funnel__bar" style={{ width: `${(vals[i] / top) * 100}%` }}>
            {l.tier2 && <span>{formatNumber(vals[i])}</span>}
          </div>
          <div className="rt-funnel__label">
            {s}
            {i > 0 && l.tier2 && <em> · {Math.round((vals[i] / vals[i - 1]) * 100)}%</em>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SourceAvatars({ ids }: { ids: string[] }) {
  return (
    <span className="rt-src-avatars">
      {ids.map((id) => {
        const s = SOURCES[id];
        if (!s) return null;
        return <img key={id} className={s.kind === 'minion' ? 'is-round' : 'is-squircle'} src={s.icon} alt={s.name} title={s.name} />;
      })}
    </span>
  );
}

/** Overflow menu for per-Tile export (§17) — Preview only. */
function OverflowMenu({ disabled, onPick }: { disabled: boolean; onPick: (f: TileFormat, dest: 'device' | 'Apollo') => void }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<TileFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setFormat(null);
      }
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [open]);
  return (
    <div className="rt-overflow" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`rt-overflow__btn${open ? ' is-open' : ''}`}
        aria-label="Tile options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setFormat(null);
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <circle cx="10" cy="4.5" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="15.5" r="1.6" />
        </svg>
      </button>
      {open && (
        <div className="r-menu rt-overflow__menu" role="menu">
          {!format ? (
            (['PDF', 'PNG', 'CSV'] as TileFormat[]).map((f) => (
              <button key={f} type="button" role="menuitem" className="r-menu__item" disabled={disabled} onClick={() => setFormat(f)}>
                Export as {f}
              </button>
            ))
          ) : (
            <>
              <div className="r-menu__label">Export {format} to</div>
              {(['device', 'Apollo'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="menuitem"
                  className="r-menu__item"
                  onClick={() => {
                    onPick(format, d);
                    setOpen(false);
                    setFormat(null);
                  }}
                >
                  {d === 'device' ? 'Your device' : 'Apollo'}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Footer({
  text,
  refreshing,
  onRefresh,
  full,
  tile,
}: {
  text: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  full: boolean;
  tile: Tile;
}) {
  const label = refreshing ? 'Refreshing…' : `Refreshed ${text}`;
  const srcText = tile.sources.map((id) => SOURCES[id]?.name).filter(Boolean).join(' + ') || 'No source';
  const content = (
    <>
      <span className="rt-footer__text">{label}</span>
      {onRefresh &&
        (refreshing ? <span className="r-spinner" aria-hidden /> : <img className="rt-footer__icon" src={tileReload} alt="" width={20} height={20} />)}
    </>
  );
  if (full) {
    return onRefresh ? (
      <button type="button" className="rt-footer" onClick={(e) => (e.stopPropagation(), onRefresh())} title={srcText} aria-label={`${label}. Refresh tile`}>
        {content}
      </button>
    ) : (
      <div className="rt-footer" title={srcText}>
        {content}
      </div>
    );
  }
  // §7.2: at small sizes attribution collapses to a persistent leading-edge indicator; reveal shows it in full.
  return (
    <div className="rt-edge" tabIndex={-1}>
      <span className={`rt-edge__bar${refreshing ? ' is-busy' : ''}`} aria-hidden />
      <div className="rt-edge__reveal" role="note">
        <span>{srcText}</span>
        {onRefresh ? (
          <button type="button" className="rt-footer rt-footer--reveal" onClick={(e) => (e.stopPropagation(), onRefresh())}>
            {content}
          </button>
        ) : (
          <span className="rt-footer rt-footer--reveal">{content}</span>
        )}
      </div>
    </div>
  );
}

export function TileView({ tile, range, mode, refreshedText, refreshing, onRefresh, onExport, editingText, onTextChange, onAskStazy }: Props) {
  const [boxRef, box] = useBox<HTMLDivElement>();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const l = ladderFor(box.w, box.h);
  const compare = comparisonLabel(range.key);
  const kind = kindOf(tile.type);

  if (tile.type === 'text') {
    return (
      <div className="rt rt--text" ref={boxRef}>
        {editingText ? (
          <textarea
            className="rt-text__input"
            autoFocus
            value={tile.text ?? ''}
            placeholder="Type a label or note"
            onChange={(e) => onTextChange?.(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div className={`rt-text${tile.text ? '' : ' is-empty'}`}>{tile.text || (mode === 'builder' ? 'Type a label or note' : '')}</div>
        )}
      </div>
    );
  }

  if (tile.status === 'collecting') {
    return (
      <div className="rt rt--collecting" ref={boxRef}>
        <div className="rt-collect__head">
          <img className="is-round" src={STAZY_AVATAR} alt="" />
          <SourceAvatars ids={tile.sources} />
        </div>
        <div className="rt-collect__who">
          <strong>Stazy</strong>
          <span>{tile.name}</span>
        </div>
        <div className="rt-collect__status">Collecting Data...</div>
      </div>
    );
  }

  const d = tile.status === 'ok' ? tileData(tile, range) : null;
  const exportDisabled = tile.status !== 'ok';
  const alert = tile.tone === 'alert';

  let body: ReactNode = null;
  if (tile.status === 'failed') {
    const failed = tile.failedSources ?? tile.sources;
    const ok = tile.sources.filter((s) => !failed.includes(s));
    body = (
      <div className="rt-failed" role="alert">
        <div className="rt-failed__title">
          <img src={warningIcon} alt="" width={18} height={18} /> Couldn’t load this Tile
        </div>
        <div className="rt-failed__row">
          <span className="rt-chip rt-chip--blocked">Blocked</span>
          {failed.map((s) => SOURCES[s]?.name ?? s).join(', ')} failed
        </div>
        {ok.length > 0 && (
          <div className="rt-failed__row">
            <span className="rt-chip rt-chip--ok">OK</span>
            {ok.map((s) => SOURCES[s]?.name ?? s).join(', ')} succeeded
          </div>
        )}
      </div>
    );
  } else if (tile.status === 'noData') {
    body = <div className="rt-nodata">Nothing for this period</div>;
  } else if (tile.status === 'unbound') {
    body = (
      <div className="rt-unbound">
        <span>{kind.label} · not connected to data</span>
        {mode === 'builder' && onAskStazy && (
          <button type="button" className="r-btn r-btn--sm" onClick={(e) => (e.stopPropagation(), onAskStazy())}>
            Bind with Stazy
          </button>
        )}
      </div>
    );
  } else if (d) {
    if (l.collapsed) {
      // §7.4 collapsed representation: a single value, a label and the source indicator.
      body = (
        <div className="rt-collapsed">
          <div className="rt-value rt-value--sm">
            {formatNumber(d.value, true)}
            {tile.unit}
          </div>
        </div>
      );
    } else if (tile.type === 'stat') body = <StatBody tile={tile} d={d} l={l} compare={compare} />;
    else if (tile.type === 'statGroup') body = <StatGroupBody tile={tile} d={d} compare={compare} l={l} />;
    else if (tile.type === 'table') body = <TableBody d={d} />;
    else if (tile.type === 'keyValue') body = <KeyValueBody d={d} />;
    else if (tile.type === 'rankedList') body = <RankedBody d={d} />;
    else if (tile.type === 'funnel') body = <FunnelBody d={d} l={l} />;
    else if (CARBON_TYPES.has(tile.type)) {
      const showHero = ['line', 'area', 'stream', 'stackedArea', 'histogram'].includes(tile.type) && l.tier2;
      body = (
        <div className="rt-chartbody">
          {showHero && <div className="rt-value rt-value--hero">{formatNumber(d.value)}</div>}
          <div className="rt-chart">
            <Chart type={tile.type} data={d} ladder={l as Ladder} />
          </div>
        </div>
      );
    }
  }

  const sr = d ? `${tile.name}: ${formatNumber(d.value)}${tile.unit ?? ''}, ${d.delta}% ${compare}. ${d.rows.length} data rows.` : `${tile.name}: ${tile.status}`;

  return (
    <div
      ref={(el) => {
        boxRef(el);
        cardRef.current = el;
      }}
      className={`rt rt--${tile.type} is-${tile.status}${alert ? ' is-alert' : ''}${l.collapsed ? ' is-collapsed' : ''}`}
      tabIndex={mode === 'preview' ? 0 : -1}
      aria-label={sr}
    >
      {l.tier1 || l.collapsed ? (
        <div className="rt-head">
          <span className="rt-name">{tile.name}</span>
        </div>
      ) : null}
      <div className="rt-body">{body}</div>
      {mode === 'preview' && onExport && <OverflowMenu disabled={exportDisabled} onPick={(f, dest) => onExport(f, dest, cardRef.current)} />}
      <Footer text={refreshedText} refreshing={refreshing} onRefresh={mode === 'preview' ? onRefresh : undefined} full={l.fullFooter} tile={tile} />
    </div>
  );
}
