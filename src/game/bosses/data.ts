import { GRALFOR } from "./gralfor";
import type { BossConfig, BossId } from "./types";

// Registry of every boss. Parallel to MONSTERS in ../monsters/data.ts —
// boss spawns go through findBoss, not findMonster. See CONTEXT.md → Boss
// + ADR 0008 for the rationale behind the parallel registry.
export const BOSSES: Record<BossId, BossConfig> = {
	gralfor: GRALFOR,
};

export function findBoss(id: BossId): BossConfig | null {
	return BOSSES[id] ?? null;
}
