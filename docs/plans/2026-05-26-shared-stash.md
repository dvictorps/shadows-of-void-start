# Shared Stash Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a shared stash (account-wide, mode-isolated) accessible from the city, with inventory on the left, stash on the right, supporting drag-and-drop, shift+click, and multi-select batch transfer.

**Architecture:** The stash reuses the existing `items` table with `locationKind: "stash"`, adding a `stashSlot` field (0-59) for grid positioning. Two batch mutations (`depositToStash`, `withdrawFromStash`) handle transfers in a single round-trip, with optimistic updates for snappy UX. The UI is a dedicated modal opened via a button in the city HUD.

**Tech Stack:** Convex (schema + mutations + queries), React + TypeScript + Tailwind, @dnd-kit (drag-and-drop), Paraglide (i18n)

---

## Task 1: Add `stashSlot` to schema + stash constant

**Files:**
- Modify: `convex/schema.ts` (add `stashSlot` field to items table)
- Modify: `src/game/inventory/constants.ts` (add `STASH_MAX_SLOTS` constant)

**Step 1: Add `stashSlot` to the items table schema**

In `convex/schema.ts`, add after the `inventorySlot` field (line ~161):

```typescript
// Stash grid position (0..59) when locationKind === "stash".
stashSlot: v.optional(v.number()),
```

**Step 2: Add `STASH_MAX_SLOTS` constant**

In `src/game/inventory/constants.ts`, add at the top alongside `INVENTORY_MAX_SLOTS`:

```typescript
export const STASH_MAX_SLOTS = 60;
```

**Step 3: Verify schema compiles**

Run: `npx convex dev --once`
Expected: Schema pushes successfully.

**Step 4: Commit**

```
feat(stash): add stashSlot field to items schema + STASH_MAX_SLOTS constant
```

---

## Task 2: Add stash query

**Files:**
- Modify: `convex/items.ts` (add `stash` query)

**Step 1: Add the stash query**

In `convex/items.ts`, add after the `equipped` query:

```typescript
// Query: stash items for the current user's active mode.
// Account-scoped (shared across characters in the same mode).
export const stash = query({
  args: { characterId: v.id("characters") },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) return []
    const char = await ctx.db.get(args.characterId)
    if (!char || char.authUserId !== authUser._id) return []
    const mode = char.hardcore ? "hardcore" : "softcore"
    const items = await ctx.db
      .query("items")
      .withIndex("by_stash", (q) =>
        q.eq("authUserId", authUser._id).eq("stashMode", mode),
      )
      .collect()
    return items.sort((a, b) => {
      const sa = a.stashSlot ?? Number.MAX_SAFE_INTEGER
      const sb = b.stashSlot ?? Number.MAX_SAFE_INTEGER
      if (sa !== sb) return sa - sb
      return b.droppedAt - a.droppedAt
    })
  },
})
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```
feat(stash): add stash query (account-scoped, mode-isolated)
```

---

## Task 3: Add stash mutations (deposit, withdraw, reorder)

**Files:**
- Create: `convex/stash.ts` (deposit, withdraw, reorder mutations)
- Modify: `convex/_shared/character.ts` (add `fetchStashAllocator` helper)

**Step 1: Add `fetchStashAllocator` to `convex/_shared/character.ts`**

Add after `fetchInventoryAllocator`, following the same pattern. Import `STASH_MAX_SLOTS`:

```typescript
import { STASH_MAX_SLOTS } from "../../src/game/inventory/constants"

