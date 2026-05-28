# 0007 — `restrictedToArmorType` modifier filter

**Status**: Accepted
**Date**: 2026-05-28

## Context

The mod-eligibility filter (`getModifiersForTemplate` in `src/game/items/generator.ts`) decides which modifiers can roll on a given equipment template by checking `mod.applicableTo` against `template.equipmentType` (and `template.weaponType`). This works cleanly for slot-level targeting ("rolls on gloves", "rolls on amulets"), but it cannot express **armor-base** targeting within a slot ("rolls on **silk** gloves but not plate/leather gloves").

The codebase already carries one ad-hoc workaround: `MOD_REQUIRED_ARMOR_TYPE` — a hardcoded map in `generator.ts` that filters four specific global mods (`globalArmorIncrease`, `globalEvasionIncrease`, `globalBarrierIncrease`, `globalSpellDamageIncrease`) to their matching armor type. The map sits in the generator instead of the modifier definitions, which means a new mod that wants armor-type targeting must edit two files and the registry-vs-data split obscures intent at the mod-declaration site.

The 2026-05-28 rebalance opened the four `tomeGainAsExtraCold/Fire/Lightning/Void` mods to amulets, staves, and gloves. On gloves, only **silk** gloves should roll these mods (mages wear silk; the gain-as-extra mechanic is mage-flavor). That's a fifth mod needing armor-base targeting — enough that a one-off addition to `MOD_REQUIRED_ARMOR_TYPE` would be the wrong move.

## Decision

Add an optional `restrictedToArmorType?: ArmorType` field to the `Modifier` interface. When set, `getModifiersForTemplate` excludes the modifier from any armor template whose `armorType` doesn't match. Non-armor templates (weapons, jewelry, tomes — where `template.armorType` is undefined) are unaffected: the restriction is a no-op for them, so `applicableTo: ["tome", "amulet", "gloves", "staff"], restrictedToArmorType: "silk"` correctly allows all four targets while filtering gloves to silk only.

The existing `MOD_REQUIRED_ARMOR_TYPE` registry stays for now. Migrating its four entries to use `restrictedToArmorType` is a follow-up — not load-bearing for this decision, and a separate refactor keeps the diff focused.

## Alternatives considered

### Extend `MOD_REQUIRED_ARMOR_TYPE` with the new entries

- **Pro**: zero changes to the `Modifier` interface; the existing mechanism already works.
- **Con**: armor-type restriction lives in the generator, not at the mod's declaration site. Declaring the restriction inline (next to `applicableTo`) is more discoverable and matches the rest of the modifier's shape.

### A new applicableTo group like `"silkGloves"`

- **Pro**: reuses the existing eligibility filter mechanism (no new field).
- **Con**: explodes the equipment-group enum combinatorially (`silkGloves`, `leatherGloves`, `plateBoots`, …). Each combination would need its own `EQUIPMENT_GROUPS` entry. Worse: `applicableTo` is a list of "where this can roll", and a `silkGloves` group conflates slot + base.

### Per-mod predicate functions

- **Pro**: maximally flexible; any future targeting rule expressible.
- **Con**: makes modifiers stop being pure data. Synergy weights and intelligent-generation logic both depend on modifiers being introspectable static records.

## Consequences

- The `Modifier` interface gains one optional field. No data migration — existing mods omit it.
- `getModifiersForTemplate` gains four lines of filter logic, sitting alongside the existing `MOD_REQUIRED_ARMOR_TYPE` check.
- Mods that want INT-base-only / DEX-base-only / STR-base-only behavior in the future express it inline (e.g., `restrictedToArmorType: "silk"` for an int-coded mod) without touching the generator.
- The four `tomeGainAsExtraX` mods (Phase C of the 2026-05-28 plan) become the first consumers.
- A follow-up cleanup can migrate the four entries in `MOD_REQUIRED_ARMOR_TYPE` to the new field and delete the registry, unifying the mechanism.
