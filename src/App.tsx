import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { APPS, DOCK_TARGETS, HOME_RECT, WORLD, type AppId, type DockSlot } from './apps';
import { CameraController, STAGE, fitRect } from './camera/camera';
import { CanvasWorld } from './components/CanvasWorld';
import { StatusBar } from './components/StatusBar';
import { Dock } from './components/Dock';
import { DeviceMask } from './components/DeviceMask';
import { TouchIndicator } from './components/TouchIndicator';
import { AppLauncher } from './launcher/AppLauncher';
import type { LauncherApp } from './launcher/launcherApps';

const HOME_CAMERA = fitRect(HOME_RECT);
const OVERVIEW_CAMERA = fitRect({ x: 0, y: 0, width: WORLD.width, height: WORLD.height }, 24);

function useStageScale() {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const update = () =>
      setScale(Math.min(window.innerWidth / STAGE.width, window.innerHeight / STAGE.height));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

export default function App() {
  const scale = useStageScale();
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);
  const camera = useRef<CameraController | null>(null);

  const [focused, setFocused] = useState<AppId | null>(null);
  const [overview, setOverview] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);

  useLayoutEffect(() => {
    if (!worldRef.current) return;
    camera.current = new CameraController(worldRef.current, blurRef.current, HOME_CAMERA);
    return () => camera.current?.destroy();
  }, []);

  /** Move the viewport (camera) into the app's location on the canvas. */
  const goToApp = useCallback((id: AppId) => {
    const app = APPS.find((a) => a.id === id);
    if (!app || !camera.current) return;
    setFocused(id);
    setOverview(false);
    void camera.current.flyTo(fitRect(app));
  }, []);

  const goHome = useCallback(() => {
    setFocused(null);
    setOverview(false);
    void camera.current?.flyTo(HOME_CAMERA);
  }, []);

  const showOverview = useCallback(() => {
    setOverview(true);
    setFocused(null);
    // Whole-canvas zoom: slower, no extra breath (it is already a zoom-out).
    void camera.current?.flyTo(OVERVIEW_CAMERA, { duration: 1150, dip: 0 });
  }, []);

  const toggleOverview = useCallback(() => {
    if (overview) goHome();
    else showOverview();
  }, [overview, goHome, showOverview]);

  const onDockOpen = useCallback((slot: DockSlot) => goToApp(DOCK_TARGETS[slot]), [goToApp]);

  const openLauncher = useCallback(() => setLauncherOpen(true), []);
  const closeLauncher = useCallback(() => setLauncherOpen(false), []);
  /** Launcher dismisses, and the camera travels to the app if it lives on the canvas. */
  const launchFromLauncher = useCallback(
    (app: LauncherApp) => {
      setLauncherOpen(false);
      if (app.target) goToApp(app.target);
    },
    [goToApp],
  );

  // Keyboard: 1–5 apps, O overview, Esc desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl/⌘ + O toggles the App Launcher (spec §4).
      if ((e.metaKey || e.ctrlKey) && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        setLauncherOpen((v) => !v);
        return;
      }
      if (launcherOpen) return; // the launcher handles its own keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') goHome();
      else if (e.key === 'o' || e.key === 'O') toggleOverview();
      else if (/^[1-5]$/.test(e.key)) goToApp(APPS[Number(e.key) - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goHome, goToApp, toggleOverview, launcherOpen]);

  // Trackpad pinch (ctrl+wheel): pinch in → overview, pinch out → back.
  useEffect(() => {
    if (!stageEl) return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || launcherOpen) return;
      e.preventDefault();
      const now = performance.now();
      if (now - last < 600 || Math.abs(e.deltaY) < 4) return;
      last = now;
      if (e.deltaY > 0 && !overview) showOverview();
      else if (e.deltaY < 0 && overview) goHome();
    };
    stageEl.addEventListener('wheel', onWheel, { passive: false });
    return () => stageEl.removeEventListener('wheel', onWheel);
  }, [stageEl, overview, showOverview, goHome, launcherOpen]);

  return (
    <div className="screen">
      <div
        ref={setStageEl}
        className="stage"
        style={{ width: STAGE.width, height: STAGE.height, transform: `scale(${scale})` }}
      >
        <svg className="svg-defs" aria-hidden width="0" height="0">
          <filter id="camera-motion-blur" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur ref={blurRef} stdDeviation="0 0" />
          </filter>
        </svg>

        <div className="viewport">
          <CanvasWorld ref={worldRef} focused={focused} overview={overview} onWindowClick={goToApp} />
        </div>

        <DeviceMask />
        <AppLauncher open={launcherOpen} onClose={closeLauncher} onLaunch={launchFromLauncher} />
        <StatusBar overview={overview} onToggleOverview={toggleOverview} />
        <div className={`dock-slot${launcherOpen ? ' is-hidden' : ''}`} aria-hidden={launcherOpen}>
          <Dock
            activeApp={focused}
            onOpen={onDockOpen}
            launcherOpen={launcherOpen}
            onOpenLauncher={openLauncher}
          />
        </div>
        <TouchIndicator stage={stageEl} />
      </div>
    </div>
  );
}
