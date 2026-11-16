// The combat loop's server calls. `useCombatLoop` owns them and hands the
// two the tick needs (`syncHp`, `consumePotion`) to `useCombatTick` as
// parameters, so the tick test injects no-ops instead of mocking a module.
//
// No reactivity on D1 (ADR 0009): each call writes what it changed into the
// character cache. ADR 0001: the potion and the incense are optimistic;
// `recordKill` is server-only (XP and drops come from the server's RNG).

import { useMutation } from "@tanstack/react-query";

import { resolvePotionUse } from "#/game/combat/potion";
import { clampVital } from "#/game/combat/vitals";
import { useTRPC } from "#/integrations/trpc/client";
import { rollbackOnError, useWorldCache } from "#/lib/world-cache";

import { useSessionedMutation } from "./useSessionToken";

export function useCombatMutations({
	characterId,
	maxHp,
}: {
	characterId: number;
	maxHp: number;
}) {
	const trpc = useTRPC();
	const cache = useWorldCache(characterId);
	const { keys } = cache;

	const recordKill = useSessionedMutation(
		useMutation(
			trpc.combat.recordKill.mutationOptions({
				onSuccess: ({ character, drops }) => {
					cache.patchCharacter(character);
					const bag = cache.zoneBag();
					if (bag && drops.length > 0) cache.setZoneBag([...bag, ...drops]);
				},
			}),
		).mutateAsync,
	);

	const syncHp = useSessionedMutation(
		useMutation(
			trpc.combat.syncHp.mutationOptions({
				// The barrier as the server stored it (same clamp as `resolveVitalSync`).
				onSuccess: ({ hpCurrent }, { barrierCurrent }) => {
					const character = cache.character();
					cache.patchCharacter(
						barrierCurrent === undefined || !character
							? { hpCurrent }
							: {
									hpCurrent,
									barrierCurrent: clampVital(
										barrierCurrent,
										character.cachedMaxBarrier,
									),
								},
					);
				},
			}),
		).mutateAsync,
	);

	// The health globe must drop instantly (ADR 0001): the count and HP move
	// in `onMutate`, and the server's numbers replace them on success.
	const consumePotion = useSessionedMutation(
		useMutation(
			trpc.combat.consumePotion.mutationOptions({
				onMutate: async ({ clientHp }) => {
					const rollback = await cache.snapshot([keys.character]);
					const character = cache.character();
					// The server's own decision, so a refused drink (none left, full
					// HP) is never painted.
					const drink =
						character &&
						resolvePotionUse({
							potions: character.potions,
							maxLife: maxHp,
							prevHp: character.hpCurrent,
							clientHp,
						});
					if (drink?.ok) {
						cache.patchCharacter({
							potions: drink.potions,
							hpCurrent: drink.hpCurrent,
						});
					}
					return { rollback };
				},
				onError: rollbackOnError,
				onSuccess: ({ hpCurrent, potions }) =>
					cache.patchCharacter({ hpCurrent, potions }),
			}),
		).mutateAsync,
	);

	// Optimistic, so a kill's incense drop landing meanwhile can't race the
	// count the HUD shows.
	const consumeIncense = useSessionedMutation(
		useMutation(
			trpc.combat.consumeEtherealIncense.mutationOptions({
				onMutate: async () => {
					const rollback = await cache.snapshot([keys.character]);
					const character = cache.character();
					if (character && character.etherealIncense > 0) {
						cache.patchCharacter({
							etherealIncense: character.etherealIncense - 1,
						});
					}
					return { rollback };
				},
				onError: rollbackOnError,
				onSuccess: ({ etherealIncense }) =>
					cache.patchCharacter({ etherealIncense }),
			}),
		).mutateAsync,
	);

	const enterCamp = useSessionedMutation(
		useMutation(
			trpc.combat.enterCamp.mutationOptions({
				onSuccess: (_result, { thresholdIndex }) =>
					cache.patchCharacter({ inCamp: true, lastCampIndex: thresholdIndex }),
			}),
		).mutateAsync,
	);

	const enterCampViaIncense = useSessionedMutation(
		useMutation(
			trpc.combat.enterCampViaIncense.mutationOptions({
				onSuccess: () => cache.patchCharacter({ inCamp: true }),
			}),
		).mutateAsync,
	);

	const exitCamp = useSessionedMutation(
		useMutation(
			trpc.combat.exitCamp.mutationOptions({
				onSuccess: () => cache.patchCharacter({ inCamp: false }),
			}),
		).mutateAsync,
	);

	return {
		recordKill,
		syncHp,
		consumePotion,
		consumeIncense,
		enterCamp,
		enterCampViaIncense,
		exitCamp,
	};
}

export type CombatMutations = ReturnType<typeof useCombatMutations>;
