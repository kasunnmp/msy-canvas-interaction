import type { Person, ReportCard, Source, Tile } from './types';
import stazy from '../assets/stazy.png';
import avatarA from '../assets/avatar-a.png';
import avatarB from '../assets/avatar-b.png';
import avatarC from '../assets/avatar-c.png';
import srcAvatar1 from '../assets/src-avatar-1.png';
import srcAvatar2 from '../assets/src-avatar-2.png';
import diamondIcon from '../../assets/dock/899d7.png';
import tileIcon from '../../assets/dock/7a402.png';
import messagesIcon from '../../assets/dock/264ec.png';
import maiseyAvatar from '../../assets/dock/a156c.png';

export const STAZY_AVATAR = stazy;

/** Data sources Stazy connects to (§5). Minions use circular avatars, apps/OS use squircles. */
export const SOURCES: Record<string, Source> = {
  glazy: { id: 'glazy', name: 'Glazy · Access Control', kind: 'minion', icon: srcAvatar1 },
  dazy: { id: 'dazy', name: 'Dazy · Clinical Ops', kind: 'minion', icon: srcAvatar2 },
  apollo: { id: 'apollo', name: 'Apollo', kind: 'app', icon: tileIcon },
  nexus: { id: 'nexus', name: 'Nexus', kind: 'app', icon: messagesIcon },
  patients: { id: 'patients', name: 'Patients', kind: 'app', icon: diamondIcon },
  os: { id: 'os', name: 'Maisey OS', kind: 'os', icon: maiseyAvatar },
};

export const ME: Person = { id: 'me', name: 'Kasun N.', avatar: avatarA, access: 'Owner' };

const people = {
  hayden: { id: 'hayden', name: 'Hayden Molnar', avatar: avatarB, access: 'Editor' as const },
  pasindu: { id: 'pasindu', name: 'Pasindu Hatanachchige', avatar: avatarC, access: 'Viewer' as const },
  yomal: { id: 'yomal', name: 'Yomal David', avatar: srcAvatar2, access: 'Viewer' as const },
  auditor: { id: 'auditor', name: 'ext.auditor@northwind.org', avatar: srcAvatar1, access: 'Viewer' as const, external: true },
};

let seed = 11;
const t = (p: Partial<Tile> & Pick<Tile, 'type' | 'name' | 'x' | 'y' | 'w' | 'h'>): Tile => ({
  id: `t${seed}`,
  sources: ['glazy'],
  status: 'ok',
  seed: seed++,
  ...p,
});

const HOUR_LOGINS = [10, 4, 52, 62, 59, 28, 8];
const OFF_HOURS_MONTHS = [55, 37, 42, 33, 29];

const now = Date.now();
const min = 60_000;
const day = 86_400_000;

