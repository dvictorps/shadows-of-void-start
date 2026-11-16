# In-progress work

Decisions made but not yet executed. Read this before starting a session — if your task overlaps with something here, you may be duplicating planned work or causing conflicts.

When a planned item starts, move it to a feature branch and reference back here. When it ships, delete the entry (closed work belongs in commit history, not this file).

**Doc language convention**: narrative + meta-docs in English (CLAUDE.md, CONTEXT.md, codebase-map, playbooks, ADRs, and the prose in this file all follow this). PT preserved only for game-domain proper nouns — `Acampamento`, `Incenso Etéreo`, `Calmaria`, item-name examples (`Espada de Ferro`), monster names, etc. Code identifiers stay English. Mixing the two in narrative produces the kind of code-switching that confuses future agents and downstream tooling (translation platforms, search) — don't.

---

## Next session — pick up here

### REFACTOR GATE (owner, 2026-11-16): close 100% of this queue before any new mechanic or tuning request

No new mechanic, balance change or adjustment request starts until every item below is done. Polish (native PT review, `TemplateBaseId` codegen, rare-name bestiary, admin-dashboard latency) is **out** of the 100%: the owner plays, feels and requests it after the gate. The gate is measured by lint: `complexity` ≤ 20 is an error, and the two shrink-only debt lists in `oxlint.config.ts` (`COMPLEXITY_DEBT`, `SERVER_CALLS_IN_COMPONENTS_DEBT`) must end empty. Each PR below removes its files from them. Rules: CLAUDE.md → Scaling rules; recipe: `docs/playbooks/adding-a-world-component.md`. Test-then-split for any untested component; splits stay lean ("só o que faz sentido pro fluxo").

