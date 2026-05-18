# Adding an equipment template

A "template" is a base item — a tier of sword, a base of helmet. Templates carry baseline stats (damage range, attack speed for weapons; defense value for armor), level + attribute requirements, and any implicits (free stats that always roll on this base).

## Decide first

1. **What slot?** Weapon (which type — sword/dagger/staff/etc), helmet, chestplate, boots, gloves, ring, amulet, belt, offhand (shield).
2. **What tier slot in the ladder?** Templates ladder by ilvl gating. Pick the next sequential id (`rusty_sword`, `iron_sword`, `steel_sword`, ...).
3. **For armor: what base type?** plate / leather / silk — determines whether `localDefenseFlat` resolves to armor / evasion / barrier (see `CONTEXT.md` → Armor Bases).
4. **Requirements?** Level + str/dex/int. Look at neighboring templates for the same type to keep the curve consistent.
5. **Implicits?** Most don't have any. Jewelry (rings, amulets) often does — usually a resistance or attribute roll. See `src/game/items/data/templates/rings.ts` for examples.

## Step 1 — Add the template

Open the right file under `src/game/items/data/templates/`. One file per category:

| Slot | File |
|---|---|
| sword | `swords.ts` |
| dagger | `daggers.ts` |
| axe | `axes.ts` |
| mace | `maces.ts` |
| greatsword | `greatswords.ts` |
| twoHandedAxe | `two-handed-axes.ts` |
| bow | `bows.ts` |
| staff | `staves.ts` |
| wand | `wands.ts` |
| helmet | `helmets.ts` |
| chestplate | `chestplates.ts` |
| boots | `boots.ts` |
| gloves | `gloves.ts` |
| shield | `shields.ts` |
| ring | `rings.ts` |
| amulet | `amulets.ts` |
| belt | `belts.ts` |

Add an entry to the exported array:

```ts
{
    id: "iron_sword",                  // unique across all templates
    name: "Iron Sword",
    equipmentType: "weapon",
    weaponType: "sword",               // weapons only
    armorType: "plate",                // armor only
    minItemLevel: 8,                   // first ilvl this can drop at
    maxItemLevel: 12,                  // last ilvl this can drop at
    baseStats: {
        minDamage: 5,
        maxDamage: 10,
        attackSpeed: 1.4,
        criticalChance: 6,             // weapons only — armor uses { armor, evasion, barrier }
    },
    requirements: { level: 8, str: 16, dex: 16 },
    implicits: [],                     // or [{ displayFormat: "+{value}% Cold Resistance", minValue: 15, maxValue: 25 }]
},
```

The generator picks templates from `src/game/items/data/templates/index.ts` — the spread is automatic, no registration needed.

## Step 2 — Verify ilvl bands

Templates of the same type form a ladder. Check that `minItemLevel`/`maxItemLevel` bands don't overlap with siblings or leave gaps — the generator picks the matching template per drop ilvl, and an unmatched ilvl crashes the roll.

Quick sanity check:

```bash
npx vitest run src/game/items/generator.test.ts
```

The generator tests roll thousands of items and would catch a gap.

## Step 3 — Implicit i18n (if you added one)

If your template has implicits with English `displayFormat` strings, check `src/game/items/mod-i18n.ts:PT_IMPLICIT_PATTERNS`. If your implicit pattern isn't already covered there, add a regex + render function:

```ts
{
    test: /^\+\d+ Maximum Mana$/i,
    render: (v) => `+${v} de Mana Máxima`,
},
```

Implicits don't have modifier ids — the matcher works on the literal English string.

## Step 4 — Verify

```bash
npx tsc --noEmit
npx vitest run
npx biome check src/
```

Open the admin items panel if you have admin role (`/admin/items`) and roll a few drops at your template's ilvl band to eyeball the result.

## Gotcha: requirement curves

Look at the existing curve before picking your numbers. For example:

- Swords requirement curve: STR + DEX both, starting (10, 10) at level 1, scaling to (~112, 112) at level 80
- Axes: STR only, (15) at level 1, (~140) at level 80
- Wands: INT only, (10) at level 1, (~138) at level 80

A new tier 5 sword should sit between tier 4 and tier 6 cleanly — about (25, 25) STR/DEX. Don't make up numbers; interpolate from siblings.
