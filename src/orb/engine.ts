/**
 * Maisey orb motion engine — a faithful port of Maisey Orb Studio's sim + loop player.
 * One shared WebGL context renders every orb on the page; each orb copies its frame
 * into its own 2D canvas (same approach the studio uses for its avatars).
 */
import { ORB_FRAG, ORB_VERT } from './shader';

export type OrbState = 'idle' | 'thinking' | 'listening' | 'talking';

export interface OrbLook {
  colors: [string, string];
  baseColor: string;
  accentColor: string;
  seed: number;
  swirl: number;
  size: number;
  depth: number;
  haze: number;
  accent: number;
  grain: number;
  softness: number;
  feather: number;
  speed: number;
  loopLength: number;
}

/** Studio defaults ("Maisey" preset). */
export const MAISEY_LOOK: OrbLook = {
  colors: ['#3540D0', '#6A7BFF'],
  baseColor: '#F6F3FF',
  accentColor: '#FFA8EE',
  seed: 1000,
  swirl: 0.5,
  size: 0.5,
  depth: 0.5,
  haze: 0.6,
  accent: 0.6,
  grain: 0.3,
  softness: 0.5,
  feather: 0,
  speed: 1,
  loopLength: 10,
};

const DT = 1 / 60;
const STATES = ['idle', 'thinking', 'listening', 'talking', 'manual'] as const;
type SimState = (typeof STATES)[number];
const FLOW_PERIOD = 10;
const TAU = Math.PI * 2;
const wrap = (x: number, p: number) => x - p * Math.floor(x / p);
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

const MOTION: Record<SimState, { flow: number; drift: number; rot: number; twist: number; ripple: number; surge: number; flowOut: number; driftOut: number }> = {
  idle: { flow: 0.2, drift: 0.04, rot: 0, twist: 0, ripple: 0, surge: 0, flowOut: 0, driftOut: 0 },
  thinking: { flow: 0.26, drift: -0.4, rot: 0, twist: 1, ripple: 0, surge: 0, flowOut: 0, driftOut: 0 },
  listening: { flow: 0.2, drift: 0.26, rot: 0, twist: 0, ripple: 1, surge: 0.1, flowOut: 0, driftOut: 0 },
  talking: { flow: 0.3, drift: 0.12, rot: 0, twist: 0, ripple: 0.1, surge: 1, flowOut: 2, driftOut: 1.4 },
  manual: { flow: 0.18, drift: 0.04, rot: 0, twist: 0, ripple: 1, surge: 1, flowOut: 2, driftOut: 1.4 },
};

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x9e3779b9) | 0;
    let t = s ^ (s >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return ((t ^= t >>> 15) >>> 0) / 4294967296;
  };
}
const toLinear = (c: number) => (c < 0.04045 ? c * 0.0773993808 : (c * 0.9478672986 + 0.0521327014) ** 2.4);
function hexToLinear(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)];
}
const seed3 = (seed: number): [number, number, number] => {
  const r = rng(seed);
  return [r() * 64, r() * 64, r() * 64];
};

type V3 = [number, number, number];
interface Params {
  p0: [number, number, number, number];
  p1: [number, number, number, number];
  opacity: number;
  intro: number;
  scale: number;
  surgeVol: number;
  pulse: number;
  c1: V3;
  c2: V3;
  c3: V3;
  c4: V3;
  seed3: V3;
}

class Sim {
  t = 0; flow = 0; drift = 0; rot = 0; twPh = 0; ripPh = 0; surgePh = 0; curIn = 0; curOut = 0;
  opacity: number;
  m: number[];
  twistW = 0; rippleW = 0; surgeW = 0;
  state: SimState;
  c1: V3; c2: V3; c3: V3; c4: V3;
  seed3: V3;

