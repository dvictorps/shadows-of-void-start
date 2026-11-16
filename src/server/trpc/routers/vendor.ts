import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { computeSellPrice } from "#/game/items/sell-price";
import { findVendorProduct } from "#/game/vendor/products";
import { resolvePurchase } from "#/game/vendor/purchase";
import { SERVER_ERRORS } from "#/lib/server-errors";

import { assertInCity } from "../../city";
import { characters, items } from "../../db/schema";
import { assertInventoryItem, inInventoryOf } from "../../item-reads";
import { fail } from "../errors";
import { characterSessionProcedure, router } from "../init";

// Vendor buy and sell. Both writes are guarded in SQL against a
// concurrent request on the same character (ADR 0009: D1 has no interactive
// transactions): a purchase only applies while the rubys still cover it, and
// a sale only pays while every sold item is still in the inventory.

export const vendorRouter = router({
	vendorBuy: characterSessionProcedure
		.input(
			z.object({
				productId: z.string(),
				quantity: z.number(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			assertInCity(character);
			const product = findVendorProduct(input.productId);
			if (!product) fail(`Unknown product: ${input.productId}`);

			const counter = product.counterField;
			const decision = resolvePurchase({
				product,
				quantity: input.quantity,
				rubys: character.rubys,
				currentCount: character[counter],
			});
			if (!decision.ok) fail(decision.error);

			const [updated] = await ctx.db
				.update(characters)
				.set({
					rubys: sql`${characters.rubys} - ${decision.cost}`,
					[counter]: sql`${characters[counter]} + ${input.quantity}`,
				})
				.where(
					and(
						eq(characters.id, character.id),
						gte(characters.rubys, decision.cost),
						product.cap === undefined
							? undefined
							: lte(characters[counter], product.cap - input.quantity),
					),
				)
				.returning({ rubys: characters.rubys, count: characters[counter] });
			// Only a concurrent purchase can make the guard miss after the check
			// above passed.
			if (!updated) fail("Not enough rubys");
			// The client patches both into its character cache.
			return {
				rubys: updated.rubys,
				counterField: counter,
				count: updated.count,
			};
		}),

	// Inventory items only (equipped, stash and bag items can't be sold). The
	// client always sends an array; a single sale is length 1.
	vendorSellMany: characterSessionProcedure
		.input(z.object({ itemIds: z.array(z.number().int().positive()) }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			assertInCity(character);
			if (input.itemIds.length === 0) {
				return { rubys: character.rubys, priceGained: 0, sold: 0 };
			}

			const ids = [...new Set(input.itemIds)];
			const rows = await ctx.db.query.items.findMany({
				where: inArray(items.id, ids),
			});
			const byId = new Map(rows.map((row) => [row.id, row]));
			let total = 0;
			for (const id of ids) {
				total += computeSellPrice(
					assertInventoryItem(byId.get(id), character.id).data,
				);
			}

			const sold = and(inArray(items.id, ids), inInventoryOf(character.id));
			// Pay first, and only if every item is still there; then delete. A
			// replayed sale finds the items gone and pays nothing.
			const [paid] = await ctx.db.batch([
				ctx.db
					.update(characters)
					.set({ rubys: sql`${characters.rubys} + ${total}` })
					.where(
						and(
							eq(characters.id, character.id),
							sql`(select count(*) from ${items} where ${sold}) = ${ids.length}`,
						),
					)
					.returning({ rubys: characters.rubys }),
				ctx.db.delete(items).where(sold),
			]);
			if (!paid[0]) fail(SERVER_ERRORS.itemNotFound);
			return { rubys: paid[0].rubys, priceGained: total, sold: ids.length };
		}),
});
