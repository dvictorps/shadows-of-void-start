import { publicProcedure, router } from "./init";
import { usersRouter } from "./routers/users";

// One sub-router per old `convex/*.ts` module (ADR 0009).
export const appRouter = router({
	health: publicProcedure.query(() => ({ ok: true })),
	users: usersRouter,
});

export type AppRouter = typeof appRouter;
