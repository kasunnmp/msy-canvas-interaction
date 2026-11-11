/**
 * Maisey orb — "a blue silk ribbon in a frosted ball".
 * Fragment shader ported 1:1 from Maisey Orb Studio (maisey-orb-studio.pages.dev), `maisey` style.
 * Uses the studio's export path (clip-space quad + analytic edge AA) so it runs on bare WebGL 1.
 */
export const ORB_VERT = `attribute vec2 position;
varying vec2 vNdc;
void main() {
  vNdc = position;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

export const ORB_FRAG = `precision highp float;
uniform vec4 uA0;
uniform vec4 uA1;
#ifdef ORB_LOOP
uniform vec4 uB0;
uniform vec4 uB1;
uniform float uWA;
uniform float uWB;
#endif
#ifdef ORB_XFADE
uniform vec4 uC0;
uniform vec4 uC1;
uniform vec4 uD0;
uniform vec4 uD1;
uniform float uWC;
uniform float uWD;
uniform float uX0;
uniform float uX1;
#endif
uniform vec3 uSeed;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uOpacity;
uniform float uIntro;
uniform float uSurge;
uniform float uSoft;
uniform float uFeather;
uniform float uSwirl;
uniform float uSize;
uniform float uDepth;
uniform float uHaze;
uniform float uAccent;
uniform float uGrain;
uniform float uFill;
uniform float uPx;
varying vec2 vNdc;
#define PZ 10.0
const float TAU = 6.28318530717958647692;
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx) * 2.0 - 1.0;
}
float wrapc(float x, float per) { return x - per * floor((x + 0.5) / per); }
vec3 wrapv(vec3 i, vec3 per) { return vec3(wrapc(i.x, per.x), wrapc(i.y, per.y), wrapc(i.z, per.z)); }
float gnoise(vec3 p, vec3 per) {
  vec3 i = floor(p);
  vec3 f = p - i;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec3 a = wrapv(i, per) + uSeed;
  vec3 b = wrapv(i + 1.0, per) + uSeed;
  float n000 = dot(hash33(vec3(a.x, a.y, a.z)), f);
  float n100 = dot(hash33(vec3(b.x, a.y, a.z)), f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(hash33(vec3(a.x, b.y, a.z)), f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(hash33(vec3(b.x, b.y, a.z)), f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(hash33(vec3(a.x, a.y, b.z)), f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(hash33(vec3(b.x, a.y, b.z)), f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(hash33(vec3(a.x, b.y, b.z)), f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(hash33(vec3(b.x, b.y, b.z)), f - vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
vec2 rot2(vec2 v, float t) { float c = cos(t), s = sin(t); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
vec2 mass(vec2 uv, vec4 P0, vec4 P1) {
  float flow = P0.x, drift = P0.y, twist = P0.z, rot = P0.w;
  float ripPh = P1.x, ripAmp = P1.y, surge = P1.z;
  vec3 per = vec3(1000.0, 1000.0, PZ);
  vec2 s = rot2(uv, rot * TAU + (0.7 * uSwirl + 3.2 * twist) * (1.0 - 0.75 * dot(uv, uv)) + 7.0 * twist * (1.0 - length(uv)));
  s += 0.35 * vec2(cos(drift * TAU / 10.0), sin(drift * TAU / 10.0));
  s *= 1.0 - 0.15 * surge;
  vec3 p = vec3(s * 0.45, flow);
  vec2 q = vec2(gnoise(p + vec3(0.0, 0.0, 3.1), per), gnoise(p + vec3(5.2, 1.3, 7.3), per));
  vec3 pw = p + vec3(q * (0.7 + 1.3 * uSwirl), 0.0);
  float d = 0.6 * s.y + 0.95 * gnoise(pw, per);
  d += 0.07 * sin(s.x * 6.0 - ripPh) * ripAmp * smoothstep(0.0, 0.4, length(uv));
  return vec2(d, q.x);
}
vec2 massAt(vec2 uv) {
  vec2 m = mass(uv, uA0, uA1);
#ifdef ORB_LOOP
  m = m * uWA + mass(uv, uB0, uB1) * uWB;
#endif
#ifdef ORB_XFADE
  vec2 mo = mass(uv, uC0, uC1) * uWC;
  if (uWD > 0.0) mo += mass(uv, uD0, uD1) * uWD;
  m = mo * uX0 + m * uX1;
#endif
  return m;
}
const float HALF_PI = 1.57079632679489662;
void main() {
  vec2 uv = vNdc / uFill;
  float r = length(uv);
  if (r > 1.0 + 1.0 / uPx) { gl_FragColor = vec4(0.0); return; }
  vec2 amp = vec2(uA0.z, uA1.y);
#ifdef ORB_LOOP
  amp = mix(amp, vec2(uB0.z, uB1.y), atan(uWB, uWA) / HALF_PI);
#endif
#ifdef ORB_XFADE
  vec2 ampO = mix(vec2(uC0.z, uC1.y), vec2(uD0.z, uD1.y), atan(uWD, uWC) / HALF_PI);
  amp = mix(ampO, amp, atan(uX1, uX0) / HALF_PI);
#endif
  float ripAmp = amp.y;
  float thinking = smoothstep(0.04, 0.2, amp.x);
  const vec2 LD = vec2(0.47, 0.88);
  const float E = 0.08;
  vec2 m = massAt(uv);
  vec2 m2 = massAt(uv + LD * E);
  float T = mix(0.1, 0.5, uSize) + 0.45 * uSurge + 0.1 * ripAmp;
  float w = mix(0.05, 0.24, uSoft);
  float k = 0.008 + 0.03 * uSoft;
  float inside = T - sqrt(m.x * m.x + k);
  float inside2 = T - sqrt(m2.x * m2.x + k);
  float gather = 1.0 - 0.9 * clamp(1.5 * ripAmp, 0.0, 1.0) * smoothstep(0.3, 0.85, r);
  float blue = smoothstep(-w, w, inside) * gather;
  float h = smoothstep(-w, T, inside);
  float h2 = smoothstep(-w, T, inside2);
  float slope = (h2 - h) / E;
  float lit = clamp(0.55 - 0.35 * slope, 0.0, 1.0);
  vec3 body = mix(uColor2, uColor1, clamp((1.0 - lit) * 1.6 * uDepth, 0.0, 1.0));
  body += mix(uColor2, uColor3, 0.3) * 0.4 * smoothstep(0.7, 1.0, lit) * h;
  float st = 0.5 + 0.5 * sin(m.x * 34.0 + 5.0 * m.y);
  body *= 1.0 - 0.07 * (1.0 - st) * h;
  body = mix(body, mix(uColor2, uColor3, 0.5), 0.2 * st * st * st * smoothstep(0.45, 1.0, lit) * h);
  body = mix(body, uColor4, uAccent * 0.8 * (1.0 - h) * (1.0 - h) * clamp(0.6 + 1.0 * m.y, 0.0, 1.0));
  float shade = smoothstep(-w, w, inside2) * (1.0 - blue);
  vec3 field = mix(uColor3, mix(uColor3, uColor1, 0.3), 0.6 * shade);
  float f = (inside + 0.5 * w) / (0.6 * w + 0.04);
  field = mix(field, uColor4, uAccent * 0.3 * exp(-f * f));
  float off = 0.34 + 0.2 * m.y;
  float back = smoothstep(-1.4 * w, 1.4 * w, 0.6 * T - sqrt((m.x - off) * (m.x - off) + k)) * gather;
  field = mix(field, mix(uColor2, uColor3, 0.5 - 0.2 * thinking), (0.42 + 0.4 * thinking) * back);
  vec3 col = mix(field, body, blue);
  float haze = smoothstep(0.5, 1.0, r);
  vec3 veil = mix(uColor3, mix(uColor3, uColor2, 0.15), smoothstep(0.86, 1.0, r));
  col = mix(col, veil, clamp(pow(haze, 1.4) * uHaze, 0.0, 0.92));
  col = mix(col, uColor3, 0.08 * uHaze);
  col = mix(col, col * 0.94 + uColor2 * 0.04, 0.5 * smoothstep(0.72, 0.96, r) * (1.0 - smoothstep(0.96, 1.0, r)));
  col *= 1.0 + 0.1 * uSurge * (1.0 - r);
  col *= 1.0 - 0.3 * uIntro;
  col += (fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.07 * uGrain;
  col = clamp(col, 0.0, 1.0);
  float alpha = 1.0 - (1.0 - uOpacity) * (1.0 - uOpacity) * (1.0 - uOpacity);
  alpha *= clamp((1.0 - r) * uPx + 0.5, 0.0, 1.0);
  alpha *= smoothstep(1.0, 1.0 - mix(0.01, 0.06, uHaze), r);
  if (uFeather > 0.0) alpha *= smoothstep(1.0, 1.0 - uFeather, r);
  gl_FragColor = alpha >= 0.75 / 255.0 ? vec4(col * alpha, alpha) : vec4(0.0);
}`;