  constructor(look: OrbLook, state: SimState, fadeIn: boolean) {
    this.state = state;
    this.opacity = fadeIn ? 0 : 1;
    this.m = STATES.map((s) => +(s === state));
    this.c1 = hexToLinear(look.colors[0]);
    this.c2 = hexToLinear(look.colors[1]);
    this.c3 = hexToLinear(look.baseColor);
    this.c4 = hexToLinear(look.accentColor);
    this.seed3 = seed3(look.seed);
    this.refreshWeights();
  }
  weights() {
    const e = this.m.map(smooth);
    const sum = e.reduce((a, b) => a + b, 0) || 1;
    return e.map((x) => x / sum);
  }
  refreshWeights() {
    const w = this.weights();
    let t = 0, r = 0, s = 0;
    STATES.forEach((k, i) => {
      t += w[i] * MOTION[k].twist;
      r += w[i] * MOTION[k].ripple;
      s += w[i] * MOTION[k].surge;
    });
    this.twistW = t; this.rippleW = r; this.surgeW = s;
  }
  intro() {
    const e = Math.min(1, (1 - this.opacity) / 0.6);
    return e * e * (3 - 2 * e);
  }
  step(dt: number) {
    this.t += dt;
    if (this.opacity < 1) this.opacity = 1 - this.opacity - 1 / 30 < 1e-9 ? 1 : this.opacity + 1 / 30;
    const t = this.t;
    let inp = 0, out = 0.05;
    switch (this.state) {
      case 'idle': break;
      case 'thinking': inp = 0.1; out = 0.1; break;
      case 'listening': inp = clamp01(0.5 + 0.3 * Math.sin(t * 2.9) + 0.18 * Math.sin(t * 7.3 + 0.4)); out = 0.1; break;
      case 'talking': inp = 0.1; out = clamp01(0.3 + 0.45 * Math.max(0, Math.sin(t * 12.5)) * (0.7 + 0.3 * Math.sin(t * 1.9)) + 0.18 * Math.sin(t * 2.3 + 1)); break;
      case 'manual': inp = 0.5; out = 0.5; break;
    }
    this.curIn += (inp - this.curIn) * 0.2;
    this.curOut += (out - this.curOut) * 0.2;
    const k = 1 / 36;
    for (let i = 0; i < STATES.length; i++) {
      const target = +(STATES[i] === this.state);
      const d = target - this.m[i];
      this.m[i] = Math.abs(d) <= k ? target : this.m[i] + Math.sign(d) * k;
    }
    this.refreshWeights();
    const w = this.weights();
    let fl = 0, dr = 0, ro = 0;
    STATES.forEach((s, i) => {
      const mo = MOTION[s];
      fl += w[i] * (mo.flow + mo.flowOut * this.curOut);
      dr += w[i] * (mo.drift + mo.driftOut * this.curOut);
      ro += w[i] * mo.rot;
    });
    const intro = this.intro();
    this.flow = wrap(this.flow + dt * fl * (1 + 3 * intro), FLOW_PERIOD);
    this.drift = wrap(this.drift + dt * dr, FLOW_PERIOD);
    this.rot = wrap(this.rot + dt * ro, 1);
    this.twPh = wrap(this.twPh + dt * 1.3, TAU);
    this.ripPh = wrap(this.ripPh + dt * (5 + 4 * this.curIn), TAU);
    this.surgePh = wrap(this.surgePh + dt * (1.6 + 2 * this.curOut), 1);
  }
  params(): Params {
    const surgeVol = this.surgeW * this.curOut;
    const pulse = 0.5 - 0.5 * Math.cos(TAU * this.surgePh);
    const o = this.opacity;
    const intro = this.intro();
    return {
      p0: [this.flow, this.drift, this.twistW * (0.3 + 0.18 * Math.sin(this.twPh)), this.rot],
      p1: [this.ripPh, this.rippleW * (0.15 + 0.85 * this.curIn), surgeVol * (0.65 + 0.35 * pulse), intro],
      opacity: o,
      intro,
      scale: 0.88 + 0.12 * (1 - (1 - o) ** 3),
      surgeVol,
      pulse,
      c1: this.c1, c2: this.c2, c3: this.c3, c4: this.c4,
      seed3: this.seed3,
    };
  }
  clone(): Sim {
    const c = Object.assign(Object.create(Sim.prototype), this) as Sim;
    c.m = [...this.m];
    return c;
  }
}

