import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { SERVER_ERRORS } from "#/lib/server-errors";

import { characters, user } from "../db/schema";
import { assertCharacterSession } from "./character-session";
import type { Context } from "./context";
import { forbidden } from "./errors";

const t = initTRPC.context<Context>().create({ isDev: import.meta.env.DEV });

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
	const session = await ctx.getSession();
	if (!session) unauthenticated();
	return next({ ctx: { ...ctx, session } });
});

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

export const CHARACTER_COLUMNS = { zoneBag: false } as const;

function unauthenticated(): never {
	throw new TRPCError({
		code: "UNAUTHORIZED",
		message: SERVER_ERRORS.notAuthenticated,
	});
}

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

export type SessionCharacter = Omit<typeof characters.$inferSelect, "zoneBag">;
