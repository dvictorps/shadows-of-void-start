# Adding a vendor product

The vendor sells consumables (and only consumables — gear is sold *to* the vendor, not bought *from* it). Each product is one entry in `src/game/vendor/products.ts`, plus a counter field on the character document, plus optional sprite/i18n.

The catalog today: **Life Potion** (capped at 10) and **Teleport Stone** (uncapped). Adding a third product follows the pattern below.

## Decide first

1. **What's the product?** It must be a consumable (one-shot use, decrements a counter). Permanent items (gear, stash tabs, passives) follow different patterns — see the stub playbooks if relevant.
2. **Price?** In Rubys. See CONTEXT.md → Vendor catalog (MVP) for the existing prices. Pick a value consistent with the gameplay weight (e.g. potions are cheap because of the carry cap; teleport stones are 4× a potion because they bypass travel time).
3. **Cap?** Optional. Capped products (like potions, MAX_POTIONS = 10) gate supply for combat balance. Uncapped products (like teleport stones) gate by ruby cost alone.
4. **Sprite?** Optional — a sprite path under `/assets/sprites/ui/` is preferred for shipped products; emoji is the fallback. See `src/components/world/VendorModal.tsx` for the render contract.

## Step 1 — Add the product id

Open `src/game/vendor/products.ts` and extend `VendorProductId` with the new id:

```ts
export type VendorProductId = "potion" | "teleport_stone" | "wind_crystal";
```

`VendorProduct[]` is a `Record<VendorProductId, ...>`, so the next step fails to compile until you add an entry — that's the safety net.

## Step 2 — Add the counter field (if new)

Counters live on the character document. Existing fields: `potions`, `teleportStones`. If your product can share an existing counter (e.g. it's a variant of an existing consumable), reuse it; otherwise add a new field.

**A new counter requires three updates:**

1. `convex/schema.ts` — add the optional field to the `characters` table validator.
2. `src/game/vendor/products.ts` — add the field name to `VendorCounterField`:

```ts
export type VendorCounterField = "potions" | "teleportStones" | "windCrystals";
```

3. The product registry in step 3 references the field — TypeScript catches the typo.

## Step 3 — Register the product

Add an entry to `VENDOR_PRODUCTS`:

```ts
wind_crystal: {
    id: "wind_crystal",
    priceRubys: 80,                                  // in Rubys
    emoji: "💎",
    icon: "/assets/sprites/ui/cristalVento.png",     // optional; emoji fallback
    counterField: "windCrystals",                    // must exist on character doc
    cap: 5,                                          // omit for uncapped
},
```

`vendorBuy` (in `convex/vendor.ts`) walks **one code path** for all products — it reads `product.counterField`, checks the cap (if any), patches the character doc. You don't touch `vendorBuy`.

## Step 4 — Wire the consumption mutation

`vendorBuy` only handles the purchase side. The **usage** mutation (the thing that decrements the counter when the player consumes the product in combat or on the map) is product-specific:

- `usePotion` in `convex/combat.ts` handles potions (heals HP).
- `useTeleportStone` in `convex/combat.ts` handles teleport stones (moves the character to an unlocked node).

Follow the existing pattern: validate the character owns the counter, validate count > 0, patch the character doc to decrement, optionally trigger downstream side effects.

Add an optimistic handler for the consumption mutation per [`adr/0001-optimistic-mutations.md`](../adr/0001-optimistic-mutations.md) — the consume click should feel instant.

## Step 5 — Add i18n

```json
"vendor_wind_crystal_name": "Cristal de Vento",
"vendor_wind_crystal_description": "Carrega a próxima travessia com vento favorável, dobrando a velocidade."
```

Plus the EN equivalents. Reference them in `VendorModal.tsx` (per-product label) and any in-game tooltip / HUD label that names the product.

## Step 6 — Verify

```bash
npx tsc --noEmit
npx vitest run
npx biome check src/
npx convex dev --once
```

Then `npm run dev`, enter the city, open the vendor:

- Buy one — counter increments on the character doc, Rubys decrement.
- Hit the cap (if capped) — button disables, no further purchases.
- Try to buy with insufficient Rubys — error toast.
- Trigger consumption (potion heal, teleport stone activation) — counter decrements, expected side effect fires.

## Gotchas

- **Server is the only writer.** The client never mutates the counter directly — every count change goes through `vendorBuy` (purchase) or the consumption mutation (use). This keeps the supply audit-trail single-source for the future leaderboard / anti-cheat work (see `docs/security/threat-model.md`).
- **The cap belongs on the product, not on the character.** Don't add per-character cap overrides — gameplay knobs that vary per character would defeat the purpose of a shared vendor catalog.
- **Consumables don't sell back.** Per CONTEXT.md → Vendor: "The vendor does not buy back consumables." Don't add a sell branch to `vendorSellMany` for them.
