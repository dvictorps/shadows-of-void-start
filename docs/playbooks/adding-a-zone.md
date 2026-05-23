# Adding a zone

A zone is a node in an act's DAG. It's either a combat zone (mobs spawn, time-based bar progression) or a city (safe hub). This playbook covers combat zones; cities follow the same shape with `kind: "city"`, no monster pool, and no encounter plan.

## Step 1 — Add the node

Open `src/game/world/act-1.ts` (or your target act). Add an entry to the `nodes` array:

```ts
{
    id: "shadow_glade",
    name: "Shadow Glade",                  // canonical English fallback
    kind: "combat",
    position: { x: 0.45, y: 0.6 },         // 0..1 on the map render
    connections: [
        { id: "forest_starter", distance: 3 },
        { id: "forest_profunda", distance: 4 },
    ],
    monsterPool: ["goblin", "serpente"],   // ids from src/game/monsters/data.ts
    level: 4,                              // zone level — drives ilvl + mob instance level
    gatedBy: ["forest_starter"],           // travel-gate — omit for entry zones
    encounterPlan: {
        calmariaBudgetSeconds: 40,
        gapBetweenSpawns: { min: 1.5, max: 3 },
        campFractions: [0.5],
        ambushes: {
            fractions: [0.72],
            packSize: { min: 3, max: 4 },
            gapWithinPackMs: 800,
            magicChance: 0.5,
        },
    },
},
```

The exact compile-checked shape lives in [`_examples/zone-example.ts`](./_examples/zone-example.ts) — if the playbook drifts, that sentinel fails `tsc` and forces a sync.

Connections are undirected — listing the edge on one side is enough but listing on both sides makes the data easier to read. Each connection's `distance` feeds the travel-time formula (`src/game/world/travel.ts:computeTravelTime`).

The `encounterPlan` controls time-based pacing (calmaria budget, gap between spawns, where camps land in the bar, ambush packs). See `src/game/world/encounter-schedule.ts` for the field-level contract and CONTEXT.md → Time-based zones for the design.

## Step 2 — Add the localized name (and optional description)

Three files:

**`messages/pt.json`** — add a name key (and a description key if the zone has flavor text):

```json
"zone_shadow_glade": "Clareira Sombria",
"zone_shadow_glade_description": "Sombras dançam entre árvores tortas."
```

**`messages/en.json`** — matching keys (description optional, same key shape):

```json
"zone_shadow_glade": "Shadow Glade",
"zone_shadow_glade_description": "Shadows dance between twisted trees."
```

Then wire it into the `NODE_I18N` lookup table in `src/game/world/i18n.ts`:

```ts
const NODE_I18N: Record<
    string,
    { name: () => string; description?: () => string }
> = {
    // …existing entries…
    shadow_glade: {
        name: m.zone_shadow_glade,
        description: m.zone_shadow_glade_description,
    },
};
```

`translateNodeName` and `translateNodeDescription` look up by id. Without an entry, the zone renders its data-file `name` and has no description (`TextLog` falls back to the name).

If the zone gets a camp cinematic, also add three `camp_line_<zone>_{1,2,3}` keys per locale and an entry in the `CAMP_LINES_I18N` table. The fallback `CAMP_LINES_FALLBACK` covers zones without their own ambient lines.

## Step 3 — Verify ilvl + monsterPool

- The zone's `level` controls `rollMonsterLevel` (mob instance level = zoneLevel ± 1) and drop ilvl (matches monster instance level). See `CONTEXT.md` → Zone level and monster instance level.
- Drops are gated by mob instance level — levels 1-4 don't drop jewelry (see `CONTEXT.md` → Drop pool). Verify your zone's level falls in the right band.

## Step 4 — Verify

```bash
npx tsc --noEmit
npx vitest run
```

Then load the world view in `npm run dev`, hover the node on the map to confirm the name renders correctly, click to enter, kill a mob, retreat, and check the loot bag for items at the expected ilvl band.

## Future: boss zones

`kind: "boss"` is reserved for act-boss nodes (Act 1's final node uses model B — see `CONTEXT.md` → Act Boss). Not yet implemented — refer to the act-boss section before adding a boss node.
