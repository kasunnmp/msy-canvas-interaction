/* Action Hub model — ClickUp "Action Hub" + "Task details" (Ext MSY docs), Figma Maisey-Action-Hub. */
import glazy from './assets/glazy.png';
import dazy from './assets/dazy.png';
import teal from './assets/rect148.png';
import meetIcon from './assets/app-meet-2.png';
import confetti from './assets/image1.png';
import messagesIcon from './assets/app-meet-1.png';
import pBlue from '../assets/dock/793e1.png';
import pBlueOverlay from '../assets/dock/35536.png';
import calendarIcon from '../assets/launcher/calendar.png';
import maiseyAvatar from '../assets/dock/a156c.png';
import avatar1 from '../assets/search/avatar-1.png';
import avatar2 from '../assets/search/avatar-2.png';
import avatar3 from '../assets/search/avatar-3.png';
import profileA from '../assets/dock/68c98.png';
import profileB from '../assets/dock/1a462.png';

export type Section = 'rightNow' | 'needsYou' | 'people' | 'suggestions' | 'worth';

/** §4.4 Type Tags: every item has exactly one. */
export type TypeTag = 'Task' | 'Reminder' | 'Mention' | 'Minion' | 'Other' | 'Alert';

export type Kind =
  | 'task'
  | 'approval'
  | 'conflict'
  | 'minion'
  | 'notification'
  | 'suggestion'
  | 'meeting'
  | 'alert'
  | 'mention'
  | 'commitment'
  | 'completion'
  | 'celebration';

/** 0 = No priority. Priority exists only on tasks and is set by the user (§8.3). */
export type Priority = 0 | 1 | 2 | 3; // 1 High, 2 Medium, 3 Low

export interface Person {
  id: string;
  name: string;
  avatar: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  assignee?: string;
}

export interface Comment {
  id: string;
  author: string;
  at: string;
  text: string;
  unread?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  url?: string;
}

export interface MiniCard {
  ago: string;
  title: string;
  icon: 'report' | 'calendar' | 'note' | 'person';
  avatar?: string;
  from?: string;
  text?: string;
}

export interface Item {
  id: string;
  kind: Kind;
  typeTag: TypeTag;
  /** Priority section that surfaces the item (a task still lives in a list). */
  section?: Section;
  /** Tasks always belong to a list under MY LISTS. */
  listId?: string;
  app?: string;
  /** Header line (Minion / app / task title). */
  title: string;
  /** Rich preview text; `{@id}` tokens render as name tags, `**x**` highlights. */
  body?: string;
  avatar?: string;
  /** Visual style for the leading visual. */
  visual?: 'minion' | 'app' | 'alert' | 'people' | 'maisey' | 'confetti' | 'none';
  ago: string;
  /** Days relative to today: 0 today, -1 yesterday, 2 this Friday… */
  day: number;
  /** Sort key within a day (higher = more important). */
  weight: number;
  critical?: boolean;
  label?: 'Approval' | 'Conflict';
  liveDot?: boolean;
  mini?: MiniCard;
  actions?: string[];
  /** Task fields */
  priority: Priority;
  description?: string;
  tags: string[];
  assignees: string[];
  attachments: Attachment[];
  subtasks: Subtask[];
  comments: Comment[];
  activity: string[];
  done: boolean;
  doneDay?: number;
  snoozedUntil?: string;
  trashed: boolean;
}

export interface List {
  id: string;
  name: string;
  icon: string; // emoji or 'checklist'
}

export const PEOPLE: Record<string, Person> = {
  me: { id: 'me', name: 'Kasun Nishshanka', avatar: maiseyAvatar },
  hayden: { id: 'hayden', name: 'Hayden Molnar', avatar: avatar1 },
  teresa: { id: 'teresa', name: 'Teresa Molnar', avatar: avatar2 },
  alex: { id: 'alex', name: 'Alex Chen', avatar: avatar3 },
  shane: { id: 'shane', name: 'Shane Warne', avatar: teal },
  dave: { id: 'dave', name: 'Dave', avatar: teal },
  sarah: { id: 'sarah', name: 'Sarah Jenkins', avatar: profileA },
  jessica: { id: 'jessica', name: 'Jessica Lee', avatar: profileB },
  pasindu: { id: 'pasindu', name: 'Pasindu Hatanachchige', avatar: teal },
};

export const TAGS: Record<string, Tag> = {
  management: { id: 'management', name: 'Management', color: '#7c3aed' },
  design: { id: 'design', name: 'Design', color: '#7c3aed' },
  finance: { id: 'finance', name: 'Finance', color: '#0aba20' },
  urgent: { id: 'urgent', name: 'Urgent', color: '#e5484d' },
  ops: { id: 'ops', name: 'Operations', color: '#eb7500' },
  research: { id: 'research', name: 'Research', color: '#0090ff' },
};

