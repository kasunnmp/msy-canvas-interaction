import { easeSettle } from './easing';

/** Viewport (stage) size in design units — matches Figma "Viewport design" 2487:15910. */
export const STAGE = { width: 1440, height: 888 };

/** Area where a focused app is framed: between the status bar (57) and the dock (top at 804). */
export const FOCUS_REGION = { left: 32, right: STAGE.width - 32, top: 57 + 14, bottom: 804 - 14 };
const REGION_W = FOCUS_REGION.right - FOCUS_REGION.left;
const REGION_H = FOCUS_REGION.bottom - FOCUS_REGION.top;
const REGION_CX = (FOCUS_REGION.left + FOCUS_REGION.right) / 2;
const REGION_CY = (FOCUS_REGION.top + FOCUS_REGION.bottom) / 2;

/** Camera = the world point shown at the centre of the focus region, and the zoom scale. */
export interface Camera {
  x: number;
  y: number;
  s: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Camera that frames `rect` inside the focus region ("zoom to fit"). */
export function fitRect(rect: Rect, padding = 0): Camera {
  const s = Math.min(REGION_W / (rect.width + padding * 2), REGION_H / (rect.height + padding * 2));
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, s };
}

export function cameraTransform(c: Camera) {
  const tx = REGION_CX - c.x * c.s;
  const ty = REGION_CY - c.y * c.s;
  return `translate3d(${tx}px, ${ty}px, 0) scale(${c.s})`;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface FlightOptions {
  /** Override duration (ms). */
  duration?: number;
  /** Zoom-out "breath" during travel, 0..1 (0 = straight pan/zoom). Defaults to distance-based. */
  dip?: number;
}

/**
 * Drives a DOM element's transform like a camera.
 * Motion language from the mecury-interactions skill:
 *  - ease-settle cubic-bezier(0.2, 0.8, 0.2, 1), no overshoot
 *  - 750–1100 ms for spatial travel depending on distance
 *  - camera breathes out (zooms back) mid-flight so origin and destination stay legible
 *  - directional motion blur proportional to on-screen velocity, resolving to sharp on arrival
 */
export class CameraController {
  private cam: Camera;
  private raf = 0;
  private resolve?: () => void;
  /** Directional (SVG) blur is costly on some GPUs/browsers; fall back to a uniform CSS blur if frames run long. */
  private cheapBlur = false;

  constructor(
    private world: HTMLElement,
    private blurNode: SVGFEGaussianBlurElement | null,
    initial: Camera,
  ) {
    this.cam = { ...initial };
    this.apply(0, 0);
  }

  get current(): Camera {
    return { ...this.cam };
  }

  jumpTo(c: Camera) {
    this.cancel();
    this.cam = { ...c };
    this.apply(0, 0);
  }

  flyTo(target: Camera, opts: FlightOptions = {}): Promise<void> {
    this.cancel();
    const from = { ...this.cam };
    const reduced = prefersReducedMotion();

    // Distance measured in screen pixels at the smaller of the two scales.
    const sMin = Math.min(from.s, target.s);
    const dist = Math.hypot(target.x - from.x, target.y - from.y) * sMin;
    const zoomRatio = Math.abs(Math.log(target.s / from.s));

    const duration = reduced
      ? 150
      : opts.duration ?? Math.min(1100, 750 + dist * 0.22 + zoomRatio * 120);
    const dip = reduced ? 0 : opts.dip ?? Math.min(0.28, dist / 3600);

    return new Promise((resolve) => {
      this.resolve = resolve;
      const start = performance.now();
      let prev = { ...from };
      let prevTime = start;
      let slowFrames = 0;

      const step = (now: number) => {
        const dt = Math.max(1, now - prevTime);
        prevTime = now;
        if (dt > 34 && this.world.style.filter.startsWith('url') && ++slowFrames >= 3) this.cheapBlur = true;
        const t = Math.min(1, (now - start) / duration);
        const e = easeSettle(t);
        const s = (from.s + (target.s - from.s) * e) * (1 - dip * Math.sin(Math.PI * e));
        const next: Camera = {
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          s,
        };
        // On-screen velocity of the content, normalised to px per 60 Hz frame → directional blur.
        const k = 16.67 / dt;
        const vx = reduced ? 0 : Math.abs(next.x - prev.x) * next.s * k;
        const vy = reduced ? 0 : Math.abs(next.y - prev.y) * next.s * k;
        this.cam = next;
        prev = next;
        this.apply(vx, vy);

        if (t < 1) {
          this.raf = requestAnimationFrame(step);
        } else {
          this.cam = { ...target };
          this.apply(0, 0);
          this.raf = 0;
          this.resolve = undefined;
          resolve();
        }
      };
      this.raf = requestAnimationFrame(step);
    });
  }

  cancel() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    // Resolve a pending flight so awaiters don't hang; the new flight starts from where we are.
    this.resolve?.();
    this.resolve = undefined;
  }

  destroy() {
    this.cancel();
  }

  private apply(vx: number, vy: number) {
    this.world.style.transform = cameraTransform(this.cam);
    const bx = Math.min(10, vx * 0.24);
    const by = Math.min(10, vy * 0.24);
    if (bx <= 0.35 && by <= 0.35) {
      this.world.style.filter = '';
    } else if (this.cheapBlur || !this.blurNode) {
      this.world.style.filter = `blur(${(Math.max(bx, by) * 0.5).toFixed(2)}px)`;
    } else {
      // The filter runs in the world's (scaled) user space, so divide by scale for on-screen px.
      const s = this.cam.s;
      this.blurNode.setAttribute('stdDeviation', `${(bx / s).toFixed(2)} ${(by / s).toFixed(2)}`);
      this.world.style.filter = 'url(#camera-motion-blur)';
    }
  }
}
