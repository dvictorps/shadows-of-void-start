# In-progress work

Decisions made but not yet executed. Read this before starting a session — if your task overlaps with something here, you may be duplicating planned work or causing conflicts.

When a planned item starts, move it to a feature branch and reference back here. When it ships, delete the entry (closed work belongs in commit history, not this file).

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

## Camp cinematic biome-specific audio (deferred)

**Status**: Planned, not started.
**Triggered by**: time-based zone progression PR. The camp cinematic is text-only at first ship.

### Why

The cinematic was designed to include ambient sound cues per biome ("Sons da natureza calma..." in forest, frog/marsh sounds in pantano, etc.). The project already has hit-sound infrastructure to extend from. Text + fade alone delivers ~80% of the felt experience; audio is the last 20%.

### Scope

- Catalog biome ambient files (`/assets/audio/biomes/forest.mp3`, `pantano.mp3`, etc.).
- Hook into the camp cinematic timeline: ambient fade-in synced with the first text fade-in; fade-out before the modal options appear.
- Zone metadata declares its biome key; the cinematic looks up the matching audio.
- Volume + accessibility: respect a future master volume setting.

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
