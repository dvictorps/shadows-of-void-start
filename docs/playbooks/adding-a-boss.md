# Adding a boss

A boss is a handcrafted single-identity enemy with `rarity: "unique"`. Bosses live in their own registry under `src/game/bosses/`, parallel to `MONSTERS` — they don't roll affixes, they declare their stat sheet on the template, and each one has its own configurable cinematic. See [ADR 0008](../adr/0008-boss-as-parallel-registry.md) for the rationale and [CONTEXT.md → Boss](../../CONTEXT.md) for the design rules.

## Step 1 — Declare the BossConfig

Create `src/game/bosses/<bossId>.ts`. Each boss is one file.

```ts
import type { BossConfig } from "./types";

export const SHADE_OF_THE_FIRST: BossConfig = {
    id: "shade_of_the_first",
    nameKey: "boss_shade_of_the_first_name",   // paraglide key (see Step 3)
    nameplateColor: "#aa66ff",                  // chosen per boss — distinct from rare yellow
    nameplateShadow:
        "0 0 22px rgba(170, 102, 255, 0.75), 0 2px 4px rgba(0, 0, 0, 0.9)",
    level: 30,                                  // fixed — overrides node level ±1 scaling
    template: {
        id: "shade_of_the_first",
        name: "Shade of the First",             // canonical fallback
        sprite: "/assets/sprites/bosses/shade.png",
        baseStats: {
            hp: 400,
            attackSpeed: 1.1,
            physicalDamage: { min: 0, max: 0 },
            elementalDamage: [{ element: "Cold", min: 18, max: 30 }],
            resistances: { cold: 50, fire: -25, lightning: 0, void: 0 },
        },
        xpReward: 90,
        allowedRarities: ["unique"],            // always — boss templates can't roll other rarities
    },
    cinematic: {
        spriteFadeInMs: 900,                    // boss-tunable; defaults to 900
        entrySfx: "bosses/shade.wav",           // path under public/assets/sounds/sfx/
        sfxBeatMs: 600,                         // pause between sfx + name reveal
        screenshake: { amplitudePx: 14, durationMs: 400 },
        deathSfx: "bosses/shadedead.wav",
    },
};
```

The exact compile-checked shape lives in [`_examples/boss-example.ts`](./_examples/boss-example.ts) — if the playbook drifts, that sentinel fails `tsc` and forces a sync.

**Resistance convention** — bosses always declare all four elements explicitly (the type allows `Partial`, but a hand-tuned boss should be deliberate about every slot). Negative values express vulnerability and are a boss-only convention.

## Step 2 — Register the boss

Open `src/game/bosses/data.ts`. Add to `BOSSES`:

```ts
import { GRALFOR } from "./gralfor";
import { SHADE_OF_THE_FIRST } from "./shade";
import type { BossConfig, BossId } from "./types";

export const BOSSES: Record<BossId, BossConfig> = {
    gralfor: GRALFOR,
    shade_of_the_first: SHADE_OF_THE_FIRST,
};
```

Also extend the `BossId` union in `src/game/bosses/types.ts`:

```ts
export type BossId = "gralfor" | "shade_of_the_first";
```

`BossId` is a hand-maintained literal union (not derived from the registry) so `WorldNode.bossNode.bossId` is type-checked at zone declarations.

## Step 3 — Localize the name (PoE-style unique convention)

Boss names go through paraglide like any other display string, **but** by convention the **proper-noun part stays identical across locales** — only the epithet translates. Like *Headhunter* in PoE staying *Headhunter* in every locale while *Kaom's Heart* becomes *Coração de Kaom*.

Add the key to **both** locales:

```jsonc
// messages/en.json
"boss_shade_of_the_first_name": "Shade of the First",

// messages/pt.json
"boss_shade_of_the_first_name": "Sombra do Primeiro",
```

Recompile paraglide:

```bash
npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide
```

`translateEnemyName` resolves bosses via `m[boss.nameKey]()` — no extra wiring required as long as the key follows the `boss_<id>_name` shape and exists in both locale files.

