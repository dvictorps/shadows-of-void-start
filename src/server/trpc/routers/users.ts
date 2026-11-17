import { eq } from "drizzle-orm";
import { z } from "zod";

import { SERVER_ERRORS } from "#/lib/server-errors";

import { USER_ROLES, user } from "../../db/schema";
import { fail } from "../errors";
import { adminProcedure, publicProcedure, router } from "../init";

export const usersRouter = router({
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

	setUserRole: adminProcedure
		.input(
			z.object({ authUserId: z.string().min(1), role: z.enum(USER_ROLES) }),
		)
		.mutation(async ({ ctx, input }) => {
			if (input.authUserId === ctx.session.user.id && input.role !== "admin") {
				fail(SERVER_ERRORS.cannotRevokeSelf);
			}
			const [updated] = await ctx.db
				.update(user)
				.set({ role: input.role })
				.where(eq(user.id, input.authUserId))
				.returning({ id: user.id });
			if (!updated) fail(SERVER_ERRORS.userNotFound);
		}),
});
