# Adding a modifier

A "modifier" is a rolled affix on a generated item — e.g. "+15 Strength", "+20% Increased Fire Damage". Adding one touches 4-5 files in predictable spots. Two of those are i18n tables that must stay in sync — TypeScript catches missing entries via literal-union Records.

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

Local mods (the ones that mutate a weapon's `computedStats`) need a `statEffect` declaration instead of `isGlobalStat: true`. See CLAUDE.md "statEffect" for the target/operation table.

The modifier id ends in `Flat` / `Increase` / `More` — the suffix and `modifierType` must agree. See `CONTEXT.md` → Modifier ID Naming Convention.

**The generator will pick it up automatically** via the `MODIFIERS` spread in `src/game/items/data/modifiers/index.ts`. No registration needed.

## Step 2 — Add the id to the affix-type union

Open `src/game/items/data/modifiers/affix-ids.ts` and add your id to either `PrefixModifierId` or `SuffixModifierId` (matching its `affixType`).

```ts
export type PrefixModifierId = Extract<
    ModifierId,
    | "localDefenseFlat"
    // …existing…
    | "myNewStatIncrease"               // add here
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
