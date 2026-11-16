import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { SERVER_ERRORS } from "#/lib/server-errors";

import { characters, user } from "../db/schema";
import { assertCharacterSession } from "./character-session";
import type { Context } from "./context";
import { forbidden } from "./errors";

// tRPC's own dev detection reads `process.env.NODE_ENV`, which the Worker
// build doesn't set, so error responses leaked stack traces on staging.
const t = initTRPC.context<Context>().create({ isDev: import.meta.env.DEV });

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// Every procedure that touches account data. Narrows `ctx.session` to
// non-null for the resolver.
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
	const session = await ctx.getSession();
	if (!session) unauthenticated();
	return next({ ctx: { ...ctx, session } });
});

// Server-side admin gate for every admin-only procedure. The route-level
// `beforeLoad` check is a UX guard, not a security boundary. The role is read
// from D1, not from the session: the session cookie cache can hold a revoked
// role for up to 5 minutes.
export const adminProcedure = authedProcedure.use(async ({ ctx, next }) => {
	const row = await ctx.db.query.user.findFirst({
		columns: { role: true },
		where: eq(user.id, ctx.session.user.id),
	});
	if (row?.role !== "admin") forbidden(SERVER_ERRORS.adminRequired);
	return next();
});

const characterSessionInput = z.object({
	characterId: z.number().int().positive(),
	sessionToken: z.string().min(1),
});

// Every column of `characters` except the zone bag: it is the one column that
// grows, and only the bag procedures read it (src/server/zone-bag.ts).
export const CHARACTER_COLUMNS = { zoneBag: false } as const;

function unauthenticated(): never {
	throw new TRPCError({
		code: "UNAUTHORIZED",
		message: SERVER_ERRORS.notAuthenticated,
	});
}

// Every procedure that MUTATES character state goes through this one: it
// loads the character, checks ownership and the single-active-session token,
// and hands the row to the resolver as `ctx.character`. Procedures add their
// own fields with another `.input(z.object({ ... }))`; tRPC merges them.
//
// The session and the row are read in parallel (the row query doesn't need
// the session), so a cookie-cache miss costs one round trip, not two.
export const characterSessionProcedure = t.procedure
	.input(characterSessionInput)
	.use(async ({ ctx, input, next }) => {
		const [session, character] = await Promise.all([
			ctx.getSession(),
			ctx.db.query.characters.findFirst({
				columns: CHARACTER_COLUMNS,
				where: eq(characters.id, input.characterId),
			}),
		]);
		if (!session) unauthenticated();
		return next({
			ctx: {
				...ctx,
				session,
				character: assertCharacterSession(character, {
					authUserId: session.user.id,
					sessionToken: input.sessionToken,
				}),
			},
		});
	});

// The row `characterSessionProcedure` hands to resolvers.
export type SessionCharacter = Omit<typeof characters.$inferSelect, "zoneBag">;
