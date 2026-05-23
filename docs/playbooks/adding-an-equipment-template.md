# Adding an equipment template

A "template" is a base item — a tier of sword, a base of helmet. Templates carry baseline stats (damage range, attack speed for weapons; defense value for armor), level + attribute requirements, and any implicits (free stats that always roll on this base).

Names are **not** stored on the template itself — they're composed at display time from a `(nameBase, nameModifier)` tuple by the lexicon system. See `src/game/items/lexicon/`.

## Decide first

1. **What slot?** Weapon (which type — sword/dagger/staff/etc), helmet, chestplate, boots, gloves, ring, amulet, belt, offhand (shield), tome, quiver.
2. **What tier slot in the ladder?** Templates ladder by `dropLevel`. Pick the next sequential id (`sword_t1`, `sword_t2`, …).
3. **For armor: what base type?** `plate` / `leather` / `silk` — determines whether `localDefenseFlat` resolves to armor / evasion / barrier (see `CONTEXT.md` → Armor Bases).
4. **Requirements?** Level + str/dex/int. Look at neighboring templates for the same type to keep the curve consistent.
5. **Implicits?** Most don't have any. Jewelry (rings, amulets) often does — usually a resistance or attribute roll. See `src/game/items/data/templates/rings.ts` for examples.
6. **What name?** Decide the `(nameBase, nameModifier)` tuple. **Both must already exist** in `src/game/items/lexicon/template-ids.ts`. If you need a new base noun or modifier, see "Step 4 — Adding a new base or modifier" below.

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
| tome | `tomes.ts` |
| quiver | `quivers.ts` |
| ring | `rings.ts` |
| amulet | `amulets.ts` |
| belt | `belts.ts` |

Add an entry to the exported array:

```ts
{
    id: "sword_t5",                     // unique across all templates
    nameBase: "sword",                  // TemplateBaseId — must exist in lexicon
    nameModifier: "war",                // TemplateModifierId | null — must exist in lexicon if non-null
    equipmentType: "weapon",
    weaponType: "sword",                // weapons only
    armorType: "plate",                 // armor only
    dropLevel: 14,                      // ilvl at which this can first drop
    baseStats: {
        minDamage: 14,
        maxDamage: 32,
        attackSpeed: 1.5,
        criticalChance: 5,              // weapons only — armor uses { armor, evasion, barrier }
    },
    requirements: { level: 14, str: 28, dex: 28 },
    implicits: [
        {
            modifierId: "accuracyFlat",
            displayFormat: "+{value} Accuracy Rating",
            minValue: 130,
            maxValue: 180,
        },
    ],
},
```

The exact compile-checked shape lives in [`_examples/template-example.ts`](./_examples/template-example.ts) — if the playbook drifts, that sentinel fails `tsc` and forces a sync.

`nameBase` and `nameModifier` are checked against the literal unions in `src/game/items/lexicon/template-ids.ts`. A typo or unknown id fails at compile time — you don't need to memorize them, just try and let TS guide you.

The generator picks templates from `src/game/items/data/templates/index.ts` — the spread is automatic, no registration needed.

### Programmatic templates (tome / quiver)

`tomes.ts` and `quivers.ts` build their `EquipmentTemplate[]` by `.map()`-ing over a `TomeTierSpec[]` / `QuiverTierSpec[]`. The `nameModifier` for each tier is pulled from a `TOME_MODIFIERS` / `QUIVER_MODIFIERS` array. If you add a new tier, append to **both** the spec array and the modifier array (TS will tell you if the lengths drift).

## Step 2 — Verify the dropLevel ladder

Templates of the same type form a ladder. Check that `dropLevel` is sequential with siblings — the loot roller picks all templates with `dropLevel <= itemLevel`, so a gap doesn't crash, but a tier that's much weaker than its sibling at the same drop level dilutes the rare-quality pool.

Quick sanity check:

```bash
npx vitest run src/game/items/generator.test.ts
```

The generator tests roll thousands of items and would catch a wiring break.

## Step 3 — Implicit i18n (if you added one)

If your template has implicits with English `displayFormat` strings, check `src/game/items/mod-i18n.ts:PT_IMPLICIT_PATTERNS`. If your implicit pattern isn't already covered there, add a regex + render function:

```ts
{
    test: /^\+\d+ to Maximum Mana$/i,
    render: (v) => `+${v} de Mana Máxima`,
},
```

Implicits don't have modifier ids on `RolledImplicit` — the matcher works on the literal English string. New patterns are easy to miss; if you ship without one, the implicit renders in English in PT mode.

## Step 4 — Adding a new base or modifier (if needed)

If your template needs a `nameBase` or `nameModifier` that doesn't exist yet:

1. Add the id (snake_case) to the appropriate union in `src/game/items/lexicon/template-ids.ts`.
2. Add a `bases` entry to **both** `src/game/items/lexicon/en.ts` and `src/game/items/lexicon/pt.ts`. PT entries set `gender: "m" | "f"`.
3. Add a `modifiers` entry to both. PT can be a plain string (invariant phrase like `"de Ferro"`) or `{ m, f }` for adjectives that inflect with the base.
4. TS will tell you if you forgot any of the three (the lexicon Records require literal-union coverage).

Naming guide:
- Materials → snake_case noun (`iron`, `copper`, `bronze`, `oak`, `silk`)
- Possessives → snake without apostrophe (`soldiers`, `knights`, `hunters`)
- Adjectives that inflect → snake_case adjective (`hallowed`, `runed`, `void_touched`)

## Step 5 — Verify

```bash
npx tsc --noEmit
npx vitest run
npx biome check src/
```

Open the admin items panel if you have admin role (`/admin/items`) and roll a few drops at your template's `dropLevel` to eyeball the display name in both EN and PT (toggle via Settings).

## Gotchas

### Requirement curves
Look at the existing curve before picking your numbers. For example:

- Swords: STR + DEX both, starting (10, 10) at level 1, scaling to (~112, 112) at level 80
- Axes: STR only, starting (15), scaling to (~140) at level 80
- Wands: INT only, starting (10), scaling to (~138) at level 80

A new tier-5 sword should sit between tier-4 and tier-6 cleanly — about (28, 28) STR/DEX. Don't make up numbers; interpolate from siblings.

### Display name fallback
If `nameBase` or `nameModifier` resolves to a lexicon entry that doesn't exist (shouldn't happen with the literal unions, but possible via casts), the renderer falls back to the `templateId` string. If you see a raw `sword_t5` in the tooltip during testing, that's the signal — fix the lexicon entry.
