import { forwardRef, lazy, Suspense } from 'react';
import { APPS, WORLD, type AppId } from '../apps';
import wallpaper from '../assets/wallpaper.png';

const ReportingApp = lazy(() => import('../reporting/ReportingApp').then((m) => ({ default: m.ReportingApp })));
const ActionHubApp = lazy(() => import('../actionhub/ActionHubApp').then((m) => ({ default: m.ActionHubApp })));
const LIVE = { reporting: ReportingApp, actionhub: ActionHubApp } as const;

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
        if (app.live) {
          const Live = LIVE[app.live];
          const interactive = focused === app.id && !overview;
          return (
            <div
              key={app.id}
              className={`app-window app-window--live is-${state}${overview ? ' in-overview' : ''}`}
              style={{ left: app.x, top: app.y, width: app.width, height: app.height }}
              aria-label={app.name}
            >
              <Suspense fallback={<img src={app.image} alt="" width={app.width} height={app.height} draggable={false} />}>
                <Live />
              </Suspense>
              {/* Until the camera is in this app, a click flies there instead of reaching the UI. */}
              {!interactive && (
                <button type="button" className="app-window__veil" aria-label={`Go to ${app.name}`} tabIndex={overview ? 0 : -1} onClick={() => onWindowClick(app.id)} />
              )}
            </div>
          );
        }
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
