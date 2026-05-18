# Adding a modifier

A "modifier" is a rolled affix on a generated item — e.g. "+15 Strength", "+20% Increased Fire Damage". Adding one touches 3-4 files in predictable spots.

## Decide first

Before writing code:

1. **Is it local or global?** Local mods affect the item's own computed stats (a weapon's `+X% Physical Damage` only buffs that weapon). Global mods sum into character totals and apply universally. See `CLAUDE.md` "Local vs Global" if you're unsure.
2. **Which category?** offensive / defensive / attribute / utility. Picks the file the new mod lives in.
3. **Which slots accept it?** Use the equipment groups (`allArmor`, `allJewelry`, `allAttackWeapons`) where possible — see `src/game/items/types/base.ts`. Mixing groups with specific slots is fine.
4. **What's its weight?** Default 1000. Higher = more common. Premium mods get 400-600, fillers get 1500-2000. See `CONTEXT.md` "Modifier Knobs" → Reference weights.
5. **What's its tier range?** 10 tiers gated by ilvl. `createStandardTiers(t10Min, t10Max, t1Min, t1Max)` interpolates linearly. Pick min/max values for the weakest tier and strongest tier.

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

Add an entry:

```ts
myNewMod: {
    id: "myNewMod",
    name: "Prefix Name" | "of Suffix Name",
    affixType: "prefix" | "suffix",
    modifierType: "flat" | "increased",
    category: "offensive" | "defensive" | "attribute" | "utility",
    applicableTo: ["allArmor", "ring"],  // groups + specifics, see EQUIPMENT_GROUPS
    displayFormat: "+{value} Some Stat",
    isGlobalStat: true,           // omit for local mods
    statEffect: { ... },          // REQUIRED for local mods — see CLAUDE.md
    weight: 800,                  // omit for default (1000)
    tiers: createStandardTiers(t10Min, t10Max, t1Min, t1Max),
},
```

The modifier id ends in `Flat` / `Increase` / `More` — the suffix and `modifierType` must agree. See `CONTEXT.md` → Modifier ID Naming Convention.

**The generator will pick it up automatically** via the `MODIFIERS` spread in `src/game/items/data/modifiers/index.ts`. No registration needed.

## Step 2 — Teach the stat engine to consume it (global mods only)

If it's a global mod (`isGlobalStat: true`), add a case in the `applyMod()` switch in `src/game/stats/compute.ts`:

```ts
case "myNewMod":
    stats.someField += v;
    return;
```

If the field doesn't exist yet on `ComputedCharacterStats`, add it in `src/game/stats/types.ts` and default it in `blankStats()` in `compute.ts`.

If the mod affects damage calculations, also wire it through `rollPlayerSwing` in `src/game/combat/damage.ts` — the increased pools live in `stats.increased`.

**Local mods skip this step** — `statEffect` already tells the generator how to bake the value into the weapon's `computedStats`. Verify it's reflected in `src/game/items/generator.ts:computeWeaponStats` if you added a new `LocalStatTarget`.

## Step 3 — Add Portuguese localization

Open `src/game/items/mod-i18n.ts` and add an entry to `PT_EXPLICIT_FORMATTERS`:

```ts
myNewMod: (v) => `+${v} de Coisa`,
```

The format must match the meaning of `displayFormat` from step 1. If your mod can appear as an **implicit** on a template, add a regex pattern to `PT_IMPLICIT_PATTERNS` too.

## Step 4 — Verify

```bash
npx tsc --noEmit
npx vitest run src/game/items/generator.test.ts
npx vitest run src/game/stats/compute.test.ts
```

Generator tests will catch:
- "no decimals in rolled values"
- "prefix/suffix limits per rarity"
- "Magic items don't exceed 2 mods"

Stat engine tests will catch missing `applyMod` case (the universal `globalDamageIncrease` was once removed for exactly this reason — see commit history).

If the mod is balance-sensitive (premium weight, exclusive slot), drop in a `weight: N` comment explaining the rationale — future agents won't know.

## Step 5 — Test the drop visually

Run `npm run dev`, create or load a character, retreat from a zone with items in the bag, open the loot picker. Verify the new mod shows on dropped items with the right localized text.
