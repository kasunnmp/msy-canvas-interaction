import { useEffect, useRef, type ReactNode } from 'react';
import type { TagColor } from '../model/types';
import { STAZY_AVATAR } from '../model/sampleReports';

/** Two-colour Tag indicator (§18.1) — Figma "Stacks / Tag indicator". */
export function Tags({ tags }: { tags: TagColor[] }) {
  if (!tags.length) return null;
  return (
    <span className="r-tags" aria-label={`Tags: ${tags.join(', ')}`}>
      {tags.map((t, i) => (
        <span key={i} className={`r-tag r-tag--${t}`} style={{ zIndex: tags.length - i }} />
      ))}
    </span>
  );
}

export function Avatar({ src, size = 24, ring, round = true, title }: { src: string; size?: number; ring?: boolean; round?: boolean; title?: string }) {
  return (
    <span className={`r-avatar${ring ? ' has-ring' : ''}${round ? '' : ' is-squircle'}`} style={{ width: size, height: size }} title={title}>
      <img src={src} alt={title ?? ''} />
    </span>
  );
}

export function StazyAvatar({ size = 24 }: { size?: number }) {
  return (
    <span className="r-avatar r-avatar--stazy" style={{ width: size, height: size }}>
      <img src={STAZY_AVATAR} alt="Stazy" />
    </span>
  );
}

/** Close a popover on outside pointer-down or Escape. */
export function useDismiss(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, ref]);
}

export function Menu({ children, className = '', onClose }: { children: ReactNode; className?: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, ref);
  return (
    <div ref={ref} className={`r-menu ${className}`} role="menu">
      {children}
    </div>
  );
}

export function MenuItem({ children, onClick, disabled, danger, icon, right }: { children: ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean; icon?: ReactNode; right?: ReactNode }) {
  return (
    <button type="button" role="menuitem" className={`r-menu__item${danger ? ' is-danger' : ''}`} disabled={disabled} onClick={onClick}>
      {icon && <span className="r-menu__icon">{icon}</span>}
      <span className="r-menu__text">{children}</span>
      {right}
    </button>
  );
}

export const MenuDivider = () => <div className="r-menu__divider" role="separator" />;

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    ref.current?.querySelector<HTMLElement>('input, button, [tabindex="0"]')?.focus();
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="r-modal-layer" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`r-modal${wide ? ' r-modal--wide' : ''}`} role="dialog" aria-modal="true">
        <div className="r-modal__head">
          <div className="r-modal__title">{title}</div>
          <button type="button" className="r-icon-btn" aria-label="Close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="r-modal__body">{children}</div>
        {footer && <div className="r-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

export const Icon = {
  check: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevron: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lock: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  globe: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  link: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 014 4l-1 1M9 11.5l-1 1a2.8 2.8 0 01-4-4l1-1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  template: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 5.5h10v7.5H3zM5.5 5.5V3.8a1 1 0 011-1h3a1 1 0 011 1v1.7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.2v4M8 5v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  pencil: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M10.5 3.5l2 2L6 12l-2.6.6L4 10z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  pin: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M6 2.5h4M7 2.5v4l-2.5 2.5h7L9 6.5v-4M8 9v4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  share: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="6" cy="6" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 13c.6-2.2 2.1-3.3 4-3.3s3.4 1.1 4 3.3M11 5v4M9 7h4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M13 8a5 5 0 11-1.5-3.6M13 2.5v2.8h-2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M8 2.5v8M4.8 7.5L8 10.7l3.2-3.2M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  copy: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="5" y="5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 10.5V4a1 1 0 011-1h6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};
