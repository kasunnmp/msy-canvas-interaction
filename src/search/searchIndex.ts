import type { AppId } from '../apps';
import avatar1 from '../assets/search/avatar-1.png';
import avatar2 from '../assets/search/avatar-2.png';
import avatar3 from '../assets/search/avatar-3.png';
import maiseyAvatar from '../assets/dock/a156c.png';
import profileA from '../assets/dock/68c98.png';
import profileB from '../assets/dock/1a462.png';
import messagesIcon from '../assets/dock/264ec.png';
import diamondIcon from '../assets/dock/899d7.png';
import tileIcon from '../assets/dock/7a402.png';
import folderIcon from '../assets/dock/f137e.svg';

/** Filter categories. Pills render only for categories present in the current results. */
export type Category = 'Contacts' | 'Messages' | 'PDF' | 'Apollo' | 'Apps';

export type Visual =
  | { kind: 'avatar'; src: string }
  | { kind: 'message'; src: string } // person avatar + small Nexus badge
  | { kind: 'pdf' }
  | { kind: 'app'; src: string };

export interface SearchItem {
  id: string;
  title: string;
  /** Muted secondary text: tag for people, "type • date" for files, date for messages. */
  meta: string[];
  /** Right-aligned source app label. */
  source: string;
  category: Category;
  visual: Visual;
  /** Local (instant) vs network (debounced) index. */
  local: boolean;
  /** Recency boost: days since last opened/modified. */
  recentDays?: number;
  /** Canvas window the camera flies to when this result is opened. */
  target?: AppId;
}

const person = (id: string, title: string, tag: string, src: string, recentDays = 30): SearchItem => ({
  id,
  title,
  meta: [tag],
  source: 'Contacts',
  category: 'Contacts',
  visual: { kind: 'avatar', src },
  local: true,
  recentDays,
  target: 'internal-chat',
});

const message = (id: string, title: string, date: string, src: string, recentDays: number): SearchItem => ({
  id,
  title,
  meta: [date],
  source: 'Nexus',
  category: 'Messages',
  visual: { kind: 'message', src },
  local: false,
  recentDays,
  target: 'internal-chat',
});

const pdf = (id: string, title: string, date: string, recentDays: number, target?: AppId): SearchItem => ({
  id,
  title,
  meta: ['PDF', date],
  source: 'PDF',
  category: 'PDF',
  visual: { kind: 'pdf' },
  local: recentDays <= 7, // recently opened files are cached locally
  recentDays,
  target,
});

const apolloDoc = (id: string, title: string, date: string, recentDays: number): SearchItem => ({
  id,
  title,
  meta: ['Report', date],
  source: 'Apollo',
  category: 'Apollo',
  visual: { kind: 'app', src: tileIcon },
  local: false,
  recentDays,
  target: 'reports',
});

const app = (id: string, title: string, src: string, target: AppId): SearchItem => ({
  id,
  title,
  meta: ['App'],
  source: 'App',
  category: 'Apps',
  visual: { kind: 'app', src },
  local: true,
  recentDays: 1,
  target,
});

/** Sample index (stand-in for the real local cache + cloud index). */
export const SEARCH_INDEX: SearchItem[] = [
  // Apps — core OS apps are cached locally (instant).
  app('app-chat', 'Internal Chat', messagesIcon, 'internal-chat'),
  app('app-reports', 'Reports', tileIcon, 'reports'),
  app('app-hub', 'Action Hub', diamondIcon, 'action-hub'),
  app('app-foxtale', 'Foxtale Studio', folderIcon, 'foxtale-studio'),
  app('app-minions', 'Maisey Minions', maiseyAvatar, 'maisey-minions'),

  // People
  person('p-hayden-molnar', 'Hayden Molnar', 'Primary', maiseyAvatar, 1),
  person('p-hayden', 'Hayden', 'Primary', avatar1, 3),
  person('p-haya', 'Haya Chen', 'Secondary', avatar2, 12),
  person('p-liam', 'Liam Hayman', 'Tertiary', avatar3, 20),
  person('p-pasindu', 'Pasindu Hatanachchige', 'Primary', profileA, 2),
  person('p-yomal', 'Yomal David', 'Secondary', profileB, 5),
  person('p-teresa', 'Teresa Molnar', 'Secondary', avatar2, 9),
  person('p-alex', 'Alex Chen', 'Tertiary', avatar1, 25),
  person('p-victoria', 'Victoria Wang', 'Primary', avatar3, 6),
  person('p-devin', 'Devin Fan', 'Secondary', avatar1, 14),

  // Nexus messages (network)
  message('m-1', 'Hayden, are you there?', '21 July • 1:30 PM', maiseyAvatar, 2),
  message('m-2', 'Pitch was ready Hayden', '21 July • 1:30 PM', maiseyAvatar, 2),
  message('m-3', "This chat works, Let's chat here on maisey comms", '10:30 AM', avatar1, 0),
  message('m-4', 'I will provide performance reviews on all users', '8:00 AM', avatar3, 1),
  message('m-5', 'Update Brand Colors across all screens', '2h ago', avatar2, 0),

  // Files
  pdf('f-1', 'Hayden Molnar', '21 July', 3),
  pdf('f-2', 'Hayden Molnar', '12 July', 12),
  pdf('f-3', 'Hayden Molnar', '10 July', 14),
  pdf('f-4', 'Onboarding.pdf', '2 July', 6),
  pdf('f-5', 'Legal Brief.pdf', '30 June', 18, 'foxtale-studio'),
  pdf('f-6', 'Employee Contract.pdf', '24 June', 25, 'foxtale-studio'),
  pdf('f-7', 'Trade Mark Docs.pdf', '20 June', 40, 'foxtale-studio'),
  pdf('f-8', 'Q3 Budget Report.pdf', '1 July', 4, 'action-hub'),

  // Apollo documents (network)
  apolloDoc('a-1', 'Security overview', 'Refreshed 1m ago', 0),
  apolloDoc('a-2', 'Financial year 2025', '15 June', 30),
  apolloDoc('a-3', 'Income report', '2 July', 8),
  apolloDoc('a-4', 'Login Activity', 'Yesterday', 1),
];

export const CATEGORY_ORDER: Category[] = ['Contacts', 'Apps', 'Messages', 'PDF', 'Apollo'];

/**
 * Ranking (spec §6): exact / prefix title → word-prefix → entity type → recency → substring/fuzzy.
 * Security trimming is a no-op here (sample data is all accessible).
 */
export function rank(items: SearchItem[], query: string): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of items) {
    const t = item.title.toLowerCase();
    let match = -1;
    if (t === q) match = 0;
    else if (t.startsWith(q)) match = 1;
    else if (t.split(/[\s_.,-]+/).some((w) => w.startsWith(q))) match = 2;
    else if (t.includes(q)) match = 3;
    else if (fuzzy(t, q)) match = 4;
    if (match < 0) continue;
    const entity = item.category === 'Contacts' || item.category === 'Apps' ? 0 : 1;
    const recency = Math.min(item.recentDays ?? 60, 60) / 60; // 0 (today) … 1 (60d+)
    scored.push({ item, score: match * 10 + entity * 2 + recency });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.item);
}

/** Letters of q appear in order in t (tolerates small typos/abbreviations). */
function fuzzy(t: string, q: string) {
  if (q.length < 3) return false;
  let i = 0;
  for (const ch of t) if (ch === q[i] && ++i === q.length) return true;
  return false;
}
