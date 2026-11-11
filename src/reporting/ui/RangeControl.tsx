import { useMemo, useRef, useState } from 'react';
import { useReporting } from '../state/store';
import type { RangeKey, ViewRange } from '../model/types';
import { Menu, MenuItem, useDismiss } from './common';
import historyIcon from '../assets/history.svg';

const TABS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

const MENU: { key: RangeKey; label: string }[] = [
  { key: 'lastWeek', label: 'Last week' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'thisYear', label: 'This year' },
  { key: 'range', label: 'Range' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dotted = (s?: string) => (s ? s.split('-').reverse().join('.') : '__.__.____');

/** §20.1 Range picker: a field showing start–end above a calendar with month and year selectors. */
function DatePicker({ initial, onApply, onClose }: { initial: ViewRange; onApply: (r: ViewRange) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, ref);
  const today = new Date();
  const [month, setMonth] = useState((initial.start ? new Date(initial.start) : today).getMonth());
  const [year, setYear] = useState((initial.start ? new Date(initial.start) : today).getFullYear());
  const [start, setStart] = useState<string | undefined>(initial.start);
  const [end, setEnd] = useState<string | undefined>(initial.end);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(year, month + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))];
  }, [month, year]);

  const pick = (d: Date) => {
    const v = iso(d);
    if (!start || (start && end)) {
      setStart(v);
      setEnd(undefined);
    } else if (v < start) {
      setEnd(start);
      setStart(v);
    } else setEnd(v);
  };

  return (
    <div ref={ref} className="rr-picker" role="dialog" aria-label="Choose a date range">
      <div className="rr-picker__field" aria-live="polite">
        {dotted(start)} - {dotted(end)}
      </div>
      <div className="rr-picker__selectors">
        <select value={month} onChange={(e) => setMonth(+e.target.value)} aria-label="Month">
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(+e.target.value)} aria-label="Year">
          {Array.from({ length: 6 }, (_, i) => today.getFullYear() - 4 + i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="rr-cal" role="grid">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span key={d} className="rr-cal__dow">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const v = iso(d);
          const inRange = start && end && v >= start && v <= end;
          const edge = v === start || v === end;
          return (
            <button key={v} type="button" className={`rr-cal__day${inRange ? ' is-in' : ''}${edge ? ' is-edge' : ''}`} onClick={() => pick(d)} aria-pressed={!!edge}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="rr-picker__foot">
        <button type="button" className="r-btn r-btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="r-btn r-btn--primary" disabled={!start || !end} onClick={() => onApply({ key: 'range', start, end })}>
          Apply
        </button>
      </div>
    </div>
  );
}

export function RangeControl({ reportId }: { reportId: string }) {
  const { state, dispatch, range } = useReporting();
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const set = (r: ViewRange) => dispatch({ type: 'setRange', id: reportId, range: r });
  const isTab = TABS.some((t) => t.key === range.key);
  const saved = state.savedViews[reportId];
  const savedMatches = saved && JSON.stringify(saved) === JSON.stringify(range);
  const menuLabel = MENU.find((m) => m.key === range.key)?.label;

  return (
    <div className="rr">
      <div className="rr-tabs" role="tablist" aria-label="Date range">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={range.key === t.key} className={`rr-tab${range.key === t.key ? ' is-on' : ''}`} onClick={() => set({ key: t.key })}>
            {t.label}
          </button>
        ))}
        <span className="rr-divider" aria-hidden />
        <div className="rr-menu-wrap">
          <button type="button" className={`rr-menu-btn${!isTab ? ' is-on' : ''}`} aria-label="More ranges" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <img src={historyIcon} alt="" width={24} height={24} />
          </button>
          {menu && (
            <Menu className="rr-menu" onClose={() => setMenu(false)}>
              {MENU.map((m) => (
                <MenuItem
                  key={m.key}
                  onClick={() => {
                    setMenu(false);
                    if (m.key === 'range') setPicker(true);
                    else set({ key: m.key });
                  }}
                  right={range.key === m.key ? <span className="r-menu__check">✓</span> : undefined}
                >
                  {m.label}
                </MenuItem>
              ))}
            </Menu>
          )}
          {picker && (
            <DatePicker
              initial={range}
              onClose={() => setPicker(false)}
              onApply={(r) => {
                set(r);
                setPicker(false);
              }}
            />
          )}
        </div>
      </div>
      {!isTab && (
        <span className="rr-current">
          {range.key === 'range' ? `${dotted(range.start)} - ${dotted(range.end)}` : menuLabel}
        </span>
      )}
      {!isTab && !savedMatches && (
        <button type="button" className="rr-save" onClick={() => dispatch({ type: 'saveView', id: reportId, range })}>
          Save view
        </button>
      )}
      {!isTab && savedMatches && <span className="rr-saved">View saved</span>}
    </div>
  );
}
