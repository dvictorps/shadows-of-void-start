import { ConvexError, v } from "convex/values"
import { MAX_POTIONS } from "../src/game/combat/constants"
import { computeSellPrice } from "../src/game/items/sell-price"
import { findVendorProduct } from "../src/game/vendor/products"
import { loadOwnedCharacter } from "./_shared/character"
import { mutation } from "./_generated/server"
import { authComponent } from "./auth"

// Vendor purchases. The catalog lives in src/game/vendor/products.ts. For
// MVP this only sells potions; teleport stones / wind crystals join later
// alongside their usage mechanics.
export const vendorBuy = mutation({
	args: {
		characterId: v.id("characters"),
		productId: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		const product = findVendorProduct(args.productId)
		if (!product) throw new ConvexError(`Unknown product: ${args.productId}`)

		const rubys = char.rubys ?? 0
		if (rubys < product.priceRubys)
			throw new ConvexError("Not enough rubys")

		if (product.id === "potion") {
			const potions = char.potions ?? 0
			if (potions >= MAX_POTIONS)
				throw new ConvexError("Potion cap reached")
			await ctx.db.patch(args.characterId, {
				rubys: rubys - product.priceRubys,
				potions: potions + 1,
			})
			return { rubys: rubys - product.priceRubys, potions: potions + 1 }
		}

		// Future product ids fall through; throw so client doesn't silently keep
		// rubys on an unhandled buy.
		throw new ConvexError(`Buy not implemented for: ${args.productId}`)
	},
})

// Vendor sale. Inventory items only — equipped/zone-bag/stash items are
// off-limits (player must unequip first). Sell price formula in
// src/game/items/sell-price.ts.
export const vendorSell = mutation({
	args: {
		characterId: v.id("characters"),
		itemId: v.id("items"),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		const item = await ctx.db.get(args.itemId)
		if (!item) throw new ConvexError("Item not found")
		if (item.characterId !== args.characterId)
			throw new ConvexError("Not your item")
		if (item.locationKind !== "inventory")
			throw new ConvexError("Item is not in inventory")

		const price = computeSellPrice(item.data)
		const rubys = char.rubys ?? 0

		await ctx.db.delete(args.itemId)
		await ctx.db.patch(args.characterId, { rubys: rubys + price })
		return { rubys: rubys + price, priceGained: price }
	},
})