interface Frame { a: Params; b: Params | null; w: number; out?: Frame; x?: number }

/** Seamless 10 s loop with a 36-tick crossfade when the state changes (studio behaviour). */
export class OrbPlayer {
  private look: OrbLook;
  private state: OrbState;
  private snap!: { a: Sim; b: Sim; ticks: number };
  private loopA!: Sim;
  private loopB!: Sim;
  private loopTick = 0;
  private out: { snap: { a: Sim; b: Sim; ticks: number }; a: Sim; b: Sim; tick: number } | null = null;
  private xTick = 0;
  private pending = false;
  private acc = 0;
  /** Fade-in on mount (opacity + intro bloom), layered over the loop. */
  private intro: Sim | null;

  constructor(look: OrbLook, state: OrbState, fadeIn = true) {
    this.look = look;
    this.state = state;
    this.intro = fadeIn ? new Sim(look, state, true) : null;
    this.buildLoop();
  }
  private makeLoop() {
    const dt = DT * this.look.speed;
    const s = new Sim(this.look, this.state, false);
    for (let i = 0; i < 60; i++) s.step(dt);
    const ticks = Math.max(1, Math.round(this.look.loopLength * 60));
    const b = s.clone();
    const a = s.clone();
    for (let i = 0; i < ticks; i++) a.step(dt);
    return { a, b, ticks };
  }
  private buildLoop() {
    this.snap = this.makeLoop();
    this.loopA = this.snap.a.clone();
    this.loopB = this.snap.b.clone();
    this.loopTick = 0;
  }
  setState(state: OrbState) {
    if (state === this.state) return;
    this.state = state;
    if (this.out) { this.pending = true; return; }
    this.out = { snap: this.snap, a: this.loopA, b: this.loopB, tick: this.loopTick };
    this.xTick = 0;
    this.buildLoop();
  }
  advance(sec: number) {
    if (!(sec > 0)) return;
    let t = Math.min(sec, 0.25);
    const n = Math.round(t / DT);
    if (n >= 1 && Math.abs(t - n * DT) < 0.002) t = n * DT;
    this.acc += t;
    while (this.acc >= DT - 1e-9) { this.acc -= DT; this.tick(); }
  }
  private tick() {
    const dt = DT * this.look.speed;
    if (this.intro) {
      this.intro.step(dt);
      if (this.intro.opacity >= 1 && this.intro.intro() <= 0) this.intro = null;
    }
    this.loopA.step(dt);
    this.loopB.step(dt);
    if (++this.loopTick >= this.snap.ticks) {
      this.loopA = this.snap.a.clone();
      this.loopB = this.snap.b.clone();
      this.loopTick = 0;
    }
    if (this.out) {
      const o = this.out;
      o.a.step(dt);
      o.b.step(dt);
      if (++o.tick >= o.snap.ticks) { o.a = o.snap.a.clone(); o.b = o.snap.b.clone(); o.tick = 0; }
      if (++this.xTick >= 36) {
        this.out = null;
        if (this.pending) {
          this.pending = false;
          this.out = { snap: this.snap, a: this.loopA, b: this.loopB, tick: this.loopTick };
          this.xTick = 0;
          this.buildLoop();
        }
      }
    }
  }
  frame(): Frame {
    const w = smooth(this.loopTick / this.snap.ticks);
    const f: Frame = { a: this.loopA.params(), b: this.loopB.params(), w };
    if (this.intro) {
      const ip = this.intro.params();
      f.a = { ...f.a, opacity: ip.opacity, intro: ip.intro, scale: ip.scale };
      f.a.p1 = [f.a.p1[0], f.a.p1[1], f.a.p1[2], ip.intro];
      f.b = f.b && { ...f.b, p1: [f.b.p1[0], f.b.p1[1], f.b.p1[2], ip.intro] };
    }
    if (this.out) {
      const o = this.out;
      f.out = { a: o.a.params(), b: o.b.params(), w: smooth(o.tick / o.snap.ticks) };
      f.x = smooth(this.xTick / 36);
    }
    return f;
  }
}

