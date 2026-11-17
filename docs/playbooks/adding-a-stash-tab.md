# Adding a stash tab (stub — extra tabs not yet implemented)

> **Status**: the shared stash shipped (`src/server/trpc/routers/stash.ts`, `src/components/world/StashModal.tsx`: account-scoped, mode-isolated, one 60-slot tab). Purchasable extra tabs are deferred and not queued; this doc orients that work.
>
> **When you pick this up**: the stash design is locked in CONTEXT.md → Stash. The lock is:
>
> - Account-scoped, mode-isolated (softcore tabs and hardcore tabs never see each other).
> - One slot, one item (no grid-tetris).
> - 60 slots per tab. Additional tabs purchased with Rubys.

The stash already exists as a single implicit tab: stash items are rows of the `items` table with `locationKind = "stash"`, `stash_mode` and `stash_slot` (0–59). This playbook covers adding purchasable extra tabs on top of that.

## Decide first

Before coding, resolve these:

1. **Schema shape**
   - Stash items already live in the `items` table (`src/server/db/game-schema.ts`): `locationKind = "stash"`, `authUserId`, `stash_mode`, `stash_slot`, with `characterId` null, behind the partial index `items_stash_idx` on `(authUserId, stashMode)`. Keep it that way: items have stable ids across location transitions (CONTEXT.md → Loot Pipeline), and a separate table would lose that invariant.
   - Option A: add a nullable `stash_tab` integer column next to `stash_slot` (existing rows backfill to tab 0) and extend `items_stash_idx` with it.
   - Option B: keep the columns and encode the tab in the slot (`stash_slot = tabIndex × STASH_MAX_SLOTS + i`). No migration, but every slot read has to decode it.
   - Recommendation: A. It keeps `stash_slot` meaning one thing.

2. **Mode isolation enforcement**
   - Already enforced for the single tab: a character's stash is `stashModeOf(character)` (`src/game/inventory/stash-mode.ts`), every stash query filters on it through `inStash(authUserId, mode)` (`src/server/item-reads.ts`), and stash rows carry `stash_mode`.
   - Tabs must be per mode too: the tab metadata key includes the mode, and the tab filter is added to `inStash`, not beside it.

3. **Tab metadata**
   - A `stashTabs` table keyed by `(authUserId, mode, tabIndex)` with a `name` and `purchasedAt` row per tab. Tab 0 is the existing implicit tab and needs no row (or a backfilled one); later tabs are inserted by a `vendorBuyStashTab` mutation.
   - Names are user-customizable per CONTEXT.md (implied — there's no spec, but the "tabs are purchasable" wording leaves it open). Decide before the UI lands.

4. **Capacity + pricing**
   - 60 slots per tab is fixed. Tab price scales? Fixed price (e.g. 200 Rubys / tab)?
   - Pricing belongs in `src/game/vendor/products.ts` alongside the existing consumables — see [`adding-a-vendor-product.md`](./adding-a-vendor-product.md). A `stash_tab` product with `counterField: undefined` (since the count is derived from stashTabs rows, not a character-row counter) breaks the existing one-product-one-counter assumption — that may need a schema split.

5. **Deposit / withdraw mutations**
   - `depositToStash({ itemIds })`, `withdrawFromStash({ itemIds })` and `reorderStash` already exist and validate ownership, city location and mode. Deposit allocates the next free slot with `createStashSlotAllocator`; with tabs it needs a target tab (the open one) and the allocator scoped to it, and `reorderStash` needs to move items across tabs.
   - Keep the optimistic update pattern per [`adr/0001-optimistic-mutations.md`](../adr/0001-optimistic-mutations.md).

## Precedents to learn from

- **`src/server/db/game-schema.ts`** → `items` table — the `locationKind` pattern (`inventory` / `equipped` / `stash`). Tabs extend the stash rows.
- **`src/server/trpc/routers/stash.ts`** → `characterSessionProcedure` + `assertInCity` (`src/server/city.ts`) — apply the same ownership + location guards.
- **`src/components/world/StashModal.tsx`** — the existing stash UI; tabs are a tab strip over its grid.
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
pnpm lint:errors
pnpm db:generate && pnpm db:migrate:local   # schema additions
```

Then `pnpm dev`: deposit an item, switch characters in the same mode → see the same item in their stash; switch to a hardcore character (if testing both modes) → should NOT see the softcore stash contents.
