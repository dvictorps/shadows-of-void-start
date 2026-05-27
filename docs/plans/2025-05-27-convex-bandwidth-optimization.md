# Convex Bandwidth Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce Convex Database I/O from ~91 MB/2h to ~28 MB/2h by separating hot-path combat state into its own table and eliminating unnecessary `.collect()` calls in reorder/bag mutations.

**Architecture:** Split the `characters` table into a cold `characters` doc (name, level, travel, cached stats — changes rarely) and a hot `combatState` doc (HP, barrier, potions, XP, zone session — changes every 2-5s during combat). Mutations that only touch combat state stop invalidating the `characters.byId` query. Lazy migration: first mutation auto-creates the `combatState` doc from existing character fields. Additionally, replace `.collect()`-then-filter patterns in reorder/bag mutations with direct `ctx.db.get()` lookups.

**Tech Stack:** Convex (schema, mutations, queries), React (subscriptions in world.tsx), TypeScript

---

## Part A: Combat State Table Separation

### Task 1: Add `combatState` table to schema + shared helpers

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/_shared/character.ts`

**Step 1: Add the `combatState` table definition to schema.ts**

Add after the `items` table (before `leaderboardSnapshot`):

```typescript
combatState: defineTable({
    characterId: v.id("characters"),
    hpCurrent: v.number(),
    barrierCurrent: v.number(),
    potions: v.number(),
    xp: v.number(),
    etherealIncense: v.number(),
    currentZoneKills: v.number(),
    currentZoneSession: v.optional(v.string()),
    zoneStartedAt: v.optional(v.number()),
    campThresholdsMs: v.optional(v.array(v.number())),
    inCamp: v.boolean(),
    lastCampIndex: v.optional(v.number()),
}).index("by_characterId", ["characterId"]),
```

**Step 2: Add `loadOrCreateCombatState` helper to `convex/_shared/character.ts`**

This is the lazy-migration core. Every mutation that needs combat state calls this instead of reading fields from the character doc:

```typescript
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

export async function loadOrCreateCombatState(
    ctx: MutationCtx,
    characterId: Id<"characters">,
    char: Doc<"characters">,
): Promise<Doc<"combatState">> {
    const existing = await ctx.db
        .query("combatState")
        .withIndex("by_characterId", (q) => q.eq("characterId", characterId))
        .unique()
    if (existing) return existing

    // Lazy migration: seed from legacy character fields
    const id = await ctx.db.insert("combatState", {
        characterId,
        hpCurrent: char.hpCurrent ?? char.cachedMaxLife ?? 50,
        barrierCurrent: char.barrierCurrent ?? char.cachedMaxBarrier ?? 0,
        potions: char.potions ?? 0,
        xp: char.xp ?? 0,
        etherealIncense: char.etherealIncense ?? 0,
        currentZoneKills: char.currentZoneKills ?? 0,
        currentZoneSession: char.currentZoneSession,
        zoneStartedAt: char.zoneStartedAt,
        campThresholdsMs: char.campThresholdsMs,
        inCamp: char.inCamp ?? false,
        lastCampIndex: char.lastCampIndex,
    })
    return (await ctx.db.get(id))!
}
```

Also add a `clearCombatZoneState` helper (replaces `clearPerVisitZoneState` for the combat state fields):

```typescript
export function clearCombatZoneState() {
    return {
        currentZoneSession: undefined,
        zoneStartedAt: undefined,
        campThresholdsMs: undefined,
        inCamp: false,
        lastCampIndex: undefined,
    } as const
}
```

Update `clearPerVisitZoneState` to only contain fields that stay on the characters table (none remain — this function becomes a no-op or is removed). If any future character-level per-visit fields exist, keep them here; otherwise remove and replace all call-sites with `clearCombatZoneState`.

Also update `refillPotionsToFloor` to accept a combatState doc instead of character:

```typescript
export function refillPotionsToFloor(cs: { potions: number }): number {
    return Math.max(cs.potions, POTION_REFILL_FLOOR)
}
```

**Step 3: Add a `combatState.byCharacterId` query**

Create in a new file `convex/combatState.ts` (or add to `convex/combat.ts`):

```typescript
export const byCharacterId = query({
    args: { characterId: v.id("characters") },
    handler: async (ctx, args) => {
        const authUser = await authComponent.getAuthUser(ctx)
        if (!authUser) return null
        return ctx.db
            .query("combatState")
            .withIndex("by_characterId", (q) => q.eq("characterId", args.characterId))
            .unique()
    },
})
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (new table/query compiles, no consumers yet)

**Step 5: Commit**