/* ───────── WebGL renderer ───────── */

type Uniforms = Record<string, WebGLUniformLocation | null>;
const UNIFORMS = ['uA0', 'uA1', 'uB0', 'uB1', 'uWA', 'uWB', 'uC0', 'uC1', 'uD0', 'uD1', 'uWC', 'uWD', 'uX0', 'uX1', 'uSeed', 'uColor1', 'uColor2', 'uColor3', 'uColor4', 'uOpacity', 'uIntro', 'uSurge', 'uSoft', 'uFeather', 'uSwirl', 'uSize', 'uDepth', 'uHaze', 'uAccent', 'uGrain', 'uFill', 'uPx'];

class GLOrb {
  canvas = document.createElement('canvas');
  gl: WebGLRenderingContext;
  private progs: { p: WebGLProgram; u: Uniforms }[] = [];
  size = 0;

  constructor() {
    const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    for (const defs of ['#define ORB_LOOP\n', '#define ORB_LOOP\n#define ORB_XFADE\n']) {
      const p = this.compile(defs);
      const u: Uniforms = {};
      for (const n of UNIFORMS) u[n] = gl.getUniformLocation(p, n);
      this.progs.push({ p, u });
    }
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }
  private compile(defs: string) {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, ORB_VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, defs + ORB_FRAG));
    gl.bindAttribLocation(p, 0, 'position');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    return p;
  }
  ensure(px: number) {
    if (px > this.size) {
      this.size = px;
      this.canvas.width = this.canvas.height = px;
    }
  }
  render(fr: Frame, look: OrbLook, px: number) {
    const gl = this.gl;
    const mix = (e: Frame) => {
      if (!e.b || !(e.w > 0)) return { a: e.a, b: e.a, wA: 1, wB: 0, surge: e.a.surgeVol * (0.65 + 0.35 * e.a.pulse) };
      if (e.w >= 1) return { a: e.b, b: e.b, wA: 1, wB: 0, surge: e.b.surgeVol * (0.65 + 0.35 * e.b.pulse) };
      const c = Math.cos((e.w * Math.PI) / 2), s = Math.sin((e.w * Math.PI) / 2);
      const sv = e.a.surgeVol * (1 - e.w) + e.b.surgeVol * e.w;
      const pu = 0.5 + (e.a.pulse - 0.5) * c + (e.b.pulse - 0.5) * s;
      return { a: e.a, b: e.b, wA: c, wB: s, surge: sv * (0.65 + 0.35 * pu) };
    };
    const cur = mix(fr);
    const old = fr.out ? mix(fr.out) : null;
    const { p, u } = this.progs[old ? 1 : 0];
    gl.useProgram(p);
    const v4 = (n: string, a: number[]) => gl.uniform4fv(u[n], a);
    const f1 = (n: string, a: number) => gl.uniform1f(u[n], a);
    const v3 = (n: string, a: number[]) => gl.uniform3fv(u[n], a);
    v4('uA0', cur.a.p0); v4('uA1', cur.a.p1); v4('uB0', cur.b.p0); v4('uB1', cur.b.p1);
    f1('uWA', cur.wA); f1('uWB', cur.wB);
    let surge = cur.surge;
    if (old) {
      v4('uC0', old.a.p0); v4('uC1', old.a.p1); v4('uD0', old.b.p0); v4('uD1', old.b.p1);
      f1('uWC', old.wA); f1('uWD', old.wB);
      const x = fr.x ?? 1;
      f1('uX0', Math.cos((x * Math.PI) / 2)); f1('uX1', Math.sin((x * Math.PI) / 2));
      surge = (1 - x) * old.surge + x * cur.surge;
    }
    const d = fr.a;
    f1('uSurge', surge); f1('uOpacity', d.opacity); f1('uIntro', d.intro);
    v3('uSeed', d.seed3); v3('uColor1', d.c1); v3('uColor2', d.c2); v3('uColor3', d.c3); v3('uColor4', d.c4);
    f1('uSoft', look.softness); f1('uFeather', look.feather); f1('uSwirl', look.swirl); f1('uSize', look.size);
    f1('uDepth', look.depth); f1('uHaze', look.haze); f1('uAccent', look.accent); f1('uGrain', look.grain);
    const fill = d.scale; // "edge" framing: the orb touches the canvas edge
    f1('uFill', fill); f1('uPx', (fill * px) / 2);
    gl.viewport(0, 0, px, px);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

/* ───────── shared scheduler ───────── */

interface Entry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  player: OrbPlayer;
  look: OrbLook;
  playing: boolean;
  cssSize: number;
  px: number;
  visible: boolean;
  dirty: boolean;
}

