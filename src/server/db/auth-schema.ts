import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Better Auth core tables (user / session / account / verification), written
// by hand from Better Auth's Drizzle SQLite schema so they live next to the
// game tables in one migration history. Column keys must match Better Auth's
// field names; the DB names are snake_case through the `casing` option in
// `client.ts` and `drizzle.config.ts`.
//
// Ids are text because Better Auth generates them. Timestamps use
// `timestamp_ms` because the adapter reads and writes `Date` objects.

export const USER_ROLES = ["user", "admin"] as const;

const createdAt = () =>
	integer({ mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`);
const updatedAt = () =>
	integer({ mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
		.$onUpdate(() => new Date());

export const user = sqliteTable("user", {
	id: text().primaryKey(),
	name: text().notNull(),
	email: text().notNull().unique(),
	emailVerified: integer({ mode: "boolean" }).notNull().default(false),
	image: text(),
	// See `additionalFields.role` in src/server/auth.ts.
	role: text({ enum: USER_ROLES }).notNull().default("user"),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const session = sqliteTable(
	"session",
	{
		id: text().primaryKey(),
		expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
		token: text().notNull().unique(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		ipAddress: text(),
		userAgent: text(),
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text().primaryKey(),
		accountId: text().notNull(),
		providerId: text().notNull(),
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text(),
		refreshToken: text(),
		idToken: text(),
		accessTokenExpiresAt: integer({ mode: "timestamp_ms" }),
		refreshTokenExpiresAt: integer({ mode: "timestamp_ms" }),
		scope: text(),
		password: text(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text().primaryKey(),
		identifier: text().notNull(),
		value: text().notNull(),
		expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [index("verification_identifier_idx").on(t.identifier)],
);
