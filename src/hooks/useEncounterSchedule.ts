// ─────────────────────────────────────────────────────────────────────────────
//  Encounter pacing for a single zone activation. Owns the calmaria time bar,
//  camp threshold rolls, ambush packs, and per-spawn gap rolls. Drives the
//  rarity decision for the next spawn (boss when budget fills, magic when
//  inside an ambush pack, otherwise the normal `rollMonsterRarity`).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { type MonsterRarity, rollMonsterRarity } from "#/game/monsters";
import type { CampSource } from "#/game/world";
import {
	type AmbushSchedule,
	rollAmbushSchedule,
	rollSpawnGapMs,
	type ZoneEncounterPlan,
} from "#/game/world/encounter-schedule";
import { useTicker } from "./useTicker";

// Calmaria ticker is intentionally coarser than the combat tick — the bar
// only needs visual smoothness, and the `transition duration-100` on the
// bar fill already covers the gap. Half the renders for the same look.
const CALMARIA_TICK_MS = 100;

type Params = {
	active: boolean;
	encounterPlan: ZoneEncounterPlan;
	// Camp thresholds (cumulative calmaria ms). Rolled server-side by
	// enterZone and persisted on the character — read off the character query.
	// Empty array while the zone hasn't rolled yet (e.g. mid-load) so the
	// ticker simply has no camps to fire. See docs/plans/in-progress.md
	// "Server-authoritative camp/phase derivation".
	serverCampThresholdsMs: readonly number[];
	isSearching: boolean;
	// Held by the state machine; set true between miniboss kill and the
	// victory-delay transition. Read at render time so the ticker re-evaluates
	// whenever state flips. A ref (not state) so flips don't trigger renders.
	postMinibossPauseRef: React.MutableRefObject<boolean>;
	// Fires with the crossed threshold's index so the parent can call
	// `enterCamp(thresholdIndex)` against the server.
	onCampTriggered: (thresholdIndex: number) => void;
};