export interface OrbHandle {
  setState(s: OrbState): void;
  setPlaying(p: boolean): void;
  resize(css: number): void;
  unregister(): void;
}

class OrbHub {
  private gl: GLOrb | null = null;
  private failed = false;
  private entries = new Set<Entry>();
  private byCanvas = new Map<Element, Entry>();
  private io: IntersectionObserver | null = null;
  private raf = 0;
  private last = -1;

  register(canvas: HTMLCanvasElement, look: OrbLook, state: OrbState, opts: { playing: boolean; size: number; fadeIn: boolean }): OrbHandle | null {
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.start()) return null;
    const e: Entry = { canvas, ctx, player: new OrbPlayer(look, state, opts.fadeIn), look, playing: opts.playing, cssSize: opts.size, px: 0, visible: true, dirty: true };
    this.entries.add(e);
    this.byCanvas.set(canvas, e);
    this.io?.observe(canvas);
    this.request();
    return {
      setState: (s) => { e.player.setState(s); e.dirty = true; this.request(); },
      setPlaying: (p) => { e.playing = p; e.dirty = true; this.request(); },
      resize: (s) => { e.cssSize = s; e.dirty = true; this.request(); },
      unregister: () => {
        this.io?.unobserve(canvas);
        this.entries.delete(e);
        this.byCanvas.delete(canvas);
      },
    };
  }
  private start() {
    if (this.gl) return true;
    if (this.failed) return false;
    try {
      this.gl = new GLOrb();
    } catch (err) {
      this.failed = true;
      console.warn('Maisey orb: WebGL unavailable, falling back to a still image.', err);
      return false;
    }
    this.io = new IntersectionObserver(
      (list) => {
        for (const it of list) {
          const e = this.byCanvas.get(it.target);
          if (e) { e.visible = it.isIntersecting; e.dirty = true; }
        }
        this.request();
      },
      { rootMargin: '64px' },
    );
    document.addEventListener('visibilitychange', () => { this.last = -1; this.request(); });
    return true;
  }
  private request() {
    if (!this.raf && this.entries.size > 0) this.raf = requestAnimationFrame(this.frame);
  }
  private frame = (now: number) => {
    this.raf = 0;
    const gl = this.gl;
    if (document.hidden || !gl) { this.last = -1; return; }
    const dt = this.last < 0 ? 0 : (now - this.last) / 1000;
    this.last = now;
    const dpr = Math.min(Math.max(1, window.devicePixelRatio || 1), 2);
    let anyPlaying = false;
    let need = 0;
    for (const e of this.entries) {
      if (e.playing) { e.player.advance(dt); anyPlaying = true; e.dirty = true; }
      const px = Math.max(1, Math.round(e.cssSize * dpr));
      if (px !== e.px) { e.px = e.canvas.width = e.canvas.height = px; e.dirty = true; }
      if (e.visible) need = Math.max(need, px);
    }
    gl.ensure(need);
    for (const e of this.entries) {
      if (!e.visible || !e.dirty) continue;
      gl.render(e.player.frame(), e.look, e.px);
      e.ctx.clearRect(0, 0, e.px, e.px);
      e.ctx.drawImage(gl.canvas, 0, gl.size - e.px, e.px, e.px, 0, 0, e.px, e.px);
      e.dirty = false;
    }
    if (anyPlaying) this.raf = requestAnimationFrame(this.frame);
    else this.last = -1;
  };
}

let hub: OrbHub | null = null;
export const orbHub = () => (hub ??= new OrbHub());
