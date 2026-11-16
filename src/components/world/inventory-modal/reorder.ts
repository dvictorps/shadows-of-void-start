import { toast } from "sonner";

import { serverErrorMessage } from "#/lib/server-error-message";
import { m } from "#/paraglide/messages";

export type InventoryMove = {
	itemId: number;
	targetSlot: number;
	swapWithItemId?: number;
};

/**
 * Moves a bag item and toasts a refusal; never rejects. The optimistic move
 * and its rollback live in `useInventoryMutations`. Both inventory reorders
 * go through here: the inventory modal's and the stash modal's bag side.
 */
export async function reorderOrToast(
	reorder: (args: { characterId: number } & InventoryMove) => Promise<object>,
	characterId: number,
	move: InventoryMove,
): Promise<void> {
	try {
		await reorder({ characterId, ...move });
	} catch (err) {
		toast.error(serverErrorMessage(err, m.error_reorder_failed()));
	}
}
