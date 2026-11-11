/**
 * The world ("canvas") and the app windows that live on it.
 * Coordinates are in Figma canvas units (node 2477:8271, 2548 × 2336).
 * Window images are 2x exports of each window from that frame.
 */

export const WORLD = { width: 2548, height: 2336 };

export type AppId =
  | 'internal-chat'
  | 'reports'
  | 'action-hub'
  | 'foxtale-studio'
  | 'maisey-minions';

export interface AppWindow {
  id: AppId;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  image: string;
}

export const APPS: AppWindow[] = [
  { id: 'internal-chat', name: 'Internal Chat', x: 26, y: 25, width: 1211, height: 720, image: `${import.meta.env.BASE_URL}canvas/internal-chat.webp` },
  { id: 'reports', name: 'Reports', x: 1315, y: 29, width: 1208, height: 720, image: `${import.meta.env.BASE_URL}canvas/reports.webp` },
  { id: 'action-hub', name: 'Action Hub', x: 25, y: 822, width: 1211, height: 720, image: `${import.meta.env.BASE_URL}canvas/action-hub.webp` },
  { id: 'foxtale-studio', name: 'Foxtale Studio', x: 1315, y: 822, width: 1208, height: 720, image: `${import.meta.env.BASE_URL}canvas/foxtale-studio.webp` },
  { id: 'maisey-minions', name: 'Maisey Minions', x: 28, y: 1591, width: 1211, height: 720, image: `${import.meta.env.BASE_URL}canvas/maisey-minions.webp` },
];

/**
 * "Desktop" resting spot: open wallpaper just past the bottom-right of the canvas, framed at
 * 1:1 so the start screen matches Figma "Viewport design" (2487:15910) — wallpaper, no windows.
 */
export const HOME_RECT = { x: 2700, y: 1640, width: 1376, height: 719 };

/** Which dock icon opens which app. Change the mapping here. */
export const DOCK_TARGETS = {
  diamond: 'action-hub',
  tile: 'reports',
  messages: 'internal-chat',
  folder: 'foxtale-studio',
  grid: 'maisey-minions',
  people: 'maisey-minions',
} as const satisfies Record<string, AppId>;

export type DockSlot = keyof typeof DOCK_TARGETS;
