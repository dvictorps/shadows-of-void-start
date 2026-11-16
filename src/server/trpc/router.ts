import { publicProcedure, router } from "./init";
import { adminRouter } from "./routers/admin";
import { charactersRouter } from "./routers/characters";
import { combatRouter } from "./routers/combat";
import { itemsRouter } from "./routers/items";
import { leaderboardRouter } from "./routers/leaderboard";
import { stashRouter } from "./routers/stash";
import { usersRouter } from "./routers/users";
import { vendorRouter } from "./routers/vendor";

// One sub-router per domain (ADR 0009). The combat state and progression are
// columns of `characters`, so the client reads them from `characters.byId`.
export const appRouter = router({
	health: publicProcedure.query(() => ({ ok: true })),
	users: usersRouter,
	admin: adminRouter,
	characters: charactersRouter,
	items: itemsRouter,
	stash: stashRouter,
	vendor: vendorRouter,
	combat: combatRouter,
	leaderboard: leaderboardRouter,
});

export type AppRouter = typeof appRouter;
