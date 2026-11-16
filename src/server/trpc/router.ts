import { publicProcedure, router } from "./init";
import { adminRouter } from "./routers/admin";
import { characterProgressionRouter } from "./routers/character-progression";
import { charactersRouter } from "./routers/characters";
import { combatRouter } from "./routers/combat";
import { combatStateRouter } from "./routers/combat-state";
import { itemsRouter } from "./routers/items";
import { leaderboardRouter } from "./routers/leaderboard";
import { stashRouter } from "./routers/stash";
import { usersRouter } from "./routers/users";
import { vendorRouter } from "./routers/vendor";

// One sub-router per old `convex/*.ts` module (ADR 0009).
export const appRouter = router({
	health: publicProcedure.query(() => ({ ok: true })),
	users: usersRouter,
	admin: adminRouter,
	characters: charactersRouter,
	characterProgression: characterProgressionRouter,
	combatState: combatStateRouter,
	items: itemsRouter,
	stash: stashRouter,
	vendor: vendorRouter,
	combat: combatRouter,
	leaderboard: leaderboardRouter,
});

export type AppRouter = typeof appRouter;
