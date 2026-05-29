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