export async function fetchStashAllocator(
  ctx: MutationCtx,
  authUserId: string,
  stashMode: "softcore" | "hardcore",
): Promise<{ used: number; nextFreeSlot: () => number }> {
  const stashItems = await ctx.db
    .query("items")
    .withIndex("by_stash", (q) =>
      q.eq("authUserId", authUserId).eq("stashMode", stashMode),
    )
    .collect()
  const occupied = new Set(
    stashItems
      .map((it) => it.stashSlot)
      .filter((s): s is number => typeof s === "number"),
  )
  function nextFreeSlot(): number {
    for (let i = 0; i < STASH_MAX_SLOTS; i++) {
      if (!occupied.has(i)) {
        occupied.add(i)
        return i
      }
    }
    return -1
  }
  return { used: stashItems.length, nextFreeSlot }
}
```

**Step 2: Create `convex/stash.ts` with all three mutations**

```typescript
import { ConvexError, v } from "convex/values"
import { INVENTORY_MAX_SLOTS, STASH_MAX_SLOTS } from "../src/game/inventory/constants"
import {
  assertInCity,
  fetchInventoryAllocator,
  fetchStashAllocator,
  loadOwnedCharacterWithSession,
} from "./_shared/character"
import { mutation } from "./_generated/server"
import { authComponent } from "./auth"

export const depositToStash = mutation({
  args: {
    characterId: v.id("characters"),
    sessionToken: v.string(),
    itemIds: v.array(v.id("items")),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) throw new ConvexError("Not authenticated")
    const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
    assertInCity(char)

    if (args.itemIds.length === 0) return { deposited: 0, failed: 0 }

    const mode = char.hardcore ? "hardcore" : "softcore"
    const { used, nextFreeSlot } = await fetchStashAllocator(ctx, authUser._id, mode)

    const items = await Promise.all(args.itemIds.map((id) => ctx.db.get(id)))
    let deposited = 0
    let failed = 0
    for (const item of items) {
      if (!item) { failed++; continue }
      if (item.characterId !== args.characterId) { failed++; continue }
      if (item.locationKind !== "inventory") { failed++; continue }
      const slot = nextFreeSlot()
      if (slot === -1) { failed += args.itemIds.length - deposited - failed; break }
      await ctx.db.patch(item._id, {
        locationKind: "stash" as const,
        characterId: undefined,
        inventorySlot: undefined,
        stashSlot: slot,
        stashMode: mode,
      })
      deposited++
    }
    return { deposited, failed }
  },
})

export const withdrawFromStash = mutation({
  args: {
    characterId: v.id("characters"),
    sessionToken: v.string(),
    itemIds: v.array(v.id("items")),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) throw new ConvexError("Not authenticated")
    const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
    assertInCity(char)

    if (args.itemIds.length === 0) return { withdrawn: 0, failed: 0 }

    const mode = char.hardcore ? "hardcore" : "softcore"
    const { nextFreeSlot } = await fetchInventoryAllocator(ctx, args.characterId)

    const items = await Promise.all(args.itemIds.map((id) => ctx.db.get(id)))
    let withdrawn = 0
    let failed = 0
    for (const item of items) {
      if (!item) { failed++; continue }
      if (item.authUserId !== authUser._id) { failed++; continue }
      if (item.locationKind !== "stash") { failed++; continue }
      if (item.stashMode !== mode) { failed++; continue }
      const slot = nextFreeSlot()
      if (slot === -1) { failed += args.itemIds.length - withdrawn - failed; break }
      await ctx.db.patch(item._id, {
        locationKind: "inventory" as const,
        characterId: args.characterId,
        stashSlot: undefined,
        stashMode: undefined,
        inventorySlot: slot,
      })
      withdrawn++
    }
    return { withdrawn, failed }
  },
})

