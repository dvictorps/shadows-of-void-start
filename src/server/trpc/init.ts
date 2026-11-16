import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { SERVER_ERRORS } from "#/lib/server-errors";

import { characters } from "../db/schema";
import { assertCharacterSession } from "./character-session";
import type { Context } from "./context";

// tRPC's own dev detection reads `process.env.NODE_ENV`, which the Worker
// build doesn't set, so error responses leaked stack traces on staging.
const t = initTRPC.context<Context>().create({ isDev: import.meta.env.DEV });

export const router = t.router;
export const publicProcedure = t.procedure;

// Every procedure that touches account data. Narrows `ctx.session` to
// non-null for the resolver.
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
	const session = await ctx.getSession();
	if (!session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: SERVER_ERRORS.notAuthenticated,
		});
	}
	return next({ ctx: { ...ctx, session } });
});

const characterSessionInput = z.object({
	characterId: z.number().int().positive(),
	sessionToken: z.string().min(1),
});

// Every procedure that MUTATES character state goes through this one: it
// loads the character, checks ownership and the single-active-session token,
// and hands the row to the resolver as `ctx.character`. Procedures add their
// own fields with another `.input(z.object({ ... }))`; tRPC merges them.
export const characterSessionProcedure = authedProcedure
	.input(characterSessionInput)
	.use(async ({ ctx, input, next }) => {
		const character = await ctx.db.query.characters.findFirst({
			where: eq(characters.id, input.characterId),
		});
		return next({
			ctx: {
				...ctx,
				character: assertCharacterSession(character, {
					authUserId: ctx.session.user.id,
					sessionToken: input.sessionToken,
				}),
			},
		});
	});
