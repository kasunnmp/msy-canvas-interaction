/**
 * Ask Maisey — data + language helpers for the Dock chat (Figma: Maisey-Minions 746:11381,
 * ClickUp "Minions" §5 Flow A — creating a Minion from Ask Maisey).
 */
import base from './assets/avatar-base.png';
import pasA from './assets/avatar-pasindu-a.png';
import pasB from './assets/avatar-pasindu-b.png';
import yomal from './assets/person-yomal.jpg';
import yoshio from './assets/person-yoshio.jpg';
import yoker from './assets/person-yoker.png';
import micro1 from './assets/micro-1.png';
import micro2 from './assets/micro-2.png';
import glazy from './assets/minion-glazy.png';
import maiseyDot from '../assets/dock/a156c.png';
import reportingLogo from '../assets/dock/899d7.png';
import nexusLogo from '../assets/dock/264ec.png';

export interface Person {
  id: string;
  name: string;
  /** Stacked avatar layers, bottom → top (as in the Figma Name-tag). */
  avatar: string[];
}

export const PEOPLE: Person[] = [
  { id: 'pasindu', name: 'Pasindu Hatanachchige', avatar: [base, pasA, pasB] },
  { id: 'yomal', name: 'Yomal David', avatar: [yomal] },
  { id: 'hayden', name: 'Hayden Molnar', avatar: [base, maiseyDot] },
  { id: 'yoshio', name: 'Yoshio Leos', avatar: [yoshio] },
  { id: 'yoker', name: 'Yoker Kulathunga', avatar: [yoker] },
  { id: 'mark', name: 'Mark Lethbridge', avatar: [base, micro1] },
  { id: 'markistone', name: 'Markistone Anthony', avatar: [base, micro2] },
  { id: 'markd', name: 'Mark David', avatar: [yoker] },
];
export const person = (id: string) => PEOPLE.find((p) => p.id === id)!;
export const firstName = (id: string) => person(id).name.split(' ')[0];

export interface AppRef {
  id: 'reporting' | 'nexus';
  name: string;
  logo: string[];
}
export const APPS: Record<AppRef['id'], AppRef> = {
  reporting: { id: 'reporting', name: 'Reporting App', logo: [base, nexusLogo, reportingLogo] },
  nexus: { id: 'nexus', name: 'Nexus App', logo: [base, nexusLogo] },
};
export const MINION_AVATAR = glazy;

/** Rich text: plain text, person name-tags and app tags. */
export type Seg =
  | { t: 'text'; v: string }
  | { t: 'person'; id: string }
  | { t: 'app'; id: AppRef['id']; label?: string }
  /** An @mention that never matched a contact — kept as typed. */
  | { t: 'raw'; v: string };

export const txt = (v: string): Seg => ({ t: 'text', v });
export const plain = (segs: Seg[]) =>
  segs
    .map((s) => (s.t === 'text' || s.t === 'raw' ? s.v : s.t === 'person' ? person(s.id).name : (s.label ?? APPS[s.id].name)))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

/* ───────── Blueprint ───────── */

export type Days = 'daily' | 'weekdays';
export interface Blueprint {
  name: string;
  report: string;
  hour: number;
  minute: number;
  ampm: 'AM' | 'PM' | null;
  days: Days | null;
  recipients: string[];
  /** @mentions that could not be matched to a contact (resolve fails at test/commit). */
  unresolved: string[];
  timezone: string;
  /** Fields Maisey filled with a safe default because the user skipped / never said. */
  assumed: string[];
  active: boolean;
  version: number;
}

export const timeLabel = (b: Pick<Blueprint, 'hour' | 'minute' | 'ampm'>) =>
  `${b.hour}:${String(b.minute).padStart(2, '0')} ${b.ampm ?? 'AM'}`;
export const shortTime = (b: Pick<Blueprint, 'hour' | 'minute' | 'ampm'>) =>
  `${b.hour}${b.minute ? `:${String(b.minute).padStart(2, '0')}` : ''} ${b.ampm ?? 'AM'}`;
