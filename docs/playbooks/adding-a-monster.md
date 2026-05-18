# Adding a monster

A monster is a mob template with base stats, an emoji, an XP reward, and the rarities it can spawn at.

## Step 1 — Define the monster

Open `src/game/monsters/data.ts`. Add an entry to `MONSTERS`:

```ts
my_new_mob: {
    id: "my_new_mob",
    name: "Stone Goblin",
    emoji: "🗿",
    baseStats: {
        hp: 18,
        attackSpeed: 0.9,
        minDamage: 3,
        maxDamage: 6,
    },
    xpReward: 12,
    allowedRarities: ["normal", "magic"],   // rare is reserved for minibosses
},
```

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

## Step 3 — Localize the name (if it's user-facing in any new context)

`MONSTERS[id].name` is currently the canonical English fallback. The name field is shown directly in the enemy nameplate during combat (see `CombatScene.tsx`).

If you want a different name in Portuguese, check `messages/pt.json` and `messages/en.json` for a `monster_*` key pattern. Add a new key (e.g. `monster_stone_goblin`) and route it via the appropriate i18n switch in the UI. Today only `monster_goblin` is i18n'd — you can either follow that pattern or update the schema to look up monster names by key.

For an MVP test mob, leaving the name as the data-file `name` is fine — it just won't translate.

## Step 4 — Verify

```bash
npx tsc --noEmit
npx vitest run
```

Then enter the zone in `npm run dev` and confirm the new monster shows up. Note the mob roll is uniformly random across `monsterPool` — to verify rare monsters in a pool, you may need to retry a few times.

## Gotcha: damage balance

Monster damage is raw. There's no formula scaling it against zone level or player armor today (player armor mitigates via `applyArmor` in `damage.ts`, but the input is just `randInt(minDamage, maxDamage)`). Pick values relative to neighboring mobs in the same zone, not against player HP.

A zone-level-2 mob shouldn't deal more than ~10 damage on average to a starter character (max HP ~100, no defenses).
