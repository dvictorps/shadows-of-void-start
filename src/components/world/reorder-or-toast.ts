import { toast } from "sonner";

import { serverErrorMessage } from "#/lib/server-error-message";
import { m } from "#/paraglide/messages";

export type SlotMove = {
	itemId: number;
	targetSlot: number;
	swapWithItemId?: number;
};

/**
 * Moves an item to another slot of its grid (the bag or the stash) and toasts
 * a refusal; never rejects. The optimistic move and its rollback live in the
 * mutation hooks. Every reorder goes through here: the inventory modal's, and
 * the stash modal's on both sides.
 */
export async function reorderOrToast(
	reorder: (args: { characterId: number } & SlotMove) => Promise<object>,
	characterId: number,
	move: SlotMove,
): Promise<void> {
	try {
		await reorder({ characterId, ...move });
	} catch (err) {
		toast.error(serverErrorMessage(err, m.error_reorder_failed()));
	}
}
