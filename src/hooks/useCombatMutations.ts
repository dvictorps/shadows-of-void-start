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

	const consumePotion = useSessionedMutation(
		useMutation(
			trpc.combat.consumePotion.mutationOptions({
				onMutate: async ({ clientHp }) => {
					const rollback = await cache.snapshot([keys.character]);
					const character = cache.character();
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
