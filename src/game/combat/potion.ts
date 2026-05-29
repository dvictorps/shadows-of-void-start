// Pure potion-drink resolution, extracted from `convex/combat.ts:usePotion`.
// The mutation stays the auth/IO boundary; the heal math and the two refusal
// cases (no potions, already full) live here so they can be unit-tested
// without a Convex runtime. See docs/codebase-map.md → convex testing
// convention.

import { POTION_HEAL_FRACTION } from "./constants";
import { clampVital } from "./vitals";

export type PotionUseResult =
	| { ok: false; reason: "no-potions" | "already-full" }
	| { ok: true; hpCurrent: number; potions: number };

/**
 * Resolve drinking a potion against the authoritative HP cap.
 *
 * `clientHp`, when supplied, is the combat loop's live HP — more current than
 * the throttled `syncHp` write-back, so a potion drunk mid-fight heals from the
 * right baseline. It's clamped to `[0, maxLife]` before use so a tampered value
 * can't over-heal. When the client omits it we fall back to the stored `prevHp`.
 */
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
