import { type Column, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { characters, user } from "../../db/schema";
import { adminProcedure, router } from "../init";

function epochMs(column: Column) {
	return sql<number>`${column}`;
}

const USER_LIST_LIMIT = 200;

export const adminRouter = router({
	pulse: adminProcedure.query(async ({ ctx }) => {
		const [users, chars] = await ctx.db.batch([
			ctx.db
				.select({
					userCount: count(),
					adminCount: sql<number>`coalesce(sum(${user.role} = 'admin'), 0)`,
				})
				.from(user),
			ctx.db
				.select({
					characterCount: count(),
					hardcoreCount: sql<number>`coalesce(sum(${characters.hardcore}), 0)`,
				})
				.from(characters),
		]);
		const { userCount, adminCount } = users[0];
		const { characterCount, hardcoreCount } = chars[0];
		return {
			userCount,
			characterCount,
			adminCount,
			hardcoreCount,
			softcoreCount: characterCount - hardcoreCount,
		};
	}),

	listUsers: adminProcedure.query(async ({ ctx }) =>
		ctx.db
			.select({
				authUserId: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.emailVerified,
				createdAt: epochMs(user.createdAt),
				role: user.role,
				characterCount: count(characters.id),
			})
			.from(user)
			.leftJoin(characters, eq(characters.authUserId, user.id))
			.groupBy(user.id)
			.orderBy(desc(user.createdAt))
			.limit(USER_LIST_LIMIT),
	),

	listAdmins: adminProcedure.query(async ({ ctx }) =>
		ctx.db
			.select({
				authUserId: user.id,
				name: user.name,
				email: user.email,
				grantedAt: epochMs(user.updatedAt),
			})
			.from(user)
			.where(eq(user.role, "admin")),
	),

	listCharactersForUser: adminProcedure
		.input(z.object({ authUserId: z.string().min(1) }))
		.query(async ({ ctx, input }) =>
			ctx.db
				.select({
					id: characters.id,
					name: characters.name,
					classId: characters.classId,
					level: characters.level,
					hardcore: characters.hardcore,
					currentLocation: characters.currentLocation,
					createdAt: characters.createdAt,
				})
				.from(characters)
				.where(eq(characters.authUserId, input.authUserId))
				.orderBy(desc(characters.id)),
		),
});
