# Adding a modifier

A "modifier" is a rolled affix on a generated item — e.g. "+15 Strength", "+20% Increased Fire Damage". Adding one touches 4-5 files in predictable spots. Two of those are i18n tables that must stay in sync — TypeScript catches missing entries via literal-union Records.

## Decide first

Before writing code:

1. **Is it local or global?** Local mods affect the item's own computed stats (a weapon's `+X% Physical Damage` only buffs that weapon). Global mods sum into character totals and apply universally. See [Local vs global](#local-vs-global) below if you're unsure.
2. **Which category?** offensive / defensive / attribute / utility. Picks the file the new mod lives in.
3. **Which slots accept it?** Use the [equipment groups](#equipment-groups-applicableto) (`allArmor`, `allJewelry`, `allAttackWeapons`) where possible. Mixing groups with specific slots is fine.
4. **What's its weight?** Default 1000. Higher = more common. Premium mods get 400-600, fillers get 1500-2000. See `CONTEXT.md` "Modifier Knobs" → Reference weights.
5. **What's its tier range?** 10 tiers gated by ilvl (see [Tiers](#tiers)). Pick min/max values for the weakest tier and strongest tier.

## Step 1 — Define the modifier

Open the right file under `src/game/items/data/modifiers/`:

- Attack damage / crit / attack speed → `weapon-damage.ts`
- Flat spell damage (staff/wand only) → `spell-damage.ts`
- Global damage %, global crit, global cast/attack speed → `global-damage.ts`
- Armor / evasion / barrier / life / mana / block / thorns → `defense.ts`
- Resistances → `resistances.ts`
- Str/Dex/Int → `attributes.ts`
- Movement speed, leech, stun, on-kill, reduced reqs → `utility.ts`
- Item Rarity (Magic Find) → `magic-find.ts`
- Tome-exclusive gain-as-extra → `tome.ts`

Add an entry. The example below is a complete, copy-pasteable `increased` prefix; swap `Increase` for `Flat` (and `modifierType: "flat"`) for an additive mod, or `affixType: "suffix"` for a suffix.

```ts
myNewStatIncrease: {
    id: "myNewStatIncrease",            // id must end in Flat / Increase / More
    affixType: "prefix",                // or "suffix"
    modifierType: "increased",          // or "flat" — must match the id's suffix
    category: "offensive",              // offensive | defensive | attribute | utility
    applicableTo: ["allArmor", "ring"], // groups + specific slots, see EQUIPMENT_GROUPS
    displayFormat: "+{value}% Some Stat",
    isGlobalStat: true,                 // omit for local mods (statEffect required instead)
    weight: 800,                        // omit for default (1000)
    // restrictedToArmorType: "silk",   // optional — armor-base gate (ADR 0007). No-op on weapons/jewelry/tomes.
    // restrictedToImplicitMod: "intelligenceFlat", // optional — slot-conditional amulet gate (ADR 0007). No-op on non-amulet slots.
    tiers: createStandardTiers(5, 10, 30, 45), // (t10Min, t10Max, t1Min, t1Max)
},
```

The exact compile-checked shape lives in [`_examples/modifier-example.ts`](./_examples/modifier-example.ts) — if the playbook drifts, that sentinel fails `tsc` and forces a sync.

**No `name` field**. The magic-item compound name pulls from `lexicon.prefixForms` / `lexicon.suffixPhrases` (step 4 below) so EN/PT can have different forms with gender concord.

Local mods (the ones that mutate the item's own computed stats) need a `statEffect` declaration instead of `isGlobalStat: true`. See [statEffect](#stateffect-declarative-local-stats) for the target/operation table.

The modifier id ends in `Flat` / `Increase` / `More` — the suffix and `modifierType` must agree. See `CONTEXT.md` → Modifier ID Naming Convention.

**The generator will pick it up automatically** via the `MODIFIERS` spread in `src/game/items/data/modifiers/index.ts`. No registration needed.

## Step 2 — Add the id to the affix-type union

Open `src/game/items/data/modifiers/affix-ids.ts` and add your id to either `PrefixModifierId` or `SuffixModifierId` (matching its `affixType`).

```ts
export type PrefixModifierId = Extract<
	ModifierId,
	| "localDefenseFlat"
	// …existing…
	| "myNewStatIncrease" // add here
>;
```

This is what forces the lexicon to cover your mod — step 4 won't compile until you add the entry.

## Step 3 — Teach the stat engine to consume it (global mods only)

If it's a global mod (`isGlobalStat: true`), add a case in the `applyMod()` switch in `src/game/stats/compute.ts`:

```ts
case "myNewStatIncrease":
    stats.increased.someField += v;
    return;
```

If the field doesn't exist yet on `ComputedCharacterStats`, add it in `src/game/stats/types.ts` and default it in `blankStats()` in `compute.ts`.

If the mod affects damage calculations, also wire it through `rollPlayerSwing` in `src/game/combat/damage.ts` — the increased pools live in `stats.increased`.

**Local mods skip this step** — `statEffect` already tells the generator how to bake the value into the weapon's `computedStats`. Verify it's reflected in `src/game/items/generator.ts:computeWeaponStats` if you added a new `LocalStatTarget`.

## Step 4 — Add affix translations to both locales

The magic-item compound name (e.g. "Heavy Iron Sword") needs an entry per locale. Open both lexicon files:

**`src/game/items/lexicon/en.ts`** — `prefixForms` or `suffixPhrases`:

```ts
prefixForms: {
    // …existing…
    myNewStatIncrease: "Mighty",        // EN doesn't inflect
},
```

**`src/game/items/lexicon/pt.ts`** — same key:

```ts
prefixForms: {
    // …existing…
    myNewStatIncrease: { m: "Poderoso", f: "Poderosa" },
    // or just "do Poder" if the modifier is an invariant phrase, not an adjective
},
```

If TS errors at the lexicon Record — that means step 2 worked. Add the entry, error clears.

For **suffixes**, `suffixPhrases` takes a single string (no gender concord — suffixes anchor to their own noun: "da Rapidez" already carries "Rapidez"'s feminine "da"). Example: `"da Força"`.

## Step 5 — Add the tooltip-line translation

This is the OTHER i18n table. It controls how the mod renders inside the item tooltip — separate from the magic-name affix.

Open `src/game/items/mod-i18n.ts` and add to `PT_EXPLICIT_FORMATTERS`:

```ts
myNewStatIncrease: (m) => `+${m.value}% de Coisa`,
```

The format must mirror the `displayFormat` from step 1 semantically. EN renders automatically by interpolating `displayFormat` — no entry needed there.

If your mod can appear as an **implicit** on a template (uncommon — implicits come from templates, not affix rolls), add a regex pattern to `PT_IMPLICIT_PATTERNS` matching the literal EN displayFormat.

## Step 6 — Verify

```bash
npx tsc --noEmit
npx vitest run src/game/items/generator.test.ts
npx vitest run src/game/stats/compute.test.ts
npx vitest run src/game/items/item-name.test.ts
```

Tests will catch:

- "no decimals in rolled values"
- "prefix/suffix limits per rarity"
- "magic items compose with the right affix order"
- Stat engine: missing `applyMod` case
- Item naming: gender concord on adjective modifiers
- Generator: spell-weapon exclusions, attack-weapon computed stats, armor defense by base, shields, jewelry eligibility, implicits, tier scaling

If the mod is balance-sensitive (premium weight, exclusive slot), drop in a `weight: N` comment explaining the rationale — future agents won't know.

## Step 7 — Test the drop visually

Run `npm run dev`, create or load a character, retreat from a zone with items in the bag, open the loot picker. Verify:

1. The mod shows on dropped items with the right localized line in the tooltip body (step 5)
2. Magic items that roll this mod get the right compound name in both locales (step 4) — e.g. "Mighty Iron Sword" / "Espada de Ferro Poderosa"
3. Toggle PT↔EN via Settings — both renderings flip cleanly

## Reminder: why two i18n entries per modifier

There are two unrelated displays of the same modifier:

- **Magic item compound name** (`lexicon.prefixForms` / `suffixPhrases`) — "Heavy Iron Sword". One word, anchored to a noun, needs gender concord in PT.
- **Tooltip mod line** (`mod-i18n.ts:PT_EXPLICIT_FORMATTERS`) — "+15 Physical Damage to Attacks". Full sentence with the rolled value interpolated.

Both keyed by the same `modifierId`. Forgetting one renders the affix as a raw id string in that surface. See `docs/playbooks/i18n-which-system.md` for the broader i18n decision tree.

## Reference

### Local vs global

- **Local mods** change the item's own header stats (weapon damage, armor value, block). They declare a `statEffect`; `isGlobalStat` is omitted or `false`. The generator bakes them into `computedStats` / `computedDefenseStats`.
- **Global mods** add to the character's totals through the stat engine (`applyMod()` in `src/game/stats/compute.ts`). They set `isGlobalStat: true` and have no `statEffect`.

### statEffect (declarative local stats)

`LocalStatTarget` and `StatEffect` live in `src/game/items/types/mods.ts`. `computeWeaponStats` and `computeArmorStats` in `src/game/items/generator.ts` apply them:

| target              | operation     | What it does                                                                                                  |
| ------------------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| `"physicalDamage"`  | `"flat"`      | Adds to both min and max damage                                                                               |
| `"physicalDamage"`  | `"increased"` | Multiplies physical damage by `(1 + value/100)`                                                               |
| `"attackSpeed"`     | `"increased"` | Multiplies attack speed by `(1 + value/100)`                                                                  |
| `"criticalChance"`  | `"increased"` | Multiplies crit chance by `(1 + value/100)`, not flat additive                                                |
| `"elementalDamage"` | `"flat"`      | Adds an elemental damage line. Requires `element: "Cold"` etc.                                                |
| `"defense"`         | `"flat"`      | Adds flat defense, resolved to armor / evasion / barrier by the base's `armorType`                            |
| `"defense"`         | `"increased"` | Multiplies defense by `(1 + value/100)`                                                                       |
| `"blockChance"`     | `"increased"` | Shields only. Adds percentage points to the base block chance (additive across base, implicits and explicits) |

A new target: add it to `LocalStatTarget`, then handle it in `computeWeaponStats` or `computeArmorStats`. That is the only reason to touch `generator.ts` when adding a mod.

### Equipment groups (applicableTo)

Defined in `src/game/items/types/base.ts` → `EQUIPMENT_GROUPS`. Adding a slot to a group adds it to every mod that uses the group.

| Group                | Expands to                                              |
| -------------------- | ------------------------------------------------------- |
| `"allArmor"`         | helmet, chestplate, boots, gloves                       |
| `"allJewelry"`       | ring, amulet, belt                                      |
| `"allAttackWeapons"` | sword, greatsword, dagger, bow, axe, mace, twoHandedAxe |

Mix groups with single types freely: `["allAttackWeapons", "helmet", "gloves", "ring"]`. Spell weapons (staff, wand) are in no group: they never roll local attack mods and roll flat spell damage instead (`CONTEXT.md` → Weapon Types).

### Tiers

- `createStandardTiers(t10Min, t10Max, t1Min, t1Max)` builds 10 tiers and interpolates linearly between them. Tier 10 covers ilvl 1–10, tier 1 covers ilvl 91–100.
- Values are rounded to integers. A test fails on any decimal.
- Epic items clamp every roll to tier 4 or better.

### Rarity limits

`MOD_LIMITS` in `src/game/items/types/item.ts`:

| Rarity    | Explicits | Max prefix | Max suffix |
| --------- | --------- | ---------- | ---------- |
| normal    | 0         | 0          | 0          |
| magic     | 1–2       | 2          | 2          |
| rare      | 3–4       | 2          | 2          |
| legendary | 5         | 3          | 3          |
| epic      | 6         | 3          | 3          |
| unique    | 0         | 0          | 0          |

Epic is the top rolled rarity. `unique` is for handcrafted entities (act bosses today): its stats are declared, never rolled.

### How the mod shows in the tooltip

- The generator sorts explicits: prefixes first (increased, then flat), then suffixes (increased, then flat).
- Mod lines and the header stats a local mod changed render in the magic blue (`RARITY_COLORS.magic`, `#8888ff`).
- Only an `increased` local mod gets the `(Local)` tag. Nothing is ever tagged `(Global)`.
