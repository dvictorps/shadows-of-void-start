# In-progress work

Decisions made but not yet executed. Read this before starting a session — if your task overlaps with something here, you may be duplicating planned work or causing conflicts.

When a planned item starts, move it to a feature branch and reference back here. When it ships, delete the entry (closed work belongs in commit history, not this file).

**Doc language convention**: narrative + meta-docs in English (CLAUDE.md, CONTEXT.md, codebase-map, playbooks, ADRs, and the prose in this file all follow this). PT preserved only for game-domain proper nouns — `Acampamento`, `Incenso Etéreo`, `Calmaria`, item-name examples (`Espada de Ferro`), monster names, etc. Code identifiers stay English. Mixing the two in narrative produces the kind of code-switching that confuses future agents and downstream tooling (translation platforms, search) — don't.

---

## Next session — pick up here

The agent-ergonomics hardening pass shipped (CI gate via sentinel examples in `docs/playbooks/_examples/`, ADRs 0002 / 0003 / 0004, stub playbooks for skill / passive / stash / vendor product, threat-model entry for phase-arg trust, drift fixes in the monster / zone / class playbooks).

**Next high-leverage item: the `src/routes/world.tsx` split** — 900-line orchestrator route (this branch is the in-flight refactor). The detailed suggested cut (into `useWorldMutations`, `useViewMode`, `useWorldModals`, and a `<CombatHud>` component) lives in the dedicated entry below — see "Split `src/routes/world.tsx` (queued)" further down this file.

**Queued immediately after**: the `src/hooks/useCombatLoop.ts` split — 916 lines, the single largest file in the repo. Same orchestrator-monolith shape, dedicated entry below.