export const reorderStash = mutation({
  args: {
    characterId: v.id("characters"),
    sessionToken: v.string(),
    itemId: v.id("items"),
    targetSlot: v.number(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) throw new ConvexError("Not authenticated")
    const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
    assertInCity(char)

    if (args.targetSlot < 0 || args.targetSlot >= STASH_MAX_SLOTS) {
      throw new ConvexError(`Invalid stash slot: ${args.targetSlot}`)
    }

    const source = await ctx.db.get(args.itemId)
    if (!source) throw new ConvexError("Item not found")
    if (source.authUserId !== authUser._id) throw new ConvexError("Not your item")
    if (source.locationKind !== "stash") throw new ConvexError("Item is not in stash")

    const mode = char.hardcore ? "hardcore" : "softcore"
    const allStash = await ctx.db
      .query("items")
      .withIndex("by_stash", (q) =>
        q.eq("authUserId", authUser._id).eq("stashMode", mode),
      )
      .collect()
    const occupant = allStash.find((it) => it.stashSlot === args.targetSlot)

    const sourceSlot = source.stashSlot
    await ctx.db.patch(source._id, { stashSlot: args.targetSlot })
    if (occupant && occupant._id !== source._id) {
      await ctx.db.patch(occupant._id, { stashSlot: sourceSlot ?? -1 })
    }
  },
})
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```
feat(stash): add deposit, withdraw, reorder mutations with city guard
```

---

## Task 4: Add stash mutations to `useWorldMutations` with optimistic updates

**Files:**
- Modify: `src/hooks/useWorldMutations.ts` (add deposit, withdraw, reorder with optimistic updates)
- Modify: `src/game/inventory/constants.ts` (add `createStashSlotAllocator` + `byStashSlotAsc`)

**Step 1: Add stash slot allocator and comparator to constants**

In `src/game/inventory/constants.ts`, add after `createInventorySlotAllocator`:

```typescript
export function byStashSlotAsc<T extends { stashSlot?: number }>(
  a: T,
  b: T,
): number {
  const sa = a.stashSlot ?? Number.MAX_SAFE_INTEGER;
  const sb = b.stashSlot ?? Number.MAX_SAFE_INTEGER;
  return sa - sb;
}

export function createStashSlotAllocator(
  existing: ReadonlyArray<{ stashSlot?: number }>,
): () => number {
  const occupied = new Set<number>();
  for (const it of existing) {
    if (typeof it.stashSlot === "number") occupied.add(it.stashSlot);
  }
  let cursor = 0;
  return () => {
    while (cursor < STASH_MAX_SLOTS && occupied.has(cursor)) cursor++;
    if (cursor >= STASH_MAX_SLOTS) return -1;
    const slot = cursor++;
    occupied.add(slot);
    return slot;
  };
}
```

**Step 2: Add stash mutations to `useWorldMutations`**

In `src/hooks/useWorldMutations.ts`, add after the `vendorSellMany` mutation (before the return), importing stash API and helpers:

