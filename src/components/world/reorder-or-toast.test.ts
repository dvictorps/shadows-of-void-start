// @vitest-environment jsdom

import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ruleError } from "#/components/trpc-test-utils";
import { SERVER_ERRORS } from "#/lib/server-errors";
import { m } from "#/paraglide/messages";

import { reorderOrToast } from "./reorder-or-toast";

type Reorder = Parameters<typeof reorderOrToast>[0];

const MOVE = { itemId: 3, targetSlot: 9, swapWithItemId: 4 };

afterEach(() => {
	vi.restoreAllMocks();
});

describe("reorderOrToast", () => {
	it("sends the move with the character and toasts nothing on success", async () => {
		const error = vi.spyOn(toast, "error");
		const reorder = vi.fn<Reorder>(async () => ({}));
		await reorderOrToast(reorder, 7, MOVE);
		expect(reorder).toHaveBeenCalledWith({ characterId: 7, ...MOVE });
		expect(error).not.toHaveBeenCalled();
	});

	it("resolves on a crash and toasts the reorder message", async () => {
		const error = vi.spyOn(toast, "error");
		const reorder = vi.fn<Reorder>(async () => {
			throw new Error("boom");
		});
		await expect(reorderOrToast(reorder, 7, MOVE)).resolves.toBeUndefined();
		expect(error).toHaveBeenCalledWith(m.error_reorder_failed());
	});

	it("translates a rule error", async () => {
		const error = vi.spyOn(toast, "error");
		const reorder = vi.fn<Reorder>(async () => {
			throw ruleError(SERVER_ERRORS.characterNotFound);
		});
		await reorderOrToast(reorder, 7, MOVE);
		expect(error).toHaveBeenCalledWith(m.error_character_not_found());
	});
});