export const ASSETS = { glazy, dazy, teal, meetIcon, confetti, messagesIcon, pBlue, pBlueOverlay, calendarIcon, maiseyAvatar };

export const SECTIONS: { id: Section; label: string; badge: string; dot: string }[] = [
  { id: 'rightNow', label: 'Right now', badge: 'orange', dot: '#eb7500' },
  { id: 'needsYou', label: 'Needs you', badge: 'purple', dot: '#a16aff' },
  { id: 'people', label: 'People', badge: 'green', dot: '#0aba20' },
  { id: 'suggestions', label: 'Suggestions', badge: 'blue', dot: '#0251ed' },
  { id: 'worth', label: 'Worth remembering', badge: 'white', dot: '#f2f2f2' },
];

export const MAX_LISTS = 10;

let n = 1;
const base = (p: Partial<Item> & Pick<Item, 'kind' | 'title'>): Item => ({
  id: `i${n++}`,
  typeTag: 'Other',
  ago: '2h ago',
  day: 0,
  weight: 1,
  priority: 0,
  tags: [],
  assignees: [],
  attachments: [],
  subtasks: [],
  comments: [],
  activity: [],
  done: false,
  trashed: false,
  ...p,
});

const task = (p: Partial<Item> & Pick<Item, 'title' | 'listId'>) =>
  base({ kind: 'task', typeTag: 'Task', activity: ['Teresa M. created this task'], ...p });

export function seedLists(): List[] {
  return [
    { id: 'backlog', name: 'Backlog', icon: 'checklist' },
    { id: 'management', name: 'Management', icon: '🤭' },
  ];
}