export function useEncounterSchedule({
	active,
	encounterPlan,
	serverCampThresholdsMs,
	isSearching,
	postMinibossPauseRef,
	onCampTriggered,
}: Params) {
	const ambushPlan = encounterPlan.ambushes;
	const calmariaBudgetMs = encounterPlan.calmariaBudgetSeconds * 1000;

	// Time-bar progress: cumulative out-of-combat (calmaria) ms. Ticks only
	// while state === "searching" — combat and camps pause it. Client-only by
	// design — leaving the zone restarts the progression (per CONTEXT.md → Time Bar).
	const [calmariaElapsedMs, setCalmariaElapsedMs] = useState(0);
	const calmariaElapsedMsRef = useRef(0);

	// Camp thresholds are now server-rolled (enterZone persists them on the
	// character). We mirror the latest value into a ref so the ticker — which
	// reads via a ref to avoid stale closures — sees updates from Convex's
	// reactive query without re-subscribing. The state copy drives the bar
	// marker render.
	const campThresholdsMsRef = useRef<readonly number[]>(serverCampThresholdsMs);
	useEffect(() => {
		campThresholdsMsRef.current = serverCampThresholdsMs;
	}, [serverCampThresholdsMs]);
	const nextCampIndexRef = useRef(0);

	// `ambushPackRemainingRef` is the mobs remaining in the active pack —
	// when > 0, the next spawn rolls inside the ambush (short gap + heavier
	// magic chance). See CONTEXT.md → Ambush events.
	const ambushScheduleRef = useRef<readonly AmbushSchedule[]>([]);
	const nextAmbushIndexRef = useRef(0);
	const ambushPackRemainingRef = useRef(0);
	// `ambushActive` re-renders the scene so it can flash an "Ambush!" cue.
	const [ambushActive, setAmbushActive] = useState(false);

	// Source of the active camp (drives cinematic flavor text).
	const [campSource, setCampSource] = useState<CampSource>("baked");

	// Per-spawn calmaria gap. Re-rolls on state transitions back to "searching"
	// — using the in-pack gap if an ambush is mid-burst, otherwise a fresh roll
	// from the plan's range so the in-pack gap can't leak into post-pack searching.
	const [nextSpawnGapMs, setNextSpawnGapMs] = useState(() =>
		rollSpawnGapMs(encounterPlan),
	);
	useEffect(() => {
		if (isSearching) {
			if (ambushPlan && ambushPackRemainingRef.current > 0) {
				setNextSpawnGapMs(ambushPlan.gapWithinPackMs);
			} else {
				setNextSpawnGapMs(rollSpawnGapMs(encounterPlan));
			}
		}
	}, [isSearching, encounterPlan, ambushPlan]);

	// Shared by the activation effect and resetForMiniboss — zero the time
	// bar, re-roll ambushes, drain any in-flight pack. Camp thresholds are
	// owned by the server: enterZone rolls them on entry, and recordKill on a
	// miniboss reroll them + resets zoneStartedAt per CONTEXT.md → Zone
	// Miniboss ("the bar resets to 0 and the schedule is rerolled"). The
	// reactive `serverCampThresholdsMs` prop carries the new values into the
	// ref via the effect above, so this client-side reset only needs to clear
	// the consumed-index counter. Activation additionally resets campSource
	// ("baked") above this call.
	const resetSchedule = useCallback(() => {
		calmariaElapsedMsRef.current = 0;
		setCalmariaElapsedMs(0);
		nextCampIndexRef.current = 0;
		ambushScheduleRef.current = rollAmbushSchedule(encounterPlan);
		nextAmbushIndexRef.current = 0;
		ambushPackRemainingRef.current = 0;
		setAmbushActive(false);
	}, [encounterPlan]);

	const activeRef = useRef(active);
	useEffect(() => {
		if (active && !activeRef.current) {
			resetSchedule();
			setCampSource("baked");
		}
		activeRef.current = active;
	}, [active, resetSchedule]);

	// Calmaria ticker — drives the time bar and the camp + ambush triggers.
	// The post-miniboss flag holds the ticker through the victory→searching
	// transition so the drained bar doesn't gain a tick before reset commits.
	useTicker(
		active && isSearching && !postMinibossPauseRef.current,
		CALMARIA_TICK_MS,
		() => {
			const next = calmariaElapsedMsRef.current + CALMARIA_TICK_MS;
			calmariaElapsedMsRef.current = next;
			setCalmariaElapsedMs(next);

			// Camp fires only if the budget hasn't filled yet — at the budget
			// boundary the boss-spawn check wins on the next spawn instead.
			const currentCampIndex = nextCampIndexRef.current;
			const nextCampThreshold = campThresholdsMsRef.current[currentCampIndex];
			if (
				nextCampThreshold !== undefined &&
				next >= nextCampThreshold &&
				next < calmariaBudgetMs
			) {
				nextCampIndexRef.current = currentCampIndex + 1;
				setCampSource("baked");
				// Pass the index of the threshold the player just crossed so the
				// parent can call enterCamp(thresholdIndex) against the server.
				onCampTriggered(currentCampIndex);
				return;
			}

			// Ambush trigger — checked after camps so a co-located camp wins.
			const nextAmbush = ambushScheduleRef.current[nextAmbushIndexRef.current];
			if (
				ambushPlan &&
				nextAmbush !== undefined &&
				next >= nextAmbush.thresholdMs &&
				next < calmariaBudgetMs &&
				ambushPackRemainingRef.current === 0
			) {
				nextAmbushIndexRef.current += 1;
				ambushPackRemainingRef.current = nextAmbush.packSize;
				setAmbushActive(true);
				// Collapse the search gap so the first ambush mob fires almost
				// immediately. Subsequent spawns use the in-pack gap (set in
				// the post-spawn re-roll above).
				setNextSpawnGapMs(ambushPlan.gapWithinPackMs);
			}
		},
	);

	const rollSpawnRarity = useCallback((): MonsterRarity => {
		if (calmariaElapsedMsRef.current >= calmariaBudgetMs) return "rare";
		if (ambushPlan && ambushPackRemainingRef.current > 0) {
			return Math.random() < ambushPlan.magicChance ? "magic" : "normal";
		}
		return rollMonsterRarity();
	}, [calmariaBudgetMs, ambushPlan]);

	// Reads the ref directly: the `ambushActive` state lags by one render
	// after the pack drains (decrement happens before the setter commits),
	// and a keyboard-shortcut bypass of the disabled HUD button would observe
	// the stale state. Defense-in-depth against incense-during-ambush.
	const isAmbushPackActive = useCallback(
		() => ambushPackRemainingRef.current > 0,
		[],
	);

	const consumeAmbushSlot = useCallback(() => {
		if (ambushPackRemainingRef.current > 0) {
			ambushPackRemainingRef.current -= 1;
			if (ambushPackRemainingRef.current <= 0) setAmbushActive(false);
		}
	}, []);

	const cancelAmbush = useCallback(() => {
		ambushPackRemainingRef.current = 0;
		setAmbushActive(false);
	}, []);

	return {
		calmariaElapsedMs,
		calmariaBudgetMs,
		campThresholdsMs: serverCampThresholdsMs,
		campSource,
		ambushActive,
		nextSpawnGapMs,
		rollSpawnRarity,
		isAmbushPackActive,
		consumeAmbushSlot,
		resetForMiniboss: resetSchedule,
		cancelAmbush,
		setCampSource,
	};
}