export function createSampleReports(): ReportCard[] {
  return [
    {
      id: 'income',
      name: 'Income report',
      tags: [],
      category: 'mine',
      role: 'owner',
      createdAt: now - 40 * day,
      createdBy: ME.name,
      schedule: 'Every Monday at 9:00 am',
      sharing: [ME, people.hayden],
      linkAccess: 'private',
      autoRefresh: false,
      refreshedAt: now - 3 * min,
      pinned: true,
      inTrash: false,
      summary: 'Revenue has been steady this month; claims processing in Oncology is where the movement is.',
      description: 'Revenue and claims across departments.',
      tiles: [
        t({ type: 'stat', name: 'Revenue', x: 0, y: 0, w: 3, h: 3, sources: ['apollo'], unit: '' }),
        t({ type: 'stat', name: 'Claims paid', x: 3, y: 0, w: 3, h: 3, sources: ['apollo'] }),
        t({ type: 'donut', name: 'Revenue by department', x: 6, y: 0, w: 6, h: 6, sources: ['apollo'] }),
        t({ type: 'simpleBar', name: 'Claims by department', x: 0, y: 3, w: 6, h: 5, sources: ['apollo', 'patients'] }),
      ],
    },
    {
      id: 'security',
      name: 'Security overview',
      tags: ['red', 'green'],
      category: 'mine',
      role: 'owner',
      createdAt: now - 21 * day,
      createdBy: ME.name,
      schedule: 'Every day at 8:00 am',
      sharing: [ME, people.hayden, people.pasindu, people.yomal, people.auditor],
      linkAccess: 'private',
      autoRefresh: false,
      refreshedAt: now - min,
      pinned: false,
      inTrash: false,
      summary:
        'Sign-in activity has been busier than usual mid-morning, and the anomaly queue has been building since the weekend. Start with Flagged anomalies before rounds.',
      description: 'Access patterns, off-hours activity and anomalies flagged by Glazy.',
      tiles: [
        t({ type: 'stat', name: 'Total logins', x: 0, y: 0, w: 3, h: 3, preset: { value: 214, delta: 6.1 } }),
        t({ type: 'stat', name: 'Off-hours logins', x: 3, y: 0, w: 3, h: 3, preset: { value: 18, delta: 6.1 } }),
        t({ type: 'stat', name: 'Unique users', x: 6, y: 0, w: 3, h: 3, statMode: 'share', preset: { value: 176, share: 8.4 } }),
        t({ type: 'stat', name: 'Flagged anomalies', x: 9, y: 0, w: 3, h: 3, statMode: 'alert', tone: 'alert', preset: { value: 3 } }),
        t({ type: 'area', name: 'Total logins', x: 0, y: 3, w: 6, h: 6, preset: { value: 214, series: HOUR_LOGINS } }),
        t({
          type: 'area',
          name: 'Off-hours logins',
          x: 6,
          y: 3,
          w: 6,
          h: 6,
          refreshedAt: now - day,
          preset: { value: 18, series: OFF_HOURS_MONTHS, labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'] },
        }),
        t({ type: 'heatmap', name: 'Sign-in density', x: 0, y: 9, w: 8, h: 4, sources: ['glazy', 'os'] }),
        t({ type: 'rankedList', name: 'Top flagged accounts', x: 8, y: 9, w: 4, h: 5 }),
      ],
    },
    {
      id: 'signins',
      name: 'User sign-ins',
      tags: ['red', 'green'],
      category: 'mine',
      role: 'owner',
      createdAt: now - 12 * day,
      createdBy: ME.name,
      schedule: 'Weekdays at 7:00 am',
      sharing: [ME, people.hayden],
      linkAccess: 'org',
      autoRefresh: true,
      refreshedAt: now - 8 * min,
      pinned: false,
      inTrash: false,
      description: 'Sign-ins by method, plus the funnel from attempt to session.',
      tiles: [
        t({ type: 'statGroup', name: 'Sign-ins at a glance', x: 0, y: 0, w: 6, h: 3 }),
        t({ type: 'gauge', name: 'MFA adoption', x: 6, y: 0, w: 3, h: 3, unit: '%', preset: { value: 82 } }),
        t({ type: 'stat', name: 'Failed sign-ins', x: 9, y: 0, w: 3, h: 3, status: 'failed', sources: ['glazy', 'os'], failedSources: ['os'] }),
        t({ type: 'funnel', name: 'Sign-in funnel', x: 0, y: 3, w: 4, h: 6 }),
        t({ type: 'line', name: 'Sign-ins over time', x: 4, y: 3, w: 8, h: 4 }),
        t({ type: 'stat', name: 'Locked accounts', x: 4, y: 7, w: 3, h: 3, status: 'noData' }),
        t({ type: 'stat', name: 'Unbound tile', x: 7, y: 7, w: 3, h: 3, status: 'unbound', sources: [] }),
      ],
    },
    {
      id: 'fy2025',
      name: 'Financial year 2025',
      tags: [],
      category: 'mine',
      role: 'owner',
      createdAt: now - 70 * day,
      createdBy: ME.name,
      schedule: 'First of every month at 6:00 am',
      sharing: [ME],
      linkAccess: 'private',
      autoRefresh: false,
      refreshedAt: now - 2 * 60 * min,
      pinned: false,
      inTrash: false,
      description: 'Budget against spend for FY2025.',
      tiles: [
        t({ type: 'groupedBar', name: 'Budget vs spend', x: 0, y: 0, w: 8, h: 5, sources: ['apollo'] }),
        t({ type: 'keyValue', name: 'Quarter summary', x: 8, y: 0, w: 4, h: 5, sources: ['apollo'] }),
        t({ type: 'table', name: 'Department spend', x: 0, y: 5, w: 12, h: 5, sources: ['apollo'] }),
      ],
    },
    {
      id: 'login-activity',
      name: 'Login Activity',
      tags: ['green'],
      category: 'shared',
      role: 'viewer',
      createdAt: now - 30 * day,
      createdBy: people.hayden.name,
      schedule: 'Every day at 9:00 am',
      sharing: [{ ...people.hayden, access: 'Owner' }, { ...ME, access: 'Viewer' }, people.yomal],
      linkAccess: 'org',
      autoRefresh: false,
      refreshedAt: now - 15 * min,
      pinned: false,
      inTrash: false,
      tiles: [
        t({ type: 'stat', name: 'Logins today', x: 0, y: 0, w: 4, h: 3 }),
        t({ type: 'stat', name: 'Unique devices', x: 4, y: 0, w: 4, h: 3 }),
        t({ type: 'stat', name: 'New locations', x: 8, y: 0, w: 4, h: 3 }),
        t({ type: 'stackedArea', name: 'Logins by method', x: 0, y: 3, w: 12, h: 5, sources: ['glazy', 'os'] }),
      ],
    },
    {
      id: 'signin-records',
      name: 'Sign-in Records',
      tags: [],
      category: 'shared',
      role: 'editor',
      createdAt: now - 9 * day,
      createdBy: people.hayden.name,
      schedule: 'Every hour',
      sharing: [{ ...people.hayden, access: 'Owner' }, { ...ME, access: 'Editor' }],
      linkAccess: 'private',
      autoRefresh: false,
      refreshedAt: now - 5 * min,
      pinned: false,
      inTrash: false,
      tiles: [
        t({ type: 'table', name: 'Recent sign-ins', x: 0, y: 0, w: 8, h: 6 }),
        t({ type: 'pie', name: 'By method', x: 8, y: 0, w: 4, h: 4 }),
        t({ type: 'scatter', name: 'Session length vs actions', x: 8, y: 4, w: 4, h: 4 }),
      ],
    },
  ];
}

/** A Report Card Stazy builds from the chat flow (§22). */
export function readmissionReport(): ReportCard {
  return {
    id: `readmission-${Date.now()}`,
    name: 'Readmission risk for cardiology',
    tags: ['red', 'green'],
    category: 'mine',
    role: 'owner',
    createdAt: Date.now(),
    createdBy: ME.name,
    schedule: 'Every day at 8:00 am',
    sharing: [ME],
    linkAccess: 'private',
    autoRefresh: false,
    refreshedAt: Date.now(),
    pinned: false,
    inTrash: false,
    description: 'Readmission risk snapshot for cardiology discharges, rate, trend, risk bands, follow-up compliance, by ward.',
    tiles: [
      t({ type: 'stat', name: '30-day readmissions', x: 0, y: 0, w: 4, h: 3, sources: ['dazy', 'patients'], status: 'collecting', preset: { value: 42, delta: 6.1 } }),
      t({ type: 'stat', name: 'Readmission rate', x: 4, y: 0, w: 4, h: 3, sources: ['dazy'], unit: '%', status: 'collecting', preset: { value: 18.4, delta: 1.6 } }),
      t({ type: 'stat', name: 'Bed occupancy', x: 8, y: 0, w: 4, h: 3, sources: ['patients', 'os'], unit: '%', status: 'collecting', preset: { value: 87, delta: -2.3 } }),
      t({ type: 'area', name: 'High-risk at discharge', x: 0, y: 3, w: 7, h: 6, sources: ['dazy'], status: 'collecting', preset: { value: 18, series: [55, 37, 42, 33, 29] } }),
      t({ type: 'rankedList', name: 'Lab turnaround by panel', x: 7, y: 3, w: 5, h: 6, sources: ['patients', 'dazy'], status: 'collecting' }),
    ],
  };
}

export const PEOPLE_DIRECTORY: Person[] = [
  { id: 'teresa', name: 'Teresa Molnar', avatar: avatarB, access: 'Viewer' },
  { id: 'alex', name: 'Alex Chen', avatar: avatarC, access: 'Viewer' },
  { id: 'victoria', name: 'Victoria Wang', avatar: srcAvatar1, access: 'Viewer' },
  people.hayden,
  people.pasindu,
  people.yomal,
];

export const TEMPLATES = [
  { id: 'tpl-security', name: 'Security overview', group: 'Work', description: 'Logins, off-hours activity and anomalies.' },
  { id: 'tpl-signins', name: 'User sign-ins', group: 'Work', description: 'Sign-ins by method with a funnel.' },
  { id: 'tpl-finance', name: 'Financial year', group: 'Work', description: 'Budget against spend by quarter.' },
  { id: 'tpl-ward', name: 'Ward occupancy', group: 'Clinical', description: 'Beds, admissions and discharges by ward.' },
  { id: 'tpl-lab', name: 'Lab turnaround', group: 'Clinical', description: 'Turnaround time by panel and priority.' },
];