export function seedItems(): Item[] {
  const items: Item[] = [
    // ── Right now ──
    base({
      kind: 'alert',
      typeTag: 'Alert',
      section: 'rightNow',
      title: 'Suspicious sign-in attempt!',
      body: 'A login from an unrecognised Windows device in Melbourne. If this wasn’t you, secure your account.',
      visual: 'alert',
      ago: 'Now',
      liveDot: true,
      critical: true,
      weight: 100,
      actions: ['Secure account', 'It was me'],
    }),
    base({
      kind: 'meeting',
      typeTag: 'Reminder',
      section: 'rightNow',
      app: 'Calendar',
      title: 'Financial Meeting - 20mins',
      body: '2:30pm - 4:30pm',
      visual: 'app',
      avatar: meetIcon,
      ago: '2m ago',
      liveDot: true,
      weight: 90,
      mini: { ago: '', title: 'Dazy', icon: 'person', avatar: dazy, text: '3 open items from last week’s sync, want me to bring these up?' },
      actions: ['View'],
    }),
    base({
      kind: 'minion',
      typeTag: 'Minion',
      section: 'rightNow',
      title: 'Dazy',
      body: '3 open items from last week’s sync. Bring these up?',
      visual: 'minion',
      avatar: dazy,
      ago: '10m ago',
      weight: 80,
      mini: { ago: 'a week ago', title: 'Weekly sync: Tue 22 Jun open items', icon: 'note' },
      actions: ['Open'],
    }),
    // ── Needs you ──
    base({
      kind: 'approval',
      typeTag: 'Minion',
      section: 'needsYou',
      title: 'Glazy',
      body: '{@hayden} shared performance review for your approval',
      visual: 'minion',
      avatar: glazy,
      label: 'Approval',
      critical: true,
      weight: 90,
      mini: { ago: '2h ago', title: 'Q3 Budget Report - Finance Review', icon: 'report' },
      actions: ['Reject', 'Approve'],
    }),
    base({
      kind: 'conflict',
      typeTag: 'Minion',
      section: 'needsYou',
      title: 'Glazy',
      body: '{@hayden} said $12k, {@shane} $15k. Which is correct?',
      visual: 'minion',
      avatar: glazy,
      label: 'Conflict',
      critical: true,
      ago: '3h ago',
      weight: 85,
      actions: ['$12k', '$15k'],
    }),
    task({
      section: 'needsYou',
      listId: 'management',
      title: 'Review Q3 budget variance',
      body: 'Sign-off needed before Friday’s review',
      priority: 1,
      tags: ['management'],
      assignees: ['teresa'],
      ago: 'Today',
      weight: 70,
    }),
    task({
      section: 'needsYou',
      listId: 'management',
      title: 'Schedule Appointments',
      body: 'Remember to schedule the appointments for tomorrow’s session',
      priority: 3,
      tags: ['management'],
      assignees: ['teresa'],
      ago: 'Yesterday',
      day: -1,
      weight: 50,
    }),
    base({
      kind: 'approval',
      typeTag: 'Minion',
      section: 'needsYou',
      title: 'Glazy',
      body: '{@teresa} shared a leave request for your approval',
      visual: 'minion',
      avatar: glazy,
      label: 'Approval',
      day: -2,
      weight: 60,
      mini: { ago: '2h ago', title: 'Jul 5 Friday: Casual leave', icon: 'calendar' },
      actions: ['Reject', 'Approve'],
    }),
    // ── People ──
    task({
      section: 'people',
      listId: 'management',
      title: 'Prepare slides for the board update',
      assignees: ['hayden'],
      tags: ['management'],
      weight: 70,
    }),
    base({
      kind: 'mention',
      typeTag: 'Mention',
      section: 'people',
      title: '3 people are asking about the Q3 numbers',
      body: 'In chats with Philip, Teresa and Dave, across 3 chats.',
      visual: 'people',
      ago: '3h ago',
      liveDot: true,
      weight: 65,
      actions: ['Open chats'],
    }),
    base({
      kind: 'commitment',
      typeTag: 'Reminder',
      section: 'people',
      title: 'Send the Q3 draft to Dave',
      body: 'You said ‘I’ll send that later’ in the Management chat.',
      visual: 'app',
      avatar: messagesIcon,
      ago: '3h ago',
      liveDot: true,
      weight: 60,
      actions: ['Send now'],
    }),
    base({
      kind: 'completion',
      typeTag: 'Other',
      section: 'people',
      title: 'Jessica completed the task',
      body: '‘Update brand colours’',
      visual: 'minion',
      avatar: profileB,
      ago: '5h ago',
      weight: 40,
    }),
    task({
      section: 'people',
      listId: 'backlog',
      title: 'Update Brand Colors',
      body: 'New palette needs to be applied across all screens',
      assignees: ['alex'],
      tags: ['design'],
      day: -1,
      weight: 45,
    }),
    // ── Suggestions ──
    base({
      kind: 'suggestion',
      typeTag: 'Other',
      section: 'suggestions',
      title: 'Share the doc with {@dave}',
      visual: 'maisey',
      ago: '4h ago',
      weight: 70,
      mini: { ago: '10:30 am', title: 'Terresa', icon: 'person', avatar: avatar2, text: 'Please send this to Dave **tomorrow**.' },
      actions: ['Remind me tomorrow', 'Share Now'],
    }),
    base({
      kind: 'suggestion',
      typeTag: 'Other',
      section: 'suggestions',
      title: 'Merge 5 to-dos about ‘Buy the app’',
      visual: 'maisey',
      ago: 'Yesterday',
      weight: 60,
      actions: ['Remind me tomorrow', 'Show tasks'],
    }),
    base({
      kind: 'suggestion',
      typeTag: 'Other',
      section: 'suggestions',
      title: 'Still want to do this one, or archive it?',
      visual: 'maisey',
      ago: '4h ago',
      weight: 50,
      mini: { ago: '2h ago', title: 'Q3 Budget Report - Finance Review', icon: 'report' },
      actions: ['Remind me tomorrow', 'Take action'],
    }),
    // ── Worth remembering ──
    base({
      kind: 'celebration',
      typeTag: 'Reminder',
      section: 'worth',
      title: 'It’s Pasindu’s birthday today 🎂',
      body: 'Send him a birthday wish!',
      visual: 'confetti',
      weight: 50,
      actions: ['Send a message'],
    }),
    base({
      kind: 'celebration',
      typeTag: 'Reminder',
      section: 'worth',
      title: 'Dave’s Work Anniversary 💼',
      body: 'Say congrats!',
      visual: 'confetti',
      day: 2,
      weight: 40,
      actions: ['Set a reminder'],
    }),
    // ── Backlog-only items ──
    base({
      kind: 'notification',
      typeTag: 'Other',
      listId: 'backlog',
      app: 'Reports',
      title: 'Financial Report Ready',
      body: 'The Q3 revenue summary has been compiled successfully',
      visual: 'app',
      avatar: meetIcon,
      ago: 'Now',
      weight: 30,
      actions: ['Open'],
    }),
    task({
      listId: 'backlog',
      title: 'Urgent Review and Authorization of Comprehensive GP Management Plan (GPMP), Team Care Arrangements (TCA), and DVA Transport Approval.',
      description:
        'please review the extensive documentation attached for Mr. Arthur Pendelton. Following his discharge from the acute respiratory ward last week, he has experienced a sudden exacerbation of his chronic COPD combined with a new presentation of unexplained weight loss.authorized as he has run out of repeats.',
      priority: 1,
      tags: ['management', 'urgent'],
      assignees: ['teresa', 'alex', 'hayden', 'sarah'],
      section: 'needsYou',
      weight: 75,
      subtasks: [
        { id: 's1', title: 'Audit all typography styles', done: false },
        { id: 's2', title: 'Update the color palette design tokens to align with the new brand guidelines', done: false },
        { id: 's3', title: 'Export all updated SVG icons, optimize them using SVGO', done: false, assignee: 'alex' },
      ],
      activity: ['Teresa M. created this task', 'Sarah J. added attachments'],
      comments: [
        { id: 'c1', author: 'sarah', at: 'Yesterday, 4:15 PM', text: 'I’ve uploaded the latest contrast report. We are failing on the tertiary buttons in the dark theme when they sit over the new modal overlay background.' },
        {
          id: 'c2',
          author: 'alex',
          at: 'Today, 9:08 AM',
          text: 'Could someone please double-check the padding on the modal component? I noticed it looks a bit tight on mobile screens, specifically when the software keyboard is active and pushes the content up.',
          unread: true,
        },
      ],
    }),
    task({ listId: 'backlog', title: 'Buy the app', body: 'Its there on the app store', assignees: ['teresa'], tags: ['management'], weight: 28 }),
    task({ listId: 'backlog', title: 'Draft onboarding checklist', priority: 2, tags: ['ops'], weight: 26 }),
    task({ listId: 'backlog', title: 'Collect vendor quotes for Q4', priority: 3, tags: ['finance'], day: -1, weight: 20 }),
    task({ listId: 'backlog', title: 'Archive old patient intake forms', day: -2, weight: 10 }),
    task({ listId: 'management', title: 'Prepare 1:1 notes for Hayden', priority: 2, tags: ['management'], weight: 30 }),
    task({ listId: 'management', title: 'Approve team leave calendar', tags: ['management'], day: -1, weight: 25 }),
  ];
  // A few completed items, for the per-day "Completed items" pills.
  const done = (title: string, day: number, listId = 'backlog', section?: Section) =>
    task({ title, listId, day, done: true, doneDay: day, section });
  items.push(
    done('Book room for design review', 0, 'backlog', 'rightNow'),
    done('Reply to pharmacy follow-up', 0, 'backlog', 'rightNow'),
    done('Send minutes from standup', -1, 'management', 'needsYou'),
    done('Check payroll export', -1, 'backlog', 'needsYou'),
    done('Renew SSL certificate', -2, 'backlog', 'needsYou'),
  );
  return items;
}