```typescript
import {
  bySlotAsc,
  byStashSlotAsc,
  createInventorySlotAllocator,
  createStashSlotAllocator,
} from "#/game/inventory/constants";

// ... inside useWorldMutations:

const depositToStash = useSessionedMutation(
  useMutation(api.stash.depositToStash).withOptimisticUpdate(
    (localStore, args) => {
      const inv = localStore.getQuery(api.items.inventory, {
        characterId: args.characterId,
      });
      const stash = localStore.getQuery(api.items.stash, {
        characterId: args.characterId,
      });
      if (!inv || !stash) return;
      const idSet = new Set(args.itemIds.map((id) => id.toString()));
      const toMove = inv.filter((it) => idSet.has(it._id.toString()));
      if (toMove.length === 0) return;
      const nextStashSlot = createStashSlotAllocator(stash);
      const moved: Doc<"items">[] = [];
      for (const item of toMove) {
        const slot = nextStashSlot();
        if (slot === -1) break;
        moved.push({
          ...item,
          locationKind: "stash" as const,
          characterId: undefined,
          inventorySlot: undefined,
          stashSlot: slot,
          stashMode: undefined, // server sets this
        });
      }
      const movedIds = new Set(moved.map((it) => it._id));
      localStore.setQuery(
        api.items.inventory,
        { characterId: args.characterId },
        inv.filter((it) => !movedIds.has(it._id)).sort(bySlotAsc),
      );
      localStore.setQuery(
        api.items.stash,
        { characterId: args.characterId },
        [...stash, ...moved].sort(byStashSlotAsc),
      );
    },
  ),
);

const withdrawFromStash = useSessionedMutation(
  useMutation(api.stash.withdrawFromStash).withOptimisticUpdate(
    (localStore, args) => {
      const inv = localStore.getQuery(api.items.inventory, {
        characterId: args.characterId,
      });
      const stash = localStore.getQuery(api.items.stash, {
        characterId: args.characterId,
      });
      if (!inv || !stash) return;
      const idSet = new Set(args.itemIds.map((id) => id.toString()));
      const toMove = stash.filter((it) => idSet.has(it._id.toString()));
      if (toMove.length === 0) return;
      const nextInvSlot = createInventorySlotAllocator(inv);
      const moved: Doc<"items">[] = [];
      for (const item of toMove) {
        const slot = nextInvSlot();
        if (slot === -1) break;
        moved.push({
          ...item,
          locationKind: "inventory" as const,
          characterId: args.characterId,
          stashSlot: undefined,
          stashMode: undefined,
          inventorySlot: slot,
        });
      }
      const movedIds = new Set(moved.map((it) => it._id));
      localStore.setQuery(
        api.items.stash,
        { characterId: args.characterId },
        stash.filter((it) => !movedIds.has(it._id)).sort(byStashSlotAsc),
      );
      localStore.setQuery(
        api.items.inventory,
        { characterId: args.characterId },
        [...inv, ...moved].sort(bySlotAsc),
      );
    },
  ),
);

const reorderStash = useSessionedMutation(
  useMutation(api.stash.reorderStash).withOptimisticUpdate(
    (localStore, args) => {
      const stash = localStore.getQuery(api.items.stash, {
        characterId: args.characterId,
      });
      if (!stash) return;
      const source = stash.find((it) => it._id === args.itemId);
      if (!source) return;
      const occupant = stash.find((it) => it.stashSlot === args.targetSlot);
      const sourceSlot = source.stashSlot;
      const next = stash
        .map((it) => {
          if (it._id === source._id) return { ...it, stashSlot: args.targetSlot };
          if (occupant && it._id === occupant._id) return { ...it, stashSlot: sourceSlot ?? -1 };
          return it;
        })
        .sort(byStashSlotAsc);
      localStore.setQuery(
        api.items.stash,
        { characterId: args.characterId },
        next,
      );
    },
  ),
);
```

Add `depositToStash`, `withdrawFromStash`, `reorderStash` to the hook's return object.

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```
feat(stash): wire stash mutations with optimistic updates in useWorldMutations
```

---

## Task 5: Add i18n messages for stash (en + pt)

**Files:**
- Modify: `src/paraglide/messages/en.js` (add stash message keys)
- Modify: `src/paraglide/messages/pt.js` (add stash message keys)

**Step 1: Add English messages**

Add the typedefs near the other city/vendor typedefs, and the message functions near the vendor messages:

Typedefs:
```javascript
/** @typedef {{}} City_Stash_LabelInputs */
/** @typedef {{}} City_Open_StashInputs */
/** @typedef {{ used: NonNullable<unknown>, total: NonNullable<unknown> }} Stash_TitleInputs */
/** @typedef {{}} Stash_Inventory_HeaderInputs */
/** @typedef {{}} Stash_Header inputs */
/** @typedef {{}} Stash_Deposit_ActionInputs */
/** @typedef {{}} Stash_Withdraw_ActionInputs */
/** @typedef {{}} Stash_Deposit_SelectedInputs */
/** @typedef {{}} Stash_Withdraw_SelectedInputs */
/** @typedef {{}} Stash_Select_AllInputs */
/** @typedef {{}} Stash_Deselect_AllInputs */
/** @typedef {{}} Stash_EmptyInputs */
/** @typedef {{}} Stash_Full_ErrorInputs */
/** @typedef {{ deposited: NonNullable<unknown>, failed: NonNullable<unknown> }} Stash_Deposit_ResultInputs */
/** @typedef {{ withdrawn: NonNullable<unknown>, failed: NonNullable<unknown> }} Stash_Withdraw_ResultInputs */
/** @typedef {{ count: NonNullable<unknown> }} Stash_Free_Slot_OneInputs */
/** @typedef {{ count: NonNullable<unknown> }} Stash_Free_Slot_OtherInputs */
```

