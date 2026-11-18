# 0010 — The game screen is a fixed 1920×1080 stage, scaled to fit

**Status**: Accepted
**Date**: 2026-11-17

## Context

The `/world` screen mixed fixed pixels with stretchy `1fr` areas: the sidebar column was `640px` (`520px` compact), the text log row `160px` (`100px` compact), the enemy sprite, nameplate and HP bar fixed in px, while the scene took whatever was left. The procedural zone path is an SVG with a `viewBox`, so it scaled with its box. The result: on a bigger monitor the mob looked smaller next to the path, on a smaller one bigger, and below `(max-height: 800px), (max-width: 1500px)` a second, compact layout (`useCompactViewport`) shrank the sidebar, the paper doll (×0.65), the status card and the stash slots. Two layouts to keep in sync, and neither kept its proportions.

The owner plays on a 1920×1080 monitor; that look is the reference.

## Decision

Everything inside the game is laid out once, at exactly **1920×1080 CSS pixels**, and the whole stage is scaled uniformly:

- `GameStage` (`src/components/GameStage.tsx`) is a black `fixed inset-0` frame holding the stage. The stage is moved and scaled with `transform: translate(x, y) scale(s)`, `s = min(viewportW / 1920, viewportH / 1080)` — down and up — and centred; the leftover is black bars (ultrawide → sides, 16:10 → top and bottom). The math is the pure `fitStage` in `src/components/game-stage/fit.ts`.
- The compact layout is gone: `useCompactViewport`, the `*-compact` grid tokens, `statusCardLayout`, the scaled paper doll, the compact stash slot size, and the small `XpBar` / `ConsumableSlot` sizes only it used. `vh` heights inside the stage became px at 1080 (`max-h-[60vh]` → `max-h-162`), and the one breakpoint variant (`md:grid-cols-2` in the stats sheet) became its ≥1920 value.
- Portals from inside the game render into a container inside the stage (`GameStageContext`, `useGameStage()`, `portalTarget`), so tooltips and menus scale with it. Code that turns screen coordinates (`getBoundingClientRect`, `clientX/Y`) into a `left` / `top` inside the stage maps them with `toStage()` and clamps against the stage's 1920×1080, not `window.inner*`.
- The dnd-kit drag overlay is the exception: dnd-kit measures, hit-tests, moves and animates in screen space, so `StageDragOverlay` portals the overlay to the body and scales only its content.
- In-game confirms come from a `ConfirmationProvider` nested inside the stage. Toasts stay a viewport-level system layer (top right, unscaled).
- Scope: `/world` only, the loading screen included. Splash, sign-in, character select and admin stay responsive: they are menus and forms, with no scene whose proportions matter, and they read better at native size on a phone or a small window.

## Consequences

- The game looks the same on every resolution; at scale 1 (a 1920×1080 viewport) it is pixel-identical to the old wide layout.
- Text scales with the stage. At 1366×768 (`s ≈ 0.71`) the 10–12 px labels land around 7–8.5 px on screen; font sizes may need a pass if that proves too small. A browser window on a 1920×1080 monitor is usually shorter than 1080 (tabs, toolbar), so it runs at `s ≈ 0.9` unless fullscreen.
- Non-integer scales resample text and pixel art; the browser's smoothing applies.
- New in-game UI must follow the stage hazards in [codebase-map.md → Invariants and hazards](../codebase-map.md#invariants-and-hazards): `fixed` is relative to the stage, portals go to the stage container, screen coordinates are converted, and there are no `vh` / `vw` / breakpoint variants inside the stage.
- The stage is hidden until the client measures the viewport (`useSyncExternalStore` with an empty server snapshot), so a server render never paints it unscaled.
