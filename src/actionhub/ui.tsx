import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { PEOPLE, PRIORITIES, type Priority } from './model';
import checklist from './assets/checklist.svg';

export function useDismiss(open: boolean, onClose: () => void, ref: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [open, onClose, ref]);
}

export function Pop({ children, className = '', onClose }: { children: ReactNode; className?: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, ref);
  return (
    <div ref={ref} className={`ah-pop ${className}`} role="menu" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

export function MItem({ children, onClick, danger, right, icon, disabled }: { children: ReactNode; onClick?: () => void; danger?: boolean; right?: ReactNode; icon?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="menuitem" disabled={disabled} className={`ah-mi${danger ? ' is-danger' : ''}`} onClick={onClick}>
      {icon && <span className="ah-mi__icon">{icon}</span>}
      <span className="ah-mi__text">{children}</span>
      {right && <span className="ah-mi__right">{right}</span>}
    </button>
  );
}

export function ListIcon({ icon, size = 20 }: { icon: string; size?: number }) {
  if (icon === 'checklist') return <img src={checklist} alt="" width={size} height={size} className="ah-listicon" />;
  return (
    <span className="ah-listicon ah-listicon--emoji" style={{ fontSize: size * 0.9, width: size, height: size }}>
      {icon}
    </span>
  );
}

export function Av({ id, size = 20 }: { id: string; size?: number }) {
  const p = PEOPLE[id];
  return <img className="ah-av" src={p?.avatar} alt={p?.name ?? ''} title={p?.name} style={{ width: size, height: size }} />;
}

export function NameTag({ id }: { id: string }) {
  const p = PEOPLE[id];
  return (
    <span className="ah-nametag">
      <img src={p?.avatar} alt="" />
      {p?.name ?? id}
    </span>
  );
}

/** Renders `{@person}` as name tags and `**x**` as blue emphasis. */
export function Rich({ text }: { text?: string }) {
  if (!text) return null;
  const parts = text.split(/(\{@\w+\}|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{@(\w+)\}$/);
        if (m) return <NameTag key={i} id={m[1]} />;
        const b = p.match(/^\*\*([^*]+)\*\*$/);
        if (b) return <strong key={i} className="ah-em">{b[1]}</strong>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export const plain = (text?: string) => (text ?? '').replace(/\{@(\w+)\}/g, (_, id) => PEOPLE[id]?.name ?? id).replace(/\*\*/g, '');

export function PriorityIcon({ p, size = 16 }: { p: Priority; size?: number }) {
  const c = PRIORITIES.find((x) => x.id === p)!.color;
  if (p === 0)
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
        <path d="M8 2.5l5.5 5.5L8 13.5 2.5 8z" fill="none" stroke={c} strokeWidth="1.4" />
      </svg>
    );
  const chevrons = p === 3 ? 1 : 2;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      {Array.from({ length: chevrons }, (_, i) => (
        <path key={i} d={`M3.5 ${10 - i * 4.5 + (chevrons === 1 ? 2 : 0)}l4.5-4.5 4.5 4.5`} fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

const svg = (d: ReactNode, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

export const I = {
  back: svg(<path d="M16 10H4m0 0l5-5m-5 5l5 5" />, 20),
  search: svg(<><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></>, 22),
  close: svg(<path d="M5 5l10 10M15 5L5 15" />),
  check: svg(<path d="M4.5 10.5l3.5 3.5 7.5-8" />, 16),
  chevron: svg(<path d="M6 8l4 4 4-4" />, 16),
  more: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <circle cx="4.5" cy="10" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="15.5" cy="10" r="1.6" />
    </svg>
  ),
  vmore: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <circle cx="10" cy="4.5" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="10" cy="15.5" r="1.6" />
    </svg>
  ),
  alarm: svg(<><circle cx="10" cy="11" r="6" /><path d="M10 8v3l2 1.5M3.5 4.5l2-2M16.5 4.5l-2-2" /></>, 18),
  comment: svg(<path d="M4 15.5V5.5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H7z" />, 18),
  link: svg(<path d="M8.5 11.5l3-3M9 6l1.2-1.2a3 3 0 014.3 4.2L13.3 10M11 14l-1.2 1.2a3 3 0 01-4.3-4.2L6.7 10" />, 18),
  plus: svg(<path d="M10 4v12M4 10h12" />, 18),
  pencil: svg(<path d="M13.5 4.5l2 2L8 14l-3 .8.8-3z" />, 16),
  trash: svg(<path d="M4 6h12M8 6V4h4v2M5.5 6l.7 10h7.6l.7-10" />, 16),
  move: svg(<path d="M4 10h11m0 0l-4-4m4 4l-4 4" />, 16),
  sort: svg(<path d="M7 4v12M7 4L4 7M7 4l3 3M13 16V4m0 12l-3-3m3 3l3-3" />, 16),
  mic: svg(<><rect x="7.5" y="3" width="5" height="9" rx="2.5" /><path d="M5 10a5 5 0 0010 0M10 15v2.5" /></>, 18),
  attach: svg(<path d="M15.5 9.5l-5.8 5.8a3.5 3.5 0 01-5-5l6.3-6.3a2.3 2.3 0 013.3 3.3L8 13.5a1.2 1.2 0 01-1.7-1.7l5.5-5.5" />, 18),
  tag: svg(<><path d="M3.5 3.5h6l7 7-6 6-7-7z" /><circle cx="7" cy="7" r="1" /></>, 16),
  user: svg(<><circle cx="10" cy="7" r="3" /><path d="M4 16.5c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5" /></>, 16),
  subtask: svg(<><path d="M3 10h6" /><circle cx="13" cy="10" r="3" /></>, 18),
  brain: svg(<path d="M7 4.5a2.5 2.5 0 00-2.5 2.5 2.5 2.5 0 00-1 4.5 2.5 2.5 0 002.5 3.5 2.5 2.5 0 004 0V5.5A2.5 2.5 0 007 4.5zM13 4.5a2.5 2.5 0 012.5 2.5 2.5 2.5 0 011 4.5 2.5 2.5 0 01-2.5 3.5 2.5 2.5 0 01-4 0" />, 16),
  list: svg(<path d="M7 5h9M7 10h9M7 15h9M3.5 5h.01M3.5 10h.01M3.5 15h.01" />, 16),
  task: svg(<><circle cx="10" cy="10" r="6.5" /><path d="M7.3 10.2l1.9 1.9 3.6-3.8" /></>, 16),
  warning: (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#e5484d" />
      <path d="M12 6.5v7M12 17v.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  sparkle: svg(<path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z" />, 16),
};