Message functions:
```javascript
export const city_stash_label = /** @type {(inputs: City_Stash_LabelInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Stash`)
};
export const city_open_stash = /** @type {(inputs: City_Open_StashInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Open stash`)
};
export const stash_title = /** @type {(inputs: Stash_TitleInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`Stash (${i?.used}/${i?.total})`)
};
export const stash_inventory_header = /** @type {(inputs: Stash_Inventory_HeaderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Inventory`)
};
export const stash_header = /** @type {(inputs: Stash_HeaderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Stash`)
};
export const stash_deposit_action = /** @type {(inputs: Stash_Deposit_ActionInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Deposit`)
};
export const stash_withdraw_action = /** @type {(inputs: Stash_Withdraw_ActionInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Withdraw`)
};
export const stash_deposit_selected = /** @type {(inputs: Stash_Deposit_SelectedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Deposit selected`)
};
export const stash_withdraw_selected = /** @type {(inputs: Stash_Withdraw_SelectedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Withdraw selected`)
};
export const stash_select_all = /** @type {(inputs: Stash_Select_AllInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Select all`)
};
export const stash_deselect_all = /** @type {(inputs: Stash_Deselect_AllInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Deselect all`)
};
export const stash_empty = /** @type {(inputs: Stash_EmptyInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Your stash is empty`)
};
export const stash_full_error = /** @type {(inputs: Stash_Full_ErrorInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Stash is full`)
};
export const stash_deposit_result = /** @type {(inputs: Stash_Deposit_ResultInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`Deposited ${i?.deposited} items` + (Number(i?.failed) > 0 ? ` (${i?.failed} could not fit)` : ``))
};
export const stash_withdraw_result = /** @type {(inputs: Stash_Withdraw_ResultInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`Withdrew ${i?.withdrawn} items` + (Number(i?.failed) > 0 ? ` (${i?.failed} could not fit)` : ``))
};
export const stash_free_slot_one = /** @type {(inputs: Stash_Free_Slot_OneInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`${i?.count} free slot`)
};
export const stash_free_slot_other = /** @type {(inputs: Stash_Free_Slot_OtherInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`${i?.count} free slots`)
};
```

**Step 2: Add Portuguese messages (same pattern, translated)**

Follow the same pattern in `pt.js`:

```javascript
// city_stash_label → "Baú"
// city_open_stash → "Abrir baú"
// stash_title → "Baú (${i?.used}/${i?.total})"
// stash_inventory_header → "Inventário"
// stash_header → "Baú"
// stash_deposit_action → "Depositar"
// stash_withdraw_action → "Retirar"
// stash_deposit_selected → "Depositar selecionados"
// stash_withdraw_selected → "Retirar selecionados"
// stash_select_all → "Selecionar tudo"
// stash_deselect_all → "Desmarcar tudo"
// stash_empty → "Seu baú está vazio"
// stash_full_error → "Baú cheio"
// stash_deposit_result → "Depositou ${i?.deposited} itens" + failed suffix
// stash_withdraw_result → "Retirou ${i?.withdrawn} itens" + failed suffix
// stash_free_slot_one → "${i?.count} espaço livre"
// stash_free_slot_other → "${i?.count} espaços livres"
```

**Step 3: Verify no syntax errors**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```
feat(stash): add i18n messages for stash UI (en + pt)
```

---

## Task 6: Create StashModal component

**Files:**
- Create: `src/components/world/StashModal.tsx`

This is the largest task. The modal has two side-by-side panels:
- **Left:** Inventory grid (60 slots) — items can be selected for deposit or shift+clicked to deposit instantly
- **Right:** Stash grid (60 slots) — items can be selected for withdrawal or shift+clicked to withdraw instantly

Both panels support drag-and-drop: drag from inventory to stash = deposit, drag from stash to inventory = withdraw, drag within the same panel = reorder.

**Step 1: Create `StashModal.tsx`**

The component follows `InventoryModal.tsx` patterns for drag-and-drop and `VendorModal.tsx` patterns for multi-select. Key design decisions:

- Uses `@dnd-kit` for drag-and-drop (consistent with InventoryModal)
- `DndContext` wraps both panels
- Drop targets: `{ kind: "inventory"; slot: number }` and `{ kind: "stash"; slot: number }`
- Drag sources: `{ kind: "inventory"; itemId }` and `{ kind: "stash"; itemId }`
- Selection state: two separate `Set<string>` — one for inventory selections, one for stash selections
- Shift+click: calls the single-item mutation directly (array of 1)
- Batch buttons: "Deposit selected" / "Withdraw selected" call the batch mutation
- Grid layout: 8 columns × ~8 rows per panel (same `INVENTORY_COLUMNS = 8` as inventory)
- Slot size: same `112px` as inventory
- Footer: shows selected count + action buttons

Props (passed from WorldModals):
```typescript
type Props = {
  isOpen: boolean;
  onClose: () => void;
  characterId: Id<"characters">;
  inventoryItems: Doc<"items">[];
  stashItems: Doc<"items">[];
  onDeposit: (itemIds: Id<"items">[]) => Promise<{ deposited: number; failed: number }>;
  onWithdraw: (itemIds: Id<"items">[]) => Promise<{ withdrawn: number; failed: number }>;
  onReorderInventory: (args: { itemId: Id<"items">; targetSlot: number }) => void;
  onReorderStash: (args: { itemId: Id<"items">; targetSlot: number }) => void;
};
```

The full component (~400 lines) follows these patterns from the existing codebase:

1. **Selection management** — Two `Set<string>` states, one per panel. Click toggles selection. `toggleAll` per panel.
2. **Shift+click** — Detected via `onClick` with `event.shiftKey`. Immediately calls deposit/withdraw with `[itemId]`.
3. **Drag-and-drop** — Reuses `PointerSensor` with `distance: 6`. Cross-panel drops trigger deposit/withdraw. Same-panel drops trigger reorder.
4. **Overflow feedback** — If batch returns `failed > 0`, show toast with the i18n result message.
5. **In-flight guard** — `useInFlight` for deposit and withdraw buttons separately.
6. **Reset on close** — `useEffect` on `isOpen` clears selections (same as VendorModal).

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```
feat(stash): create StashModal component with dual-panel drag-and-drop + multi-select
```

---

## Task 7: Wire StashModal into WorldModals + CityScene + world.tsx

**Files:**
- Modify: `src/components/world/CityScene.tsx` (add stash button)
- Modify: `src/components/world/WorldModals.tsx` (add StashModal)
- Modify: `src/routes/world.tsx` (add stash modal handle, query subscription, mutation wiring)

**Step 1: Add stash button to CityScene**

In `CityScene.tsx`, add an `onOpenStash` prop and a stash button on the right side of the city (mirroring vendor on the left):

```typescript
import { ArrowLeft, Archive, Store } from "lucide-react";

type Props = {
  cityName: string;
  onLeave: () => void;
  onOpenVendor: () => void;
  onOpenStash: () => void;
};
```

Add the button (right side, mirroring vendor's left placement):

```tsx
<button
  type="button"
  onClick={onOpenStash}
  aria-label={m.city_open_stash()}
  className="-translate-y-1/2 absolute top-1/2 right-8 inline-flex flex-col items-center gap-2 border-2 border-white/40 bg-black px-6 py-5 font-medium text-white/80 uppercase tracking-[0.2em] transition hover:border-white hover:bg-white/10 hover:text-white"
>
  <Archive className="h-12 w-12" strokeWidth={1.5} />
  <span className="display-title text-base">
    {m.city_stash_label()}
  </span>
</button>
```

**Step 2: Add StashModal to WorldModals**

Add `stashModal` prop (ModalHandle), `stashItems`, and mutation callbacks to `WorldModals`. Render `StashModal` inside the fragment.

**Step 3: Wire in world.tsx**

1. Create `stashModal` handle: `const stashModal = useModal();`
2. Add stash query subscription (warm it alongside inventory):
   ```typescript
   const liveStash = useQuery(api.items.stash, { characterId: character._id });
   const stashItems = useCachedQuery(`stash:${character._id}`, liveStash);
   ```
3. Pass `onOpenStash={stashModal.open}` to `CityScene`
4. Pass stash props to `WorldModals`:
   ```typescript
   stashModal={stashModal}
   stashItems={stashItems ?? []}
   onStashDeposit={async (itemIds) => {
     return await depositToStash({ characterId: character._id, itemIds });
   }}
   onStashWithdraw={async (itemIds) => {
     return await withdrawFromStash({ characterId: character._id, itemIds });
   }}
   onReorderStash={(args) => {
     reorderStash({ characterId: character._id, ...args });
   }}
   ```
5. Destructure `depositToStash`, `withdrawFromStash`, `reorderStash` from `useWorldMutations`.

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```
feat(stash): wire StashModal into city scene, world modals, and world route
```

---

## Task 8: Update playbook + docs

**Files:**
- Modify: `docs/playbooks/adding-a-stash-tab.md` (update status, record decisions)
- Modify: `docs/plans/in-progress.md` (remove stash from queue if listed)

**Step 1: Update the playbook**

Change the status from "orientation doc only" to reflect that the base system is implemented. Record the decisions made:

1. Schema: Option A (items table with `locationKind: "stash"`) — implemented
2. Mode isolation: Character's `hardcore` flag derives mode; query filter + mutation guard — implemented
3. Tab metadata: Deferred — single default tab, no `stashTabs` table
4. Capacity + pricing: 60 slots, pricing deferred
5. Deposit/withdraw: Batch mutations with partial-success semantics — implemented

**Step 2: Update in-progress.md if stash is queued there**

Check `docs/plans/in-progress.md` for stash references and update or remove the entry.

**Step 3: Commit**

```
docs: update stash playbook with implementation decisions
```

---

## Task 9: Manual testing + polish

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Test golden path**

1. Open the game, enter the city
2. Verify stash button appears on the right side of the city scene
3. Click the stash button — modal opens with inventory on left, stash on right
4. **Drag-and-drop deposit:** drag an item from inventory to a stash slot → item moves to stash
5. **Shift+click deposit:** shift+click an item in inventory → item moves to stash instantly
6. **Multi-select deposit:** click several inventory items (they highlight), click "Deposit selected" → items move to stash
7. **Drag-and-drop withdraw:** drag a stash item to an inventory slot → item moves to inventory
8. **Shift+click withdraw:** shift+click a stash item → item moves to inventory
9. **Multi-select withdraw:** click several stash items, click "Withdraw selected" → items move to inventory
10. **Reorder within stash:** drag a stash item to another stash slot → items swap
11. **Reorder within inventory:** drag an inventory item to another inventory slot → items swap

**Step 3: Test edge cases**

1. **Stash full:** fill all 60 stash slots, try to deposit more → toast "Stash is full"
2. **Inventory full:** fill all 60 inventory slots, try to withdraw from stash → toast "Inventory full"
3. **Partial batch:** select 10 items when only 3 slots remain → 3 deposit, toast "7 could not fit"
4. **Not in city:** navigate to a zone, verify stash button is NOT shown (city-only)
5. **Mode isolation:** if you have both softcore and hardcore characters, verify they see different stash contents

**Step 4: Run validation**

```bash
npx tsc --noEmit
npx biome check src/
npx vitest run src/game/items/
```

**Step 5: Fix any issues found**

**Step 6: Commit any polish fixes**

```
fix(stash): [description of fix]
```
