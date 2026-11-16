import { authedProcedure, router } from "../init";

// Mirrors convex/users.ts.
export const usersRouter = router({
	me: authedProcedure.query(({ ctx }) => {
		const { id, email, name, role } = ctx.session.user;
		return { id, email, name, role };
	}),
});
