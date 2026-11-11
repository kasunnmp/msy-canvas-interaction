# msy-canvas-interaction

A spatial "canvas OS" prototype for Maisey. The screen is a **viewport** onto one large
**canvas** that holds every app window. Clicking an app in the dock doesn't bring the app
to you — the **camera travels to the app** on the canvas.

Motion follows the [`mecury-interactions`](.claude/skills/mecury-interactions/SKILL.md)
skill: `ease-settle` timing, a slight zoom-out "breath" mid-flight, directional motion blur
that resolves on arrival, and unfocused windows dimming to 30%.

## Run

```bash
npm install
npm run dev
```

## Controls

| Input | Action |
|---|---|
| Dock icons | Fly the camera into that app |
| Dock search icon / `Ctrl`/`⌘` + `K` / `Ctrl` + `Space` | Quick Search (↑↓ results, ←→ filter pills, `Enter` open, `Esc` / click outside to close) |
| Dock 4-icon grid / `Ctrl`/`⌘` + `O` | Open the App Launcher (search, paged grid, `Esc` / back to close) |
| Layers icon (top-left) / `O` / trackpad pinch-in | Zoom out to the whole canvas |
| Click a window in overview | Fly into it |
| `1`–`5` | Jump to apps in canvas order |
| `Esc` / pinch-out from overview | Back to the desktop |

## Structure

| Path | What |
|---|---|
| `src/apps.ts` | Canvas size, window positions, home spot, **dock → app mapping** |
| `src/camera/camera.ts` | `CameraController` (fit-to-rect, flights, motion blur) |
| `src/camera/easing.ts` | Cubic-bezier easing (`ease-settle`) |
| `src/components/CanvasWorld.tsx` | The canvas: wallpaper + app windows |
| `src/components/Dock.tsx`, `StatusBar.tsx`, `DeviceMask.tsx` | Chrome, built from Figma |
| `src/search/` | Quick Search (ClickUp doc "Quick Search", Figma Maisey OS – Core `2364:13466`); sample index in `searchIndex.ts` |
| `src/reporting/` | **Reporting app** (live window on the canvas) — ClickUp "Reporting App Design Spec", Figma `Maisey Reporting 888:83020`. Preview, Builder, Stazy chat, Carbon Charts tiles |
| `src/launcher/` | App Launcher (ClickUp spec "App Launcher", Figma Maisey OS – Core `139:3745`) |
| `public/canvas/*.webp` | 2x exports of each app window from Figma |

## Figma sources

- Viewport: `Maisey-Patient-Records` node `2487:15910`
- Canvas (apps): node `2477:8271`

App windows are image exports for now, except **Reports**, which is a live app. Click into it to use it:

- **Preview** — report list (My Reports / Shared with me, pinning), title menu (Info, Rename, Pin, Share, Auto refresh, Export, Duplicate, Move to Trash), *Refreshed* label = Run now, Today/Week/Month + Last week/Last month/This year/Range, Save view, avatar stack → Share modal, header Export (PDF/HTML/Markdown/CSV/Print), per-Tile ⋮ export (PDF/PNG/CSV) with progress toasts, per-Tile footer refresh, failed / no-data / unbound states, owner-only Stazy summary.
- **Builder** (Edit) — 12-column × 64px grid, Insert library (28 Tile types), drag & drop with snap and push-down, 8-handle resize within each type's min/max, per-Tile Rename / Duplicate / Delete, Text tool, Tidy up, undo (⌘Z), Save / Discard.
- **Stazy chat** (sidebar Stazy pill, or + → New Report) — clarifying-question card, Tiles fill in while collecting, Done card → View Report; layout edits via chat (add / remove / rename / move / resize / tidy) and commit-gated data edits (connect a source, schedule).
