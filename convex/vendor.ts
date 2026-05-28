import { ConvexError, v } from "convex/values"
import { computeSellPrice } from "../src/game/items/sell-price"
import { findVendorProduct } from "../src/game/vendor/products"
import { assertInCity, loadOrCreateCombatState, loadOwnedCharacterWithSession } from "./_shared/character"
import { mutation } from "./_generated/server"
import { authComponent } from "./auth"

export const vendorBuy = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		productId: v.string(),
		quantity: v.number(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		assertInCity(char)

		if (!Number.isInteger(args.quantity) || args.quantity <= 0)
			throw new ConvexError("Quantity must be a positive integer")

		const product = findVendorProduct(args.productId)
		if (!product) throw new ConvexError(`Unknown product: ${args.productId}`)

		const totalCost = product.priceRubys * args.quantity
		const rubys = char.rubys ?? 0
		if (rubys < totalCost) throw new ConvexError("Not enough rubys")

		const newRubys = rubys - totalCost

		if (product.counterField === "potions") {
			const cs = await loadOrCreateCombatState(ctx, args.characterId, char)
			const currentCount = cs.potions
			const newCount = currentCount + args.quantity
			if (product.cap !== undefined && newCount > product.cap)
				throw new ConvexError(`${product.id} cap reached`)
			await ctx.db.patch(cs._id, { potions: newCount })
			await ctx.db.patch(args.characterId, { rubys: newRubys })
			return { rubys: newRubys, [product.counterField]: newCount }
		}

		const currentCount = char[product.counterField] ?? 0
		const newCount = currentCount + args.quantity
		if (product.cap !== undefined && newCount > product.cap)
			throw new ConvexError(`${product.id} cap reached`)
		await ctx.db.patch(args.characterId, {
			rubys: newRubys,
			[product.counterField]: newCount,
		})
		return { rubys: newRubys, [product.counterField]: newCount }
	},
})

// Vendor sale. Inventory items only — equipped/zone-bag/stash items are
// off-limits (player must unequip first). Sell price formula in
// src/game/items/sell-price.ts. Handles single and batch sales; the client
// always passes an array (length 1 for one item) so this is the only
// mutation needed.
export const vendorSellMany = mutation({
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

		if (args.itemIds.length === 0) return { rubys: char.rubys ?? 0, priceGained: 0, sold: 0 }

		const items = await Promise.all(args.itemIds.map((id) => ctx.db.get(id)))
		let total = 0
		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			if (!item) throw new ConvexError("Item not found")
			if (item.characterId !== args.characterId)
				throw new ConvexError("Not your item")
			if (item.locationKind !== "inventory")
				throw new ConvexError("Item is not in inventory")
			total += computeSellPrice(item.data)
		}

		const rubys = char.rubys ?? 0
		await Promise.all(args.itemIds.map((id) => ctx.db.delete(id)))
		await ctx.db.patch(args.characterId, { rubys: rubys + total })
		return { rubys: rubys + total, priceGained: total, sold: args.itemIds.length }
	},
})
