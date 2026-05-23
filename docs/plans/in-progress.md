# In-progress work

Decisions made but not yet executed. Read this before starting a session — if your task overlaps with something here, you may be duplicating planned work or causing conflicts.

When a planned item starts, move it to a feature branch and reference back here. When it ships, delete the entry (closed work belongs in commit history, not this file).

**Doc language convention**: narrative + meta-docs in English (CLAUDE.md, CONTEXT.md, codebase-map, playbooks, ADRs, and the prose in this file all follow this). PT preserved only for game-domain proper nouns — `Acampamento`, `Incenso Etéreo`, `Calmaria`, item-name examples (`Espada de Ferro`), monster names, etc. Code identifiers stay English. Mixing the two in narrative produces the kind of code-switching that confuses future agents and downstream tooling (translation platforms, search) — don't.

---

## Next session — pick up here

**Next high-leverage item: the `src/hooks/useCombatLoop.ts` split** — 916 lines, the single largest file in the repo. The world.tsx split (PR #45) cleared the previous worst MODIFYING-friction surface; this is the new one. Same orchestrator-monolith shape, with a dedicated entry below containing the suggested cut + lessons-learned from the world.tsx split.

After that, three queued follow-ups can land in any order:

- **Server-authoritative camp/phase derivation** — closes Threat #3 in the threat model.
- **Single active session per character** — closes Threat #5 in the threat model (multi-tab races). Same architectural shape as phase derivation (schema add + `sessionToken` arg threaded through every state-mutating mutation + a helper that bundles ownership + session check). **Hard-blocker before any leaderboard / rank ships** — a rank built on multi-tab kills is fraud-by-construction even without intent. Also see the "Convex cost envelope" section below — multi-tab abuse multiplies a single user's function-call cost by tab count.
- **In-flight tracking for spam-click action handlers** — extends the vendor pattern (shipped in PR #45) to potion / teleport stone / exit-zone buttons / map travel / incense.

Before starting the useCombatLoop split, read: the file itself (top comment block already decomposes its concerns along lifecycle / refs / state / public-mutation lines — use that as the seam), and the consumer wiring in `src/routes/world.tsx` (stable post-split).

---

## Project health snapshot (as of 2026-05-23)

**Current grade: A** (composite across architecture / code quality / docs / scalability / agent ergonomics).

This is a self-assessment from senior-review passes after PRs #39 (tooltip i18n + slot-aware mods), #41 (decomposed item-name lexicon + 20 renderer tests), #42 (playbook + codebase-map refresh), the agent-ergonomics-hardening pass (sentinel CI gate against playbook drift, stub playbooks for queued Future domains, ADRs 0002 + 0003), and PR #45 (world.tsx split into `useWorldMutations` + `useViewMode` hooks and a `WorldModals` sibling, plus the shared `createInventorySlotAllocator` lift). The grade exists to give downstream agents a quick read on what's solid and what's debt — pick work that moves the needle, skip work that doesn't.

### Why A (criteria that earned the current grade)

- **Architecture: A-** — render-at-display-time naming + literal-union enforcement is the correct choice for a multi-locale ARPG (codified now in [ADR 0003](../adr/0003-render-at-display-names.md)). Lexicon pattern is battle-tested across two domains (monsters + items). Convex/TanStack split is coherent. Remaining hole: drift risk between lexicon and `mod-i18n.ts` (same modifier id in two independent tables) — flagged in the lexicon follow-ups below.
- **Code quality: A** — `src/game/` is pure + tested. 334 vitest cases. Comments are WHY-focused. One remaining stain: residual `as TemplateBaseId` casts at the Convex boundary (Convex validators can't express literal unions — captured in [ADR 0003](../adr/0003-render-at-display-names.md)). The world.tsx orchestrator dropped from 900 → 645 lines via PR #45.
- **Docs: A** — `CONTEXT.md` is best-in-class for a solo-dev project (879 lines of single-source-of-truth game rules). Three ADRs codify the load-bearing architectural decisions (optimistic mutations, three-system i18n, render-at-display naming). Playbooks accurate and link to type-checked sentinel examples; new system stubs let an agent picking up skills / passives / stash know which questions need answering before coding.
- **Scalability: A** — adding a new locale = 1 new lexicon file per domain + matching paraglide JSON. Adding a new template = 1 entry + 0 lexicon changes if base/modifier already exist. Decomposition cut lexicon size by 88% (562 → 135). Literal-union enforcement makes "forgot a translation" a compile error.
- **Translation quality: B-** — 130 PT lexicon entries were AI-bulk-translated. Four hand-revised (Espada Bastarda, Estrela da Manhã, Maculado pelo Vazio, Gume) caught real awkwardness, so the rest probably has 5–10 similar issues. Fine for indie pre-release, not for a paid Brazilian release.
- **Agent ergonomics for ONBOARDING: A+** — `CONTEXT.md` + `CLAUDE.md` + `codebase-map.md` get an agent productive in ~30 minutes.
- **Agent ergonomics for MODIFYING existing things: A** — strong TS catches mistakes. World.tsx is now 645 lines after PR #45 (down from 900). The remaining MODIFYING-friction surface is `useCombatLoop.ts` at 916 lines — split queued below, pushes this axis toward A+ when it lands.
- **Agent ergonomics for ADDING NEW systems (skills, passive tree, stash): B** — stub playbooks now exist for each queued Future domain, listing the decisions to resolve + the ADRs the agent will need to write. The systems themselves aren't built, but the orientation infrastructure is. The grade returns to A once the first new system ships against its stub without an emergency refactor.

### What raises the grade

| Move | Outcome |
|---|---|
| Split `src/hooks/useCombatLoop.ts` (queued) | Agent ergonomics for MODIFYING A → A+. Removes the largest single-file navigation tax in the repo (916 lines). |
| Native PT review of `lexicon/pt.ts` | Translation quality B- → A. Composite **A → A+** if combined with the useCombatLoop split. |
| 3+ months of system additions (skills / passive / stash) WITHOUT emergency refactor against the stubs | **A+** — architecture proven at scale, not just at theory. Until then A+ is hypothetical. |

### What lowers the grade

| Risk | Drop |
|---|---|
| Next major refactor ships without updating relevant playbooks (drift recurs) | A → B+. The sentinel CI gate covers the playbook code blocks — but a refactor that *also* changes the surrounding prose without updating it is still possible. |
| New domain shipped that ignores its stub playbook (and doesn't write the ADRs it flagged) | Scalability slips A → B+. The first system to do this sets a precedent that's hard to walk back. |
| `world.tsx` grows further (or another orchestrator route hits the same shape) | Modifying existing → B+. Agent navigation tax compounds. |
| Someone "optimizes" render-at-display by pre-rendering names | Locale switching silently breaks. Now explicitly forbidden by [ADR 0003](../adr/0003-render-at-display-names.md). |
| `mod.description` (legacy field) becomes load-bearing again in any consumer | Defeats the render-at-display invariant. Tooltips diverge by locale. |

### Reading this from a fresh session

If you're picking up where we left off:

1. Read this snapshot first — know where the project sits and what's at stake.
2. The world.tsx split (PR #45) and agent-ergonomics hardening are **done**. The next high-leverage debt is the `useCombatLoop.ts` split (queued entry below).
3. When a major refactor lands, **update the relevant playbook + sentinel in the same PR** (this is the single most important habit for keeping the grade trajectory positive).

---

## Beta readiness — Convex cost envelope (snapshot, refine with real telemetry)

Reference material, not planned work. Snapshot taken 2026-05-23 in response to the deployment / scaling question. Update this section when real call-rate observations diverge from the model below.

### Per-active-hour call rate (estimated)

Combat-tick mutations driven by `useCombatLoop` against `convex/combat.ts`:

- `recordKill` — 1 per monster kill. At ~6s/kill cycle (spawn gap + ~3s fight typical) that's ~600/hour. Endgame burst rates (heavy dual-wield + ambush packs) approach ~1200/hour.
- `syncHp` — gated on `hp !== lastSyncedHpRef` + 10s ticker → ceiling 360/hour, but most idle players hit far less because HP only changes during active combat.
- `usePotion` / `useEtherealIncense` — ~10-30/hour.

Out-of-combat mutations driven by `useWorldMutations`:

- `enterZone` / `exitZone` / `pickFromBag` / `discardFromBag` — ~20-40/hour. Zone changes are deliberate, not spammed.
- `startTravel` / `arriveAtTravel` — pair on each node transition. ~10-20/hour.
- `equipItem` / `unequipItem` / `reorderInventory` — ~10-50/hour during active loot sessions.
- `vendorBuy` / `vendorSellMany` — bursty around vendor visits. ~5-20/hour averaged.

**Total mutations per active hour: ~700-1500.**

### Reactive query updates also bill

Convex meters function calls, which includes query re-runs triggered by mutations on watched tables. Every `recordKill` invalidates `api.characters.list` (level/xp/potions/incense) and `api.items.zoneBag` (the new drop). Every `equipItem` invalidates `api.items.inventory` + `api.items.equipped`. Multiplier from reactive reads is roughly **2-3× the mutation count**.

**Estimated chargeable function calls per active hour: ~2000-4000.**

### Projection against tiers

Verify exact numbers at [convex.dev/pricing](https://www.convex.dev/pricing) — Convex adjusts plans periodically. Approximations as understood today:

| Tier | Included calls / month | Active hours / month it supports | Reads as |
|---|---|---|---|
| Free (Starter) | ~1M | ~250-500 | Friends beta (10 friends × ~10h each = 100h) fits with headroom |
| Pro ($25 base) | ~25M | ~6000-12000 | ~100 daily-active players × ~2h/day fits inside the included quota |
| Above Pro | Usage-based overage | — | Depends on per-call overage rate |

### What inflates this estimate

- **Layer 2 of the threat-model fix** (per-hit mutation instead of per-kill): 5-10× the call rate. Defer until ranking ships and the cost is justified.
- **Frequent leaderboard subscriptions**: a "live top 100" view re-runs the leaderboard query for every subscriber whenever any one of the top 100 levels up.
- **Multi-tab abuse** (see Threat #5 in `docs/security/threat-model.md`): a 5-tab user costs 5× their fair share until the active-session lock ships.

### What does NOT matter for Convex cost

Bandwidth. Convex bandwidth allowances are generous and SPA payloads are tiny (character doc + inventory + zone bag is well under 100KB even at endgame). Bandwidth is the **frontend host's** concern (Vercel / Cloudflare Pages), not Convex's.

### Action items before opening a public beta

- Watch the Convex dashboard's function-call counter after the first week of real play. Compare actual rate to the ~2000-4000/hour model above; refine the projection.
- Ship Layer 1 rate limits (threat-model). They serve double duty: anti-cheat **and** cost ceiling against scripted spam.
- Ship the single-active-session lock (queued entry below). It serves double duty: anti-cheat-vs-multi-tab **and** cost protection against the same vector.

---

## Attribute baseline rebalance pass (low priority — wait for player feedback)

**Status**: Live, watching. Shipped in the over-level + attributes patch.

**Why**: Initial conversions chosen by gut:
- Str → +1% Melee Damage / point
- Dex → +2 Accuracy / point
- Int → +2% Barrier per 10 points (= 0.2 / point)

At ~80 of the primary attribute that lands at +80% melee / +160 acc / +16% barrier. Str clearly dominates Int — fine if Mage gameplay still feels good (Int is meant as a defensive nudge, not the offensive bedrock; spells lean on `spell` + per-element increased), but if Mage feels flat at level ~15+ revisit:

- Cheapest knob: bump `INT_BARRIER_PCT_PER_POINT` (in `src/game/stats/compute.ts`) from `0.2` → `0.5`.
- Or: add a second Int conversion (e.g., +1% spell damage / point).

Open until a Mage run reaches Act 1 endgame.

---

## Act-boss node Model B refit for time-bar (deferred)

**Status**: Planned, not started.
**Triggered by**: time-based zone progression PR. The act-boss node still uses the older "Bar 1 fills → miniboss → Bar 2 fills → act boss" Model B (see CONTEXT.md → Act Boss). With regular zones moving to time-based bars, the act-boss node needs design alignment.

### Open questions to resolve before coding

- Does each Model B bar become a separate time-bar with its own schedule? Or stay as a kill counter (the act-boss node remains the only place with kill-counter pacing)?
- Do camps appear in the act-boss node? Probably no — boss node = commitment.
- Does the player get a checkpoint after killing the act-boss-miniboss (between Bar 1 and Bar 2)? With time-based, a brief pause + heal would feel natural — but it dilutes "Bar 2 starts immediately".
- Does Incenso Etéreo work in the act-boss node? Probably no (mirroring the existing "no incenso during boss" rule applied to the whole boss node).

### Why deferred

Time-based zone progression is already large; mixing Model B redesign in would double the scope and complicate testing. Act-boss can ship on the old model until this lands.

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

### 3. Hash function → `src/lib/rng.ts`

**Risk**: `hashItemId` in `item-name.ts` is FNV-1a; `CombatScene.tsx` has a separate `*31`-walk hash. Both are deterministic string→[0, 1) hashes. Two implementations, same purpose, will drift.

**Fix**: extract to `src/lib/rng.ts` as `hashStringToUnit(s, salt?)` (or two-output variant). Both callers consume from there. Was flagged in the first simplify pass and deferred — the second caller (CombatScene) uses a weaker hash that probably should upgrade to match.

**Why deferred**: not load-bearing, both implementations currently work. Worth doing when next touching `CombatScene`'s hash.

### 4. Convex validator can't enforce literal unions

**Constraint, not a bug**. `nameBase` / `nameModifier` are stored as `v.optional(v.string())` because Convex validators don't have ergonomic literal-union support. The in-process `GeneratedItem` type widens to `string` at the persistence boundary — the lexicon files themselves keep the union enforcement. If Convex ever ships a `v.unionLiteral([...])` helper, swap in.

---

## Split `src/hooks/useCombatLoop.ts` (queued)

**Status**: Planned, not started. The world.tsx split (PR #45) is done — this is the next high-leverage refactor.

**Why**: 916-line tick orchestrator — the single largest file in the repo. Same navigation-tax problem the world.tsx split just resolved: an agent touching combat behavior has to read the whole file (the ~12 mid-tick refs, the searching/boss_intro/engaged/victory/miniboss_victory/acampamento state machine, encounter + camp + ambush scheduling, leech, barrier recovery, calmaria time-bar) before they're confident about side effects. Now the worst MODIFYING-friction surface in the codebase.

### Suggested cut

The file's top comment block already decomposes its concerns cleanly along lifecycle / refs / state / public-mutation lines — use that as the seam:

- **`useCombatRefs`** — bundles the ~12 mid-tick refs (`stateRef`, `enemyRef`, `playerProgressRef`, `enemyProgressRef`, `deadRef`, `nextSwingIndexRef`, `barrierRef`, `leechRef`, `playerHpRef`, `lastSyncedHpRef`, `initialHpRef`, `activeRef`, plus the camp/ambush trio) into a single typed bag. Each tick callback consumes the bag instead of importing twelve names individually.
- **`useEncounterSchedule`** — encounter plan rolling for a zone activation: spawn gap from `rollSpawnGapMs`, calmaria budget + miniboss promotion, camp thresholds (`rollCampThresholdsMs` + `nextCampIndexRef`), ambush schedule (`rollAmbushSchedule` + pack counter). Owns the `setCalmariaElapsedMs` / `campThresholdsMs` state and exposes "what should the next spawn be?" / "is a camp due?" queries.
- **`useCombatState`** — the `searching → boss_intro → engaged → victory / miniboss_victory → acampamento` state machine + the `bossIntroStage` sub-state. Owns transitions; doesn't own the tick.
- **`useCombatTick`** — the 50ms engaged tick: leech ticking, barrier recovery, alternate-weapon swings via `nextSwingIndexRef`, enemy swing, victory/death routing. Calls `recordKill` / `syncHp` mutations.

These are starting points based on the file's preamble — refine them once the actual extraction starts.

### Watch out for (lessons from the world.tsx split)

- **Verify each cut against the live file before fragmenting.** The original world.tsx plan included a `<CombatHud>` cut that turned out to be a no-op — that JSX already lived inside `<CombatScene>`. Don't assume the suggested cuts above are still valid as the file evolves; read the actual code first, propose adjustments, then split.
- **Combat-internal mutations stay inside the split.** `useCombatLoop` calls `recordKill`, `syncHp`, `usePotion`, and `useEtherealIncense` — these are tick-driven combat mutations, distinct from the 10 world-route mutations that live in `useWorldMutations.ts`. They belong inside whichever sub-hook owns the tick / victory routing (probably `useCombatTick`), NOT bundled into `useWorldMutations`. Conflating the two surfaces will widen useWorldMutations beyond its current scope.
- **WorldModals re-renders on every combat tick** because `combat.barrier.current` and `combat.playerHp` are passed through as props (for `ShowStatsModal`). The fix is to wrap `WorldModals` in `React.memo` and split combat-tick props from modal-render props (or gate them on `statsModal.isOpen`). The simplify pass on the world.tsx split flagged this but deferred — splitting `useCombatLoop` is the natural moment to fix it because the data flow is being restructured anyway. Don't fix it independently; fold into this split if you touch the consumer interface.
- **MonsterTooltip reconciles every combat tick** (same shape as the WorldModals issue above). `CombatScene.tsx:510-514` mounts `<MonsterTooltip enemy={enemy} />` inside a `hidden group-hover:block` wrapper — the tooltip is always mounted, only CSS-hidden, so any CombatScene re-render reconciles it for every magic/rare enemy on screen even when not hovered. Surfaced by the simplify pass on the rarity-card primitive lift. Fix: wrap `MonsterTooltip` in `React.memo` (props are just `enemy`, and the displayed fields — rarity / level / mods / name — are stable across an enemy's lifetime even if the object ref churns) and/or gate the mount on JS hover state instead of CSS visibility. Defer to this split because the enemy data flow is in motion; fold in if you touch how the CombatScene consumes the enemy.

### Validation

- `npx tsc --noEmit`, `npx vitest run`.
- Manual smoke: full combat loop including miniboss victory cinematic, boss intro three-stage spawn (sprite → name → hp), camp cinematic, and an ambush pack. Confirm `useCombatLoop.ts` line count drops meaningfully (target: under 400 in the main file).

---

## Server-authoritative camp/phase derivation (queued)

**Status**: Planned, not started.
**Why**: PR #40 added server-side enforcement of the 30% bag retention cap by accepting a `phase` arg on `exitZone` / `pickFromBag` / `discardFromBag`. The cap math itself is server-enforced, but the **`phase` arg is still client-trusted**. A tampered client (or someone hitting the Convex endpoint directly via the SDK) can pass `phase: "camp"` while actually in combat and bypass the cap entirely. Auth + ownership are protected; phase is not.

### Why we deferred

This is the next "right" step for the time-based-zone scope, but it requires schema + enterZone + useCombatLoop rewiring. Doing both in the same PR as the world.tsx split (now shipped in PR #45) would have been too much surface for one review.

### Scope

- **Schema** (`convex/schema.ts`): add to `characters`:
  - `zoneStartedAt?: number` (ms) — set by `enterZone`, cleared by `exitZone`/death.
  - `campThresholdsMs?: number[]` — rolled by `enterZone`, consumed on `enterCamp`.
  - `inCamp?: boolean` — set by `enterCamp`, cleared by `exitCamp` / `exitZone`.
- **`enterZone`**: roll the camp thresholds server-side (move `rollCampThresholdsMs` call from client to server) and persist `zoneStartedAt` + `campThresholdsMs`. Return both to the client so the time bar can render markers.
- **New `enterCamp` mutation**: takes `thresholdIndex`. Validates `Date.now() - zoneStartedAt >= campThresholdsMs[thresholdIndex]` (with a small grace window for clock drift). Sets `inCamp = true`. Idempotent on the same index.
- **New `exitCamp` mutation**: clears `inCamp`. Called when the player picks "Seguir em frente" in the camp panel.
- **`exitZone` / `pickFromBag` / `discardFromBag`**: drop the `phase` arg. Derive phase server-side as `inCamp ? "camp" : "combat"` (combat vs exploration distinction is only cosmetic for the cap — both gate at 30%).
- **Client (`useCombatLoop` + `world.tsx`)**:
  - Read `campThresholdsMs` from the character query instead of rolling locally.
  - Call `enterCamp(thresholdIndex)` when the camp cinematic triggers.
  - Call `exitCamp` on the "Seguir em frente" handler.
  - Stop passing `phase` to the three mutations; UI still uses local `combat.phase` to decide which buttons to show (matches the server's derivation, but UI math doesn't gate security).

### Validation

- `npx tsc --noEmit`, `npx vitest run`, `npx convex dev --once`, `npx biome check`.
- Manual: enter zone, reach camp, observe panel (no client-trusted phase). Then try in DevTools: call `pickFromBag` with no `enterCamp` first — should reject. Verify `enterCamp` rejects if called before the time threshold.

### Why this matters

Without this, the cap is a **client-cooperation** boundary, not a security one. The user's framing in PR #40 — *"backend tem que proteger isso"* — only fully holds once phase derives from server state.

---

## Single active session per character (queued — gates leaderboards)

**Status**: Planned, not started. Closes Threat #5 in [`docs/security/threat-model.md`](../security/threat-model.md). Triggered by the user's observation that opening the same character in two browser tabs runs two independent `useCombatLoop` instances with no coordination.

**Why**: better-auth identifies the **user**, not the **client**. `loadOwnedCharacter(authUserId, characterId)` returns the same character to every tab, and nothing on the character doc identifies which client is currently authoritative. Concrete consequences with N overlapping tabs:

- `recordKill` is credited **N×** per real kill cycle. Each tab spawns its own enemy locally, fights it locally, and reports the kill. The server has no way to dedupe.
- `enterZone` is last-writer-wins on `currentZoneSession`. Second tab's call orphans the first tab's bag (still in the items table tagged with the old session id, but invisible to the `zoneBag` query keyed on the new session).
- `syncHp` is last-writer-wins every 10s — HP becomes incoherent; a healthy tab can resurrect a "dead" tab's character.
- Convex function-call cost is multiplied by tab count (see "Convex cost envelope" above).

Pre-ranking impact is bounded ("weird bugs" + cost amplifier). **Post-ranking impact is fraud-by-construction** — a leaderboard entry built on multi-tab kills isn't ranked legitimately even if the player didn't intend to cheat. **Must ship before the first competitive feature lands.**

### Scope

- **Schema** (`convex/schema.ts`): add to `characters`:

  ```ts
  activeSessionToken: v.optional(v.string()),
  activeSessionAt: v.optional(v.number()),
  ```

- **New mutation** `claimCharacterSession({ characterId, sessionToken })` in `convex/characters.ts` (or a new `convex/sessions.ts` if other session work accumulates): writes the token + `Date.now()` onto the character. Idempotent on the same token. Stealing the session does NOT require any kind of confirm — the second tab just wins.

- **New helper** in `convex/_shared/character.ts`: `loadOwnedCharacterWithSession(ctx, authUserId, characterId, sessionToken)` — runs the existing ownership check, then asserts `char.activeSessionToken === sessionToken`. Throws `ConvexError("Session lost")` on mismatch. Read-only queries deliberately do NOT call this — a stale tab can still observe its character coherently, it just can't write.

- **Every state-mutating mutation** in `convex/combat.ts`, `convex/items.ts`, `convex/vendor.ts`: add `sessionToken: v.string()` arg, swap `loadOwnedCharacter` → `loadOwnedCharacterWithSession`. Mechanical but wide — ~15 call sites.

- **Client**:
  - Generate a UUID once per tab on mount (`crypto.randomUUID()` stored in an in-memory ref — NOT persisted, so a refresh creates a fresh token and re-claims, which is the desired UX).
  - Call `claimCharacterSession` immediately after `api.characters.list` resolves and a character is selected.
  - Thread the token through `useWorldMutations`, `useCombatLoop`, and any other mutation call site (consider a `useSessionToken()` hook that returns the active token + a `withSession(args)` helper so each call site doesn't have to remember).
  - Catch `ConvexError("Session lost")` globally — translate via `src/lib/convex-errors.ts`, route to a non-dismissible "Another tab has taken over this character" modal that offers a Refresh button. Refresh re-mounts, regenerates the token, re-claims.

### Watch out for

- **Mount-time race**: combat loop's `active=true` must wait until the claim mutation resolves AND the next `characters.list` snapshot shows the new token. Otherwise the first few `recordKill` calls from a freshly-mounted tab race against the prior tab's stale token and get rejected. Gate the loop activation on `char.activeSessionToken === ourToken`.
- **Network blip false-positives**: a laggy mutation that arrives after a competing claim looks like a tab-takeover to the user. Mitigate by surfacing the "session lost" modal only after a second consecutive rejection, OR by including the timestamp comparison ("if `activeSessionAt` is within 2s of ours, it's a race, not a takeover"). Pick whichever is cheaper once the first pass lands.
- **Optimistic mutations**: `withOptimisticUpdate` closures patch local store before the mutation commits. If the server rejects with "Session lost", the optimistic patch is rolled back automatically by Convex — verify this in manual testing rather than assuming.
- **Mobile background tabs**: iOS Safari aggressively suspends backgrounded tabs. A user playing on phone, switching apps, coming back 10 minutes later — that tab may have lost its session to another device's claim. The "session lost" modal must be reachable from a suspended-tab state (it is, because the next mutation attempt triggers it).

### Validation

- `npx tsc --noEmit`, `npx vitest run`, `npx convex dev --once`, `npx biome check`.
- Manual:
  - Open same character in two tabs. Confirm tab 2 wins on its claim — tab 1's next mutation shows the session-lost modal.
  - Refresh tab 1 (modal's Refresh button). It re-claims, starts working. Tab 2 now loses on its next mutation.
  - In DevTools, call a mutation with no `sessionToken` arg → rejected at the validator level.
  - In DevTools, call a mutation with a fake token → rejected with "Session lost".
  - Cross-device: log in on phone, open character. Log in on desktop, open same character. Desktop wins; phone shows the modal next time it tries to act.
- Cost check: the claim mutation fires once per tab mount. Acceptable overhead. The validation check inside `loadOwnedCharacterWithSession` is one extra equality on an already-loaded doc — no extra round-trip.

### Why this matters before Convex Pro upgrade

The "Convex cost envelope" section above assumes one player = one active loop. Multi-tab abuse can N× a single user's function-call cost — the protection here pays for itself in the cost dimension well before it pays for itself in the anti-cheat dimension. Layer 1 rate limits (in the threat-model) don't help against this because the spam is distributed across legitimate-looking sessions from one user.

### Why not just BroadcastChannel client-side

`BroadcastChannel` (or `localStorage` events) can detect cross-tab presence inside the same browser and degrade one tab to "view only". But it does NOT cover:

- Two browsers on the same device (Chrome + Firefox).
- Two devices on the same account (laptop + phone).
- A determined exploiter who patches out the client-side check (the whole point of moving validation to the server).

A client-side coordinator is a UX nicety on top of the server lock, never a replacement. Defer it until the server lock proves the modal-based UX is too disruptive — at which point a `BroadcastChannel` "Another tab on this browser is active — Switch to this tab" inline handoff is a polish item, not a fix.

---

## In-flight tracking for spam-click action handlers (queued)

**Status**: Planned, not started. Triggered by the vendor spam-click fix that shipped in PR #45.

**Why**: `VendorModal` now tracks per-product `pendingBuys: Set<VendorProductId>` and a single `isSelling: boolean`, and disables the corresponding buttons while the mutation is in flight. The same shape applies to every other action handler that today fires one round-trip per click with no guard. Without it, a fast-clicking user (or impatient one mid-lag) bounces N requests off Convex that the server then rejects, polluting the toast log and burning quota.

### Handlers to cover

Each one has the same fix shape: `useState<boolean>` (or `Set` if multiple instances of the same action coexist), early-return at the top of the handler, set/clear in `try` / `finally`, plus `disabled` on the button.

- **`combat.usePotion`** (CombatScene HUD) — clicked rapidly when low HP. Optimistic decrements `potions` so the button greys out on count=0, but a double-tap before the local count updates can fire twice.
- **`handleUseTeleportStone`** (world.tsx → CombatScene HUD button + map-click teleport-stone path) — same race against the local `teleportStones` count.
- **`handleRetreat` / `handlePickAll` / `handleDiscardAll`** (ExitZoneModal) — close-on-success protects against most double-clicks, but a slow round-trip leaves the buttons live.
- **`handleEnterNode`** (map click → `startTravel`) — `pendingArrival` guards subsequent clicks once it's set, but the set→await→pendingArrival flow has a small window where two clicks could both fire `startTravel`.
- **`combat.triggerIncense`** — same shape as potion.

### Scope

- Track in-flight at the handler call site (not inside `useWorldMutations` — the hook stays mutation-only; UX guards belong to the consumer).
- Reset on the natural close boundary (modal close, zone exit) so a slow request mid-close doesn't leave stale state.
- Defer until the world.tsx + useCombatLoop splits merge — both move the handler call sites around, and threading the new state through during a refactor wastes effort.

### Validation

- Manual: spam each action button, confirm only one toast/error per intended action.
- No new tests — this is UX behavior on top of stable mutation contracts.

---

## Thorns-reflect overwrites player-swing damage (queued)

**Status**: Planned, not started. **Latent bug** confirmed in both the pre- and post-refactor combat tick (preserved through PR #47 deliberately to keep that refactor structural). Surfaced by Gemini's review on the same PR.

**Why**: inside the 50ms `useCombatTick` callback, both a player swing AND an enemy swing can resolve in the same tick when their progress refs both pass `≥1`. Today's flow:

1. Top of tick: `const currentEnemy = enemyRef.current` — snapshot of pre-swing enemy.
2. Player swing connects: `const updated = { ...currentEnemy, currentHp: newEnemyHp }`. `enemyRef.current = updated; updateEnemy(updated)`. Enemy HP is now `newEnemyHp`.
3. Enemy swing connects (same tick). Thorns reflects if `stats.thorns > 0`:
   ```ts
   const enemyAfter = Math.max(0, currentEnemy.currentHp - reflected);
   const updated = { ...currentEnemy, currentHp: enemyAfter };
   enemyRef.current = updated;
   updateEnemy(updated);
   ```
   `currentEnemy.currentHp` is the **pre-swing** HP (captured at step 1). `enemyAfter` is `pre-swing - thorns`. The `{ ...currentEnemy, currentHp: enemyAfter }` then **overwrites** the post-player-swing HP with `pre-swing - thorns` — silently erasing the player-swing damage.

Concrete consequences:
- Player + thorns build vs a tanky mob: the player-swing damage component is being silently lost on any tick where both swings resolve. Effective DPS is lower than the stat sheet implies.
- Thorns appears to "double-dip" against the original HP (its full reflect plus the player swing's damage is what the player thinks happened, but the recorded HP is just `pre-swing - thorns`).
- More likely to fire when player attack speed is high (more ticks per second → higher prob of both progress refs hitting 1 in the same tick).

### Scope

The fix is local to `useCombatTick.ts`. Two options:

- **(A) Compute thorns from the live ref**:
  ```ts
  const enemyAtNow = enemyRef.current ?? currentEnemy;
  const enemyAfter = Math.max(0, enemyAtNow.currentHp - reflected);
  const updated = { ...enemyAtNow, currentHp: enemyAfter };
  ```
  Reads the post-player-swing HP correctly. Minimal change.
- **(B) Re-bind `currentEnemy` after each mutation**:
  ```ts
  // After player swing block (regardless of branch):
  currentEnemy = enemyRef.current ?? currentEnemy;
  ```
  Same effect; preserves the "all reads in the tick go through `currentEnemy`" pattern.

Either approach. (A) is more localised and clearer about intent.

### Validation

- Add a vitest case in a new `src/hooks/useCombatTick.test.ts` (or in a thin damage-routing test file in `src/game/combat/`) that simulates the same-tick collision: player swing connects + enemy swing connects with thorns. Assert final enemy HP = `initial - playerDamage - thorns`, not `initial - thorns`.
- Manual: roll a thorns build (rings/amulets with `thornsFlat`), engage a mob with `attackSpeed > 1`, watch the enemy HP bar — confirm it drops at the expected rate vs the stat sheet.

### Why not in PR #47

PR #47 is purely structural (`useCombatLoop` split). Including a real combat-math change would muddy the diff and the "no behavioural change" claim that justifies the smoke-test scope. Surfaced by Gemini's review but deliberately scoped out — fix lands as a follow-up.

---

## Native monster barrier

**Status**: Planned, not started. Triggered by the "Additional Barrier" monster mod from the zone-progression PR.

**Why**: today the `monsterAdditionalBarrier` mod folds into HP (`hp × 1.3`) as a placeholder because monsters have no barrier mechanism. The player has barrier (pool above HP, 6s recovery timer, full refill — see CONTEXT.md → Defenses → Barrier). Monsters should have the same shape so the mod's flavour matches its identity ("barrier above HP", not "more HP").

### Scope

- Extend `ScaledMonsterStats` with a `barrier: number` field (currently absent).
- Add `barrier` and `barrierRecoveryRemaining` to the live enemy state on `Enemy` (mirror the player's `BarrierState`).
- Reuse `damageBarrier()` / `tickBarrierRecovery()` from `src/game/combat/barrier.ts` on the enemy side of the combat tick.
- Update `monsterAdditionalBarrier` mod to grant a real barrier pool (e.g., `barrier += hp × 0.3`) instead of inflating HP.
- UI: render a thin blue strip above the enemy HP bar when barrier > 0 (mirror the player's HealthGlobe barrier ring).

### Validation

- `npx tsc --noEmit`, `npx vitest run`
- Manual: roll a magic mob with Additional Barrier. Confirm barrier pool absorbs first, refills 6s after empty, doesn't refill while above zero.

---

## Future: rare-name bestiary (low priority)

**Status**: Idea parked. Not a priority — touches persistence, not combat feel.

**Why**: rares now get random proper names from the lexicon pools ("Garra de Aço, o Furioso" / "Stonemaw, the Furious"). Each spawn rolls a fresh `RareNameSeed` so the same monster type produces a different name every time. A bestiary would let the player accumulate the rares they've killed across runs — a memorable trophy log instead of forgotten flavor text.

### Scope sketch

- New Convex table `rareEncounters` keyed by characterId, storing: spawn seed, monster id, level, mods, killed-at timestamp, zone id. (Seed lets the renderer reproduce the same name later — the displayed string isn't stored, so locale-switch reads the right language out of the bestiary too.)
- `recordKill` mutation grows a branch: when `monsterRarity === "rare"`, also insert into `rareEncounters`.
- New world view (`/world` view mode `"bestiary"`, or a modal opened from the status card) lists past rares chronologically or by zone. Each entry renders via `translateEnemyName({ def, mods, rarity: "rare", nameSeed })`.
- Optional: count how many times the same `(monsterId, mod combo)` has been killed — repeat-kill stats add a collector dimension.

### Why deferred

Combat-feel work pays off the moment the player fights; persistence pays off later. The seed + mods are already first-class on the Enemy object, so the data plumbing is cheap when we get to it — no schema migration on monsters or names needed.

### Validation when picked up

- Add the table in `convex/schema.ts`, then in `convex/combat.ts:recordKill` upsert the encounter on rare kills.
- Manual: kill a rare, open the bestiary, see the same name. Switch locale — the bestiary entry renders in the new language. Kill a rare with the same monsterId, see a different name.

---

## Future: passive tree + active skills (not started)

Per CONTEXT.md → Classes, the order is:

1. MVP combat ✅ (done)
2. Passive tree (not started — needs design)
3. Active skills per class (not started — depends on passive tree)

When a session starts working on this, expect to add a third combat path (alongside attack/spell) for skill casts, and a major refactor to the stat engine to handle skill-gem-style modifier sources.

---

## Future: stash + vendor (not started)

Per CONTEXT.md → Stash and Vendor, the design is locked but no code exists:

- Stash: account-scoped, mode-isolated (softcore / hardcore), 60 slots + purchasable tabs.
- Vendor: per-act, sells consumables (potions today), buys gear for Rubys.
- Ruby: currency. Monsters never drop Rubys directly.

This is **scoped after** the passive tree because economy + progression need to balance against built characters.

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

## Extract `CLASS_NAME` paraglide map to a shared helper (queued)

**Status**: Planned, not started. Flagged by the simplify pass on the admin dashboard PR (#46) and deferred from that PR to avoid scope creep. Both agents that reviewed the admin diff (reuse + quality) called out this duplication as a real concern.

**Why**: the same `Record<CharacterClassId, () => string>` paraglide-message map is inlined in **four** call sites today:

- `src/routes/character-select.tsx:18-22`
- `src/components/CreateCharacterModal.tsx:19-23`
- `src/components/world/StatusCard.tsx:13-17`
- `src/routes/admin/users.tsx:21-25` (added in PR #46)

The comment at `src/game/classes/data.ts:5-6` already calls out that consumers maintain these maps — the codebase has been waiting for someone to extract the helper. Four copies is the tipping point: any future change to a class name (rename, new class, locale-specific tweak) has to touch four files and risks drift.

### Scope

- Add a new helper in `src/game/classes/i18n.ts` (matches the world/items locale-i18n shape) exporting:
  ```ts
  export function getClassDisplayName(classId: string): string {
    const def = findClassDefinition(classId);
    if (!def) return classId;
    // CLASS_NAME map lives here, keyed by CharacterClassId, paraglide getters as values.
    return CLASS_NAME[def.id]();
  }
  ```
- Replace the inline `CLASS_NAME` + ad-hoc resolution in all four call sites with `getClassDisplayName(c.classId)`.
- Remove the now-stale comment in `src/game/classes/data.ts` (the one that flags this duplication).

### Watch out for

- `src/routes/admin/users.tsx` (PR #46) wraps the call in a tiny `classDisplayName` helper that handles the unknown-class fallback. The shared helper should keep that fallback so the admin drill-down doesn't crash on a legacy character with a removed class id.
- The three non-admin call sites currently use `m.unknown_class()` as the fallback, not the raw id. Check whether the shared helper should also fall back via paraglide (consistency) or return the raw id (admin behavior). Reasonable answer: paraglide fallback, since the admin row would also benefit from a translated "Unknown class" label.

### Validation

- `npx tsc --noEmit`, `npx vitest run`, `npx biome check`.
- Manual: open character-select, the create-character modal (after picking each class), the world status card, and `/admin/users` (expand a row). Class names render in the active locale for every site.

### Why deferred from PR #46

PR #46 added one of the four duplicates as part of building the admin dashboard. Extracting in the same PR would have pulled `CreateCharacterModal.tsx` and `StatusCard.tsx` into the diff — files unrelated to admin work — bloating the review surface and conflicting with the in-flight `useCombatLoop` split work in adjacent areas. The extraction is small enough that a focused follow-up PR is the cleaner path.
