import { hasOwnKey } from "../typed-object";
import { GRALFOR } from "./gralfor";
import type { BossConfig, BossId } from "./types";

// Registry of every boss. Parallel to MONSTERS in ../monsters/data.ts —
// boss spawns go through findBoss, not findMonster. See CONTEXT.md → Boss
// + ADR 0008 for the rationale behind the parallel registry.
export const BOSSES = {
	gralfor: GRALFOR,
} satisfies Record<BossId, BossConfig>;

// Accepts any string: callers pass a monster def id, which is only a boss id
// for `rarity: "unique"` spawns.
export function findBoss(id: string): BossConfig | null {
	return hasOwnKey(BOSSES, id) ? BOSSES[id] : null;
}
