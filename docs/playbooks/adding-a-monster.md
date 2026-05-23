# Adding a monster

A monster is a mob template with base stats, a sprite path, an XP reward, and the rarities it can spawn at.

## Step 1 — Define the monster

Open `src/game/monsters/data.ts`. Add an entry to `MONSTERS`:

```ts
stone_goblin: {
    id: "stone_goblin",
    name: "Stone Goblin",                                  // canonical English fallback
    sprite: "/assets/sprites/criaturas/goblin.png",        // public asset path
    baseStats: {
        hp: 18,
        attackSpeed: 0.9,
        physicalDamage: { min: 3, max: 6 },                // {min, max} object, not flats
        elementalDamage: [],                               // entries: { element, min, max }
    },
    xpReward: 12,
    allowedRarities: ["normal"],                           // rare is reserved for minibosses
},
```

The exact compile-checked shape lives in [`_examples/monster-example.ts`](./_examples/monster-example.ts) — if the playbook drifts, that sentinel fails `tsc` and forces a sync.

The `MonsterId` type derives from the keys of `MONSTERS` (`keyof typeof MONSTERS`), so the id strings get type-checked everywhere automatically — you'll see compile errors at zone declarations that reference the new id once it's added.

## Step 2 — Add to a zone's monster pool

Open `src/game/world/act-1.ts` (or whichever act you're populating). Find the zone where the monster should spawn and add the id to `monsterPool`:

```ts
{
    id: "starter_forest",
    name: "Floresta Inicial",
    kind: "combat",
    monsterPool: ["goblin", "my_new_mob"],
    level: 2,
    ...
}
```

## Step 3 — Localize the name

`MONSTERS[id].name` is the canonical English fallback shown when no locale entry exists. The actual combat nameplate goes through `translateMonsterName` in `src/game/world/i18n.ts`, which looks up the id in the `MONSTER_I18N` table and falls back to `def.name` for misses.

To wire the localization:

1. Add `monster_<id>` keys to **both** `messages/pt.json` and `messages/en.json` (e.g. `monster_stone_goblin`).
2. Add an entry to the `MONSTER_I18N` table in `src/game/world/i18n.ts`:

```ts
const MONSTER_I18N: Record<MonsterId, () => string> = {
    // …existing…
    stone_goblin: m.monster_stone_goblin,
};
```

`MONSTER_I18N` is typed `Record<MonsterId, …>`, so omitting the new id is a compile error — you can't ship a mob with a missing translation entry.

If the monster will also roll as magic/rare, it needs gendered lexicon entries in `src/game/world/lexicon/{en,pt}.ts` for the adjective concord on its mod-name compound. See [`i18n-which-system.md`](./i18n-which-system.md) for the decision tree.

## Step 4 — Verify

```bash
npx tsc --noEmit
npx vitest run
```

Then enter the zone in `npm run dev` and confirm the new monster shows up. Note the mob roll is uniformly random across `monsterPool` — to verify rare monsters in a pool, you may need to retry a few times.

## Gotcha: damage balance

Monster damage scales against zone level via `scaleMonsterStats` in `src/game/monsters/scaling.ts`, but the raw `baseStats.physicalDamage.{min,max}` are the unscaled inputs. Player armor mitigates via `applyArmor` in `damage.ts`. Pick base damage relative to neighboring mobs in the same zone, not against player HP.

A zone-level-2 mob shouldn't deal more than ~10 damage on average to a starter character (max HP ~100, no defenses).

## Gotcha: spell monsters

A monster that only hits with elements (e.g. `lich`, `olho_do_vazio`) sets `physicalDamage: { min: 0, max: 0 }` and populates `elementalDamage`. The combat engine still pipes both through the same path — no special-case branch needed.
