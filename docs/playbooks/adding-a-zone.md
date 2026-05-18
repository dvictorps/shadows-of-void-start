# Adding a zone

A zone is a node in an act's DAG. It's either a combat zone (mobs spawn, boss threshold) or a city (safe hub). This playbook covers combat zones; cities follow the same shape with `kind: "city"` and no monster pool.

## Step 1 — Add the node

Open `src/game/world/act-1.ts` (or your target act). Add an entry to the `nodes` array:

```ts
{
    id: "shadow_glade",
    name: "Shadow Glade",                  // canonical English name
    kind: "combat",
    position: { x: 0.45, y: 0.6 },         // 0..1 on the map render
    connections: ["starter_forest", "ruined_outpost"],
    monsterPool: ["goblin", "shade"],      // see adding-a-monster
    level: 4,                              // zone level — drives ilvl + mob instance level
},
```

Connections are undirected — listing the edge on one side is enough but listing on both makes the data easier to read.

## Step 2 — Add the localized name

Two files:

**`messages/pt.json`** — add a new key:

```json
"zone_shadow_glade": "Clareira Sombria",
```

**`messages/en.json`** — matching key:

```json
"zone_shadow_glade": "Shadow Glade",
```

Then wire it up in `src/game/world/i18n.ts:translateNodeName`:

```ts
case "shadow_glade":
    return m.zone_shadow_glade();
```

The fallback in that switch returns the node's `name` field as-is. Without the i18n entry, the zone shows in English regardless of locale.

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
