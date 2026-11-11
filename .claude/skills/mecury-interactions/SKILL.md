---
name: mecury-interactions
description: Motion and interaction language for card-based, intent-driven canvas UIs, derived from studying the Mercury OS concept (mercuryos.com/architecture). Use when building or animating floating "module" cards, a command/action bar, hold-⌘ shortcut overlays, adding cards side by side ("+" / Tab), text-selection-to-new-card, vertical flow navigation, or pinch/zoom-out overview of a canvas — or whenever the user asks for "Mercury-style", "Mecury interactions", calm/fluid OS-like motion.
---

# Mecury interactions

A motion + interaction spec for calm, spatial, card-based interfaces. Apply these
principles and numbers when designing or implementing UI in this style. Give the
product its own name, type, colours and content — borrow the *behaviour*, not
Mercury's branding or exact visuals.

## 1. Core principles

1. **Fast start, long settle.** ~60% of the distance is covered in the first ~40%
   of the time, then a long soft deceleration. No bounce, no overshoot.
2. **Two tempos.** Overlays/menus are near-instant (80–200 ms). Spatial moves are
   slow and weighty (600–900 ms). Whole-canvas zooms ~1.1–1.2 s.
3. **Directional motion blur.** Moving cards smear *along their direction of
   travel* mid-flight and resolve to sharp as they settle. This is the signature.
4. **Depth = blur + dim.** Whatever is in front stays sharp; everything behind
   blurs and fades. Selecting one item dims the rest to ~30% opacity.
5. **Never cut — move the camera.** Navigation is a pan or zoom of one continuous
   canvas, so users always know where things went.
6. **Shared-element continuity.** Things transform into other things (a selected
   suggestion pill becomes the header of the new card; an email morphs into its
   reply composer) instead of disappearing and reappearing.
7. **Show input.** Touches render as soft translucent grey circles (~28px);
   held keys show as a dark rounded keycap HUD at bottom-centre ("⌘" → "⌘ R").

## 2. Motion tokens

See `references/motion-tokens.css` for drop-in CSS variables.

| Token | Value | Use |
|---|---|---|
| `ease-settle` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | default for everything spatial |
| `ease-snap` | `cubic-bezier(0.3, 0.7, 0.1, 1)` | overlays, highlights |
| spring (if using a physics lib) | stiffness ~170, damping ~26, mass 1 (critically damped, **no overshoot**) | |
| `dur-instant` | 80 ms | ⌘ overlay appear, keycap HUD |
| `dur-quick` | 180 ms | row highlight, chip appear |
| `dur-appear` | 300–450 ms | new card fades/rises in |
| `dur-move` | 650–800 ms | camera pan, flow swap |
| `dur-morph` | 900 ms–1.35 s | in-place content morph (email → reply) |
| `dur-zoom` | 1.1–1.2 s out, ~0.75 s back in | overview pinch |
| `stagger` | 20–40 ms per card | overview fly-in |
| `blur-peak` | 8–14 px along axis | mid-flight motion blur |
| `blur-backdrop` | 6–10 px, opacity 0.5 | layers behind overlays |
| `dim-unfocused` | opacity 0.3 | non-selected cards |

## 3. Interaction patterns

### A. Hold ⌘ → action overlay
- Keydown ⌘: action list drops from the card's header bar in **80 ms**; card body
  behind blurs + dims; keycap HUD fades in bottom-centre.
- Typing while holding filters the list; matching row fills with accent blue in
  **180 ms**; HUD shows the chord ("⌘ R").
- Footer hint: "Release ⌘ to run action · Space to cancel".
- Release: overlay vanishes instantly; the action runs as an **in-place morph**
  (~1.1–1.35 s): old content slides up ~40px with vertical blur and fades, new
  content (e.g. reply composer) rises in beneath, header gains a removable chip
  ("Reply ×"). Caret blinks in the new input.

### B. Command bar (card header doubles as input)
- Natural-language input; autocomplete list opens beneath the header, highlighted
  row = accent fill + trailing arrow button. Background blurs while open.
- Tokens resolve into styled chips inline ("Forward to" in accent, names in bold).

### C. "+" / Tab → new card in the flow
- A small "+" bubble sits beside the active card.
- On activate: a suggestion card fades + rises in to the right (**~450 ms**), list
  items stagger in. Choosing one resolves the card into its result (**~300 ms**
  crossfade with slight scale 0.98→1).
- When the row exceeds the viewport, the camera pans left to keep the newest card
  in view (**700–900 ms**, `ease-settle`, horizontal motion blur on all cards).

### D. Highlight text → new card
- Selection gets a soft lavender highlight + round drag handle.
- A compact suggestion popover appears next to the selection.
- The chosen suggestion **detaches as a pill and flies** to the empty slot
  (**~400 ms**), the source card briefly blurs and slides left (**~900 ms**), the
  pill becomes the new card's header and the body grows in under it (**~650 ms**).

### E. Vertical flow navigation (swipe / ↑↓)
- Current card exits upward with strong vertical blur + fade; next card enters
  from below; **650–850 ms** per step.
- Sidebar selection highlight moves in sync. Large ghost title stays fixed.

### F. Pinch → overview
- Zoom out over **~1.2 s**: focused cards scale down; other cards fly in from the
  edges (blurred, staggered) and settle into a masonry grid; title gains a
  ": Overview" suffix; a rules/settings panel slides in from the left.
- Tapping a group dims the others to 0.3, then zoom back in (**~750 ms**).

## 4. Visual baseline (to pair with the motion)
- Flat light-grey canvas (~`#DDDDDD`), text `#333`; cards off-white `#F7F7F7`,
  radius ~12px, very soft wide shadow (`0 20px 60px rgba(0,0,0,.08)`).
- Card = header strip (icon · bold title · grey source · mic/input icon) + body +
  pill buttons + "⌘ More actions" footer.
- Colour only for meaning: one saturated accent blue for selection/intent chips,
  lavender for text selection. Neutral grotesk sans; tiny UI labels (11–13px).
- Use your own typeface/palette choices; these are proportions, not a copy target.

## 5. Implementation guidance (web)
- Animate only `transform`, `opacity`, `filter` — never layout properties.
- One canvas container with a camera `transform: translate() scale()`; cards are
  absolutely positioned children. Pans/zooms animate the camera, not each card.
- Shared-element morphs: FLIP technique, the View Transitions API
  (`view-transition-name`), or Framer Motion `layoutId`.
- Directional blur: SVG filter `<feGaussianBlur stdDeviation="X 0">` (horizontal)
  or `"0 Y"` (vertical), driven from velocity each frame; fallback: keyframe
  `filter: blur(0) → blur(8px) → blur(0)` at 0/35/100%.
- Backdrop focus: `backdrop-filter: blur(8px)` on overlays plus
  `filter: blur(6px); opacity:.5` on underlying content.
- Respect `prefers-reduced-motion`: drop blur, cut durations to ≤150 ms, replace
  pans with crossfades.
- Keyboard: ⌘ hold (keydown/keyup, cancel on blur/Space), Tab = new card,
  ↑/↓ = switch flow, Esc = close overlay; pinch = `wheel` with `ctrlKey` on
  trackpads, two-pointer distance on touch.

## 6. Checklist before shipping a transition
- [ ] Uses `ease-settle` (or no-overshoot spring) and a duration from §2
- [ ] Moving elements blur along their axis and arrive sharp
- [ ] Background blurs/dims when something comes forward
- [ ] No hard cuts — spatial origin/destination is visible
- [ ] Shared elements morph rather than pop
- [ ] Reduced-motion path exists
