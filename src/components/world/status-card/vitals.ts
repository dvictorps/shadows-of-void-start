import { xpToNextLevel } from "#/game/progression/levels";
import type { ComputedCharacterStats } from "#/game/stats/types";
import type { CharacterRow } from "#/lib/api-types";

export type VitalsInput = {
	character: Pick<
		CharacterRow,
		"hpCurrent" | "potions" | "xp" | "level" | "currentLocation"
	>;
	stats: Pick<ComputedCharacterStats, "maxLife" | "maxBarrier">;
	hpOverride?: number;
	barrierOverride?: number;
	potionsOverride?: number;
	xpOverride?: number;
	teleportStones: number;
	hasPotionHandler: boolean;
	hasTeleportHandler: boolean;
};

export function statusVitals(input: VitalsInput) {
	const { character, stats } = input;
	const maxHp = stats.maxLife;
	const hp = input.hpOverride ?? character.hpCurrent;
	const potions = input.potionsOverride ?? character.potions;
	const xp = input.xpOverride ?? character.xp;
	const xpNeeded = xpToNextLevel(character.level);
	return {
		hp,
		maxHp,
		barrier: input.barrierOverride ?? stats.maxBarrier,
		maxBarrier: stats.maxBarrier,
		potions,
		teleportStones: input.teleportStones,
		xp,
		xpNeeded,
		canUsePotion: input.hasPotionHandler && potions > 0 && hp < maxHp,
		canUseTeleportStone:
			input.hasTeleportHandler &&
			input.teleportStones > 0 &&
			character.currentLocation !== "city",
	};
}