```
git add convex/schema.ts convex/_shared/character.ts convex/combatState.ts
git commit -m "feat: add combatState table, lazy migration helper, and query"
```

---

### Task 2: Migrate `syncHp` to use combatState

**Files:**
- Modify: `convex/combat.ts` — `syncHp` mutation (lines 339-370)

**Step 1: Update syncHp to read/write combatState instead of character**

The mutation still loads the character (for session validation), but reads HP/barrier from `combatState` and patches `combatState` instead of `characters`:

```typescript
export const syncHp = mutation({
    args: {
        characterId: v.id("characters"),
        sessionToken: v.string(),
        hpCurrent: v.number(),
        barrierCurrent: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const authUser = await authComponent.getAuthUser(ctx)
        if (!authUser) throw new ConvexError("Not authenticated")
        const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
        const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

        const { maxLife, maxBarrier } = await getCachedStats(ctx, args.characterId, char)
        const clamped = Math.max(0, Math.min(maxLife, Math.floor(args.hpCurrent)))
        const clampedBarrier = args.barrierCurrent !== undefined
            ? Math.max(0, Math.min(maxBarrier, Math.floor(args.barrierCurrent)))
            : undefined

        const hpSame = clamped === cs.hpCurrent
        const barrierSame = clampedBarrier === undefined || clampedBarrier === cs.barrierCurrent
        if (hpSame && barrierSame) return { hpCurrent: clamped }

        const patch: Record<string, unknown> = {}
        if (!hpSame) patch.hpCurrent = clamped
        if (!barrierSame) patch.barrierCurrent = clampedBarrier

        await ctx.db.patch(cs._id, patch)
        return { hpCurrent: clamped }
    },
})
```

**Key change:** `ctx.db.patch(cs._id, ...)` instead of `ctx.db.patch(args.characterId, ...)`. This means the `characters` table is NOT written to, so `characters.byId` is NOT invalidated.

**Step 2: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

**Step 3: Commit**

```
git commit -m "perf: syncHp writes to combatState instead of characters"
```

---

### Task 3: Migrate `usePotion` to use combatState

**Files:**
- Modify: `convex/combat.ts` — `usePotion` mutation (lines 246-278)

**Step 1: Update usePotion**

```typescript
export const usePotion = mutation({
    args: {
        characterId: v.id("characters"),
        sessionToken: v.string(),
        clientHp: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const authUser = await authComponent.getAuthUser(ctx)
        if (!authUser) throw new ConvexError("Not authenticated")
        const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
        const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

        if (cs.potions <= 0) throw new ConvexError("No potions to use")

        const { maxLife } = await getCachedStats(ctx, args.characterId, char)
        const currentHp = args.clientHp !== undefined
            ? Math.max(0, Math.min(maxLife, Math.floor(args.clientHp)))
            : cs.hpCurrent
        if (currentHp >= maxLife) throw new ConvexError("Already at full HP")

        const healed = Math.min(maxLife, currentHp + Math.floor(maxLife * POTION_HEAL_FRACTION))
        await ctx.db.patch(cs._id, { hpCurrent: healed, potions: cs.potions - 1 })
        return { hpCurrent: healed, potions: cs.potions - 1 }
    },
})
```

