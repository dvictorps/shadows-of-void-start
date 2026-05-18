import { ConvexError, v } from "convex/values"
import {
	MAX_POTIONS,
	MAX_TELEPORT_STONES,
	MAX_WIND_CRYSTALS,
} from "../src/game/combat/constants"
import { computeSellPrice } from "../src/game/items/sell-price"
import { findVendorProduct } from "../src/game/vendor/products"
import { assertInCity, loadOwnedCharacter } from "./_shared/character"
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
		assertInCity(char)

		const product = findVendorProduct(args.productId)
		if (!product) throw new ConvexError(`Unknown product: ${args.productId}`)

		const rubys = char.rubys ?? 0
		if (rubys < product.priceRubys)
			throw new ConvexError("Not enough rubys")

		const newRubys = rubys - product.priceRubys
		if (product.id === "potion") {
			const potions = char.potions ?? 0
			if (potions >= MAX_POTIONS)
				throw new ConvexError("Potion cap reached")
			await ctx.db.patch(args.characterId, {
				rubys: newRubys,
				potions: potions + 1,
			})
			return { rubys: newRubys, potions: potions + 1 }
		}
		if (product.id === "teleport_stone") {
			const stones = char.teleportStones ?? 0
			if (stones >= MAX_TELEPORT_STONES)
				throw new ConvexError("Teleport stone cap reached")
			await ctx.db.patch(args.characterId, {
				rubys: newRubys,
				teleportStones: stones + 1,
			})
			return { rubys: newRubys, teleportStones: stones + 1 }
		}
		if (product.id === "wind_crystal") {
			const crystals = char.windCrystals ?? 0
			if (crystals >= MAX_WIND_CRYSTALS)
				throw new ConvexError("Wind crystal cap reached")
			await ctx.db.patch(args.characterId, {
				rubys: newRubys,
				windCrystals: crystals + 1,
			})
			return { rubys: newRubys, windCrystals: crystals + 1 }
		}

		throw new ConvexError(`Buy not implemented for: ${args.productId}`)
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
		itemIds: v.array(v.id("items")),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)
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
