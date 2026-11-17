import { defaultRng, type Rng } from "#/lib/rng";

import { findBoss } from "../bosses/data";
import type { BossId } from "../bosses/types";
import type { GeneratedItem } from "../items/types";
import { rollBossDrops, rollDrop, rollMinibossDrops } from "../loot/drops";
import { findMonster } from "../monsters/data";
import { scaleMonsterStats } from "../monsters/scaling";
import type { MonsterRarity } from "../monsters/types";
import { applyXpGain, type XpGainResult } from "../progression/levels";
import type { StatCache } from "../stats/cache";
import {
	DEFAULT_ENCOUNTER_PLAN,
	rollCampThresholdsMs,
} from "../world/encounter-schedule";
import { ACT_1, findNode } from "../world/index";
import { zoneContextFor } from "../world/zone-context";
import {
	ETHEREAL_INCENSE_DROP_CHANCE,
	MAX_POTIONS,
	POTION_DROP_CHANCE,
} from "./constants";
import { classifyKill, resolveZoneProgress, tallyBossKill } from "./kill";

export interface KillTarget {
	templateId: string;
	monsterLevel: number;
	monsterRarity: MonsterRarity;
	xpReward: number;
}

export interface KillClaim {
	monsterId: string;
	monsterLevel: number;
	monsterRarity: MonsterRarity;
}

export function resolveKillTarget(
	claim: KillClaim,
	character: Pick<KillCharacter, "level" | "currentLocation">,
): { ok: true; target: KillTarget } | { ok: false; error: string } {
	const boss = findBoss(claim.monsterId);
	const template = findMonster(claim.monsterId) ?? boss?.template;
	if (!template) {
		return { ok: false, error: `Unknown monster: ${claim.monsterId}` };
	}
	const zone = zoneContextFor(ACT_1, character.currentLocation);
	if (
		boss ? zone.bossNode?.bossId !== boss.id : claim.monsterRarity === "unique"
	) {
		return {
			ok: false,
			error: `Invalid kill: ${claim.monsterId} as ${claim.monsterRarity}`,
		};
	}
	const center = zone.level ?? character.level;
	const monsterLevel = boss
		? boss.level
		: Math.min(
				center + 1,
				Math.max(1, center - 1, Math.floor(claim.monsterLevel)),
			);
	return {
		ok: true,
		target: {
			templateId: template.id,
			monsterLevel,
			monsterRarity: boss ? "unique" : claim.monsterRarity,
			xpReward: scaleMonsterStats(template, monsterLevel).xpReward,
		},
	};
}

export interface KillCharacter {
	level: number;
	xp: number;
	currentLocation: string;
	currentZoneSession: string | null;
	currentZoneKills: number;
	inCamp: boolean;
	potions: number;
	etherealIncense: number;
	completedZones: string[];
	bossKillCounts: Partial<Record<BossId, number>>;
	totalBossKills: number;
	cachedMagicFind: number;
}

export interface KillUpdate {
	level?: number;
	xp: number;
	hpCurrent?: number;
	barrierCurrent?: number;
	currentZoneKills: number;
	inCamp?: boolean;
	campThresholdsMs?: number[];
	zoneStartedAt?: number;
	lastCampIndex?: null;
	completedZones?: string[];
	bossKillCounts?: Partial<Record<BossId, number>>;
	totalBossKills?: number;
	potions?: number;
	etherealIncense?: number;
	cachedMaxLife?: number;
	cachedMaxBarrier?: number;
	cachedMagicFind?: number;
	cachedMovementSpeed?: number;
}

export interface KillOutcome {
	update: KillUpdate;
	drops: GeneratedItem[];
	xpGained: number;
	levelsGained: number;
	potionDropped: boolean;
	incenseDropped: boolean;
	newMaxLife: number | undefined;
	newMaxBarrier: number | undefined;
}

export function resolveKillXp(
	character: Pick<KillCharacter, "level" | "xp">,
	target: KillTarget,
): XpGainResult {
	return applyXpGain(character.level, character.xp, target.xpReward);
}

export function resolveKill(params: {
	character: KillCharacter;
	monsterId: string;
	target: KillTarget;
	gain: XpGainResult;
	levelUpStats: StatCache | null;
	now: number;
	rng?: Rng;
}): KillOutcome {
	const { character, target, gain, levelUpStats } = params;
	const rng = params.rng ?? defaultRng;

	const zone = findNode(ACT_1, character.currentLocation);
	const kill = classifyKill(target.monsterRarity, zone?.kind);
	const progress = resolveZoneProgress({
		grantsCampTier: kill.grantsCampTier,
		zoneKind: zone?.kind,
		prevZoneKills: character.currentZoneKills,
		prevInCamp: character.inCamp,
	});
	const update: KillUpdate = {
		xp: gain.xp,
		currentZoneKills: progress.currentZoneKills,
	};
	if (gain.level !== character.level) update.level = gain.level;
	if (progress.inCamp !== undefined) update.inCamp = progress.inCamp;

	let magicFind = character.cachedMagicFind;
	if (levelUpStats) {
		Object.assign(update, levelUpStats);
		update.hpCurrent = levelUpStats.cachedMaxLife;
		update.barrierCurrent = levelUpStats.cachedMaxBarrier;
		magicFind = levelUpStats.cachedMagicFind;
	}

	if (kill.grantsCampTier) {
		if (!character.completedZones.includes(character.currentLocation)) {
			update.completedZones = [
				...character.completedZones,
				character.currentLocation,
			];
		}
		if (progress.resetCampSchedule && zone) {
			update.campThresholdsMs = rollCampThresholdsMs(
				zone.encounterPlan ?? DEFAULT_ENCOUNTER_PLAN,
				rng,
			);
			update.zoneStartedAt = params.now;
			update.lastCampIndex = null;
		}
		if (kill.isBossKill) {
			const tally = tallyBossKill(
				params.monsterId,
				character.bossKillCounts,
				character.totalBossKills,
			);
			update.bossKillCounts = tally.bossKillCounts;
			update.totalBossKills = tally.totalBossKills;
		}
	}

	const potionDropped =
		character.potions < MAX_POTIONS && rng.unit() < POTION_DROP_CHANCE;
	if (potionDropped) update.potions = character.potions + 1;
	const incenseDropped = rng.unit() < ETHEREAL_INCENSE_DROP_CHANCE;
	if (incenseDropped) update.etherealIncense = character.etherealIncense + 1;

	const drops = character.currentZoneSession
		? rollKillDrops(
				kill.dropTable,
				target.monsterRarity,
				target.monsterLevel,
				magicFind,
				rng,
			)
		: [];

	return {
		update,
		drops,
		xpGained: target.xpReward,
		levelsGained: gain.levelsGained,
		potionDropped,
		incenseDropped,
		newMaxLife: levelUpStats?.cachedMaxLife,
		newMaxBarrier: levelUpStats?.cachedMaxBarrier,
	};
}

function rollKillDrops(
	table: ReturnType<typeof classifyKill>["dropTable"],
	monsterRarity: MonsterRarity,
	monsterLevel: number,
	magicFind: number,
	rng: Rng,
): GeneratedItem[] {
	if (table === "boss") return rollBossDrops({ monsterLevel, magicFind }, rng);
	if (table === "miniboss")
		return rollMinibossDrops({ monsterLevel, magicFind }, rng);
	const drop = rollDrop({ monsterRarity, monsterLevel, magicFind }, rng);
	return drop ? [drop] : [];
}
