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
			if (!updated) fail(SERVER_ERRORS.notEnoughRubys);
			return {
				rubys: updated.rubys,
				counterField: counter,
				count: updated.count,
			};
		}),

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
