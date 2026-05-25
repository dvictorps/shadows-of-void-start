import type { BossId } from "../bosses";
import type { MonsterId } from "../monsters";
import type { ZoneEncounterPlan } from "./encounter-schedule";

// Boss-node config — only set when `kind === "boss"`. Drives the gauntlet
// (N back-to-back rare fights) and points at the boss config that spawns
// after the gauntlet completes. See CONTEXT.md → Act Boss + ADR 0004.
export interface BossNodeConfig {
	bossId: BossId;
	gauntlet: {
		/** How many rare fights precede the boss. Act 1 / Gralfor: 3. */
		fights: number;
		/** Monster ids the gauntlet rares are picked from (uniformly). */
		monsterPool: MonsterId[];
	};
}

// Drives flavor-text selection in the camp cinematic — baked camps read the
// zone's CAMP_LINES, incenso-triggered camps read a generic incense set.
// Lives here (game domain) so the i18n helper, the combat hook, and the
// scene components can all reference the same union without redeclaring.
// See CONTEXT.md → Incenso Etéreo.
export type CampSource = "baked" | "incense";

export type NodeKind = "city" | "combat" | "boss";

export interface NodeConnection {
	// Target node id. Edges are undirected; list each connection on at least
	// one side (renderer dedupes).
	id: string;
	// Travel distance in abstract units. Feeds the travel-time formula
	// (see `src/game/world/travel.ts` → computeTravelTime).
	distance: number;
}

export interface WorldNode {
	id: string;
	name: string;
	kind: NodeKind;
	// Logical position on the map (0..1 in x/y). The renderer maps these onto pixels.
	position: { x: number; y: number };
	connections: NodeConnection[];
	// Monster ids eligible to spawn in this node. Only set for combat nodes.
	monsterPool?: MonsterId[];
	// Zone level — drives monster instance level (±1) and drop ilvl. Only set
	// for combat / boss nodes.
	level?: number;
	// Progression gate — the destination is only travel-eligible if every
	// listed node id is in the character's completedZones set. Omitted on
	// city and on entry zones (always accessible). See CONTEXT.md →
	// Travel system → Progression gating.
	gatedBy?: string[];
	// Encounter pacing — replaces the hard-coded threshold + spawn delay.
	// Only set for combat nodes. See `encounter-schedule.ts`.
	encounterPlan?: ZoneEncounterPlan;
	// Boss-node config — required when `kind === "boss"`, unused otherwise.
	// Drives the gauntlet + the boss spawn that follows it.
	bossNode?: BossNodeConfig;
}

export interface Act {
	id: string;
	name: string;
	nodes: WorldNode[];
}
