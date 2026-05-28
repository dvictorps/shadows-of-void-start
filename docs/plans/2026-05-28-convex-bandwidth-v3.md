# Convex Bandwidth Optimization v3

**Goal:** Build on the v2 cleanup (combatState split, swapWithItemId, idempotent syncHp) with scaling-fixes that mostly pay off as the user base grows. Three high-leverage moves + four lower-leverage moves the user opted to ship together.

**Rationale:** Today the v2 changes hold bandwidth at ~28 MB/2h. Several patterns in the backend scale linearly with users or characters (leaderboard full-table scan, admin pulse N+1, ever-growing `completedZones`/`unlockedNodes`/`bossKillCounts` arrays on the always-on `characters.byId` doc). Fix them now while the codebase is small.

---

## A. Leaderboard — index-driven top-50

**Files:** `convex/schema.ts`, `convex/combat.ts`, `convex/leaderboard.ts`, `convex/characters.ts`

The current `computeSnapshot` does `ctx.db.query("characters").collect()` and sorts in memory. That scales linearly with users.

1. Add a denormalized `totalBossKills` (number) field to `characters`. Increment in `recordKill` on `isBossKill`. Default 0.
2. Backfill: lazy on read — if `totalBossKills === undefined`, treat as 0. Cold characters get the field on their next boss kill or via a one-shot migration script run from the dashboard.
3. Normalize `hardcore: boolean` (not optional) on new characters and via lazy backfill. The index needs a non-undefined key.
4. Two new indexes on `characters`:
   - `by_hardcore_level` on `["hardcore", "level"]`
   - `by_hardcore_bossKills` on `["hardcore", "totalBossKills"]`
5. `computeSnapshot` becomes: for each `(category, mode)`, `.withIndex(...).eq("hardcore", mode === "hardcore").order("desc").take(50)`. Sort by tiebreak in memory.
6. Existing characters without `hardcore` flag — backfill on first read in `byId` (write side, not query side, so no churn on hot path).

---

## B. Admin pulse — denormalize counts

**Files:** `convex/schema.ts`, `convex/characters.ts`, `convex/admin.ts`, `convex/combat.ts` (`respawnDead` hardcore path)

1. Add `characterCount` and `hardcoreCount` (numbers) to `userRoles`.
2. Increment in `characters.create`, decrement in `characters.remove` and hardcore `respawnDead`. All operations on userRoles use `loadOrCreateUserRole` to handle users who haven't been roled yet.
3. Rewrite `pulse` to one `.collect()` over `userRoles` instead of O(users) loops.

---

## C. Split characters → characterProgression

**Files:** `convex/schema.ts`, new `convex/characterProgression.ts`, `convex/_shared/character.ts`, `convex/combat.ts`, `convex/characters.ts`, `src/routes/world.tsx`

Move append-only arrays that aren't read by the combat hot path:

- `completedZones: string[]`
- `unlockedNodes: string[]`
- `bossKillCounts: Record<string, number>`

These grow over a character's life and the `characters.byId` query (always-on) pays for them every invalidation.

1. New table `characterProgression` keyed by `characterId`, indexed `by_characterId`.
2. Lazy migration via `loadOrCreateProgression` (same pattern as `loadOrCreateCombatState`).
3. New query `characterProgression.byCharacterId` for the world map / boss screens.
4. `recordKill` writes `completedZones` + `bossKillCounts` to progression instead of characters.
5. Client only subscribes to progression when the relevant UI surface is open (world map view).

---

## D. zoneBag ownership — defense in depth

**File:** `convex/items.ts:481`

Single-line change: `items.every(...)` instead of trusting `items[0].authUserId`. Apply same audit to `inventory`, `equipped`, `stash` queries.

---

## E. Cache-miss instrumentation in recordKill

**File:** `convex/combat.ts:110`

Add structured log when `recordKill` falls into the recompute branch because `char.cachedMaxLife === undefined` (NOT because of level-up). Detects regressions in equip/unequip cache invalidation.

---

## F. Slim recordKill drops payload

**File:** `convex/combat.ts:184-220`, client consumers

Return `{ id, slot, rarity }` only — full `data` arrives via the `zoneBag` subscription which the client already has open during combat. Update any client code that read `drops.data` directly.

---

## G. getCachedStats audit (read-only)

**File:** `convex/_shared/character.ts`

Verify the function is a true cache hit when the 4 `cached*` fields are populated, with no silent fallback to `computeCharacterStats`. Document findings inline if anything is off.

---

## Validation

- `npx tsc --noEmit` clean
- `npx vitest run` — all 552+ tests pass
- `npx convex deploy --yes` succeeds (schema push: 1 new field, 2 new indexes, 1 new table)
- Manual: create char, kill a boss, check leaderboard, open admin dashboard, navigate the world map.
