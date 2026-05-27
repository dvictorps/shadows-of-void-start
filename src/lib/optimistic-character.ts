// Shared optimistic-update primitives for the `api.characters.byId` query.
// Convex mutations that patch the active character (potion drink, ruby
// spend, etc.) call these from their `.withOptimisticUpdate(...)` closure
// so the local store reflects the change before the server replies.
//
// Lives in `src/lib/` instead of inside `src/routes/world.tsx` so both the
// route's mutation hooks and `useCombatLoop`'s ones can import without
// reaching across the layout boundary (hooks-into-route is a circular
// shape we want to avoid).

import type { OptimisticLocalStore } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

export function findCharacter(
	localStore: OptimisticLocalStore,
	characterId: Id<"characters">,
): Doc<"characters"> | undefined {
	return (
		localStore.getQuery(api.characters.byId, { id: characterId }) ?? undefined
	);
}

export function applyCharacterDelta(
	localStore: OptimisticLocalStore,
	characterId: Id<"characters">,
	delta: Partial<Doc<"characters">>,
): void {
	const char = localStore.getQuery(api.characters.byId, {
		id: characterId,
	});
	if (!char) return;
	localStore.setQuery(
		api.characters.byId,
		{ id: characterId },
		{
			...char,
			...delta,
		},
	);
}

export function applyCombatStateDelta(
	localStore: OptimisticLocalStore,
	characterId: Id<"characters">,
	delta: Partial<Doc<"combatState">>,
): void {
	const cs = localStore.getQuery(api.combatState.byCharacterId, { characterId });
	if (!cs) return;
	localStore.setQuery(api.combatState.byCharacterId, { characterId }, { ...cs, ...delta });
}