**Step 2: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run`

**Step 3: Commit**

```
git commit -m "perf: usePotion writes to combatState instead of characters"
```

---

### Task 4: Migrate `recordKill` to split writes between combatState and characters

**Files:**
- Modify: `convex/combat.ts` — `recordKill` mutation (lines 66-243)

This is the most complex mutation — it writes combat fields (xp, potions, etherealIncense, currentZoneKills, inCamp, campThresholdsMs, zoneStartedAt, lastCampIndex) AND character fields (level, completedZones, bossKillCounts, cached stats).

**Step 1: Update recordKill**

Split the single `updates` object into two: `charUpdates` (patches `characters`) and `csUpdates` (patches `combatState`).

- `charUpdates` gets: level (only if changed), completedZones, bossKillCounts, cachedMaxLife/cachedMaxBarrier/cachedMagicFind/cachedMovementSpeed
- `csUpdates` gets: xp, potions, etherealIncense, currentZoneKills, inCamp, campThresholdsMs, zoneStartedAt, lastCampIndex, hpCurrent (on level-up), barrierCurrent (on level-up)

**Key logic changes:**
- Read `xp` from `cs.xp` instead of `char.xp`
- Read `potions` from `cs.potions` instead of `char.potions`
- Read `etherealIncense` from `cs.etherealIncense` instead of `char.etherealIncense`
- Read `currentZoneKills` from `cs.currentZoneKills`
- Read `inCamp` from `cs.inCamp`
- Read `currentZoneSession` from `cs.currentZoneSession`
- Only patch `characters` if `charUpdates` has keys (level-up, zone completion, boss kill)
- Always patch `combatState` (xp changes every kill)

**Step 2: Run type check + tests**

**Step 3: Commit**

```
git commit -m "perf: recordKill splits writes — combat fields to combatState, character fields to characters"
```

---

### Task 5: Migrate remaining combat mutations

**Files:**
- Modify: `convex/combat.ts` — enterZone, enterCity, enterCamp, exitCamp, enterCampViaIncense, useEtherealIncense, respawnDead, useTeleportStone

Each mutation follows the same pattern:
1. `loadOwnedCharacterWithSession` (still reads `characters` for session check)
2. `loadOrCreateCombatState` (reads combat fields)
3. Patch `combatState` for hot-path fields
4. Patch `characters` only when cold-path fields change

**enterZone:** Patches combatState with hp/barrier reset + zone session + camp thresholds. Does NOT patch characters (currentZoneSession moves to combatState).

**enterCity:** Patches combatState with hp/barrier/potions reset.

**enterCamp / exitCamp / enterCampViaIncense:** Patch combatState (inCamp, lastCampIndex). Read zoneStartedAt/campThresholdsMs from combatState.

**useEtherealIncense:** Patch combatState (etherealIncense).

**respawnDead:**
- Softcore: patch combatState (xp penalty, hp/barrier/potions reset, clear zone state) + patch characters (currentLocation = "city", clear travel).
- Hardcore: patch characters (dead = true, clear travel) + delete combatState doc + delete items.

**useTeleportStone:**
- City: patch combatState (hp/barrier/potions reset, clear zone state) + patch characters (teleportStones, travel state).
- Non-city: patch combatState (clear zone state) + patch characters (teleportStones, travel state).

**Step 1: Implement all**

**Step 2: Run type check + tests**

**Step 3: Commit**

```
git commit -m "perf: migrate all combat mutations to combatState table"
```

---

### Task 6: Migrate item mutations that read combat state

**Files:**
- Modify: `convex/items.ts` — exitZone, pickFromBag, discardFromBag
- Modify: `convex/vendor.ts` — vendorBuy

**exitZone:** Reads `inCamp` and `currentZoneSession` from combatState. Patches combatState with `clearCombatZoneState()`.

**pickFromBag / discardFromBag:** Read `inCamp` and `currentZoneSession` from combatState.

**vendorBuy:** `potions` moves to combatState. Read potions from combatState, patch combatState. `teleportStones` stays on characters — needs conditional patching based on the product's `counterField`. If `counterField === "potions"`, patch combatState; else patch characters.

**Step 1: Implement all**

**Step 2: Run type check + tests**

**Step 3: Commit**

```
git commit -m "perf: item/vendor mutations read combat fields from combatState"
```

---

### Task 7: Update client subscriptions and field access

**Files:**
- Modify: `src/routes/world.tsx`
- Modify: `src/hooks/useCombatTick.ts` (optimistic update for consumePotion)

**Step 1: Subscribe to combatState in world.tsx**

After the `characters.byId` subscription, add:

```typescript
const combatState = useQuery(api.combatState.byCharacterId, {
    characterId: character._id,
});
```

**Step 2: Replace all `character.<combatField>` reads with `combatState?.<field>` fallback**

Create a merged accessor (keeps backward compat during lazy migration):

```typescript
const cs = combatState;
const hp = cs?.hpCurrent ?? character.hpCurrent ?? maxHp;
const potions = cs?.potions ?? character.potions ?? 0;
const incense = cs?.etherealIncense ?? character.etherealIncense ?? 0;
const barrier = cs?.barrierCurrent ?? character.barrierCurrent ?? stats.maxBarrier;
const xp = cs?.xp ?? character.xp ?? 0;
const zoneSession = cs?.currentZoneSession ?? character.currentZoneSession;
const campThresholds = cs?.campThresholdsMs ?? character.campThresholdsMs ?? EMPTY_THRESHOLDS;
const zoneStartedAt = cs?.zoneStartedAt ?? character.zoneStartedAt;
const inCamp = cs?.inCamp ?? character.inCamp ?? false;
const currentZoneKills = cs?.currentZoneKills ?? character.currentZoneKills ?? 0;
```

Then update all downstream consumers:
- `useCombatLoop` call: `initialHp: hp`, `potions`, `incense`, `initialBarrier: barrier`, `serverCampThresholdsMs: campThresholds`
- zoneBag subscription: `zoneSession` instead of `character.currentZoneSession`
- Out-of-combat barrier sync: use `barrier` instead of `character.barrierCurrent`
- StatusCard and HUD: use `potions` instead of `character.potions`

**Step 3: Update the consumePotion optimistic update in useCombatTick.ts**

The optimistic update currently patches `characters.byId` via `applyCharacterDelta`. Now it should also patch `combatState.byCharacterId`:

```typescript
const consumePotion = useMutation(api.combat.usePotion).withOptimisticUpdate(
    (localStore, args) => {
        // Patch characters (legacy fallback)
        const char = findCharacter(localStore, args.characterId);
        if (char) {
            const currentHp = args.clientHp ?? char.hpCurrent ?? 0;
            const heal = Math.floor(maxHp * POTION_HEAL_FRACTION);
            applyCharacterDelta(localStore, args.characterId, {
                potions: Math.max(0, (char.potions ?? 0) - 1),
                hpCurrent: Math.min(maxHp, currentHp + heal),
            });
        }
        // Patch combatState
        const cs = localStore.getQuery(api.combatState.byCharacterId, { characterId: args.characterId });
        if (cs) {
            const currentHp = args.clientHp ?? cs.hpCurrent ?? 0;
            const heal = Math.floor(maxHp * POTION_HEAL_FRACTION);
            localStore.setQuery(api.combatState.byCharacterId, { characterId: args.characterId }, {
                ...cs,
                potions: Math.max(0, cs.potions - 1),
                hpCurrent: Math.min(maxHp, currentHp + heal),
            });
        }
    },
);
```

**Step 4: Run type check + tests**

**Step 5: Commit**

```
git commit -m "feat: client subscribes to combatState, falls back to character fields for lazy migration"
```

---

### Task 8: Update character creation to also create combatState

**Files:**
- Modify: `convex/characters.ts` — `create` mutation

**Step 1: After inserting the character, insert the combatState doc**

```typescript
await ctx.db.insert("combatState", {
    characterId,
    hpCurrent: maxHp,
    barrierCurrent: baseStats.maxBarrier,
    potions: STARTING_POTIONS,
    xp: 0,
    etherealIncense: 0,
    currentZoneKills: 0,
    inCamp: false,
})
```

New characters skip the lazy migration entirely.

**Step 2: Run type check + tests**

**Step 3: Commit**

```
git commit -m "feat: character creation also creates combatState doc"
```

---

### Task 9: Update character deletion to also delete combatState

**Files:**
- Modify: `convex/characters.ts` — `remove` mutation

**Step 1: Before deleting the character, delete its combatState**

```typescript
const cs = await ctx.db
    .query("combatState")
    .withIndex("by_characterId", (q) => q.eq("characterId", args.id))
    .unique()
