import { type Column, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { characters, user } from "../../db/schema";
import { adminProcedure, router } from "../init";

// The queries behind /admin. Every procedure goes
// through `adminProcedure`.

// Better Auth's `timestamp_ms` columns decode to `Date`, which JSON turns into
// a string over HTTP but leaves a `Date` through the SSR `localLink`. Reading
// the raw column keeps it a number on both paths.
function epochMs(column: Column) {
	return sql<number>`${column}`;
}

// One page of users. Paginate the list before
// raising it.
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

	// There is no promotion timestamp (`user.role` is a plain column), so `grantedAt` is the account's last update, which is the
	// promotion for anyone promoted after sign-up and never edited since.
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
