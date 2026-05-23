# Adding a passive (stub — system not yet implemented)

> **Status**: orientation doc only. The passive-tree system doesn't exist yet. See `docs/plans/in-progress.md` → "Future: passive tree + active skills" for the queue position.
>
> **When you pick this up**: the passive tree is the prerequisite for active skills ([`adding-a-skill.md`](./adding-a-skill.md)). Build it first.

A passive is a node in a shared talent tree. Per CONTEXT.md → Classes: the passive tree is a **shared system** with class branches into it (not a per-class tree). One graph, three (or more) entry points.

## Decide first

Before coding, resolve these:

1. **Graph or grid?**
   - PoE-style sprawling graph with adjacency-driven travel cost vs Last-Epoch-style class-branch grid with explicit tiers. Affects data shape (`edges: NodeId[]` vs `tier: number`), UI rendering (force-directed layout vs grid), and balance ("hidden" nodes deep in branches).
   - Recommendation: start with a small graph (~50 nodes) — easier to balance, easier to render, doesn't lock you out of a grid later.

2. **What does a passive grant?**
   - Almost certainly **the same modifier vocabulary as items** — `+10% Increased Physical Damage`, `+50 Life`, `+15% Cold Resistance`. If so, passive nodes carry a list of `RolledMod`-shaped effects (or `Modifier`-shaped, since passive values are fixed not rolled) and `compute.ts` consumes them through the existing `applyMod` switch.
   - Open question: do passives carry **modifier ids that already exist** (lifeFlat, colduResistanceIncrease, etc) or do they get a parallel `PassiveEffectId` vocabulary? Reusing modifier ids is cheaper and keeps the stat engine on one code path; a separate vocabulary lets passives do things items can't (e.g. "grants +1 to all skill levels").

3. **Where does passive data live?**
   - Precedent: `src/game/items/data/modifiers/` (multi-file aggregation) and `src/game/world/act-1.ts` (graph nodes with `connections`). The closest fit is `src/game/passives/data.ts` (or `src/game/passives/tree.ts` for the graph + per-node payload split).

4. **Allocation persistence**
   - Server-authoritative. Schema addition to `characters` table: `allocatedPassives: Id<"passives">[]` or `string[]` of node ids + a derived `passivePoints` count.
   - The stat engine must consume allocated passives the same way it consumes items — a `passives` argument to `computeCharacterStats` is the cleanest extension point.

5. **Allocation rules**
   - Are nodes reached by adjacency (must allocate a neighbor first)? Free-pick from a class's starting cluster? Costs scaling per branch depth? Refund mechanic?
   - These are gameplay knobs, not architecture — but they affect schema (do we need to store allocation order? a per-node cost?). Pick early.

6. **Class entry points**
   - Each class enters the shared tree at a different cluster. CONTEXT.md doesn't specify the entry positions yet — these are design decisions that lock in once the tree has node positions.

## Precedents to learn from

- **`src/game/world/types.ts`** (`WorldNode` + `NodeConnection`) — graph with positioned nodes, edges with weight (`distance`). Identical pattern works for a passive tree (nodes are skills, edges are travel, "distance" maps to allocation order).
- **`src/game/stats/compute.ts`** — the stat engine. Passives plug in here. Read `applyMod` for the modifier vocabulary you'll likely reuse.
- **`convex/characters.ts`** — character mutations. A `allocatePassive(characterId, nodeId)` mutation joins the existing crowd (equip / unequip / consumePotion shape).

## ADR-worthy decisions to capture as you go

- Graph vs grid shape + why.
- Whether passives reuse modifier ids or introduce a parallel vocabulary.
- How allocation interacts with respec (free? cost? not allowed?).
- Where class entry points live (data file? hardcoded per class? derived?).

## Validation when the system lands

```bash
npx tsc --noEmit
npx vitest run src/game/passives/
npx vitest run src/game/stats/    # passive allocation must compose with items
npx vitest run src/game/items/    # don't regress item-driven stats
npx biome check src/
npx convex dev --once             # schema additions
```

Then `npm run dev`: open the tree, allocate a node, verify the stat panel reflects it, equip an item with the same stat, verify they sum correctly.