## Step 4 — Add the boss node to the act

Open the relevant act file (e.g. `src/game/world/act-1.ts`). Add a `kind: "boss"` node with a `bossNode` config:

```ts
{
    id: "shade_lair",
    name: "Lair of the First",
    kind: "boss",
    position: { x: 0.94, y: 0.6 },
    connections: [{ id: "previous_zone", distance: 5 }],
    level: 28,                                  // gauntlet rares scale against this; boss uses its own level
    gatedBy: ["previous_zone"],
    monsterPool: ["enemy_a", "enemy_b"],        // optional — see note below
    bossNode: {
        bossId: "shade_of_the_first",
        warmupSeconds: 30,                      // optional — calmaria/time-bar budget before the gauntlet
        gauntlet: {
            fights: 3,                          // 3 rares before the boss spawns
            monsterPool: ["enemy_a", "enemy_b"],
        },
    },
},
```

Add the zone name + description keys to both locale files (`zone_shade_lair`, `zone_shade_lair_description`).

**Which fields drive what (this trips people up):** spawns come from `bossNode.gauntlet.monsterPool` — that's the required one. The **node-level** `monsterPool` is *optional* and does NOT drive boss-node spawns; it feeds sprite preloading (`world.tsx` reads `currentNode.monsterPool`), so mirror the gauntlet pool there to avoid a sprite pop-in on the first rare. `warmupSeconds` (optional) becomes the calmaria/time-bar budget during the pre-gauntlet warmup; omit it and the boss node uses the default plan. There is no `encounterPlan` on a boss node — camps and ambushes are gated off automatically inside `kind: "boss"` nodes. (The real `gralfor` node in `act-1.ts` carries both `monsterPool` and `warmupSeconds`, so don't be surprised when you see them.)

## Step 5 — Drop in the assets

```
public/assets/sprites/bosses/<bossId>.png
public/assets/sounds/sfx/bosses/<bossId>.wav         # entry sfx
public/assets/sounds/sfx/bosses/<bossId>dead.wav     # death sfx
```

Paths in `BossConfig` are relative to `public/assets/sprites/` (for the template sprite — start with `/assets/sprites/bosses/...`) and `public/assets/sounds/sfx/` (for the cinematic sfx — `bosses/...`).

## Step 6 — Verify

```bash
npx tsc --noEmit
npx vitest run
```

Then in `npm run dev`:

1. Travel to the boss node (it appears on the map once `gatedBy` is satisfied).
2. Three rare fights play back-to-back; each runs the standard rare intro (sprite → name → HP).
3. After the third rare falls, the boss spawns with the 4-beat cinematic: sprite fade-in → sfx + screenshake → nameplate (in the boss's color) → HP bar → engagement.
4. The tooltip on hover shows the boss's stat sheet (resistances, damage breakdown), not an affix list.
5. Boss kill awards multi-item drops; the modal offers "continue farming" (restarts the gauntlet) or "retreat" (100% bag).

## Gotcha: incense is banned in boss nodes

The `useEtherealIncense` button is greyed out inside any `kind: "boss"` node — server-side too. Per CONTEXT.md → Incenso Etéreo. No code change needed when adding a new boss; the gate keys off `node.kind`, not the boss id.

## Gotcha: gauntlet rare drops use the standard miniboss table

Gauntlet rare kills use the same `rollMinibossDrops` as zone minibosses (2 items, 1 guaranteed Rare). The boss kill itself also drops via `rollBossDrops` (2-3 items, guaranteed Rare, 75/25 Rare/Magic). See `src/game/loot/drops.ts`.

## Gotcha: rarity is "unique", not a separate type

Bosses use `rarity: "unique"` — the fourth tier in `MonsterRarity`. Code that needs to differentiate boss behavior (cinematic, stat-sheet tooltip, death sfx routing, drop table) branches on `enemy.rarity === "unique"` rather than reaching back into the registry. The boss-specific data (cinematic config, nameplate color) is fetched at the branch via `findBoss(enemy.def.id as BossId)`.
