# Adding a class

A class is a playable character archetype with starting attributes, starter equipment, and i18n'd name + description. Classes are otherwise mechanically identical today (passive tree + active skills are out of scope until those systems land).

## Step 1 — Define the class

Open `src/game/classes/data.ts`. Add an entry to `CLASS_DEFINITIONS`:

```ts
templar: {
    id: "templar",
    name: "Templar",
    description: "Sacred warrior who channels divine power into martial discipline.",
    primaryAttribute: "strength",
    baseStats: {
        hp: 80,
        barrier: 10,
        attributes: { strength: 8, dexterity: 4, intelligence: 8 },
    },
},
```

The exact compile-checked shape lives in [`_examples/class-example.ts`](./_examples/class-example.ts) — if the playbook drifts, that sentinel fails `tsc` and forces a sync. (The sentinel reuses an existing class id so it compiles without modifying the `CharacterClassId` union.)

`CharacterClassId` is a hand-maintained closed union in `types.ts` (`"warrior" | "mage" | "rogue"`). To register a new class, add the id to that union first — every consumer (starter-gear map, class-name i18n maps in step 4) will then fail compile until you wire it through.

## Step 2 — Hook up the starter weapon

Open `src/game/items/starter-gear.ts`:

1. Define the starter weapon item (follow the existing `rustySword` / `rustyDagger` / `crackedWand` shape — pre-rolled, no requirements, namespaced `starter:` id):

```ts
const blessedHammer: GeneratedItem = {
    id: "starter:blessed_hammer",
    templateId: "blessed_hammer",
    templateName: "Blessed Hammer",
    equipmentType: "weapon",
    weaponType: "mace",
    rarity: "normal",
    name: "Blessed Hammer",
    itemLevel: 1,
    baseStats: { minDamage: 2, maxDamage: 6, attackSpeed: 1.1, criticalChance: 5 },
    implicits: [],
    explicits: [],
    // computedStats mirrors baseStats since starters have no rolled mods.
    computedStats: {
        physicalDamage: { min: 2, max: 6 },
        elementalDamage: [],
        attackSpeed: 1.1,
        criticalChance: 5,
    },
};
```

2. Register it in `STARTER_ITEMS` and `STARTER_WEAPON_BY_CLASS`:

```ts
const STARTER_ITEMS = {
    ...
    "starter:blessed_hammer": blessedHammer,
};

export const STARTER_WEAPON_BY_CLASS = {
    warrior: "starter:rusty_sword",
    rogue: "starter:rusty_dagger",
    mage: "starter:cracked_wand",
    templar: "starter:blessed_hammer",
};
```

The character creation mutation (`convex/characters.ts:create`) reads `STARTER_WEAPON_BY_CLASS[classId]` and inserts it as the equipped weapon. No convex changes needed.

## Step 3 — Localize the class name + description

`messages/pt.json` + `messages/en.json`:

```json
"class_templar_name": "Templário",
"class_templar_description": "Guerreiro sagrado que canaliza poder divino em disciplina marcial."
```

(EN file gets the English versions.)

## Step 4 — Wire the i18n maps

Three places consume the class i18n today:

1. **`src/components/CreateCharacterModal.tsx`** — `CLASS_NAME`, `CLASS_DESCRIPTION`, and `CLASS_LIST` const arrays. Add `templar` to `CLASS_LIST` and to both maps.
2. **`src/components/world/StatusCard.tsx`** — `CLASS_NAME` map. Add the templar entry.
3. **`src/routes/character-select.tsx`** — `CLASS_NAME` map at the top of the file. Add templar.

TS will flag any of these you miss — `Record<CharacterClassId, () => string>` requires every key be present.

## Step 5 — Verify

```bash
npx tsc --noEmit
npx vitest run
npx biome check src/
```

Then `npm run dev`, open the character-select modal, scroll the class list, verify:
- Name renders in PT and EN (toggle locale via settings modal).
- Description renders correctly.
- After creating, the starter weapon shows in the paper doll and the items table query returns it as equipped.

## Future: per-class identity

The class system today is **starting attributes + starter weapon** only. When passive trees and active skills land, each class gets a passive tree branch and 1-3 starter skills — that work hasn't started yet and is tracked in [`docs/plans/in-progress.md`](../plans/in-progress.md).
