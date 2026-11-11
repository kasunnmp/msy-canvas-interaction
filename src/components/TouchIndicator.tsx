import { useEffect, useState } from 'react';

interface Touch {
  id: number;
  x: number;
  y: number;
}

/** mecury-interactions "show input": soft translucent circle at each press. */
export function TouchIndicator({ stage }: { stage: HTMLElement | null }) {
  const [touches, setTouches] = useState<Touch[]>([]);

  useEffect(() => {
    if (!stage) return;
    let id = 0;
    const onDown = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      const k = r.width / stage.offsetWidth;
      const t = { id: ++id, x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
      setTouches((prev) => [...prev, t]);
      window.setTimeout(() => setTouches((prev) => prev.filter((p) => p.id !== t.id)), 600);
    };
    stage.addEventListener('pointerdown', onDown);
    return () => stage.removeEventListener('pointerdown', onDown);
  }, [stage]);

  return (
    <div className="touch-layer" aria-hidden>
      {touches.map((t) => (
        <span key={t.id} className="touch-dot" style={{ left: t.x, top: t.y }} />
      ))}
    </div>
  );
}
