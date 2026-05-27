import { ConvexError, v } from "convex/values"
import { STASH_MAX_SLOTS } from "../src/game/inventory/constants"
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
		const { nextFreeSlot } = await fetchStashAllocator(ctx, authUser._id, mode)

		const items = await Promise.all(args.itemIds.map((id) => ctx.db.get(id)))
		let deposited = 0
		let failed = 0
		for (const item of items) {
			if (!item || item.characterId !== args.characterId || item.locationKind !== "inventory") {
				failed++
				continue
			}
			const slot = nextFreeSlot()
			if (slot === -1) {
				failed += args.itemIds.length - deposited - failed
				break
			}
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
			if (!item || item.authUserId !== authUser._id || item.locationKind !== "stash" || item.stashMode !== mode) {
				failed++
				continue
			}
			const slot = nextFreeSlot()
			if (slot === -1) {
				failed += args.itemIds.length - withdrawn - failed
				break
			}
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
		swapWithItemId: v.optional(v.id("items")),
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
		if (source.stashMode !== mode) throw new ConvexError("Item is in a different stash mode")

		const sourceSlot = source.stashSlot
		await ctx.db.patch(source._id, { stashSlot: args.targetSlot })

		if (args.swapWithItemId) {
			const occupant = await ctx.db.get(args.swapWithItemId)
			if (occupant && occupant._id !== source._id
				&& occupant.authUserId === authUser._id
				&& occupant.locationKind === "stash"
				&& occupant.stashSlot === args.targetSlot) {
				await ctx.db.patch(occupant._id, { stashSlot: sourceSlot ?? -1 })
			}
		}
	},
})
