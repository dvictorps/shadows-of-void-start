// Shared optimistic-update primitives for the `api.characters.list` query.
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
	const characters = localStore.getQuery(api.characters.list, {});
	return characters?.find((c) => c._id === characterId);
}

export function applyCharacterDelta(
	localStore: OptimisticLocalStore,
	characterId: Id<"characters">,
	delta: Partial<Doc<"characters">>,
): void {
	const characters = localStore.getQuery(api.characters.list, {});
	if (!characters) return;
	localStore.setQuery(
		api.characters.list,
		{},
		characters.map((c) => (c._id === characterId ? { ...c, ...delta } : c)),
	);
}
