# Adding a stash tab (stub — system not yet implemented)

> **Status**: orientation doc only. The stash system doesn't exist yet. See `docs/plans/in-progress.md` → "Future: stash + vendor" for the queue position.
>
> **When you pick this up**: the stash design is locked in CONTEXT.md → Stash. The lock is:
>
> - Account-scoped, mode-isolated (softcore tabs and hardcore tabs never see each other).
> - One slot, one item (no grid-tetris).
> - 60 slots per tab. Additional tabs purchased with Rubys.

This playbook covers adding the _first_ tab (default tab on character creation) — and any subsequent tabs unlocked via vendor purchase. The two flows share the same underlying `stash` table and slot vocabulary; they differ in how the tab is created.

## Decide first

Before coding, resolve these:

1. **Schema shape**
   - Option A: one `stash` row per item, indexed by `(authUserId, mode, tabIndex)`. Items live in the existing `items` table with `location: { kind: "stash", authUserId, mode, tabIndex, slot }`.
   - Option B: separate `stashItems` table that mirrors `items` but doesn't share id space.
   - Recommendation: A. Items have stable ids across location transitions (CONTEXT.md → Loot Pipeline) — splitting the table loses that invariant.

2. **Mode isolation enforcement**
   - The stash is **scoped by mode** (softcore stash vs hardcore stash never see each other). Every stash query needs the character's mode in the filter — and a mutation that moves an item from inventory → stash must reject if the character's mode and the target stash's mode disagree.
   - The mode already exists: a character's stash is `stashModeOf(character)` (`src/game/inventory/stash-mode.ts`), and stash rows carry `stash_mode` (`src/server/db/game-schema.ts`).

3. **Tab metadata**
   - A `stashTabs` table keyed by `(authUserId, mode, tabIndex)` with a `name` and `purchasedAt` row per tab. The default tab (index 0) is created on character creation; later tabs are inserted by `vendorBuyStashTab`.
   - Names are user-customizable per CONTEXT.md (implied — there's no spec, but the "tabs are purchasable" wording leaves it open). Decide before the UI lands.

4. **Capacity + pricing**
   - 60 slots per tab is fixed. Tab price scales? Fixed price (e.g. 200 Rubys / tab)?
   - Pricing belongs in `src/game/vendor/products.ts` alongside the existing consumables — see [`adding-a-vendor-product.md`](./adding-a-vendor-product.md). A `stash_tab` product with `counterField: undefined` (since the count is derived from stashTabs rows, not a character-doc counter) breaks the existing one-product-one-counter assumption — that may need a schema split.

5. **Deposit / withdraw mutations**
   - `depositToStash({ itemId, tabIndex, slot })` and `withdrawFromStash({ itemId })`. Both validate: ownership, stash mode = character mode, target slot empty (deposit), source slot occupied (withdraw).
   - Optimistic update pattern per [`adr/0001-optimistic-mutations.md`](../adr/0001-optimistic-mutations.md) — stash drag-drop should feel as snappy as inventory drag-drop.

## Precedents to learn from

- **`src/server/db/game-schema.ts`** → `items` table — the `locationKind` pattern (`inventory` / `equipped` / `stash`). Tabs extend the stash rows.
- **`src/server/trpc/routers/stash.ts`** → `characterSessionProcedure` + `assertInCity` (`src/server/city.ts`) — apply the same ownership + location guards.
- **`src/components/world/InventoryModal.tsx`** — drag-drop grid that the stash UI should mirror. Stash should reuse `ItemCard` and the same drag handles.
- **`src/game/vendor/products.ts`** — single source of truth for vendor catalog. Stash tab purchase is a product on this catalog (with the caveat in "Decide first" #4 above).

## ADR-worthy decisions to capture as you go

- Whether stash items live in the `items` table or a separate one (the trade-off above).
- How mode isolation is enforced (schema guard? query filter? both?).
- Tab pricing curve (flat vs scaling).
- Whether the stash supports filters / search / sort beyond the basic grid view.

## Validation when the system lands

```bash
npx tsc --noEmit
npx vitest run src/game/items/    # stash transitions must not break item identity
npx oxlint src/
pnpm db:generate && pnpm db:migrate:local   # schema additions
```

Then `npm run dev`: deposit an item, switch characters in the same mode → see the same item in their stash; switch to a hardcore character (if testing both modes) → should NOT see the softcore stash contents.
