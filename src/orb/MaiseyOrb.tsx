import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MAISEY_LOOK, orbHub, type OrbHandle, type OrbLook, type OrbState } from './engine';
import './orb.css';

export type { OrbState } from './engine';

interface Props {
  /** CSS pixel diameter. */
  size?: number;
  /** idle · thinking · listening · talking — changes crossfade over ~0.6 s like the studio. */
  state?: OrbState;
  playing?: boolean;
  look?: OrbLook;
  /** Opacity + bloom-in on mount. */
  fadeIn?: boolean;
  /** Subtle 1px inner ring, as on the studio's avatars. */
  ring?: boolean;
  className?: string;
  label?: string;
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Maisey's living orb — "a blue silk ribbon in a frosted ball". */
export function MaiseyOrb({ size = 44, state = 'idle', playing = true, look = MAISEY_LOOK, fadeIn = true, ring = true, className, label }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const handle = useRef<OrbHandle | null>(null);
  const init = useRef({ size, state, playing, look, fadeIn });
  const [fallback, setFallback] = useState(false);
  const play = playing && !reduced();

  useLayoutEffect(() => {
    init.current = { size, state, playing: play, look, fadeIn };
  });

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const i = init.current;
    const h = orbHub().register(el, i.look, i.state, { playing: i.playing, size: i.size, fadeIn: i.fadeIn && i.playing });
    if (!h) { setFallback(true); return; }
    handle.current = h;
    return () => { h.unregister(); handle.current = null; };
  }, []);

  useEffect(() => { handle.current?.setState(state); }, [state]);
  useEffect(() => { handle.current?.setPlaying(play); }, [play]);
  useEffect(() => { handle.current?.resize(size); }, [size]);

  return (
    <span
      className={`maisey-orb${ring ? ' maisey-orb--ring' : ''}${fallback ? ' maisey-orb--still' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-state={state}
    >
      <canvas ref={canvas} />
    </span>
  );
}
