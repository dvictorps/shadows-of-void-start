// Pure, server-authoritative kill-resolution decisions, extracted from
// `convex/combat.ts:recordKill` so they can be unit-tested without a Convex
// runtime (the mutation itself opens with a better-auth read that
// `convex-test` can't satisfy). The mutation stays the IO + randomness
// boundary; everything deterministic about "what does this kill mean" lives
// here.

import type { MonsterRarity } from "../monsters/types";
import type { NodeKind } from "../world/types";

/** Which drop table a kill rolls against. */
export type KillDropTable = "boss" | "miniboss" | "standard";

export interface KillClassification {
	/** A `rare` killed inside a `kind: "boss"` node — a gauntlet rare, not a
	 * zone miniboss. Routes to the miniboss drop table but does NOT grant a
	 * camp tier (the gauntlet is mid-fight, the camp belongs to the boss). */
	isBossNodeRareKill: boolean;
	/** A `rare` killed in a normal zone — the zone miniboss. */
	isMinibossKill: boolean;
	/** A `unique` — the act boss. */
	isBossKill: boolean;
	/** Whether the kill ends the zone and drops the player into camp. Minibosses
	 * and bosses do; gauntlet rares and normal mobs don't. */
	grantsCampTier: boolean;
	/** The drop table this kill rolls against. */
	dropTable: KillDropTable;
}

/**
 * Classify a kill from its rarity and the kind of node it happened in. This is
 * the branch the whole `recordKill` flow hangs off — camp tier, zone
 * completion, and drop-table selection all derive from it.
 */
export function classifyKill(
	rarity: MonsterRarity,
	zoneKind: NodeKind | undefined,
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
	/** New `currentZoneKills` value — reset to 0 on a camp-granting kill (the
	 * zone is over), otherwise incremented by one. */
	currentZoneKills: number;
	/** `inCamp` transition: `true` on a camp-granting kill, `false` when a
	 * non-granting kill clears a lingering camp, and `undefined` to leave the
	 * stored value untouched (no write). */
	inCamp: boolean | undefined;
	/** Roll a fresh camp schedule (campThresholds + zoneStartedAt reset). Only
	 * on a camp-granting kill inside a `combat` zone — boss nodes have no camps,
	 * so a `unique` kill grants the camp tier without arming a schedule. */
	resetCampSchedule: boolean;
}

/**
 * Resolve the zone-session bookkeeping a kill triggers, given its
 * camp-granting classification (from {@link classifyKill}) and the kind of node
 * it happened in. The completedZones append is left to the caller because it
 * needs the loaded progression doc — everything else about "what does this kill
 * do to the zone session" is decided here.
 */
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
	/** Per-boss kill counts, with this kill applied. */
	bossKillCounts: Record<string, number>;
	/** The leaderboard-index total (`characters.totalBossKills`). */
	totalBossKills: number;
}

/**
 * Apply one boss kill to the per-boss counts and resolve the leaderboard total.
 *
 * `priorTotal` is the character's existing `totalBossKills`. It's `undefined`
 * for legacy pre-backfill characters — and those may already carry a populated
 * `priorCounts`. Falling back to `0 + 1` there would reset their tally to 1 and
 * cost them their leaderboard standing during the deploy → backfill window, so
 * we re-derive the total by summing the per-boss counts instead.
 */
export function tallyBossKill(
	bossId: string,
	priorCounts: Record<string, number>,
	priorTotal: number | undefined,
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
