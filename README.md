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
| `public/canvas/*.webp` | 2x exports of each app window from Figma |

## Figma sources

- Viewport: `Maisey-Patient-Records` node `2487:15910`
- Canvas (apps): node `2477:8271`

App windows are image exports for now; they will be converted to live UI one at a time.
