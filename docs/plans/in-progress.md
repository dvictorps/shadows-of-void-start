# In-progress work

Decisions made but not yet executed. Read this before starting a session — if your task overlaps with something here, you may be duplicating planned work or causing conflicts.

When a planned item starts, move it to a feature branch and reference back here. When it ships, delete the entry (closed work belongs in commit history, not this file).

---

## Agent ergonomics hardening (MAX PRIORITY — pick up after current in-flight work)

**Why this is max priority**: this project is built almost entirely through prompt engineering with AI agents. The codebase's value compounds with the quality of agent-facing infrastructure — docs accuracy, type safety, decision capture. Every hour invested here pays back as faster, safer features for the rest of the project's life. Letting these debts accumulate is the single biggest risk to project velocity.

Pick up these tasks after the time-based-zone-progression work wraps (or in parallel if scope allows). Order is suggested — the CI gate is the highest-leverage item, the rest are independent.

### 1. CI gate against playbook drift (HIGH leverage)

**Problem**: PR #41 (item naming lexicon) shipped without updating `adding-an-equipment-template.md` and `adding-a-modifier.md`. PR #42 fixed them, but the only thing that caught the drift was a senior-style audit. The next major refactor will introduce the same drift.

**Fix**: small vitest file (`docs/playbooks-smoke.test.ts` or similar) that:

- Reads each playbook with a code-block annotation (`// from playbook: adding-an-equipment-template.md`).
- Extracts the example TypeScript blocks.
- Wraps them in a minimal harness and runs `tsc --noEmit` against the example.
- Asserts: every playbook example must compile against current types.

Alternative shape: include a sentinel "playbook example" file per playbook (e.g. `docs/playbooks/_examples/template-example.ts`) that gets type-checked as part of the regular tsc pass. Any drift between code shape and the example breaks CI.

**Estimate**: 1-3 hours depending on shape chosen. Worth every minute — it's the only mechanism that prevents repeat-drift.

### 2. Playbook stubs for queued domains

**Problem**: `in-progress.md` lists Future domains (passive tree, active skills, stash, vendor, bestiary, etc.) with design notes but no scaffolding. When an agent picks one up, they'll improvise from the closest existing precedent — usually monsters or items — and the resulting structure may not match what a senior would design.

**Fix**: For each Future domain in `in-progress.md`, add a stub playbook `docs/playbooks/adding-a-<domain>.md` that:

- Lists the design questions the agent must resolve before coding (the same shape as `adding-a-zone.md`'s "Decide first" section).
- Points at the existing precedents to learn from (e.g. skills should mirror `src/game/monsters/` for data structure, `src/game/items/lexicon/` for naming).
- Flags the open ADR-worthy decisions (where does skill data live? how do they interact with the stat engine?).

Specifically queue stubs for:
- `adding-a-skill.md` (active skill, gem-style)
- `adding-a-passive.md` (passive tree node)
- `adding-a-stash-tab.md` (vendor + ruby loop)
- `adding-a-vendor-product.md` (the slot is set up but only consumables are listed)

These aren't full recipes (the systems don't exist yet). They're orientation docs that get filled in when each system lands.

**Estimate**: 30 min per stub. Low individual cost, high collective payoff.

### 3. ADR for the i18n architecture (lexicon × paraglide × mod-i18n)

**Problem**: The three-system split is non-obvious and was the result of real trade-offs (PR #41 review surfaced "why not unify?" questions). The `i18n-which-system.md` playbook explains the decision tree but not the rejected alternatives or the underlying constraints.

**Fix**: `docs/adr/0002-i18n-systems.md`. Short — five paragraphs. Covers:

- Why paraglide alone wasn't enough (gender concord at scale = key-suffix explosion).
- Why a single lexicon couldn't replace paraglide (lexicons run through a renderer per call; static UI strings don't need that overhead and lose tooling).
- Why mod-i18n.ts isn't folded into the lexicon (different shape: value-interpolation + min-max range support).
- Status: Accepted. Date.

This codifies the decision so a future contributor doesn't redo the analysis from scratch (or, worse, "simplifies" the architecture without knowing why it exists).

**Estimate**: 30 min.

### 4. ADR for render-at-display naming (items + monsters)

**Problem**: Both the item-name and monster-name renderers chose to derive display strings from data at render time rather than store them. The reasoning is solid (locale switching, no name baked into the row) but it's also the kind of decision a future contributor might "improve" without context — pre-rendering names "for performance" would silently break locale switching.

**Fix**: `docs/adr/0003-render-at-display-names.md`. Same shape as 0002. Covers:

- Why we don't store rendered names (locale switch retranslates everything; no stale-cache problem).
- Why UUID-seeded proper names (no `nameSeed` column needed; the seed is implicit in the existing id).
- The Convex-validator literal-union limitation that drove the `v.optional(v.string())` widening.

**Estimate**: 30 min.

### 5. Split `src/routes/world.tsx` (already queued)

