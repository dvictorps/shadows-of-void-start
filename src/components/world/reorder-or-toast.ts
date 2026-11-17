import { toast } from "sonner";

import { serverErrorMessage } from "#/lib/server-error-message";
import { m } from "#/paraglide/messages";

export type SlotMove = {
	itemId: number;
	targetSlot: number;
	swapWithItemId?: number;
};

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
