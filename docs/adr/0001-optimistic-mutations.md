# 0001 — Optimistic mutations for the gameplay loop

**Status**: Accepted
**Date**: 2026-05-17

## Context

The gameplay loop is a chain of high-frequency player actions that all hit Convex mutations: equip / unequip, drag-reorder inventory, pick selected loot, discard selected loot, take everything, discard everything, use potion, record kill. Every one of those is a network round-trip — even at sub-50ms it's a visible hitch.

In playtesting, the symptom was:
- Click "Pegar tudo" → modal frozen open for ~80ms → items appear in inventory → modal closes.
- Drag a sword onto the weapon slot → inventory slot stays full → sword "snaps back" → ~60ms later sword arrives in the slot and the inventory cell empties.

The auto-battler genre depends on tight feedback loops. Mobs die in 1-2 seconds; the player makes inventory decisions between fights. A 100ms hitch on every action accumulates into "feels sluggish" even when the server is fast.

## Decision

Every mutation that produces a *visible UI change in the player's own state* uses Convex's `.withOptimisticUpdate((localStore, args) => ...)`. The optimistic handler mirrors the server-side logic against the local query cache, so the UI shows the post-mutation state on the *next* render — before the server has even acknowledged.

Mutations that **must** be optimistic:
- `reorderInventory`, `equipItem`, `unequipItem` (inventory + paper doll)
- `pickFromBag`, `discardFromBag`, `exitZone` (loot picker)
- `consumePotion` (combat HUD — health globe must drop instantly)

Mutations that **must not** be optimistic (server-only authority):
- `recordKill` (XP gain, drop rolls) — the client can't replicate the server's RNG.
- `respawnDead` (XP penalty, state reset) — same.
- `enterZone`, `enterCity` (session creation, orphan bag cleanup) — touches multiple atoms.

## How the optimistic handlers stay correct

Two rules:

1. **Mirror, don't reimplement.** The optimistic body reads the current query result and produces the same shape the server would produce, using shared helpers where possible (`planEquip` for equip displacement, `bySlotAsc` for inventory ordering). When the server's logic is non-trivial (e.g. inventory overflow allocation), the optimistic handler imports the same pure function the server uses.

2. **Fail closed.** If the optimistic handler can't compute a sensible result (missing query data, planEquip rejection, inventory overflow), it returns without calling `localStore.setQuery`. The user sees a brief delay matching the server round-trip — same UX as having no optimism. Better to be slow than to flash incorrect state.

## Rollback behavior

When the server rejects a mutation, Convex automatically rolls back the optimistic update. The UI snaps from "looks correct" to "actually correct" — typically a few ms after the user sees the toast.

The combination is acceptable because:
- Optimistic flashes only fail when the server rejects, which usually means the action was invalid in the first place (overflow, broken state, wrong slot).
- The rollback is visible — the player sees the item return — so they understand *why* the toast says "Inventário cheio".

## Trade-offs

**Cost we paid:**
- Each mutation now has ~30-80 lines of client-side mirror code in `world.tsx` / `InventoryModal.tsx`.
- Two implementations of the same logic exist — server's authoritative version and client's optimistic version. They can drift.
- The mirror has to know about query shapes; if a query gains a field, the optimistic handler must also produce it.

**Why we paid it:**
- The genre needs the feedback to be instant. Auto-battler players churn through inventory hundreds of times per session.
- The shared `planEquip` helper means the most complex case (equip with displacement) is *not* duplicated logic — both client and server import the same pure planner.
- Tests on `planEquip` (`src/game/items/equipment.test.ts`) cover both call sites at once.

## Consequences

Future mutations on the gameplay loop must follow this pattern. The PR template (when one exists) should ask: "Is this a player-state mutation? If yes, where is the optimistic handler?"

The localStorage cache (`useCachedQuery`) is the *next* layer below — it makes cold reloads also feel instant. The two layers compose: optimism handles "I just did this", cache handles "I just opened the page".