1. **Done (`chore/anti-monolith-rules`)** — `complexity` → error with `COMPLEXITY_DEBT` (9 files); new rule `shadows/no-server-calls-in-components` with `SERVER_CALLS_IN_COMPONENTS_DEBT` (2 files); Scaling rules in CLAUDE.md; the world-component playbook. No max-lines rule (owner call: size is a weak signal; complexity is the gate).
2. **Done (`fix/inventory-modal-oddities`)** — the five oddities the InventoryModal tests pinned, each test flipped on purpose: Escape closes the top layer only (`src/hooks/useEscapeLayer.ts`; `Modal`, the item context menu and a drag register layers, a non-dismissible modal holds the key), a failed reorder toasts `error_reorder_failed` in the modal and on the stash path (`reorderOrToast`, now `src/components/world/reorder-or-toast.ts`), a failed swap toasts `error_swap_hands_failed`, `describeBrokenReasons` goes through paraglide (`broken_missing_*`), and `WorldModals` builds the stash's inventory reorder itself (the `onReorderInventory` prop is gone).
3. **Done (`test/stash-modal`, `refactor/stash-modal-split`, `fix/stash-modal-oddities`)** — `StashModal` tested (`StashModal.test.tsx`, 32 cases on the drag harness shared with the inventory test, `src/components/world/dnd-test-harness.ts`), then split: `StashModal.tsx` ~310 lines of composition and the transfer calls (was 595, `complexity` 24), `stash-modal/` (`StashPanel`, pure `drag.ts` / `selection.ts`), `DragSlot` and `DropCell` shared from `src/components/game/`. Then its pinned oddities fixed: a stash drag holds an Escape layer (Escape cancels the drag, the stash stays open); a failed deposit / withdraw goes through `serverErrorMessage` (rule errors translated, a crash or a failure with no message toasts `error_deposit_failed` / `error_withdraw_failed` instead of its raw text or "full"); `onReorderStash` goes through `reorderOrToast` (moved to `src/components/world/reorder-or-toast.ts`, tested) like the inventory reorders.
4. **Done (`test/vendor-modal`, `refactor/vendor-modal-split`, `fix/vendor-modal-oddities`)** — `VendorModal` tested (`VendorModal.test.tsx`, 27 cases), then split: `VendorModal.tsx` ~210 lines of composition, state and calls (was 520), `vendor-modal/` (`BuyTab`, `SellTab`, `RubyBalance`, pure `buy-limits.ts`), the selection rules shared from `src/components/world/item-selection.ts` and the ruby coin from `src/components/game/RubyIcon.tsx`. Then its pinned oddities fixed: a failed buy / sell goes through `serverErrorMessage` (`vendor_buy_failed` / `vendor_sell_failed` as the crash fallback); the ruby tooltip and `RubyCounter`'s `aria-label` are paraglide keys (`ruby_tooltip`, `ruby_balance_label`); the multi-buy label is `vendor_buy_action_qty` with a `{qty}` param. Left for later (not in the gate's fix scope): the vendor's own server errors (`"Not enough rubys"` in `src/server/trpc/routers/vendor.ts`, the `resolvePurchase` refusals) have no case in `translateServerError`, so they still show in English; add them to `SERVER_ERRORS` with paraglide keys.
5. **`ItemTooltip`** (complexity 64) — test (**done, `test/item-tooltip`**: `src/components/game/ItemTooltip.test.tsx`, 19 cases: rarity header and ornaments, hand / off-hand line, attack and spell weapon stats, defenses blue only when changed, implicits, the (Local) tag, requirements, broken band, item level), split (**done, `refactor/item-tooltip-split`**: `ItemTooltip.tsx` ~65 lines of composition, was 426 with `complexity` 64; `item-tooltip/` holds `ItemHeader`, `StatBlock`, `ModLines`, `Requirements` and the pure `stat-rows.ts`, tested; the 19 component tests passed unchanged; it left `COMPLEXITY_DEBT`), then **NEXT:** a small fix PR for what the tests pin: a requirement of level only (no Str / Dex / Int) shows no requirement line at all. 3 PRs: test, split, fixes; the fixes PR is left.
6. **`StatusCard`** (complexity 28) — test + refactor; reuse `combat-scene`'s consumable slot for its parallel copy. 1 PR.
7. **`ShowStatsModal`** (385 lines) — test + lean split only if concerns are mixed. 1 PR.
8. **Server calls out of `CreateCharacterModal` and `LeaderboardModal`** — `server` / data props, tests. 1 PR.
9. **Combat hooks complexity** — `useCombatLoop` (31), `useCombatTick` (37, the tick handler); both already tested. 1 PR.
10. **Engine and lib complexity** — `compute.ts` (`applyModifierValue` 62, `buildSwing` 22, `computeOnce` 23), `planEquip` 27, `computeWeaponStats` 27, `tryTranslate` 29 (lookup tables where it's a big switch); all tested. 1–2 PRs.
11. **Design-system warnings to zero, then promote to error** — `react/forbid-elements` (26) and `shadcn/*` (~95) on admin, root modals and `src/components/ui`. 2–3 PRs.
12. **Injected RNG in `generateItem` / `rollDrop`** — the follow-up in the post-migration section below. 1 PR.

Both monolith refactors are done — world.tsx (PR #45) and useCombatLoop (PR #47, split into `useCombatLoop` + `useCombatTick` + `useEncounterSchedule`). Camp/phase derivation (PR #48), thorns-reflect fix (PR #49), spam-click in-flight tracking (PR #50), the phase-arg dead-weight cleanup (PR #51), the `useInFlight` extraction (PR #52), and the single-active-session lock (`feat/single-active-session`) all shipped. The leaderboard hard-blocker is now cleared.

**Monster crit + native monster barrier shipped together in PR #57** (`feat/monster-barrier-crit`), bundled with elemental-damage monster mods, rares bumped to 4 mods, and per-weapon hit FX. The PoE-style build-pressure loop is now live — both the highest-leverage gameplay debt and the mechanical follow-up are closed.

**Boss system shipped on `feat/boss-system`** — first act-boss (Gralfor, O Persistente) plus the full configurable infrastructure: `src/game/bosses/` registry, `unique` rarity tier, `kind: "boss"` node with gauntlet (N rares → boss), 4-beat boss cinematic (sprite → impact sfx + screenshake → name → hp), per-boss nameplate color, declared stat sheets with negative resistances, gauntlet/boss drop routing, and the supersession of Model B. Adding a second boss is one file under `src/game/bosses/` + one paraglide key per locale + a boss node — see [playbook](../playbooks/adding-a-boss.md) and [ADR 0008](../adr/0008-boss-as-parallel-registry.md).

Pure-refactor backlog is empty. Gameplay-debt backlog is empty. Boss-infrastructure debt is empty. Pre-public-beta hardening backlog is empty. What remains splits into:

- **Agent-ergonomics hardening — track open, not blocking (started in PR #68)**: PR #68 shipped the doc de-drift + the first server-authoritative test extraction (`recordKill` → `src/game/combat/kill.ts`, 14 tests). The follow-up extraction pass (`refactor/extract-mutation-decisions`) continued it: `usePotion` → `src/game/combat/potion.ts` (`resolvePotionUse`), `syncHp` → `src/game/combat/vitals.ts` (`clampVital` / `resolveVitalSync`), and the camp-tier/zone-completion branch of `recordKill` → `kill.ts` (`resolveZoneProgress`), with 21 new tests. This is the highest-leverage _risk-reduction_ track (the testing cliff outside `src/game/` is the project's #1 navigability risk), but nothing forces it next — it competes by appetite with the passive-tree feature. Documented continuation, in priority order:
  1. **Extraction pass — largely done.** `usePotion`, `syncHp`, and the `recordKill` zone/camp branch are now pure + tested (see above). `respawnDead` was assessed and left as-is: its only deterministic logic is `applyDeathXpPenalty` (already a pure, tested `src/game/progression` helper) and the `char.hardcore` mode branch; the rest is irreducible IO (deleting owned items, clearing zone state, patching two docs). Manufacturing a pure wrapper there would add indirection without adding a testable decision. The remaining honest target is the **stat-cache-recompute branch of `recordKill`** (the level-up path that calls `computeCharacterStats`) — but that's already exercised through `computeCharacterStats` tests, so it's low-value. Treat the mutation-extraction backlog as effectively drained; the net win now comes from (2).
  2. **Done (Cloudflare migration phase 2)** — the tRPC procedures have integration tests on `@cloudflare/vitest-plugin` + local D1 (`src/server/trpc/routers/*.integration.test.ts`).
  3. **Done (`test/combat-hooks`, PRs #79 / #80)** — `useCombatLoop`, `useEncounterSchedule` and `useCombatTick` are tested on fake timers with the server calls injected as parameters (no `TRPCProvider`, no module mocks).
  4. **`CombatScene` done (tested on `test/combat-scene`, split on `refactor/combat-scene-split`). `InventoryModal` done (tested on `test/inventory-modal`, split on `refactor/inventory-modal-split`, its pinned oddities fixed on `fix/inventory-modal-oddities`). NEXT: `StashModal` (REFACTOR GATE item 3).** Each component is two PRs, in this order:
     1. **Done (`test/combat-scene`)** — `src/components/world/CombatScene.test.tsx`, 50 cases in jsdom (`@testing-library/react`), state as props, callbacks as `vi.fn()`, no module mocks and no production change. They pin what the scene renders and emits in each state: fixed HUD, exploration/ambush, fight, rare and boss intros, victory, zone complete, camp, consumables, mage element selector. Death is not in there: `CombatScene` has no death state (the route owns it). Two harness facts for the next component test: framer-motion runs for real on fake timers, but the clock must stay faked for the whole file (its frame loop is a singleton that stalls if a pending frame is dropped), and Testing Library's `cleanup` must be called by hand (vitest runs without globals).
     2. **Done (`refactor/combat-scene-split`)** — `CombatScene.tsx` is now ~210 lines of composition (`complexity` 5, was 989 / 64) over `src/components/world/combat-scene/` (top HUD, nameplate, arena, sprite + its motion hook, bottom HUD, popups, the intro-reveal rules in `reveal.ts`; the largest piece is `CombatArena` at 13). The 50 tests passed unchanged; only the element-selector locator moved to the new `aria-label`s. Its 7 `react/forbid-elements` warnings, plus `CampCinematic`'s 2 and `ElementSelector`'s 1, went onto `variant="hud"` with new sizes `hud-lg` / `hud-icon` / `hud-slot` (no new variant: the colors were already `hud`'s). The duplicate `element_*` keys in `messages/*.json` were removed (the later block, the one in effect, stays).
     3. **Done (`test/inventory-modal`)** — `src/components/world/InventoryModal.test.tsx`, 64 cases in jsdom. They pin opening and closing, the bag grid and paper doll, the click menu per item kind, equip / unequip / swap hands / discard by click, reorder / equip / unequip / swap by drag, the drag highlights and cancel, broken items, the full bag, and every error toast. The one production change is the seam: the modal takes `server: InventoryServer` (an interface it declares, like `ExitFlowServer`; `world.tsx` passes the `useInventoryMutations` bundle it already built, through `WorldModals`) instead of calling the hook itself. Fixtures (`makeItem`, `inventoryRow`, `equippedRow`, one builder per item kind) are in `src/components/world/item-test-fixtures.ts` for the stash modal to reuse; the `narrow` DOM helper moved to `src/components/dom-test-utils.ts`, shared with `CombatScene.test.tsx`. Harness facts for the next component test:
        - dnd-kit drags for real in jsdom through `PointerSensor`: `pointerDown` on the card, then two `pointerMove`s on `document` (past the 6 px activation, then onto the target), then `pointerUp`. Layout comes from a `vi.spyOn(HTMLElement.prototype, "getBoundingClientRect")` (the dragged item at the origin, the target 1000 px right, everything else far away), so `closestCenter` lands where the test says.
        - `DragOverlay`'s drop animation calls `Element.animate`, which jsdom lacks: stub it on the prototype with an animation that fires `onfinish` as soon as it is set.
        - dnd-kit's sensor cancels on `KeyboardEvent.code === "Escape"`; the Escape layers (`useEscapeLayer`: `Modal`, the context menu) read `key`. Send both.
        - The draggable wrapper carries `role="button"` (dnd-kit's attributes), and the overlay holds a second card with the same name while dragging: look cards up per cell then.
        - `ConfirmationProvider` and sonner's `<Toaster />` run for real; `toast.dismiss()` in `afterEach`. A rule error is a `TRPCClientError.from({ error: { message, code, data: { code } } })`.
        - Declare the `server` interface with `Promise<object>` returns (as `ExitFlowServer` does; `anti-slop` rejects `Promise<unknown>`), not as `ReturnType` of the hook: tRPC types a void procedure's output as `never`, which no fake can resolve.
     4. **Done (`refactor/inventory-modal-split`)** — `InventoryModal.tsx` is now ~330 lines of composition and server calls (was 750, with 4 warnings: 2 `complexity`, 2 `forbid-elements`; now none) over `src/components/world/inventory-modal/`: `PaperDoll` (slots, broken badges, Swap hands), `BagGrid` (free count, 60-slot grid), `DragSlot`, and `drag.ts` with the pure decisions, `resolveDrop` (source × target → reorder / equip / unequip / swap / nothing) and `slotHighlight` (strong / soft / invalid), tested in `drag.test.ts`. The 64 component tests passed unchanged. The Close and Swap hands buttons are `variant="hud"` (`hud-lg` / `hud`, `caps`). Kept deliberately in the modal (owner call: split only what serves the flow, `complexity` ≤ 20 is fine): the four `trigger*` server calls and the click-menu builder. `DragSlot` and the bag cell are now shared with the stash (`src/components/game/DragSlot.tsx`, `src/components/game/DropCell.tsx`, on `refactor/stash-modal-split`).
        Never split the untested component first.
- **Deferred, scoped**: camp cinematic biome ambience.
- **Low-priority polish**: native PT review of `lexicon/pt.ts`, `TemplateBaseId` codegen, rare-name bestiary, admin-dashboard cold-cache latency.
- **oxlint: zero errors since `chore/oxlint-debt` (2026-11-15).** The first run reported 380 errors in `src/`. All were fixed, not silenced. The policy for inline disables: allowed only under a real external constraint, and the comment must say why the documented pattern doesn't apply. The migration's phase 3 removed the 3 `react/hooks` disables on the old `use*` function names, the `useViewMode` auto-enter effect, the `vi.mock` in `useCombatTick.test.ts` and the error-decoder disable. **Disables still in the tree, to revisit:**
  - _`useCombatTick` HP flush on deactivation_: a sync with an external system on `active` flipping from several route paths; kept, with a reason that no longer mentions the old transport.
  - _Kept for good:_ the 2 framer-motion imperative-controls effects (`CombatScene` victory fade, now in `src/components/world/combat-scene/useEnemySpriteMotion.ts`; `HealthGlobe` hit shake), the `/world` session claim on route arrival (moved verbatim into `src/hooks/useSessionClaim.ts` on `refactor/world-split`), and the `Object.keys` SAFETY cast centralized in `src/game/typed-object.ts`.
    Warnings left (163 as of phase 3, 136 after `refactor/combat-scene-split`, 132 after `refactor/inventory-modal-split`, 4 fewer after `fix/inventory-modal-oddities`, which cleared `Modal` with the tokens `tracking-title` / `shadow-dialog` and `<Button variant="starkText" size="glyph">` for its header ×; 128 after `refactor/stash-modal-split`, which cleared `StashModal`; 125 after `refactor/vendor-modal-split`, which cleared `VendorModal`; 124 after `refactor/item-tooltip-split`): `complexity` and the `shadcn/*` / `react/forbid-elements` design-system rules on app-shell UI (admin, generic modals, `src/components/ui` itself); sign-in and character-select are clean since phase 3 (new theme tokens `tracking-label` / `text-2xs` / `leading-display` / `void`, and the `caps` / `tall` / `inline` options on `<Button>`). The game-art directories turn the `shadcn/*` rules off. Fix them in any file you touch.
- **PRIORITY now that the Cloudflare backend is in production (ADR 0009): the post-migration lint/test pass (decided 2026-11-15).** The project is fully AI-driven, and a deterministic lint error is the guard-rail an agent can't skip; a convention that only lives in a doc can be. The architecture rules (`tools/oxlint/shadows/`) and type-aware lint shipped on `feat/lint-architecture` (see CLAUDE.md → Lint discipline); the combat hooks got their tests on `test/combat-hooks`, and their activation resets moved to the zone-entry event (`useCombatLoop.startVisit`) on `refactor/zone-entry-reset`. Left:
  1. **Clear the remaining oxlint warnings (227 as of 2026-11-15, 163 after phase 3, still 163 after `feat/lint-architecture`, 147 after `refactor/world-split`, 136 after `refactor/combat-scene-split`, 132 after `refactor/inventory-modal-split`)**, then promote the rules to `error` so the pre-push gate covers them:
     - `react/forbid-elements` (26; 18 in `src/components/world`): game-art buttons. Owner decision (2026-11-16): add game variants to `<Button>`. `variant="hud"` (square, white/40 border; disabled keeps pointer events so the TextLog still gets the hover) shipped on `refactor/world-split` with `size="hud"`; `refactor/combat-scene-split` added the sizes `hud-lg` (text actions), `hud-icon` (icon-only) and `hud-slot` (consumable art + count) and cleared `CombatScene`, `CampCinematic` and `ElementSelector`; `refactor/inventory-modal-split` cleared `InventoryModal`. Convert the rest onto these; add a variant only when the look really differs.
     - `shadcn/*` on app-shell UI: `src/routes/admin/**`, root `src/components/*` modals, and `src/components/ui` itself (sign-in and character-select done in phase 3).
     - `complexity` (11; an **error** since `chore/anti-monolith-rules`, with the offenders held at `warn` in `COMPLEXITY_DEBT`; top: `src/game/stats/compute.ts` ×3, `src/game/items/generator.ts`; `WorldLayout` left the list on `refactor/world-split`, `CombatScene` on `refactor/combat-scene-split`, `InventoryModal` on `refactor/inventory-modal-split`). Pure refactors, and the `src/game` ones are covered by tests.
  2. **Follow-ups the lint pass surfaced (not blocking):**
     - _Injected RNG in `src/game`._ Today every roll goes through `#/lib/rng` (enforced by `shadows/game-determinism`), but that module still reads `Math.random` itself. Some engine functions already take a `random: () => number` (`rollPlayerSwing`, `rollEnemyAttack`, `rollMonsterRarity`, `rollMonsterMods`, `resolveKill`); `generateItem` and `rollDrop` don't. Threading an `Rng` through them changes their signatures on the server and client sides, so it gets its own PR with tests. It also unlocks seeded, reproducible loot tests.
     - _D1 JSON columns are typed, not validated._ `items.data`, `zone_bag`, `boss_kill_counts` and the leaderboard entries decode through Drizzle's `text({ mode: "json" }).$type<>()`, which casts (ADR 0009 chose this to retire the hand-synced validator). `shadows/no-unvalidated-json-parse` guards hand-written `JSON.parse`, not these. Revisit if a stored shape changes without a migration.
- **Next big feature**: passive tree (per CONTEXT.md → Classes ordering: MVP combat ✅ → passive tree → active skills). Design work needed first — no stub plan yet.

**Owner focus (2026-11-16): refactor before gameplay.** Code quality and navigability come first; gameplay feel gets feedback and tuning only after the refactor track is done and the owner has played a while. When a doc/code divergence needs a call in the meantime, take the pragmatic one (usually: the doc follows the shipped behavior) and note it for the gameplay-feel pass.

Order: the REFACTOR GATE queue at the top of this section, item by item. Feature work (passive tree), cleanup (lexicon/codegen) and content polish (camp cinematic art + audio) wait until it is empty.

### world.tsx size — closed decision

PR #52 landed world.tsx at 740 lines (down from 774, the original monolith was 900). Further extraction (e.g. `useExitFlow`, `useTravelHandlers`) was considered and rejected — the file no longer mixes concerns (composition / handlers / derivations / JSX are contiguous sections), so further splitting would hide flow that today reads linearly. The trigger for revisiting is concerns getting _re-mixed_ (business logic inside JSX, mutation hooks called outside the composition block, fetch in a handler) — NOT raw line growth. The styleguide rule in `.gemini/styleguide.md` was updated to reflect this distinction. Orchestrator routes at this app's scale have a natural floor around 700-750 lines.

**Update (2026-05-28)**: world.tsx is now ~937 lines after the `useBarrier` hook extraction landed alongside the post-PR #64 QoL/balance bundle. The hook owns the BarrierState continuously across all views (map / combat / city / travel) — the prior dual-ref scaffolding (out-of-combat barrier ref + ticker + sync mutation) is gone. world.tsx is still above the 740 line floor PR #52 closed on, but the residual gap is in flat composition / handlers / JSX (no concerns re-mixed). The closed decision still holds: the trigger for revisiting is _concerns re-mixing inside JSX/handlers_, not raw line growth.

**Update (2026-05-29, agent-ergonomics pass)**: honesty check on the above — an audit found one `handleLeaveWorld` handler that had drifted _into_ the derivations block, so the "contiguous sections" claim was no longer literally true. It was moved back up with the other `handle*` functions, restoring the composition → handlers → derivations → JSX ordering the closed decision relies on. Lesson: "contiguous sections" is the actual invariant this decision protects, so a handler landing in the wrong section IS the re-mixing trigger — even when no business logic moved into JSX. Watch for it on every world.tsx edit, not just big ones.

**Update (2026-11-16, `refactor/world-split`): reopened and executed.** The reopening rests on this decision's own trigger, not on size. At ~970 lines the file had re-mixed again: the incense gate (a nine-term game rule) and the potion gate sat inline in JSX props; `useState` / `useInFlight` / an adjust-during-render state and a `useEffect` sat inside the handlers and derivations blocks; and `handlePlayerDeath` sat in the middle of composition. Two things the 2026-05 decisions didn't have also changed the cost side: the lint now measures the problem (`complexity` 78 on `WorldLayout`, against a cap of 20), and the combat state machine has tests with the server injected (PRs #79 / #80), so the route can be split without moving untested logic.

What shipped: the decisions went to `src/game` with tests (`resolveTextLog`, `resolveNodeClick`, `zoneContextFor`, `canLightIncense`, `planZoneExit`); the stateful flows went to hooks with their calls injected, also tested (`useExitFlow`: the exit flow the 2026-05 decision rejected as "hiding flow"; with 16 cases it now reads as a spec. `useSessionClaim`, `useIncenseGuard`); the view blocks went to `CombatPane` / `WorldMapPane` / `WorldSidebar`. Behavior is unchanged, including the Retreat-Cancel divergence (pinned by a test, still pending the owner). Result: ~660 lines, `WorldLayout` complexity **18**, the four sections contiguous again. The rule from here: the measured gate is the `complexity` warning on `WorldLayout`. A new decision goes into `src/game` or one of these hooks, not inline; a warning on `WorldLayout` is the re-mixing trigger.

---

## Project health snapshot (as of 2026-11-16)

**Current grade: A** (composite across architecture / code quality / docs / scalability / agent ergonomics). Same letter as the 2026-05-25 snapshot, on a much stronger floor: the Cloudflare migration (ADR 0009, PRs #73–#77) made the backend server-authoritative and integration-tested, and PR #78 turned the architecture into lint errors. What holds it below A+ is the React layer: most world components are untested (`CombatScene` got its tests on `test/combat-scene`), and one orchestrator (`InventoryModal`) is large; `CombatScene` was split behind its tests on `refactor/combat-scene-split`. The combat hooks got their tests on `test/combat-hooks`, and `world.tsx` was split behind them on `refactor/world-split`.

This is a self-assessment from senior-review passes. It exists to give downstream agents a quick read on what's solid and what's debt — pick work that moves the needle, skip work that doesn't.

### Why A (criteria that earned the current grade)

- **Architecture: A** (was A-) — one Worker, D1 + Drizzle, tRPC over the react-query cache (ADR 0009). Every procedure has the same shape: auth → load → decide in `src/game/` → one write or `batch()`, with SQL guards on the replayable paths (bag pick-ups, sales, spends). Render-at-display naming + literal-union enforcement ([ADR 0003](../adr/0003-render-at-display-names.md)) still carries the multi-locale side. Remaining holes: no interactive transactions on D1 (threat #6, accepted), and lexicon / `mod-i18n.ts` drift (same modifier id in two tables).
- **Code quality: A** — `src/game/` is pure, deterministic and tested, and it is now _enforced_: `shadows/game-imports` and `shadows/game-determinism` reject React/server imports and ambient clock/random reads (every roll goes through `#/lib/rng`). `pnpm lint:errors` is at zero across oxlint's correctness / suspicious / perf / pedantic categories, anti-slop, you-might-not-need-an-effect and type-aware rules (no-floating-promises, no-misused-promises, no-unsafe-\*, no-deprecated); the 380 initial errors were fixed, not silenced, and the few inline disables left are listed with their reasons above. 136 warnings remain (design-system rules on app-shell UI + `complexity`).
- **Backend robustness: A-** (new line) — server-authoritative for HP caps, XP, drops, travel, prices, equip requirements and bag integrity (threat-model "Do not regress" table). `shadows/require-session-procedure` makes the single-active-session check structural on every mutation. Open: client-reported HP/kills (threats #1, #2) and concurrent read-modify-write (#6) — local impact until a leaderboard or trade exists.
- **Docs: A** — `CONTEXT.md` single source of truth for game rules; nine ADRs; playbooks with type-checked sentinels; `CLAUDE.md` now lists the lint rules and why each exists, so the docs and the lint config tell the same story.
- **Scalability: A** — new locale = 1 lexicon file per domain + paraglide JSON; new template = 1 entry; new procedure = the `adding-a-procedure` recipe, with lint catching the session/purity mistakes.
- **Translation quality: B-** — 130 PT lexicon entries were AI-bulk-translated; four hand-revised entries caught real awkwardness, so expect 5–10 more. Fine for indie pre-release, not for a paid Brazilian release.
- **Agent ergonomics for ONBOARDING: A+** — `CONTEXT.md` + `CLAUDE.md` + `codebase-map.md` get an agent productive in ~30 minutes.
- **Agent ergonomics for MODIFYING existing things: A** (was A-) — the conventions that used to live only in docs (pure engine, session middleware, server-only modules, validated JSON, handled promises, SAFETY-commented casts) are now deterministic lint errors, and pre-commit / pre-push run them. Caveat: `InventoryModal.tsx` (~730 lines) reads linearly but is a navigation tax. `world.tsx` is off this list since `refactor/world-split` (~660 lines, complexity 18), and `CombatScene.tsx` since `refactor/combat-scene-split` (~210 lines of composition, complexity 5, over `src/components/world/combat-scene/`).
- **TESTING as a refactor/bugfix safety net: A in `src/game/` + procedures, B in the hooks, C+ in the components** — 903 vitest cases across 48 files. The pure domain is blanketed, and every tRPC router has integration tests on a real local D1 (`src/server/trpc/routers/*.integration.test.ts`, through `@cloudflare/vitest-plugin`). The combat state machine is covered end to end (`useCombatLoop.test.ts`, `useEncounterSchedule.test.ts`, `useCombatTick.test.ts`: spawn → fight → victory, intros, camps, incense, gauntlet, re-entry), on fake timers with the server injected, and the `/world` flows around it are too (`useExitFlow`, `useSessionClaim`, `useIncenseGuard`, plus the route's decisions in `src/game/world`). `CombatScene` is pinned by component tests since `test/combat-scene` (`CombatScene.test.tsx`: every state it renders and every callback it emits), and `InventoryModal` since `test/inventory-modal` (`InventoryModal.test.tsx`: every server call by click and by real dnd-kit drag, every state it renders, every error toast). The blind spot left is the rest of the world components (the other modals, e.g. `StashModal` / `VendorModal`, and the thin `world.tsx` wiring: no tests). This is the line that keeps the composite at A.
- **Agent ergonomics for ADDING NEW systems (skills, passive tree): B** — stub playbooks list the decisions and ADRs each queued domain needs. The grade returns to A once the first new system ships against its stub without an emergency refactor.

### What raises the grade

| Move                                                                                          | Outcome                                                    |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Native PT review of `lexicon/pt.ts`                                                           | Translation quality B- → A.                                |
| 3+ months of system additions (skills / passive) WITHOUT emergency refactor against the stubs | **A+** — architecture proven at scale, not just at theory. |

### What lowers the grade

| Risk                                                                                      | Drop                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next major refactor ships without updating relevant playbooks (drift recurs)              | A → B+. The type-check sentinels under `docs/playbooks/_examples/` cover the playbook code blocks via `tsc --noEmit` — but a refactor that _also_ changes the surrounding prose without updating it is still possible, and there is no CI workflow that enforces `tsc` on push (no `.github/workflows/` yet — local discipline is the only guard). |
| New domain shipped that ignores its stub playbook (and doesn't write the ADRs it flagged) | Scalability slips A → B+. The first system to do this sets a precedent that's hard to walk back.                                                                                                                                                                                                                                                   |
| `world.tsx` grows further (or another orchestrator route hits the same shape)             | Modifying existing → B+. Agent navigation tax compounds.                                                                                                                                                                                                                                                                                           |
| An `oxlint-disable` or a rule switched off to get a change through, instead of a fix      | Code quality A → B+. The lint rules are the guard-rail that replaced doc-only conventions; each silenced finding re-opens the gap they closed. Disables need a real external constraint, written in the comment (CLAUDE.md → Lint discipline).                                                                                                     |
| Someone "optimizes" render-at-display by pre-rendering names                              | Locale switching silently breaks. Now explicitly forbidden by [ADR 0003](../adr/0003-render-at-display-names.md).                                                                                                                                                                                                                                  |
| `mod.description` (legacy field) becomes load-bearing again in any consumer               | Defeats the render-at-display invariant. Tooltips diverge by locale.                                                                                                                                                                                                                                                                               |

### Reading this from a fresh session

If you're picking up where we left off:

1. Read this snapshot first — know where the project sits and what's at stake.
2. world.tsx split (PR #45), useCombatLoop split (PR #47), camp/phase derivation (PR #48, closed Threat #3), thorns-reflect fix (PR #49), spam-click in-flight tracking (PR #50), phase-arg cleanup (PR #51), `useInFlight` extraction (PR #52), the single-active-session lock (`feat/single-active-session`, closed Threat #5), the Cloudflare migration (PRs #73–#77, ADR 0009) and the architecture lint (PR #78) are all **done**. The leaderboard hard-blocker is cleared — competitive features are unblocked architecturally.
3. When a major refactor lands, **update the relevant playbook + sentinel + codebase-map + CONTEXT.md + this file in the same PR** (this is the single most important habit for keeping the grade trajectory positive — see the "Doc-update discipline" section in `CLAUDE.md`).

---

## Beta readiness — D1 quota envelope (snapshot, refine with real telemetry)

Reference material, not planned work. Rewritten for the Cloudflare backend (2026-11-16) from the old Convex cost envelope; measured CPU per procedure is in the [ADR 0009](../adr/0009-cloudflare-d1-trpc-backend.md) update notes. The Workers Free plan has no bill: hitting a quota fails requests until the daily reset (00:00 UTC), for every player. Verify the current limits at the Cloudflare docs; as understood today: **100k Worker requests/day**, **D1: 5M rows read/day, 100k rows written/day**, 10 ms CPU per request (not enforced per request so far, see ADR 0009).

### Per-active-hour rates (estimated)

Combat (`useCombatLoop`):

- `recordKill` — 1 per kill. ~600/hour at a ~6 s kill cycle, ~1200/hour at endgame burst. **~1 row written** (the character UPDATE; drops ride on it as JSON) plus nothing else, and since phase 3 it also carries the HP sync.
- `syncHp` — only when 10 s pass after the last write with HP changed, so steady fighting makes almost none; idle players make zero. Ceiling 360/hour, realistic far below.
- `consumePotion` / `consumeEtherealIncense` — ~10–30/hour, 1 row each.

Out of combat (`useWorldMutations`, `useInventoryMutations`): zone enter / exit / pick / discard ~20–40/hour; travel ~10–20/hour; equip / reorder ~10–50/hour; vendor / stash ~5–20/hour. A kept item costs its `items` insert plus index entries (~2 rows); a move costs 1–2 rows per item.

**Rows written per active hour: ~1.2–1.7k** (≈1.2–1.7 per kill on average, dominated by kills). **Requests per active hour: ~700–1500 mutations + a handful of queries** — the client reads from its cache and mutations write their results into it (no refetch per mutation); queries don't refetch on focus except the character on `/world` (after 30 s), and the leaderboard / admin views poll (5 min / 30 s) only while open.

### Projection against the daily quotas

| Quota                      | Per active hour | Active hours/day it supports (all players combined) |
| -------------------------- | --------------- | --------------------------------------------------- |
| D1 rows written (100k/day) | ~1.2–1.7k       | ~60–80                                              |
| Worker requests (100k/day) | ~0.8–1.6k       | ~60–120 (static assets count too; keep them cached) |
| D1 rows read (5M/day)      | small           | not the constraint                                  |

Solo testing fits with a wide margin. A 10-friend beta at ~3 h/day each (~30 active hours) fits; ~20 regular players doesn't, and the first quota to go is the write quota.

### What inflates this estimate

- **Layer 2 of the threat model** (per-hit server calls instead of per-kill): 5–10× the request and write rates. Defer until ranking ships and the cost is justified.
- **New indexes on hot columns**: every index a kill's UPDATE touches is one more row written per kill (game-schema.ts header).
- **Invalidating instead of writing results into the cache**: each invalidation is a refetch request. The hooks write results; keep it that way.
- **Spam scripts** (threats #1 / #2): one client can burn the shared quota. Layer 1 rate limits are the cap.
- **Optimistic rollback refetches**: `rollbackOnError` restores the snapshot and then refetches the keys it touched, since other writes may have landed meanwhile. Rejections are rare, so this is cheap; revisit only if the request quota gets tight.

### Other Free-plan risks

- **Concurrent read-modify-write** (threat #6): accepted while the game is solo-tested; escalation is a per-character Durable Object.
- **Password hashing CPU**: sign-up costs ~105–130 ms CPU against the Free plan's nominal 10 ms. Nothing has been rejected; if Cloudflare starts to, lower the scrypt cost in `src/server/password.ts`, don't buy a plan.

### Action items before opening a public beta

- Watch the Cloudflare dashboard (Workers requests, D1 rows written) after the first week of real play; compare with the model above.
- Ship Layer 1 rate limits (threat model): anti-cheat **and** quota ceiling against scripted spam.
- If the write quota binds before the player count justifies a paid plan, the levers are fewer rows per kill (already 1) and fewer kept items, not more caching.

---

## Camp cinematic biome ambience (deferred)

**Status**: Planned, not started.
**Triggered by**: time-based zone progression PR. The camp cinematic ships
text-only + a warm radial glow as a stand-in for the full ambient layer.

### Why

The cinematic was designed to feel "comfy" — a real rest stop, not a UI
pause. The text + slow HUD fade-out + warm glow gets ~60% of the felt
experience. The remaining 40% is in (a) biome-themed background art and
(b) ambient audio (campfire crackle + per-biome environment).

### Scope

- **Background art per biome**: hand-authored pixel scene per zone biome
  (forest, swamp, crypt, castle, void) showing the character resting at a
  campfire, in the spirit of the Dark Souls II–style "Hidamari" piece the
  user referenced. Replaces the current radial-gradient glow.
- **Ambient audio**: catalog biome ambient files (`/assets/audio/biomes/forest.mp3`, etc.)
  plus a generic `campfire.mp3` loop on top. Hook into the cinematic
  timeline: campfire+ambient fade-in synced with the first text fade-in;
  ambient fade-out only after the player picks a button (so the moment
  lingers as long as they need).
- **Zone metadata**: each zone declares its biome key; cinematic looks up
  the matching art + audio.
- **Volume**: respect the existing global SFX volume (`useSfxVolume`).
- **Accessibility**: ambient is auxiliary — the cinematic still reads
  fully with audio off.

---

## Item naming lexicon — open follow-ups (low priority)

**Status**: PRs #39 (tooltip labels + slot-aware mods) and #41 (decomposed lexicon + renderer + 20 tests) landed. The three items below are real but were intentionally deferred — none blocks a beta, but each one closes a small hole that will widen as more locales / modifiers land.

### 1. Native PT-BR review of bulk-translated entries

**Risk**: 130-ish lexicon entries (55 bases + 80 modifiers) were AI-bulk-translated. The four manually reviewed (Espada Bastarda, Estrela da Manhã, Maculado pelo Vazio, Gume) caught real awkwardness, so the rest probably has 5–10 similar issues. Fine for indie / pre-release. Not fine before a paid release in Brazil.

**Fix**: Walk through `lexicon/pt.ts` with a native speaker, especially:

- All `gendered` adj forms — check the `m`/`f` inflection
- The 21-tier "owner" ladder (warden / champion / templar / archon / sovereign / etc.) reads as a power progression — does the PT chain feel like ascending power?
- Tier-21 void specials — the new `void_touched` / `void_forged` / `void_woven` / `void_inscribed` family is intentional, but each adjective should feel epic in PT.

**Why deferred**: project is solo dev pre-release. Translation quality is the kind of thing a real audience surfaces, not a code reviewer.

### 2. Codegen for `TemplateBaseId` / `TemplateModifierId`

**Risk**: `src/game/items/lexicon/template-ids.ts` declares the two literal unions by hand. The data files (`data/templates/*.ts`) reference these unions but the union itself is human-maintained — if someone adds a base/modifier to a template file using a string that isn't yet in the union, TypeScript catches it. But adding the union member doesn't force them to add a lexicon entry until they re-run tsc.

**Fix**: small codegen step. Walk `data/templates/*.ts` at build time (or via a `vitest` snapshot), collect every `nameBase` / `nameModifier` value, emit `template-ids.generated.ts`. The hand-written file just re-exports the generated union. Lexicons then can't compile if the unions grow without entries.

**Why deferred**: the hand-maintained file works for now. Codegen is the right call if/when there's a sustained pace of adding new bases.

---

## Future: rare-name bestiary (low priority)

**Status**: Idea parked. Not a priority — touches persistence, not combat feel.

**Why**: rares now get random proper names from the lexicon pools ("Garra de Aço, o Furioso" / "Stonemaw, the Furious"). Each spawn rolls a fresh `RareNameSeed` so the same monster type produces a different name every time. A bestiary would let the player accumulate the rares they've killed across runs — a memorable trophy log instead of forgotten flavor text.

### Scope sketch

- New D1 table `rare_encounters` keyed by characterId (mind the write quota: one more row per rare kill), storing: spawn seed, monster id, level, mods, killed-at timestamp, zone id. (Seed lets the renderer reproduce the same name later — the displayed string isn't stored, so locale-switch reads the right language out of the bestiary too.)
- `recordKill` mutation grows a branch: when `monsterRarity === "rare"`, also insert into `rareEncounters`.
- New world view (`/world` view mode `"bestiary"`, or a modal opened from the status card) lists past rares chronologically or by zone. Each entry renders via `translateEnemyName({ def, mods, rarity: "rare", nameSeed })`.
- Optional: count how many times the same `(monsterId, mod combo)` has been killed — repeat-kill stats add a collector dimension.

### Why deferred

Combat-feel work pays off the moment the player fights; persistence pays off later. The seed + mods are already first-class on the Enemy object, so the data plumbing is cheap when we get to it — no schema migration on monsters or names needed.

### Validation when picked up

- Add the table in `src/server/db/game-schema.ts` (`pnpm db:generate`), then have `combat.recordKill` insert the encounter on rare kills in the same batch.
- Manual: kill a rare, open the bestiary, see the same name. Switch locale — the bestiary entry renders in the new language. Kill a rare with the same monsterId, see a different name.

---

## Future: combat identity pass — spell scaling, class feel, bow balance

**Status**: Needs design discussion. No code yet.

**Why**: Act 1 rebalance (2026-05-27) raised monster HP/damage/accuracy by 50% and added elemental damage to every monster. The harder Act 1 exposed three design gaps:

### 1. Spell damage scaling locked to Mage

Spell damage currently only matters for INT-stacking caster builds (staff/wand + tome). Warrior and Rogue have no access to spell scaling, which makes hybrid builds impossible and limits build diversity. Goal: open spell damage as a secondary scaling avenue for non-mage classes without eroding the mage's identity as the primary caster.

Open questions:

- Should non-mages access spell damage through gear (e.g. a "spell damage" suffix on melee weapons), through a passive tree node, or through active skills that scale off spell power?
- How much spell scaling is "enough to feel hybrid" without making pure-melee builds feel inferior?
- Mage identity lever: mages should still be the best at pure spell DPS. Possible lever: mage-exclusive "more spell damage" passives, or a mage-only mechanic (e.g. spell echo, spell penetration) that non-mages can't access.

### 2. Warrior and Rogue class individuality

Both classes currently play as "stack physical damage, swing weapon." There's no mechanical reason to pick Warrior over Rogue beyond base stats. Each class needs a signature mechanic that changes HOW they deal damage, not just how much.

Ideas to explore:

- **Warrior**: Fortify (damage reduction that stacks per hit landed), Rage (damage ramp-up over sustained combat), or a block/counter mechanic that rewards facetanking.
- **Rogue**: Critical strike synergy (guaranteed crit after evading, or crit multiplier scaling with evasion), Poison/Bleed DoTs that reward hit-and-run, or a combo system where consecutive hits accelerate.

### 3. Bow balance — strongest weapon in the game

Bows currently have two-handed weapon stat budgets while allowing a quiver in the offhand, giving them strictly more total stats than any other weapon setup. DPS is competitive with dual-wield but without the accuracy/survivability tradeoffs.

Proposed direction: make bow DPS competitive but with a **different damage application feel** — fewer, harder-hitting shots rather than a stream of fast hits. Ideas:

- **Accuracy penalty on bows**: lower base accuracy forces bow users to invest in accuracy gear or accept more misses. Thematic — bows are harder to aim than melee.
- **Slower base attack speed**: push bows toward "sniper" feeling (big hits, slow cadence) vs. dual-wield "blender" (many small hits, fast cadence). DPS stays comparable but moment-to-moment combat feels distinct.
- **Remove quiver or nerf quiver stat budget**: if the quiver is the problem, reduce what it gives rather than nerfing the bow itself.
- **Range advantage (future)**: if/when area-based mechanics land, bows could get a "first strike" or "safe distance" bonus that justifies their power — they pay for DPS with positioning, not raw stats.

Key constraint: the user wants DPS to be competitive across weapon types. The differentiation is in **feel** (cadence, hit weight, accuracy profile), not in raw output.

---

## Future: passive tree + active skills (not started)

Per CONTEXT.md → Classes, the order is:

1. MVP combat ✅ (done)
2. Passive tree (not started — needs design)
3. Active skills per class (not started — depends on passive tree)

When a session starts working on this, expect to add a third combat path (alongside attack/spell) for skill casts, and a major refactor to the stat engine to handle skill-gem-style modifier sources.

---

## Stash — shipped, vendor — existing

**Stash shipped** on `feat/shared-stash`. Account-scoped, mode-isolated (softcore/hardcore), 60 slots, accessible from city. Drag-and-drop, shift-click, bulk select/deposit/withdraw. Backend: `src/server/trpc/routers/stash.ts`. Frontend: `StashModal.tsx`. Purchasable tabs are deferred.

**Vendor** already exists (`src/server/trpc/routers/vendor.ts`, `VendorModal.tsx`) — sells potions for Rubys, buys gear.

---

## Future: anti-cheat / server-authoritative event validation

**Status**: Documented, deferred. See [docs/security/threat-model.md](../security/threat-model.md).

The current system is server-authoritative for **values** (HP cap, XP per monster, drops, prices) but trusts the **client for events** (kill happened, current HP). Two real exploits exist today:

1. `recordKill` spam — infinite XP + free loot/potions.
2. `syncHp` god mode — never die.

Both are documented with severity, mechanism, and layered fixes in the threat-model doc.

**Decision**: not implementing now. Impact is local (no leaderboard / trade / shared economy yet). Cost-benefit favors deferring.

**Triggers for starting**:

- Layer 1 (rate limits + zone preconditions, ~1-2h): public beta or any user-facing cheat concern.
- Layer 2 (session-based combat, ~4-6h): leaderboards, trade, or any feature where one player's progress affects another's.
- Layer 3 (server-tick combat, days): competitive mode with real value at stake.

When a session starts on this, read the threat-model doc first — it has the schema changes, acceptance criteria, and tradeoffs per layer.

---

## Eliminate residual admin-dashboard navigation latency (low priority)

**Status**: Planned, not started. User-flagged on PR #46 — current state ("muito melhor mas não como eu quero") accepted as a stopping point; remaining latency tracked here.

**Why**: even after the PR #46 polishing pass (loader-based prefetch in `character-select`, `preload="render"` on the `/admin` Link + sidebar Links), the **first** `/character-select` → `/admin` navigation in a session was perceptibly non-instant on Convex.

**Update (Cloudflare migration phase 3)**: the WebSocket subscribe handshake that was the root cause is gone. Admin queries are one-shot tRPC queries, batched into a single request, and SSR runs them in-process (`localLink`) with the result dehydrated into the page (`setupRouterSsrQueryIntegration`), so a hard reload of an `/admin/*` page arrives with its data. What can still cost is the client-side code-split chunk fetch and one HTTP round trip on the first in-app navigation. **Re-measure before doing anything**; if it's still noticeable, the remaining direction is a persistent query cache (`@tanstack/query-persist-client-core` + IndexedDB) so the first visit per session hits the cache.

### What has already been tried (don't redo)

- Loader prefetch of the admin tabs in `character-select` (now through `prefetchAdminTabs(queryClient, trpc)`), `<Link preload="render">`, `defaultPreloadDelay: 0`, and the `/admin` pending shell.
- SSR of the admin payload (in place since phase 3 via the route loaders' `ensureQueryData`).

### Why deferred

Current latency is acceptable for the admin-only audience (friends-beta) — admins refresh deliberately, not continuously, so a sub-second cold-cache delay isn't a real cost. This entry exists so the residual `/admin` latency doesn't get re-discovered as a new problem the next time someone polls the dashboard.

### Validation when picked up

- Time `/character-select` → `/admin` first-paint with the Performance panel: target <50ms from `click` to first paint of populated cards.
- Same flow on a hard reload directly to `/admin/users`: target a single network roundtrip and no visible pending shell.
- Confirm non-admins still never trigger admin queries (the gating in the loader stays correct).
