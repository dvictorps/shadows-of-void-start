# Shadows of Void — Project Guidelines

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS + TanStack Router
- **Backend:** Convex (database + auth)
- **Build:** Vite + Biome (lint/format) + Vitest (testing)
- **Path alias:** `#/*` → `./src/*`

## Game Context

ARPG with automatic/stat-check combat. No projectile speed, no area of effect. Players gear up and the stat engine resolves encounters. Loot is the core loop — items must feel rewarding and balanced.

---

## Item Generator System

All item generation code lives in `src/game/items/`. The tooltip component is at `src/components/game/ItemTooltip.tsx`.

### File Structure

```
src/game/items/
├── types/
│   ├── base.ts          # Equipment, weapon, armor types, equipment groups, BaseStatKey
│   ├── mods.ts          # Modifier interface, tiers, StatEffect, weight
│   ├── item.ts          # GeneratedItem, RolledMod, rarity, computed stats
│   └── index.ts         # Re-exports
├── data/
│   ├── modifiers/       # Modifier definitions (one file per category)
│   │   ├── weapon-damage.ts   # Local attack mods + accuracy/crit mult
│   │   ├── spell-damage.ts    # Flat spell damage (staff/wand only)
│   │   ├── global-damage.ts   # Global % damage, attack/cast speed, global crit
│   │   ├── defense.ts         # Local defense, global defense, life/mana, regen, thorns, block
│   │   ├── resistances.ts     # Cold/fire/lightning/void resistance
│   │   ├── attributes.ts      # Str/dex/int
│   │   ├── utility.ts         # Movement speed, leech, stun, light radius
│   │   ├── magic-find.ts      # Item rarity (prefix + suffix)
│   │   └── index.ts           # Aggregates all modifiers into MODIFIERS, exports helpers
│   └── templates.ts     # Equipment base templates (weapons, armor, jewelry)
├── generator.ts         # Item generation logic (public API: generateItem())
└── generator.test.ts    # 71 tests
```

### How to Add a New Modifier

1. **Pick the right file** in `data/modifiers/` by category
2. **Define the modifier** with all required fields:

```ts
myNewMod: {
    id: "myNewMod",
    name: "Prefix Name" | "of Suffix Name",
    affixType: "prefix" | "suffix",
    modifierType: "flat" | "increased",
    category: "offensive" | "defensive" | "attribute" | "utility",
    applicableTo: ["allArmor", "allJewelry"],  // use groups when possible
    displayFormat: "+{value} Some Stat",
    isGlobalStat: true,        // omit for local mods
    statEffect: { ... },       // required for local mods (see below)
    weight: 800,               // omit for default (1000)
    tiers: createStandardTiers(tierT10Min, tierT10Max, tierT1Min, tierT1Max),
},
```

3. **That's it.** The generator picks it up automatically via the `MODIFIERS` spread in `index.ts`.

You do NOT need to touch `generator.ts` unless you're adding a new `LocalStatTarget`.

### Local vs Global

- **Local mods** affect the item's header stats (weapon damage, armor value). They need a `statEffect` declaration. `isGlobalStat` is omitted or `false`.
- **Global mods** affect the character's total stats (handled by the stat engine, not the item generator). They have `isGlobalStat: true` and no `statEffect`.

### statEffect (Declarative Local Stats)

Local mods declare what they do via `statEffect` so the generator applies them automatically:

| target | operation | What it does |
|---|---|---|
| `"physicalDamage"` | `"flat"` | Adds value to both minDamage and maxDamage |
| `"physicalDamage"` | `"increased"` | Multiplies physical damage by `(1 + value/100)` |
| `"attackSpeed"` | `"increased"` | Multiplies attack speed by `(1 + value/100)` |
| `"criticalChance"` | `"increased"` | Multiplies crit chance by `(1 + value/100)` — NOT flat additive |
| `"elementalDamage"` | `"flat"` | Adds a new elemental damage line. Requires `element: "Cold"` etc. |
| `"defense"` | `"flat"` | Adds flat defense (resolved to armor/evasion/barrier by armorType) |
| `"defense"` | `"increased"` | Multiplies defense by `(1 + value/100)` |

