# Caster + Block + Barrier + Rogue Rebalance — 2026-05-28

> **For Claude:** REQUIRED SUB-SKILL: `superpowers:executing-plans`. Tasks below are commit-sized; each phase wraps in a logical PR.

**Goal**: implementation of design decisions from the 2026-05-28 grill session. Five categories of change: engine bugs in caster damage / block / stats sync, system addition of `restrictedToArmorType` modifier filter, balance rebalance (tome gain-as-extra, shield implicits, 2H staff, rogue starter), mod-scope adjustments (gain-as-extra opened to amulets/silk-gloves/staff; tome removed from block mod), barrier mechanic rework (no passive regen, refill-on-break, +50% damage multiplier).

**Tech stack**: Convex (mutations only — no schema changes here), React + TS, `src/game/*` stats and items engines.

**Architecture intent**: rogue's defensive identity (evasion × leather) currently requires a gear drop to activate, while warrior (HP) and mage (barrier from class) have intrinsic defenses — fix the asymmetry via starter chest. Barrier's continuous-regen identity is replaced with a "reliable burst absorber, cycles on break" model paralleling armor/evasion's continuous-on layers (see ADR 0005 update). Caster scaling honors the same 2H-vs-1H ratio that 2H melee weapons already follow (greatsword 2.0× sword).

**Reference**: Grill-with-docs session transcript 2026-05-28.

---

## Phase A — Engine bugs

Independent of design decisions. Fix first so balance numbers can be calibrated against working math.

### Task 1: Spell weapon flats enter compute pipeline

**Files**:
- `src/game/items/generator.ts:705` — remove the `&& !isSpellWeapon` gate so `computeWeaponStats` runs for wands/staves too.
- `src/game/stats/compute.ts:302-306` — drop the no-op early-return for `coldDamageFlat`/`fireDamageFlat`/`lightningDamageFlat`/`voidDamageFlat` on spell weapons; route them into `stats.swings[].elementalDamage` keyed by element.
- `src/game/stats/compute.ts:515-529` (element conversion) — verify it touches only `phys.min/max`, leaving other-element buckets intact. No change expected; existing logic is correct once Task 1 routes the flats through.

**Validation**: new test in `src/game/stats/compute.test.ts`:
- Setup: wand with base 12-25, mod `+6-12 fire spell damage`, mage selectedElement=lightning.
- Expected swing: `[{element: "lightning", min: 12+lvl, max: 25+lvl*2}, {element: "fire", min: 6, max: 12}]`.

### Task 2: Block double-count fix

**Files**:
- `src/game/items/generator.ts:611-663` (`computeArmorStats`) — iterate BOTH `item.implicits` AND `item.explicits` when computing block; sum additively (NOT multiplicatively). Pseudocode: `blockChance = baseBlock + sum(all block mods, raw value)`.
- `src/game/stats/compute.ts:applyItem` lines 405-426 — stop adding block mods to `stats.blockChance` via `applyModifierValue`/`applyMod`. Rely solely on `computedDefenseStats.blockChance` (now fully baked).
- Cap at `compute.ts:592-595` unchanged (still `Math.min(BLOCK_CHANCE_CAP, ...)`).

**Validation**: new test in `src/game/items/generator.test.ts`:
- Cotton aegis (base 22) + implicit `blockChanceIncrease: 18` + explicit `blockChanceIncrease: 4` → `computedDefenseStats.blockChance === 44`.
- Verify `compute.ts` doesn't add more on top.

### Task 3: StatsModal staleness fix

**File**: `src/routes/world.tsx:188-201` — `equippedSnapshot` `useMemo` deps must include `liveEquipped` (the raw live query) in addition to the cached `equippedItems`. When `liveEquipped` updates, the snapshot recomputes even if cache still serves the previous payload. Cleanest: derive `equippedSnapshot` from `liveEquipped ?? equippedItems ?? []`, with the memo keyed on whichever source was used.

