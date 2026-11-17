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

## Step 2 — Hook up the starter gear

Open `src/game/items/starter-gear.ts`:

1. Define the starter weapon item (follow the existing `rustySword` / `rustyDagger` / `crackedWand` shape — pre-rolled, no requirements, namespaced `starter:` id):

```ts
const blessedHammer: GeneratedItem = {
	id: "starter:blessed_hammer",
	templateId: "blessed_hammer",
	nameBase: "mace",
	nameModifier: "blessed",
	equipmentType: "weapon",
	weaponType: "mace",
	rarity: "normal",
	itemLevel: 1,
	baseStats: {
		minDamage: 2,
		maxDamage: 6,
		attackSpeed: 1.1,
		criticalChance: 5,
	},
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

The name is rendered at display time from `nameBase` (a `TemplateBaseId`) and `nameModifier` (a `TemplateModifierId`), so both need entries in `src/game/items/lexicon/template-ids.ts` and the `en` / `pt` lexicons ([ADR 0003](../adr/0003-render-at-display-names.md)). `"blessed"` above is an example; add it, or reuse an existing modifier id.

2. Register it in `STARTER_ITEMS` (a `ReadonlyMap`) and `STARTER_WEAPON_BY_CLASS`:

```ts
const STARTER_ITEMS: ReadonlyMap<string, GeneratedItem> = new Map([
	["starter:rusty_sword", rustySword],
	// ...
	["starter:blessed_hammer", blessedHammer],
]);

export const STARTER_WEAPON_BY_CLASS = {
	warrior: "starter:rusty_sword",
	rogue: "starter:rusty_dagger",
	mage: "starter:cracked_wand",
	templar: "starter:blessed_hammer",
} satisfies Record<CharacterClassId, string>;
```

3. Add the class to `STARTER_CHESTPLATE_BY_CLASS`: a starter chestplate id (defined and registered in `STARTER_ITEMS` like the weapon, e.g. the rogue's `starter:tattered_leather_vest`), or `undefined` for none:

```ts
export const STARTER_CHESTPLATE_BY_CLASS = {
	warrior: undefined,
	rogue: "starter:tattered_leather_vest",
	mage: undefined,
	templar: undefined,
} satisfies Record<CharacterClassId, string | undefined>;
```

Both maps are `satisfies Record<CharacterClassId, …>`, so a class id missing from either fails `tsc`. Character creation (`characters.create` → `planNewCharacter` in `src/game/classes/new-character.ts`) reads both maps and inserts the weapon and, if any, the chestplate as equipped. No server changes needed.

## Step 3 — Localize the class name + description

`messages/pt.json` + `messages/en.json`:

```json
"class_templar_name": "Templário",
"class_templar_description": "Guerreiro sagrado que canaliza poder divino em disciplina marcial."
```

(EN file gets the English versions.)

## Step 4 — Wire the i18n maps

Two places hold the class i18n today:

1. **`src/game/classes/i18n.ts`** — the `CLASS_NAME` map behind `getClassDisplayName` (used by `StatusCard`, `CreateCharacterModal` and `character-select`). Add the templar entry.
2. **`src/components/CreateCharacterModal.tsx`** — `CLASS_DESCRIPTION` and `CLASS_LIST`. Add `templar` to both.

TS will flag any of these you miss — `Record<CharacterClassId, () => string>` requires every key be present.

## Step 5 — Verify

```bash
npx tsc --noEmit
npx vitest run
pnpm lint:errors
```

Then `pnpm dev`, open the character-select modal, scroll the class list, verify:

- Name renders in PT and EN (toggle locale via settings modal).
- Description renders correctly.
- After creating, the starter weapon shows in the paper doll and the items table query returns it as equipped.

## Future: per-class identity

The class system today is **starting attributes + starter weapon** only. When passive trees and active skills land, each class gets a passive tree branch and 1-3 starter skills — that work hasn't started yet and is tracked in [`docs/plans/passive-tree-and-skills.md`](../plans/passive-tree-and-skills.md).
