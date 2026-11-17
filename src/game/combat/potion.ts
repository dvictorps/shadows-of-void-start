import { POTION_HEAL_FRACTION } from "./constants";
import { clampVital } from "./vitals";

export type PotionUseResult =
	| { ok: false; reason: "no-potions" | "already-full" }
	| { ok: true; hpCurrent: number; potions: number };

export function resolvePotionUse(params: {
	potions: number;
	maxLife: number;
	prevHp: number;
	clientHp: number | undefined;
}): PotionUseResult {
	if (params.potions <= 0) return { ok: false, reason: "no-potions" };

	const currentHp =
		params.clientHp !== undefined
			? clampVital(params.clientHp, params.maxLife)
			: params.prevHp;
	if (currentHp >= params.maxLife) return { ok: false, reason: "already-full" };

	const healed = Math.min(
		params.maxLife,
		currentHp + Math.floor(params.maxLife * POTION_HEAL_FRACTION),
	);
	return { ok: true, hpCurrent: healed, potions: params.potions - 1 };
}