The downstream "Server-authoritative camp/phase derivation" security work (closes Threat #3 in the threat model) is blocked on the world.tsx split landing first — both touch the same combat-hook + mutation surface and would collide in a single PR.

Before starting, read: `src/routes/world.tsx` (the file being split), `src/hooks/useCombatLoop.ts` (combat orchestrator the route consumes), and `convex/items.ts` + `convex/combat.ts` (mutations the route's optimistic handlers mirror). Then align scope before fragmenting.

---

## Project health snapshot (as of 2026-05-23)

**Current grade: A** (composite across architecture / code quality / docs / scalability / agent ergonomics).

This is a self-assessment from senior-review passes after PRs #39 (tooltip i18n + slot-aware mods), #41 (decomposed item-name lexicon + 20 renderer tests), #42 (playbook + codebase-map refresh), and the agent-ergonomics-hardening pass (sentinel CI gate against playbook drift, stub playbooks for queued Future domains, ADRs 0002 + 0003). The grade exists to give downstream agents a quick read on what's solid and what's debt — pick work that moves the needle, skip work that doesn't.

### Why A (criteria that earned the current grade)

- **Architecture: A-** — render-at-display-time naming + literal-union enforcement is the correct choice for a multi-locale ARPG (codified now in [ADR 0003](../adr/0003-render-at-display-names.md)). Lexicon pattern is battle-tested across two domains (monsters + items). Convex/TanStack split is coherent. Remaining hole: drift risk between lexicon and `mod-i18n.ts` (same modifier id in two independent tables) — flagged in the lexicon follow-ups below.
- **Code quality: A-** — `src/game/` is pure + tested. 334 vitest cases. Comments are WHY-focused. Two known stains: residual `as TemplateBaseId` casts at the Convex boundary (Convex validators can't express literal unions — captured in [ADR 0003](../adr/0003-render-at-display-names.md)) and `src/routes/world.tsx` at 836 lines.
- **Docs: A** — `CONTEXT.md` is best-in-class for a solo-dev project (879 lines of single-source-of-truth game rules). Three ADRs codify the load-bearing architectural decisions (optimistic mutations, three-system i18n, render-at-display naming). Playbooks accurate and link to type-checked sentinel examples; new system stubs let an agent picking up skills / passives / stash know which questions need answering before coding.
- **Scalability: A** — adding a new locale = 1 new lexicon file per domain + matching paraglide JSON. Adding a new template = 1 entry + 0 lexicon changes if base/modifier already exist. Decomposition cut lexicon size by 88% (562 → 135). Literal-union enforcement makes "forgot a translation" a compile error.
- **Translation quality: B-** — 130 PT lexicon entries were AI-bulk-translated. Four hand-revised (Espada Bastarda, Estrela da Manhã, Maculado pelo Vazio, Gume) caught real awkwardness, so the rest probably has 5–10 similar issues. Fine for indie pre-release, not for a paid Brazilian release.
- **Agent ergonomics for ONBOARDING: A+** — `CONTEXT.md` + `CLAUDE.md` + `codebase-map.md` get an agent productive in ~30 minutes.
- **Agent ergonomics for MODIFYING existing things: A-** — strong TS catches mistakes, but `world.tsx` (836 lines) is a navigation tax.
- **Agent ergonomics for ADDING NEW systems (skills, passive tree, stash): B** — stub playbooks now exist for each queued Future domain, listing the decisions to resolve + the ADRs the agent will need to write. The systems themselves aren't built, but the orientation infrastructure is. The grade returns to A once the first new system ships against its stub without an emergency refactor.

### What raises the grade

| Move | Outcome |
|---|---|
| Split `src/routes/world.tsx` (see queued entry below) | Agent ergonomics for MODIFYING → A. Composite **A → A+** if combined with native PT review. |
| Split `src/hooks/useCombatLoop.ts` (queued after world.tsx) | Agent ergonomics for MODIFYING → A. Removes the largest single-file navigation tax in the repo (916 lines). |
| Native PT review of `lexicon/pt.ts` | Translation quality B- → A. |
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
2. The MAX PRIORITY agent-ergonomics hardening is **done**. The next high-leverage debt is the `world.tsx` split (queued entry below).
3. When a major refactor lands, **update the relevant playbook + sentinel in the same PR** (this is the single most important habit for keeping the grade trajectory positive).

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

**Status**: PRs #39 (tooltip labels + slot-aware mods) and #41 (decomposed lexicon + renderer + 20 tests) landed. The four items below are real but were intentionally deferred — none blocks a beta, but each one closes a small hole that will widen as more locales / modifiers land.

### 1. Cross-coverage test: lexicon affix forms ↔ `mod-i18n.ts`

**Risk**: The same `ModifierId` universe is translated in two independent tables — `lexicon.prefixForms` / `suffixPhrases` (magic-item compound name) and `mod-i18n.ts:PT_EXPLICIT_FORMATTERS` (tooltip mod line). Different data, but a new modifier needs entries in both. Today nothing forces that — a missing entry on either side renders the modifier id as a string fallback.

**Fix** (estimated: ~10 lines of test). One vitest file that iterates `MODIFIERS` and, per locale, asserts every prefix has a `lexicon.prefixForms` entry AND every modifier has a `PT_EXPLICIT_FORMATTERS` entry (or its EN equivalent path). Catches drift at CI time instead of at the tooltip.

**Why deferred**: low rate of new modifiers — the pool is mature, drift is unlikely in the next month. Worth adding before the next big modifier expansion.

### 2. Native PT-BR review of bulk-translated entries

**Risk**: 130-ish lexicon entries (55 bases + 80 modifiers) were AI-bulk-translated. The four manually reviewed (Espada Bastarda, Estrela da Manhã, Maculado pelo Vazio, Gume) caught real awkwardness, so the rest probably has 5–10 similar issues. Fine for indie / pre-release. Not fine before a paid release in Brazil.

**Fix**: Walk through `lexicon/pt.ts` with a native speaker, especially:

- All `gendered` adj forms — check the `m`/`f` inflection
- The 21-tier "owner" ladder (warden / champion / templar / archon / sovereign / etc.) reads as a power progression — does the PT chain feel like ascending power?
- Tier-21 void specials — the new `void_touched` / `void_forged` / `void_woven` / `void_inscribed` family is intentional, but each adjective should feel epic in PT.

**Why deferred**: project is solo dev pre-release. Translation quality is the kind of thing a real audience surfaces, not a code reviewer.

### 3. Codegen for `TemplateBaseId` / `TemplateModifierId`

**Risk**: `src/game/items/lexicon/template-ids.ts` declares the two literal unions by hand. The data files (`data/templates/*.ts`) reference these unions but the union itself is human-maintained — if someone adds a base/modifier to a template file using a string that isn't yet in the union, TypeScript catches it. But adding the union member doesn't force them to add a lexicon entry until they re-run tsc.

**Fix**: small codegen step. Walk `data/templates/*.ts` at build time (or via a `vitest` snapshot), collect every `nameBase` / `nameModifier` value, emit `template-ids.generated.ts`. The hand-written file just re-exports the generated union. Lexicons then can't compile if the unions grow without entries.

**Why deferred**: the hand-maintained file works for now. Codegen is the right call if/when there's a sustained pace of adding new bases.

### 4. Hash function → `src/lib/rng.ts`

**Risk**: `hashItemId` in `item-name.ts` is FNV-1a; `CombatScene.tsx` has a separate `*31`-walk hash. Both are deterministic string→[0, 1) hashes. Two implementations, same purpose, will drift.

**Fix**: extract to `src/lib/rng.ts` as `hashStringToUnit(s, salt?)` (or two-output variant). Both callers consume from there. Was flagged in the first simplify pass and deferred — the second caller (CombatScene) uses a weaker hash that probably should upgrade to match.

**Why deferred**: not load-bearing, both implementations currently work. Worth doing when next touching `CombatScene`'s hash.

### 5. Convex validator can't enforce literal unions

**Constraint, not a bug**. `nameBase` / `nameModifier` are stored as `v.optional(v.string())` because Convex validators don't have ergonomic literal-union support. The in-process `GeneratedItem` type widens to `string` at the persistence boundary — the lexicon files themselves keep the union enforcement. If Convex ever ships a `v.unionLiteral([...])` helper, swap in.

---

## Split `src/routes/world.tsx` (queued)

**Status**: Planned, not started. User has requested this be picked up after the in-flight time-based-zones work wraps.

**Why**: `src/routes/world.tsx` is **836 lines** today. It's the orchestrator route — combat hook, all eight-or-so modals, twelve+ mutations with optimistic closures, the view-mode state machine (map / city / combat), the priority text log. The agent who needs to add a new button in the HUD or wire a new mutation has to read the whole thing before they're confident they won't break adjacent logic.

### Suggested cut

- **`useWorldMutations`** custom hook — extracts the `useMutation(...).withOptimisticUpdate(...)` declarations into one place. Each declaration is 10-40 lines today; pulling them out drops world.tsx by ~250 lines and makes the optimistic recipes easier to compare.
- **`useViewMode`** custom hook — encapsulates the `viewMode: "map" | "city" | "combat"` state machine + the auto-transitions on `enterZone` / `enterCity` / `exitZone` arrival.
- **Modal manager** — the 8+ `useModal()` calls + state for which item / loot bag / vendor product the modal targets could collapse into one `useWorldModals()` hook returning a stable typed API. Or extract each modal block into a sibling component that owns its own visibility.
- **Combat HUD section** — the JSX for the bottom-of-screen combat buttons (potion, teleport stone, retreat, loot preview) is its own thing — pull into `<CombatHud character={...} />`.

### Validation

- `npx tsc --noEmit`, `npx vitest run` (no UI test coverage today; rely on TS + manual smoke).
- Manual smoke: enter zone → kill mob → exit with loot picker → equip new item → travel to next zone. The five main user-flows touch every part of world.tsx.

---

## Split `src/hooks/useCombatLoop.ts` (queued after world.tsx split)

**Status**: Planned, not started. Queued behind the world.tsx split.

**Why**: 916-line tick orchestrator — the single largest file in the repo (larger than `world.tsx` even pre-split). Same navigation-tax problem as world.tsx: an agent touching combat behavior has to read the whole file (the ~12 mid-tick refs, the searching/boss_intro/engaged/victory/miniboss_victory/acampamento state machine, encounter + camp + ambush scheduling, leech, barrier recovery, calmaria time-bar) before they're confident about side effects. Once the world.tsx split lands, this becomes the worst MODIFYING-friction surface in the codebase.

### Suggested cut

The file's top comment block already decomposes its concerns cleanly along lifecycle / refs / state / public-mutation lines — use that as the seam:

- **`useCombatRefs`** — bundles the ~12 mid-tick refs (`stateRef`, `enemyRef`, `playerProgressRef`, `enemyProgressRef`, `deadRef`, `nextSwingIndexRef`, `barrierRef`, `leechRef`, `playerHpRef`, `lastSyncedHpRef`, `initialHpRef`, `activeRef`, plus the camp/ambush trio) into a single typed bag. Each tick callback consumes the bag instead of importing twelve names individually.
- **`useEncounterSchedule`** — encounter plan rolling for a zone activation: spawn gap from `rollSpawnGapMs`, calmaria budget + miniboss promotion, camp thresholds (`rollCampThresholdsMs` + `nextCampIndexRef`), ambush schedule (`rollAmbushSchedule` + pack counter). Owns the `setCalmariaElapsedMs` / `campThresholdsMs` state and exposes "what should the next spawn be?" / "is a camp due?" queries.
- **`useCombatState`** — the `searching → boss_intro → engaged → victory / miniboss_victory → acampamento` state machine + the `bossIntroStage` sub-state. Owns transitions; doesn't own the tick.
- **`useCombatTick`** — the 50ms engaged tick: leech ticking, barrier recovery, alternate-weapon swings via `nextSwingIndexRef`, enemy swing, victory/death routing. Calls `recordKill` / `syncHp` mutations.

These are starting points based on the file's preamble — refine them once the actual extraction starts.

### Validation

- `npx tsc --noEmit`, `npx vitest run`.
- Manual smoke: full combat loop including miniboss victory cinematic, boss intro three-stage spawn (sprite → name → hp), camp cinematic, and an ambush pack. Confirm `useCombatLoop.ts` line count drops meaningfully (target: under 400 in the main file).

---

## Server-authoritative camp/phase derivation (queued after world.tsx split)

**Status**: Planned, not started.
**Why**: PR #40 added server-side enforcement of the 30% bag retention cap by accepting a `phase` arg on `exitZone` / `pickFromBag` / `discardFromBag`. The cap math itself is server-enforced, but the **`phase` arg is still client-trusted**. A tampered client (or someone hitting the Convex endpoint directly via the SDK) can pass `phase: "camp"` while actually in combat and bypass the cap entirely. Auth + ownership are protected; phase is not.

### Why we deferred

This is the next "right" step for the time-based-zone scope, but it requires schema + enterZone + useCombatLoop rewiring, which collides with the queued world.tsx split. Doing both in the same PR is too much surface for one review.

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

## Shared rarity-tinted card primitive (low priority refactor)

**Status**: Planned, not started.

**Why**: `src/components/world/MonsterTooltip.tsx` (added in `feat/zone-progression`) and `src/components/game/ItemTooltip.tsx` (in master) share non-trivial structure: identical `RARITY_COLORS` and `HEADER_BG` tables, identical `Separator` JSX, identical outer shell (tinted border + glow + `boxShadow` recipe + header-with-bg). The first two RARITY_COLORS rows of MonsterTooltip are a strict subset of ItemTooltip's 5-row map.

### Scope

- Lift `Separator` from `ItemTooltip` into a shared location (`src/components/ui/Separator.tsx` or similar).
- Centralize rarity-color tables (`RARITY_COLORS`, `HEADER_BG`) into a single source — perhaps `src/game/items/rarity-style.ts` re-exported by both tooltips.
- Optionally extract a `RarityCard` primitive (top accent line + tinted border + glow + header). Both tooltips consume it and add their own body content.

### Why deferred

The duplication is real but small enough that the refactor takes a focused PR. Doing it inline would have bloated `feat/zone-progression`. The current shape is correct; this is purely about reducing parallel maintenance.

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
