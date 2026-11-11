import { forwardRef } from 'react';
import { APPS, WORLD, type AppId } from '../apps';
import wallpaper from '../assets/wallpaper.png';

interface Props {
  focused: AppId | null;
  overview: boolean;
  onWindowClick: (id: AppId) => void;
}

/**
 * The large canvas. It never moves itself — the camera (CSS transform on this element,
 * driven by CameraController) moves over it.
 */
export const CanvasWorld = forwardRef<HTMLDivElement, Props>(function CanvasWorld(
  { focused, overview, onWindowClick },
  ref,
) {
  return (
    <div
      ref={ref}
      className="world"
      style={{ width: WORLD.width, height: WORLD.height }}
    >
      {/* Wallpaper extends well past the canvas so the camera never sees an edge. */}
      <div className="world__wallpaper" style={{ backgroundImage: `url(${wallpaper})` }} aria-hidden />
      {APPS.map((app) => {
        const state = focused === null ? 'idle' : focused === app.id ? 'focused' : 'dimmed';
        return (
          <button
            key={app.id}
            type="button"
            className={`app-window is-${state}${overview ? ' in-overview' : ''}`}
            style={{ left: app.x, top: app.y, width: app.width, height: app.height }}
            aria-label={app.name}
            tabIndex={overview ? 0 : -1}
            onClick={() => onWindowClick(app.id)}
          >
            <img src={app.image} alt="" width={app.width} height={app.height} draggable={false} />
          </button>
        );
      })}
    </div>
  );
});
