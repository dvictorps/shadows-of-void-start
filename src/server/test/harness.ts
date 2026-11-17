import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { expect } from "vitest";

import { findStarterItem } from "#/game/items/starter-gear";

import { db } from "../db/client";
import {
	characters,
	items,
	USER_ROLES,
	user,
	type ZoneBagEntry,
} from "../db/schema";
import type { RequestSession } from "../trpc/context";
import { createCallerFactory } from "../trpc/init";
import { appRouter } from "../trpc/router";

const createCaller = createCallerFactory(appRouter);

type Role = (typeof USER_ROLES)[number];

export interface TestAccount {
	session: RequestSession;
	caller: ReturnType<typeof createCaller>;
}

let sequence = 0;

export async function createAccount(role: Role = "user"): Promise<TestAccount> {
	sequence += 1;
	const id = `test-user-${crypto.randomUUID()}`;
	const now = new Date();
	const row = {
		id,
		name: `Tester ${sequence}`,
		email: `${id}@example.test`,
		emailVerified: false,
		role,
		createdAt: now,
		updatedAt: now,
	};
	await db.insert(user).values(row);
	const session: RequestSession = {
		user: { id, email: row.email, name: row.name, role },
	};
	return { session, caller: callerFor(session) };
}

export function callerFor(session: RequestSession | null) {
	return createCaller({
		db,
		getSession: async () => session,
		responseHeaders: new Headers(),
	});
}

export interface PlayableCharacter {
	characterId: number;
	sessionToken: string;
}

export async function createPlayableCharacter(
	account: TestAccount,
	classId = "warrior",
	hardcore = false,
): Promise<PlayableCharacter> {
	const characterId = await account.caller.characters.create({
		name: `Hero ${crypto.randomUUID().slice(0, 8)}`,
		classId,
		hardcore,
	});
	const sessionToken = crypto.randomUUID();
	await account.caller.characters.claimCharacterSession({
		characterId,
		sessionToken,
	});
	return { characterId, sessionToken };
}

export async function patchCharacter(
	characterId: number,
	values: Partial<typeof characters.$inferInsert>,
): Promise<void> {
	await db.update(characters).set(values).where(eq(characters.id, characterId));
}

export async function backdateZoneVisit(
	characterId: number,
	exploredMs: number,
): Promise<void> {
	await patchCharacter(characterId, { zoneStartedAt: Date.now() - exploredMs });
}

export async function readCharacter(characterId: number) {
	const row = await db.query.characters.findFirst({
		where: eq(characters.id, characterId),
	});
	if (!row) throw new Error(`character ${characterId} not found`);
	return row;
}

export async function expectServerError(
	promise: Promise<unknown>,
	message: string | RegExp,
): Promise<void> {
	const error = await promise.then(
		() => null,
		(cause: unknown) => cause,
	);
	if (!(error instanceof TRPCError)) {
		expect.fail(`expected a TRPCError, got ${String(error)}`);
	}
	const matches =
		message instanceof RegExp
			? message.test(error.message)
			: error.message === message;
	expect(matches, `"${error.message}" should match ${String(message)}`).toBe(
		true,
	);
}

export async function enterZone(
	account: TestAccount,
	hero: PlayableCharacter,
	zoneId = "forest_starter",
): Promise<string> {
	await patchCharacter(hero.characterId, { currentLocation: zoneId });
	const { zoneSession } = await account.caller.combat.enterZone({
		...hero,
		zoneId,
	});
	return zoneSession;
}

export async function stageBag(
	characterId: number,
	count: number,
): Promise<ZoneBagEntry[]> {
	const data = findStarterItem("starter:rusty_sword");
	if (!data) throw new Error("starter item missing");
	const entries = Array.from({ length: count }, (_, i) => ({
		bagId: `bag-${i}-${crypto.randomUUID()}`,
		data,
		droppedAt: Date.now(),
		droppedFrom: "goblin",
		droppedFromLevel: 1,
	}));
	await patchCharacter(characterId, { zoneBag: entries });
	return entries;
}

export async function inventoryOf(characterId: number) {
	return db
		.select()
		.from(items)
		.where(
			and(
				eq(items.characterId, characterId),
				eq(items.locationKind, "inventory"),
			),
		);
}
