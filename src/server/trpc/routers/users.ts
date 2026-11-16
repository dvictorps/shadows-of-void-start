import { eq } from "drizzle-orm";
import { z } from "zod";

import { USER_ROLES, user } from "../../db/schema";
import { fail } from "../errors";
import { adminProcedure, publicProcedure, router } from "../init";

// Account roles. The role is `user.role` (ADR 0009 update); admin queries
// count characters with SQL, so there are no per-user counters.
export const usersRouter = router({
	// Role + identity of the caller, or null when signed out. `authUserId`
	// lets the admin dashboard spot the caller's own row.
	getUserRole: publicProcedure.query(async ({ ctx }) => {
		const session = await ctx.getSession();
		if (!session) return null;
		const { id, name, email, role } = session.user;
		return { authUserId: id, role: role ?? "user", name, email };
	}),

	isAdmin: publicProcedure.query(async ({ ctx }) => {
		const session = await ctx.getSession();
		return session?.user.role === "admin";
	}),

	// Admin-only. The first admin is promoted with SQL
	// (`wrangler d1 execute … "UPDATE user SET role = 'admin' …"`).
	setUserRole: adminProcedure
		.input(
			z.object({ authUserId: z.string().min(1), role: z.enum(USER_ROLES) }),
		)
		.mutation(async ({ ctx, input }) => {
			// The dashboard also disables this button; the server is the fence.
			if (input.authUserId === ctx.session.user.id && input.role !== "admin") {
				fail("Cannot revoke your own admin role");
			}
			const [updated] = await ctx.db
				.update(user)
				.set({ role: input.role })
				.where(eq(user.id, input.authUserId))
				.returning({ id: user.id });
			if (!updated) fail("User not found");
		}),
});
