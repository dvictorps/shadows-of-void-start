import { SERVER_ERRORS } from "#/lib/server-errors";

import type { MonsterRarity } from "../monsters/types";
import type { ZoneEncounterPlan } from "../world/encounter-schedule";
import type { BossNodeConfig } from "../world/types";
import type { Decision } from "../world/zone-actions";
import type { ZoneContext } from "../world/zone-context";

export const KILL_PACE_GRACE_MS = 1000;

export interface KillPaceState {
	zoneStartedAt: number | null;
	zoneBudgetMs: number | null;
	currentZoneKills: number;
	gauntletKills: number;
}

export function maxPacedKills(
	plan: ZoneEncounterPlan,
	exploredMs: number,
): number {
	const minGapMs = plan.gapBetweenSpawns.min * 1000;
	const ambushKills = plan.ambushes
		? plan.ambushes.fractions.length * plan.ambushes.packSize.max
		: 0;
	return Math.floor(exploredMs / minGapMs) + ambushKills + 1;
}

const NOT_REACHED = { ok: false, error: SERVER_ERRORS.killNotReached } as const;

export function resolveKillPace(
	rarity: MonsterRarity,
	zone: Pick<ZoneContext, "encounterPlan" | "bossNode">,
	state: KillPaceState,
	now: number,
): Decision {
	if (state.zoneStartedAt === null) {
		return { ok: false, error: SERVER_ERRORS.notInZone };
	}
	const budgetMs =
		state.zoneBudgetMs ?? zone.encounterPlan.calmariaBudgetSeconds * 1000;
	const exploredMs = now - state.zoneStartedAt + KILL_PACE_GRACE_MS;
	if (rarity === "rare" || rarity === "unique") {
		if (exploredMs < budgetMs) return NOT_REACHED;
		return gauntletAllows(rarity, zone.bossNode, state.gauntletKills)
			? { ok: true }
			: NOT_REACHED;
	}
	const ceiling =
		maxPacedKills(zone.encounterPlan, Math.min(exploredMs, budgetMs)) +
		(zone.bossNode?.gauntlet.fights ?? 0);
	return state.currentZoneKills < ceiling ? { ok: true } : NOT_REACHED;
}

function gauntletAllows(
	rarity: "rare" | "unique",
	bossNode: BossNodeConfig | null,
	gauntletKills: number,
): boolean {
	if (bossNode === null) return true;
	const { fights } = bossNode.gauntlet;
	return rarity === "rare" ? gauntletKills < fights : gauntletKills >= fights;
}