The 836-line orchestrator. Already has an entry below — keeping the cross-reference here to make sure it's not forgotten in the same priority sweep. See the dedicated entry for details.

### Validation across all items

```bash
npx tsc --noEmit       # passes if playbook examples + ADR snippets compile
npx vitest run         # passes if playbooks-smoke.test.ts is green
npx biome check src/
```

No runtime change. All deliverables are docs / tests / type-level guarantees. Low risk, high agent-ergonomics payoff.

---

## Time-based zone progression + Acampamento + Incenso Etéreo (active design)

**Status**: Design locked, implementation pending.
**Branch**: `feat/time-based-zones` (created from `origin/master`).

### Why

The current zone progression is a hidden 30-kill counter. The agreed redesign replaces it with a **time bar** that advances during exploração (gaps between encounters) and pauses during combate. The bar fills when the zone's encounter schedule completes, then the miniboss spawns. Goal: zone feels like a transit, not a kill quota.

The design is fully documented in `CONTEXT.md` — see `### Time Bar`, `### Combat Phases`, `### Encounter Schedule`, `### Acampamento`, and `### Active player input` (Incenso Etéreo, consolidated Teleport Stone).

### Scope summary

- **Time Bar** (replaces Threshold Bar): per-zone encounter schedule + `spawn event` abstraction (`{ size: 1, kind, ... }`) to leave NvN combat as a future-portable extension.
- **Encounter Schedule**: zone declares `encountersBeforeBoss`, `gapBetweenSpawns: {min, max}`, `ambushes: { count, packSize, gapWithinPack, magicChance }`, camp anchoring rules. Lives in `src/game/world/act-1.ts`.
- **Acampamento** (camps): cinematic + modal with two options (Retornar com 100% / Seguir em frente). Baked into the schedule at anchored positions (~50% for `<20` encounters, ~33% + ~66% for `≥20`).
- **Incenso Etéreo**: new consumable, drop-only (~2-3% from any kill), triggers the camp cinematic on demand. Queueable during combate; blocked during boss fight.
- **Bag retention tiers**: camp = 100%, exploração = 30%, combate = 30%, morte = 0%. ExitZoneModal enforces 30% cap with player picking which slots.
- **Teleport Stone consolidation**: stone absorbs the wind crystal's purpose. Single item, destination = any node in `unlockedNodes`. City gets short travel time (3s) + heal/refill; other nodes get the wind crystal's old travel time (~12s) + no heal. Vendor price 40r. `useWindCrystal` and the `windCrystals` counter are retired.

### Required code changes (rough map)

- `convex/combat.ts`:
  - `recordKill` — drop `etherealIncense` independently on each kill (counter on character doc); decouple miniboss spawn from kill count (engine drives it from schedule end).
  - `useTeleportStone` — accept `destinationNodeId: v.string()`; branch on `city` vs other (heal+refill only when city); compute `travelArrivesAt` from the appropriate constant.
  - `useWindCrystal` — delete.
  - Add `useEtherealIncense` mutation that triggers the camp cinematic flow (or model the cinematic purely client-side and just decrement the counter server-side).
- `convex/schema.ts`: add `etherealIncense?: v.number()` to `characters`; consider retiring `windCrystals` (or leave for legacy data tolerance).
- `src/game/world/act-1.ts`: each zone gets `encounterSchedule` data (encounter count, gap bounds, ambush spec, camp positions).
- `src/game/combat/constants.ts`: add `STONE_TRAVEL_SECONDS_CITY` (3s), keep/rename `WIND_CRYSTAL_TRAVEL_SECONDS` → `STONE_TRAVEL_SECONDS_NON_CITY` (~12s).
- `src/hooks/useCombatLoop.ts`: replace `KILLS_TO_THRESHOLD` flow with the schedule iterator; track current schedule slot; emit camp events at scheduled slots; queue incenso activations during combat.
- New components: camp cinematic (`CampCinematic.tsx`?) with fade transitions and the two-option modal.
- `src/components/world/ExitZoneModal.tsx`: enforce the 30% keep-cap when phase is exploração/combate (pass current phase from caller).
- `src/components/world/StatusCard.tsx` / combat HUD: 4th button (Incenso Etéreo), greyed out per rules.
- `src/game/vendor/products.ts`: drop wind crystal; update stone price.
- `messages/pt.json` + `messages/en.json`: camp cinematic strings, incenso strings.

### Validation

```bash
npx tsc --noEmit
npx vitest run
npx convex dev --once
npx biome check src/ convex/
```

Manual smoke: enter zone, observe ambush event with magic pack, hit a baked camp (cinematic fires, modal opens with 2 options), use Continuar (bar resumes), reach miniboss, kill, see Zone Complete panel. Separately: drop an Incenso Etéreo, use mid-combat (queues), confirm cinematic fires after current kill. Separately: use Teleport Stone with non-city destination, confirm no heal/refill applied.

### Open follow-ups (deferred in this PR — see entries below)

- Act-boss node (Model B) re-fit for the time-bar system.
- Biome-specific ambient audio for the camp cinematic.

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