To add a new stat target (e.g., `"blockChance"`), add it to `LocalStatTarget` in `types/mods.ts` and handle it in `computeWeaponStats` or `computeArmorStats` in `generator.ts`.

### Equipment Groups (applicableTo)

Use groups instead of listing individual slots:

| Group | Expands to |
|---|---|
| `"allArmor"` | helmet, chestplate, boots, gloves |
| `"allJewelry"` | ring, amulet, belt |
| `"allAttackWeapons"` | sword, greatsword, dagger, bow, axe, mace, twoHandedAxe |

Groups are defined in `types/base.ts` → `EQUIPMENT_GROUPS`. Adding a new equipment slot to a group automatically includes it in all modifiers using that group.

You can mix groups with individual types: `["allAttackWeapons", "helmet", "gloves", "ring"]`

### Modifier Weight

Controls how likely a mod is to roll. Default is `1000`. Higher = more common.

| Weight | Meaning | Examples |
|---|---|---|
| 2000 | Very common (bad mod) | Light Radius |
| 1500-1800 | Common (filler) | Thorns, Stun Duration |
| 1000 | Standard (default) | Most mods |
| 500-600 | Uncommon (good) | Attack Speed, Crit Chance, Life |
| 400 | Rare (premium) | Life Leech |

### Tier System

- 10 tiers, gated by item level (tier 10 = ilvl 1-10, tier 1 = ilvl 91-100)
- `createStandardTiers(t10Min, t10Max, t1Min, t1Max)` interpolates linearly
- All values are integers (no decimals)

### Rarity System

| Rarity | Explicits | Max Prefix | Max Suffix |
|---|---|---|---|
| normal | 0 | 0 | 0 |
| magic | 1-2 | 2 | 2 |
| rare | 3-4 | 2 | 2 |
| legendary | 5 | 3 | 3 |
| epic | 6 | 3 | 3 |

Epic is the highest tier (above legendary).

### Weapon Types

- **Attack weapons** (sword, greatsword, dagger, bow, axe, mace, twoHandedAxe): compute header stats, roll local attack mods
- **Spell weapons** (staff, wand): header shows only base crit chance, never roll local attack mods, roll spell damage flat mods instead

### Typed Base Stats

`baseStats` uses `Partial<Record<BaseStatKey, number>>` where `BaseStatKey` = `"minDamage" | "maxDamage" | "attackSpeed" | "criticalChance" | "armor" | "evasion" | "barrier"`. Typos are caught at compile time.

### Tooltip Display Rules

- Modified stats (by local mods) display in blue `#8888ff`
- Only `increased` local mods show a `(Local)` label. Never show `(Global)`.
- Explicits sorted: prefixes first (increased → flat), then suffixes (increased → flat)
- Legendary = crimson `#dc143c` with glow. Epic = green `#1eff00` with glow.
- Rare+ get corner ornaments. Legendary/Epic get accent line at top.

### Tests

Run with `npx vitest run src/game/items/generator.test.ts`. Tests cover:
- Mod counts per rarity, prefix/suffix limits, no duplicates
- Integer values only (no decimals)
- Spell weapon exclusions, attack weapon computed stats
- Armor defense resolution, shield handling
- Jewelry eligibility, implicits
- Tier system scaling

### Design Decisions (Do Not Change Without Discussion)

- `increased` crit chance is **multiplicative** (`base × (1 + inc/100)`), not flat additive
- `% max life` and `% max mana` mods were intentionally removed — reserved for future power creep
- Global attack speed does NOT roll on weapons — only jewelry and gloves
- `localDefenseFlat`/`localDefenseIncrease` use a generic "Defense" display that resolves to Armor/Evasion/Barrier based on the armor's base type at roll time
- The `"more"` modifier type exists in the type system but is unused — reserved for skills
