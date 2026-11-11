import type { AppId } from '../apps';
import patientsIcon from '../assets/launcher/patients.png';
import chatIcon from '../assets/launcher/chat.png';
import calendarIcon from '../assets/launcher/calendar.png';
import placeholderIcon from '../assets/launcher/placeholder.png';

export interface LauncherApp {
  id: string;
  name: string;
  icon: string;
  /** Canvas window the camera flies to on launch (if the app lives on the canvas). */
  target?: AppId;
}

/**
 * Installed apps, from Figma "App launcher" (Maisey OS – Core, 139:3745).
 * The first three share their icons with the dock, so they open the same canvas windows.
 * Placeholders fill the grid so paging (28 per page) can be seen.
 */
export const LAUNCHER_APPS: LauncherApp[] = [
  { id: 'patients', name: 'Patients', icon: patientsIcon, target: 'action-hub' },
  { id: 'chat', name: 'Chat', icon: chatIcon, target: 'internal-chat' },
  { id: 'calendar', name: 'Calendar', icon: calendarIcon, target: 'reports' },
  ...Array.from({ length: 29 }, (_, i) => ({
    id: `placeholder-${i + 1}`,
    name: 'App name',
    icon: placeholderIcon,
  })),
];

/** Search priority: exact name, then prefix, then partial match. */
export function searchApps(apps: LauncherApp[], query: string): LauncherApp[] {
  const q = query.trim().toLowerCase();
  if (!q) return apps;
  const rank = (name: string) => {
    const n = name.toLowerCase();
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.includes(q)) return 2;
    return -1;
  };
  return apps
    .map((app, index) => ({ app, index, r: rank(app.name) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.index - b.index)
    .map((x) => x.app);
}
