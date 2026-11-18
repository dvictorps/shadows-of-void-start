import type { AnyProcedure } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { SERVER_ERRORS } from "#/lib/server-errors";

import { db } from "../../db/client";
import {
	createAccount,
	createPlayableCharacter,
	enterZone,
	inventoryOf,
	readCharacter,
	stageBag,
	type TestAccount,
} from "../../test/harness";
import type { RequestSession } from "../context";
import { appRouter } from "../router";

const ENDPOINT = "http://test.local/api/trpc";
const OWNER_EXEMPT = new Set(["characters.create"]);

const wireError = z.object({
	error: z.object({
		message: z.string(),
		data: z.object({ code: z.string() }),
	}),
});

interface RouterRecord {
	[key: string]: AnyProcedure | RouterRecord;
}

function isProcedure(
	value: AnyProcedure | RouterRecord,
): value is AnyProcedure {
	return typeof value === "function";
}

function mutationPaths(
	record: RouterRecord,
	prefix: readonly string[] = [],
): string[] {
	return Object.entries(record).flatMap(([key, value]) => {
		const path = [...prefix, key];
		if (!isProcedure(value)) return mutationPaths(value, path);
		return value._def.type === "mutation" ? [path.join(".")] : [];
	});
}

interface ForeignInput {
	id: number;
	characterId: number;
	sessionToken: string;
}

function foreignInput(characterId: number): ForeignInput {
	return { id: characterId, characterId, sessionToken: crypto.randomUUID() };
}

function handle(session: RequestSession | null, req: Request) {
	return fetchRequestHandler({
		endpoint: "/api/trpc",
		router: appRouter,
		req,
		createContext: () => ({
			db,
			getSession: async () => session,
			responseHeaders: new Headers(),
		}),
	});
}

async function post(
	session: RequestSession | null,
	path: string,
	input: ForeignInput,
): Promise<z.infer<typeof wireError>["error"]> {
	const response = await handle(
		session,
		new Request(`${ENDPOINT}/${path}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(input),
		}),
	);
	const body: unknown = await response.json();
	return wireError.parse(body).error;
}

async function victim() {
	const owner = await createAccount();
	const hero = await createPlayableCharacter(owner);
	await enterZone(owner, hero);
	await stageBag(hero.characterId, 2);
	return { owner, hero };
}

async function snapshot(characterId: number) {
	return {
		character: await readCharacter(characterId),
		inventory: await inventoryOf(characterId),
	};
}

async function readsOf(intruder: TestAccount, characterId: number) {
	const { caller } = intruder;
	return {
		character: await caller.characters.byId({ id: characterId }),
		inventory: await caller.items.inventory({ characterId }),
		equipped: await caller.items.equipped({ characterId }),
		zoneBag: await caller.items.zoneBag({ characterId }),
		softcoreStash: await caller.items.stash({ stashMode: "softcore" }),
		list: await caller.characters.list(),
	};
}

describe("another account's character id", () => {
	const paths = mutationPaths(appRouter._def.record);

	it("covers every mutation of the router", () => {
		expect(paths).toContain("characters.claimCharacterSession");
		expect(paths).toContain("combat.recordKill");
		expect(paths).toContain("stash.depositToStash");
		expect(paths.length).toBeGreaterThan(25);
	});

	it("reads as nothing for a signed-in stranger", async () => {
		const { hero } = await victim();
		const stranger = await createAccount();
		expect(await readsOf(stranger, hero.characterId)).toEqual({
			character: null,
			inventory: [],
			equipped: [],
			zoneBag: [],
			softcoreStash: [],
			list: [],
		});
	});

	it("refuses every mutation from a signed-in stranger and changes nothing", async () => {
		const { hero } = await victim();
		const stranger = await createAccount();
		const before = await snapshot(hero.characterId);
		for (const path of paths.filter((p) => !OWNER_EXEMPT.has(p))) {
			const error = await post(
				stranger.session,
				path,
				foreignInput(hero.characterId),
			);
			expect({ path, code: error.data.code }).toEqual({
				path,
				code: "FORBIDDEN",
			});
			expect([
				SERVER_ERRORS.notYourCharacter,
				SERVER_ERRORS.adminRequired,
			]).toContain(error.message);
		}
		expect(await snapshot(hero.characterId)).toEqual(before);
	});

	it("refuses every read and mutation from a signed-out visitor", async () => {
		const { hero } = await victim();
		const before = await snapshot(hero.characterId);
		for (const path of paths) {
			const error = await post(null, path, foreignInput(hero.characterId));
			expect({ path, code: error.data.code }).toEqual({
				path,
				code: "UNAUTHORIZED",
			});
		}
		const input = encodeURIComponent(JSON.stringify({ id: hero.characterId }));
		const read = await handle(
			null,
			new Request(`${ENDPOINT}/characters.byId?input=${input}`),
		);
		expect(read.status).toBe(401);
		expect(await snapshot(hero.characterId)).toEqual(before);
	});
});
