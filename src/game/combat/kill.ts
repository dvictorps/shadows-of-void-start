import type { MonsterRarity } from "../monsters/types";
import type { NodeKind } from "../world/types";

export type KillDropTable = "boss" | "miniboss" | "standard";

export interface KillClassification {
	isBossNodeRareKill: boolean;
	isMinibossKill: boolean;
	isBossKill: boolean;
	grantsCampTier: boolean;
	dropTable: KillDropTable;
}

export function classifyKill(
	rarity: MonsterRarity,
	zoneKind?: NodeKind,
): KillClassification {
	const isBossNodeRareKill = rarity === "rare" && zoneKind === "boss";
	const isMinibossKill = rarity === "rare" && !isBossNodeRareKill;
	const isBossKill = rarity === "unique";
	const grantsCampTier = isMinibossKill || isBossKill;
	const isAnyRareKill = isMinibossKill || isBossNodeRareKill;
	const dropTable: KillDropTable = isBossKill
		? "boss"
		: isAnyRareKill
			? "miniboss"
			: "standard";
	return {
		isBossNodeRareKill,
		isMinibossKill,
		isBossKill,
		grantsCampTier,
		dropTable,
	};
}

export interface ZoneProgressDecision {
	currentZoneKills: number;
	inCamp: boolean | undefined;
	resetCampSchedule: boolean;
}

export function resolveZoneProgress(params: {
	grantsCampTier: boolean;
	zoneKind: NodeKind | undefined;
	prevZoneKills: number;
	prevInCamp: boolean;
}): ZoneProgressDecision {
	if (params.grantsCampTier) {
		return {
			currentZoneKills: 0,
			inCamp: true,
			resetCampSchedule: params.zoneKind === "combat",
		};
	}
	return {
		currentZoneKills: params.prevZoneKills + 1,
		inCamp: params.prevInCamp ? false : undefined,
		resetCampSchedule: false,
	};
}

export interface BossKillTally {
	bossKillCounts: Record<string, number>;
	totalBossKills: number;
}

export function tallyBossKill(
	bossId: string,
	priorCounts: Record<string, number>,
	priorTotal?: number,
): BossKillTally {
	const bossKillCounts = {
		...priorCounts,
		[bossId]: (priorCounts[bossId] ?? 0) + 1,
	};
	const totalBossKills =
		priorTotal !== undefined
			? priorTotal + 1
			: Object.values(bossKillCounts).reduce((sum, n) => sum + n, 0);
	return { bossKillCounts, totalBossKills };
}