if (cs) await ctx.db.delete(cs._id)
```

Also update `respawnDead` (hardcore path) to delete combatState.

**Step 2: Run type check + tests**

**Step 3: Commit**

```
git commit -m "feat: character deletion cascades to combatState"
```

---

## Part B: Eliminate Unnecessary `.collect()` Calls

### Task 10: Optimize `reorderInventory` — accept `swapWithItemId` from client

**Files:**
- Modify: `convex/items.ts` — `reorderInventory` mutation (lines 463-501)
- Modify: client call site(s) that call `reorderInventory`

**Step 1: Add optional `swapWithItemId` arg**

```typescript
export const reorderInventory = mutation({
    args: {
        characterId: v.id("characters"),
        sessionToken: v.string(),
        itemId: v.id("items"),
        targetSlot: v.number(),
        swapWithItemId: v.optional(v.id("items")),
    },
    handler: async (ctx, args) => {
        const authUser = await authComponent.getAuthUser(ctx)
        if (!authUser) throw new ConvexError("Not authenticated")
        await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

        if (args.targetSlot < 0 || args.targetSlot >= INVENTORY_MAX_SLOTS) {
            throw new ConvexError(`Invalid slot: ${args.targetSlot}`)
        }

        const source = await ctx.db.get(args.itemId)
        if (!source) throw new ConvexError("Item not found")
        if (source.characterId !== args.characterId) throw new ConvexError("Not your item")
        if (source.locationKind !== "inventory") throw new ConvexError("Item is not in inventory")

        const sourceSlot = source.inventorySlot
        await ctx.db.patch(source._id, { inventorySlot: args.targetSlot })

        if (args.swapWithItemId) {
            const occupant = await ctx.db.get(args.swapWithItemId)
            if (occupant && occupant._id !== source._id
                && occupant.characterId === args.characterId
                && occupant.locationKind === "inventory") {
                await ctx.db.patch(occupant._id, { inventorySlot: sourceSlot ?? -1 })
            }
        }
    },
})
```

**Key change:** No more `.collect()` on the entire inventory. The client knows which item is in the target slot and passes its ID directly.

**Step 2: Update the client call site to pass `swapWithItemId`**

Find the component that calls `reorderInventory` (likely InventoryModal or a drag handler) and pass the occupant's item ID.

**Step 3: Run type check + tests**

**Step 4: Commit**

```
git commit -m "perf: reorderInventory accepts swapWithItemId, skips full inventory collect"
```

---

### Task 11: Optimize `reorderStash` — same pattern

**Files:**
- Modify: `convex/stash.ts` — `reorderStash` mutation (lines 98-136)
- Modify: client call site

Same pattern as Task 10: add `swapWithItemId` optional arg, do direct `ctx.db.get()` instead of full stash `.collect()`.

**Step 1: Implement**

**Step 2: Update client call site**

**Step 3: Run type check + tests**

**Step 4: Commit**

```
git commit -m "perf: reorderStash accepts swapWithItemId, skips full stash collect"
```

---

### Task 12: Optimize `pickFromBag` and `discardFromBag` — validate individually

**Files:**
- Modify: `convex/items.ts` — `pickFromBag` (lines 129-184) and `discardFromBag` (lines 193-226)

**Step 1: Replace `.collect()` + filter with direct `ctx.db.get()` per item**

For `pickFromBag`:
```typescript
handler: async (ctx, args) => {
    // ... auth + session + camp check ...
    const cs = await loadOrCreateCombatState(ctx, args.characterId, char)
    if (!cs.inCamp) throw new ConvexError("pickFromBag is camp-only...")
    const zoneSession = cs.currentZoneSession
    if (!zoneSession || args.itemIds.length === 0) return { kept: 0 }

    const { used, nextFreeSlot } = await fetchInventoryAllocator(ctx, args.characterId)
    let kept = 0
    for (const itemId of args.itemIds) {
        const item = await ctx.db.get(itemId)
        if (!item || item.characterId !== args.characterId || item.zoneSession !== zoneSession) continue
        if (used + kept + 1 > INVENTORY_MAX_SLOTS) break
        await ctx.db.patch(itemId, {
            locationKind: "inventory" as const,
            zoneSession: undefined,
            inventorySlot: nextFreeSlot(),
        })
        kept++
    }
    return { kept }
},
```

Same pattern for `discardFromBag` — iterate and `ctx.db.get()` each, then `ctx.db.delete()`.

**Step 2: Run type check + tests**

**Step 3: Commit**

```
git commit -m "perf: pickFromBag/discardFromBag validate items individually instead of collecting entire bag"
```

---

## Final Validation

### Task 13: Full test suite + type check + deploy

**Step 1:** `npx tsc --noEmit`
**Step 2:** `npx vitest run` — all 552+ tests must pass
**Step 3:** `npx convex deploy --yes` — verify schema push succeeds (new table + index)
**Step 4:** Manual smoke test: create a new character, enter a zone, kill monsters, use potions, equip items, open stash, exit zone. Verify no regressions.

**Step 5: Commit any final fixes**

---

## Expected Impact

| Source | Before (2h) | After (2h) | Savings |
|--------|-------------|------------|---------|
| `items.inventory` | 36 MB | ~5 MB | -31 MB (skip during combat) |
| `items.stash` | 12.6 MB | ~1 MB | -11.6 MB (skip if modal closed) |
| `items.equipped` | 9.5 MB | ~9.5 MB | 0 (still always-on) |
| `combat.recordKill` | 6 MB | ~3 MB | -3 MB (patches smaller combatState) |
| `combat.syncHp` | 5.3 MB | ~0.5 MB | -4.8 MB (combatState + no-op skip) |
| `items.zoneBag` | 4.6 MB | ~4.6 MB | 0 (inherent to gameplay) |
| `leaderboard` | 3 MB | ~1.5 MB | -1.5 MB (cron 60min) |
| `characters.byId` (hidden) | ~6 MB | ~0.5 MB | -5.5 MB (rarely invalidated) |
| `combatState` query (new) | 0 | ~1.5 MB | +1.5 MB (tiny payload × many invalidations) |
| Reorder/bag collects | ~3 MB | ~0.3 MB | -2.7 MB (direct gets) |
| **Total** | **~91 MB** | **~28 MB** | **~63 MB (~69% reduction)** |
