import { LEVEL_CAP } from "../progression/levels";
import type { SelectableElement } from "../stats/types";
import type { CharacterClassId } from "./types";

export function defaultElementFor(
	classId: CharacterClassId,
): SelectableElement | null {
	return classId === "mage" ? "fire" : null;
}

interface LevelBonusAnchor {
	atLevel1: number;
	atCap: number;
}

const ATTUNEMENT_LEVEL_BONUS = {
	min: { atLevel1: 3, atCap: 100 },
	max: { atLevel1: 5, atCap: 200 },
} as const satisfies Record<"min" | "max", LevelBonusAnchor>;

function interpolate(anchor: LevelBonusAnchor, level: number): number {
	const clamped = Math.min(LEVEL_CAP, Math.max(1, level));
	const growth = (anchor.atCap - anchor.atLevel1) * (clamped - 1);
	return Math.round(anchor.atLevel1 + growth / (LEVEL_CAP - 1));
}

export function attunementLevelBonus(level: number) {
	return {
		min: interpolate(ATTUNEMENT_LEVEL_BONUS.min, level),
		max: interpolate(ATTUNEMENT_LEVEL_BONUS.max, level),
	};
}