export const isTask = (i: Item) => i.kind === 'task';
export const isLive = (i: Item) => !i.trashed;
export const isOpen = (i: Item) => !i.trashed && !i.done;

/** Critical items can't be snoozed (§5.1). */
export const canSnooze = (i: Item) => !i.critical;

/** Feedback is offered on Intent cards, Maisey and Minion items — not tasks (§5.2). */
export const canFeedback = (i: Item) => i.kind !== 'task';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Matches the status bar clock: Wed 2 Jul. */
export const TODAY = new Date(2025, 6, 2, 10, 19);

/** "2 Jul · Today · Wednesday" — dates state when items arrived, never how late (§4.6). */
export function dayParts(offset: number): string[] {
  const d = new Date(+TODAY + offset * 864e5);
  const label = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const rel = offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : offset === 1 ? 'Tomorrow' : offset > 1 && offset < 7 ? `This ${DAYS[d.getDay()]}` : null;
  if (rel && rel.startsWith('This ')) return [label, rel];
  return rel ? [label, rel, DAYS[d.getDay()]] : [label, DAYS[d.getDay()]];
}

export const SNOOZE_OPTIONS = [
  { id: '30m', label: 'In 30 minutes', at: '10:49 AM' },
  { id: '1h', label: 'In 1 hour', at: '11:19 AM' },
  { id: 'later', label: 'Later today', at: '4:00 PM' },
  { id: 'tomorrow', label: 'Tomorrow', at: 'Thu 9:00 AM' },
  { id: 'week', label: 'Next week', at: 'Mon 7 Jul, 9:00 AM' },
];

export const PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: 0, label: 'No priority', color: 'rgba(0,0,0,0.45)' },
  { id: 1, label: 'High', color: '#e5484d' },
  { id: 2, label: 'Medium', color: '#eb7500' },
  { id: 3, label: 'Low', color: '#0090ff' },
];

export const ICON_SET = ['checklist', '📋', '🗂️', '📌', '🎯', '🚀', '💼', '📈', '🧾', '🧠', '🗓️', '⭐', '🔥', '🛠️', '💡', '📣', '🤝', '🏥', '🧪', '📦'];
export const EMOJI_SET = ['😀', '🤭', '😎', '🥳', '🤓', '😇', '🙌', '👏', '🎉', '❤️', '🌱', '🌈', '☕', '🍀', '🐝', '🦊', '🐼', '🌟', '⚡', '🍕', '🎨', '🎵', '📚', '✈️'];