**Validation**: manual — equip a new piece during combat with stats modal open; modal numbers update within one render.

### Task 4: HP-on-levelup closure fix

**File**: `src/hooks/useCombatTick.ts:553-561` — `restoreToFull` closes over a stale `maxHp` captured at hook activation. Fix: read maxHp at call time, not closure.

Two approaches (pick whichever is cleaner once reading the surrounding context):
- **A**: hold `maxHpRef` that re-syncs whenever `stats.maxLife` changes via a `useEffect`. `restoreToFull` reads `maxHpRef.current`.
- **B**: `restoreToFull` accepts a `maxHp` parameter passed by the caller at invocation time. Caller in `useCombatLoop:244-246` reads `stats.maxLife` fresh.

Recommended: **B**. Less ref ceremony; the level-up handler already has access to the fresh stats prop (which itself updates on `character.level` change via the reactive query — combine with Task 3's snapshot fix).

**Validation**: manual — level up a character at HP=full, verify the bar shows full of the NEW max, not full-minus-Δ.

### Task 5: Belt sprite scale-50 removal

**File**: `src/components/game/ItemCard.tsx:240-249` — remove `item.equipmentType === "belt"` from the `isJewelry` check. Rename the variable to `isTinyJewelry` (rings + amulets only). Add one-line comment explaining belts are jewelry-classified for stat purposes but render full-scale.

### Phase A PR

All five tasks above ship together. Tight, no design dependencies, all independent of each other. Safe to land before balance changes.

Commit: `fix(combat,items,ui): spell flats, block double-count, stats modal staleness, HP levelup desync, belt sprite scale`

---

## Phase B — System addition: `restrictedToArmorType` modifier filter

### Task 6: Add the field + filter

**Files**:
- `src/game/items/types/mods.ts` — add optional `restrictedToArmorType?: ArmorType` field to the `Modifier` interface. `ArmorType = "plate" | "leather" | "silk"`.
- `src/game/items/generator.ts` — in the mod-eligibility filter (where `applicableTo` membership is checked), short-circuit when `mod.restrictedToArmorType && item.armorType !== mod.restrictedToArmorType`. Modifiers with no `restrictedToArmorType` field are unaffected.
- **New ADR**: `docs/adr/0007-restricted-armor-type-mod-filter.md` per the [ADR-FORMAT](./grill-with-docs format) template. Context (asymmetry between `equipmentType` and `armorType` in mod targeting), Decision (add the optional field), Consequences (small generator change, no migration, opens future "INT-base only" / "STR-base only" mods cleanly).

**Validation**: TS clean. Add a generator unit test — a mod with `restrictedToArmorType: "silk"` rolling on `gloves` only attaches to silk_gloves variants, never plate/leather.

### Phase B PR

Single task, single commit, includes the new ADR. Lands before Phase C (which uses the new field).

Commit: `feat(items): add restrictedToArmorType modifier filter + ADR 0007`

---

## Phase C — Mod scope changes

### Task 7: Tome gain-as-extra slots + armor-type restriction

**File**: `src/game/items/data/modifiers/tome.ts` — for `tomeGainAsExtraCold`, `tomeGainAsExtraFire`, `tomeGainAsExtraLightning`, `tomeGainAsExtraVoid`:

```ts
applicableTo: ["tome", "amulet", "gloves", "staff"],
restrictedToArmorType: "silk",  // No-op on tome/amulet/staff (not armor); filters gloves to silk only.
```

### Task 8: Block mod cleanup — tome can't roll block

**File**: `src/game/items/data/modifiers/defense.ts:214-224` — `blockChanceIncrease.applicableTo` currently `["offhand"]`, which incorrectly includes tomes. CONTEXT.md → line 781 explicitly says "tome ... only off-hand without block chance, by design".

Cleanest fix: change `applicableTo` from `["offhand"]` to whatever the shield-specific equipmentType union is. Investigate at implementation time — if there's no `equipmentType: "shield"` distinct from tome, add one to the equipment type union (small refactor) OR use a `restrictedToOffhandKind` shape similar to Task 6. Prefer the former (typed equipment type distinction is cleaner long-term).

**Validation**: generate 1000 tomes — none should have `blockChanceIncrease`. Generate 1000 shields — should still roll as before.

### Phase C PR

Lands after Phase B. Two commits, can be one PR.

Commit 1: `feat(items): tome gain-as-extra rolls on amulets, silk gloves, staves`
Commit 2: `fix(items): remove tome eligibility from blockChanceIncrease mod`

---

## Phase D — Balance numbers

### Task 9: Tome gain-as-extra tier values bumped

**File**: `src/game/items/data/modifiers/tome.ts` — for all 4 mods:

```ts
tiers: createStandardTiers(6, 8, 12, 18),  // Was (1, 3, 12, 18)
```

Resulting curve (`createStandardTiers` interpolates linearly across 10 tiers):

| Tier | ilvl | min-max |
|---|---|---|
| t10 | 1-10 | 6-8 |
| t9 | 11-20 | 7-9 |
| t8 | 21-30 | 7-10 |
| t1 | 91-100 | 12-18 |

### Task 10: Shield implicits rebalance per-base

**File**: `src/game/items/data/templates/shields.ts` — for ALL 63 shield bases (21 tiers × 3 armor types):

| Tier | Old implicit range | New implicit range |
|---|---|---|
| T1 | [10, 20] | [1, 3] |
| T11 | ~[20, 30] | ~[2, 4] |
| T21 | [30, 40] | [3, 5] |

Linear scaling between T1 and T21, per-base.

Resulting ceilings (with bug fix in Task 2 applied):

| Shield tier | Base | Implicit max | Explicit max | Total |
|---|---|---|---|---|
| T1 + max rolls | 22 | 3 | 3 (t10 explicit) | **28** |
| T11 + max rolls | 27 | 4 | 5 | **36** |
| T21 + max rolls | 32 | 5 | 8 (t1 explicit) | **45** |

Matches PoE-style "best shields with great mods cap around 40-45% gear-only block".

### Task 11: Staff base damage rebalance

**File**: `src/game/items/data/templates/staves.ts` (or wherever staff bases live) — for EACH staff tier T1..T21, set `minDamage` and `maxDamage` to exactly 2.0× the corresponding wand tier's values. Wand base values are the source-of-truth.

T21 reference: wand 69-152 → staff 138-304. T1 reference: scaled down equivalently.

Other staff stats unchanged: attack speed 1.2, crit 6.0, implicit `+75-125% spell damage`. (Implicit values are not buffed here — the base damage bump compounds through the implicit's multiplicative scaling.)

### Task 12: Rogue starter buffs

**Files**:
- `src/game/items/starter-gear.ts` — bump the rogue dagger entry from `2-4` damage to `3-5`. Other dagger stats unchanged (AS 1.7, crit 6.5%).
- `convex/characters.ts:create` — when `classId === "rogue"`, after inserting the starter weapon, also insert a `leather_chestplate_t1` document for the character with `locationKind: "equipped", equippedSlot: "chestplate"`. Update the starter-gear test if one exists.

Resulting lvl 1 rogue:
- DPS: avg 4 × 1.7 AS = 6.8 (parity with warrior's 6.6).
- EHP: 50 HP + 22 evasion (was 0).

### Phase D PR

All four balance tasks ship together. They touch independent files but conceptually belong to "the 2026-05-28 rebalance pass". Doc updates in this PR:
- CONTEXT.md: add a Weapons section note describing the 2H spell rule (`staff base damage = 2.0 × wand base damage at every tier`) mirroring greatsword/sword.

Commit: `balance: tome gainAsExtra, shield implicits, 2H staff, rogue starter`

---

## Phase E — Barrier mechanic rework

### Task 13: Barrier — no regen, refill on break, +50% damage multiplier, symmetric monster behavior

**Files**:

`src/game/combat/constants.ts:45,52`:
```ts
// Remove BARRIER_REGEN_FRACTION_PER_SECOND entirely.
export const BARRIER_REFILL_DELAY_SECONDS = 10;   // Renamed from BARRIER_COOLDOWN_SECONDS
export const BARRIER_DAMAGE_MULTIPLIER = 1.5;     // New: +50% damage when absorbed by barrier
```

`src/game/combat/barrier.ts`:
- `BarrierState` interface — rename `cooldownRemaining` → `refillRemaining` for semantic clarity (it's now the countdown to instant refill, not to "regen resumes").
- `tickBarrier(state, dt)`:
  - If `refillRemaining > 0`: decrement; if it hits 0, set `current = max` (instant full refill); else no change.
  - If `refillRemaining === 0` and `current > 0`: NO-OP. No passive regen. State stays as-is until next damage or refill cycle.
- `damageBarrier(state, rawDamage)` — leitura A (barrier pool effectively × 1/1.5):
  ```ts
  const effective = rawDamage * BARRIER_DAMAGE_MULTIPLIER;
  const absorbed = Math.min(state.current, effective);
  state.current -= absorbed;
  const lifeOverflow = rawDamage * (1 - absorbed / effective);  // = rawDamage - absorbed/multiplier
  if (state.current === 0 && state.refillRemaining === 0) {
    state.refillRemaining = BARRIER_REFILL_DELAY_SECONDS;
  }
  return { state, lifeOverflow };
  ```
  - Note: if damage hits when `refillRemaining > 0` (in cooldown), barrier.current is already 0, so absorbed === 0, lifeOverflow === rawDamage. No double-trigger of refill timer.

`src/hooks/useCombatTick.ts:239,287,299` — `tickBarrier` calls keep firing in real time (combat 50ms / exploration / travel / map). No call-site changes needed; the function's internal logic changed but signature stays.

`src/hooks/useCombatTick.ts` enemy barrier path (lines 325-327 per the earlier exploration) — apply the same `BARRIER_DAMAGE_MULTIPLIER` to player→enemy damage absorbed by enemy's barrier. The multiplier is a property of the `damageBarrier` function, so this happens automatically once the function changes — symmetric by design.

`src/game/combat/barrier.test.ts` — overhaul:
- Remove regen-related tests.
- Add: damage absorbed at 1.5× rate.
- Add: barrier broken → refillRemaining = 10s.
- Add: tickBarrier advances refillRemaining; reaches 0 → barrier.current = max (instant).
- Add: damage during refill cooldown → all carries to life, no double-trigger.
- Add: symmetric behavior for monster barrier.

**Doc updates IN THE SAME PR**:

`docs/adr/0005-barrier-regen-mechanic.md` — append:

```markdown
## Update (2026-05-28) — pivot to "no passive regen + refill on break + damage multiplier"

The continuous-regen-with-cooldown model from the 2026-05-24 decision (and its tuning updates of 2026-05-26 and 2026-05-27) made barrier feel like a dead stat in sustained combat. Players reported a structural asymmetry: armor and evasion mitigate every hit continuously, but barrier was a slowly-depleting pool that essentially provided "+N HP of overflow life" without functioning as a recurring defensive layer. A 300-armor warrior trivialised Gralfor; a mage with equivalent barrier investment ran out by the third engagement and reverted to relying on life and potions.

The fix replaces continuous regen with a binary "have it / cooldown for 10s / get it all back" cycle, compensated by a +50% damage multiplier on absorbed hits:

1. **No passive regen.** Once damaged, barrier stays at its current value indefinitely (city entry still resets fully).
2. **Refill on break.** When current hits zero from damage, a 10-second cooldown starts. At expiry, current jumps instantly to max — no in-between regen.
3. **+50% damage multiplier on absorption.** Effective pool = max / 1.5. A 1500-barrier mage absorbs 1000 raw damage before breaking. Applies symmetrically to the player damaging a monster's barrier.
4. **Cooldown ticks in real time** across combat / exploração / travel / map.
5. **Monster barrier mirrors.** The `monsterAdditionalBarrier` 30%-of-HP pool follows the same rules — same `damageBarrier`/`tickBarrier` functions, no asymmetric code path.

The "auto-break metagame" (tank a trash hit pre-boss to reset partial barrier) is accepted as a small acknowledged quirk — the cost is real (10s of vulnerability during whatever fight you self-broke in) and the trick maps to existing PoE energy-shield trigger-pre-boss patterns. Not worth eliminating.

City entry behavior and gear-swap behavior from the original ADR are preserved unchanged.

The failure mode that motivated the original move-away-from-binary ("mage immortal to anything but continuous DPS over 10s, potions trivialise the 6s window, no build pressure on life") is partially mitigated by:
- 10s vulnerability window (vs original 6s) is longer.
- +50% damage multiplier shrinks effective pool by 33% — first-burst absorption is meaningfully weaker.
- Player still must engage potions during the cooldown window — barrier doesn't save them from the next 1-2 fights without it.

The full "double HP every cycle" loop returns vs sustained-damage profiles, accepted as the price of paridade with armor/evasão as continuous defensive layers.
```

`CONTEXT.md` Defenses → Barrier (lines 293-302 currently) — rewrite to match the new mechanic. Drop references to "regen 1%/s", replace with "no passive regen; refill in full 10s after break; +50% damage taken when absorbed". Update the historical note section to point to both the original ADR and the new Update section.

`CONTEXT.md` Monster Modifier Pool → Additional Barrier (line 562 currently) — rewrite to match (same cooldown + refill behavior; remove regen reference).

### Phase E PR

Standalone PR — biggest gameplay-feel change in the set, deserves its own review and merge timing for rollback safety.

Commit: `feat(combat): barrier rework — no regen, refill on break, +50% damage multiplier`

---

## Validation across all phases

- `npx tsc --noEmit` clean.
- `npx vitest run` — baseline 552 must stay green; expected to grow by ~10-15 new tests (block math, spell flats, barrier rework, generator filter).
- `npx convex deploy --dry-run` — should succeed; no Convex schema changes here, only mutation body changes (rogue starter chest insert).
- **Manual smoke (run all in one session)**:
  - Create a rogue → verify dagger DPS feels right vs goblin → take a hit and verify evasion kicks → die-once test rare survivability.
  - Level up at full HP → verify bar shows full of NEW max.
  - Equip a wand with `+6-12 fire spell damage` → open stats modal → verify damage line shows fire flat alongside converted base.
  - Equip a shield with implicit + explicit block mods → verify tooltip "Chance de Bloqueio" = base + implicit + explicit (additive).
  - Open stats modal mid-equip-swap → verify numbers update.
  - Take damage to barrier until break → verify 10s timer → verify instant refill.
  - Kill miniboss (rare) → take +50% damage from boss's hits-into-your-barrier.
  - Pick up belt drop → verify sprite renders at full scale, not half.

---

## Out of scope (deliberately not in this plan)

- No passive tree work (rogue's DEX-evasion identity still gates on gear; a passive tree node "+X evasion per DEX" would close the unarmored-rogue gap structurally and is parked for the passive-tree pass).
- No new ADR for the staff = 2.0× wand rule (it's a balance tuning matching an existing precedent, not a load-bearing architectural decision).
- No barrier-related schema migration (barrier state lives in client `BarrierState`, not Convex — confirmed via ADR 0005 + previous exploration).
- No further block-cap retuning (75% cap stays; PoE-aligned).
- No staff-exclusive mods or staff implicit bump (deliberate restraint — first land the base damage 2.0× rule, evaluate, escalate later if endgame parity still feels off).