export const daysLabel = (d: Days | null) => (d === 'weekdays' ? 'every weekday' : 'every day');

export function joinNames(ids: string[]) {
  const n = ids.map(firstName);
  if (n.length <= 1) return n.join('');
  return `${n.slice(0, -1).join(', ')} & ${n[n.length - 1]}`;
}

export function whoLabel(b: Blueprint) {
  const n = [...b.recipients.map(firstName), ...b.unresolved.map((u) => `@${u}`)];
  if (!n.length) return 'you';
  return n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} & ${n[n.length - 1]}`;
}
export const describe = (b: Blueprint) => `I'll send the ${b.report} to ${whoLabel(b)} ${daysLabel(b.days)} at ${timeLabel(b)}.`;

/* ───────── Parsing the request (§5.1) ───────── */

/** Minion-shaped = work that should repeat or run without another prompt. */
export function isMinionShaped(text: string) {
  return /\b(every\s?day|everyday|every\s+(morning|evening|week|weekday|monday|tuesday|wednesday|thursday|friday|month|hour)|each\s+(day|morning|week)|daily|weekly|monthly|weekdays?|whenever|recurring|on a schedule)\b/i.test(text);
}

export function parseTime(text: string): { hour: number; minute: number; ampm: 'AM' | 'PM' | null } | null {
  const at =
    /\bat\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?m?\b/i.exec(text) ??
    /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\b/i.exec(text) ??
    /^\s*(\d{1,2})(?::(\d{2}))?\s*$/.exec(text);
  if (!at) return null;
  let hour = Number(at[1]);
  const minute = at[2] ? Number(at[2]) : 0;
  let ampm: 'AM' | 'PM' | null = at[3] ? (at[3].toLowerCase().startsWith('p') ? 'PM' : 'AM') : null;
  if (hour > 23 || minute > 59) return null;
  if (hour >= 13) { hour -= 12; ampm = 'PM'; }
  if (hour === 0) { hour = 12; ampm = 'AM'; }
  if (!ampm && /\b(morning)\b/i.test(text)) ampm = 'AM';
  if (!ampm && /\b(evening|night|afternoon)\b/i.test(text)) ampm = 'PM';
  return { hour, minute, ampm };
}

export function parseDays(text: string): Days | null {
  if (/\bweekdays?\b|mon(day)?\s*(-|–|to)\s*fri(day)?/i.test(text)) return 'weekdays';
  if (/\bevery\s?day\b|\beveryday\b|\bdaily\b|\beach day\b/i.test(text)) return 'daily';
  return null;
}

export function parseReport(text: string) {
  const m = /\bsend\s+(?:me\s+)?(?:the\s+|a\s+|an\s+)?(.+?)\s+(?:to|for)\b/i.exec(text);
  const r = (m?.[1] ?? 'daily report').replace(/^(daily|weekly)\s+(\1\s+)/i, '$1 ').trim();
  return r.toLowerCase();
}

export function buildBlueprint(segs: Seg[]): Blueprint {
  const text = plain(segs);
  const t = parseTime(text);
  return {
    name: 'Glazy',
    report: parseReport(text),
    hour: t?.hour ?? 8,
    minute: t?.minute ?? 0,
    ampm: t?.ampm ?? null,
    days: parseDays(text),
    recipients: [...new Set(segs.filter((s): s is Extract<Seg, { t: 'person' }> => s.t === 'person').map((s) => s.id))],
    unresolved: segs.filter((s): s is Extract<Seg, { t: 'raw' }> => s.t === 'raw').map((s) => s.v.replace(/^@/, '')),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time',
    assumed: ['Timezone'],
    active: false,
    version: 1,
  };
}

export const titleFor = (b: Blueprint | null, firstMessage: string) =>
  b ? `${b.report.charAt(0).toUpperCase()}${b.report.slice(1)} Minion` : firstMessage.length > 42 ? `${firstMessage.slice(0, 40)}…` : firstMessage || 'New chat';
