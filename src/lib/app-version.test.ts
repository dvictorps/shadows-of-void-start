import { beforeEach, describe, expect, it, vi } from "vitest";

type AppVersion = typeof import("./app-version");

let version: AppVersion;

beforeEach(async () => {
	vi.resetModules();
	version = await import("./app-version");
});

function respondingWith(build: string | null): typeof fetch {
	const headers = new Headers();
	if (build !== null) headers.set(version.BUILD_ID_HEADER, build);
	return vi
		.fn<typeof fetch>()
		.mockResolvedValue(new Response("{}", { headers }));
}

describe("withBuildCheck", () => {
	it("stays current while the server answers with the client's build", async () => {
		await version.withBuildCheck(respondingWith(version.BUILD_ID))("/api/trpc");
		expect(version.isClientOutdated()).toBe(false);
	});

	it("stays current when the response carries no build header", async () => {
		await version.withBuildCheck(respondingWith(null))("/api/trpc");
		expect(version.isClientOutdated()).toBe(false);
	});

	it("flags the client outdated once the server answers with another build, and notifies once", async () => {
		const listener = vi.fn<() => void>();
		version.subscribeClientOutdated(listener);
		const checked = version.withBuildCheck(respondingWith("a-newer-build"));

		await checked("/api/trpc");
		await checked("/api/trpc");

		expect(version.isClientOutdated()).toBe(true);
		expect(listener).toHaveBeenCalledOnce();
	});

	it("hands the response through untouched", async () => {
		const response = await version.withBuildCheck(respondingWith("other"))(
			"/api/trpc",
		);
		expect(await response.text()).toBe("{}");
	});

	it("stops notifying an unsubscribed listener", () => {
		const listener = vi.fn<() => void>();
		version.subscribeClientOutdated(listener)();
		version.noteServerBuild("a-newer-build");
		expect(listener).not.toHaveBeenCalled();
	});
});

describe("checkServerBuild", () => {
	it("asks the server for its build without touching the game's endpoints", async () => {
		const fetchImpl = respondingWith("a-newer-build");
		await version.checkServerBuild(0, fetchImpl);
		expect(fetchImpl).toHaveBeenCalledWith("/api/trpc/health", {
			cache: "no-store",
		});
		expect(version.isClientOutdated()).toBe(true);
	});

	it("checks at most once per interval", async () => {
		const fetchImpl = respondingWith(version.BUILD_ID);
		await version.checkServerBuild(0, fetchImpl);
		await version.checkServerBuild(
			version.BUILD_CHECK_MIN_INTERVAL_MS - 1,
			fetchImpl,
		);
		expect(fetchImpl).toHaveBeenCalledOnce();
		await version.checkServerBuild(
			version.BUILD_CHECK_MIN_INTERVAL_MS,
			fetchImpl,
		);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it("stops checking once the client is known to be outdated", async () => {
		version.noteServerBuild("a-newer-build");
		const fetchImpl = respondingWith("a-newer-build");
		await version.checkServerBuild(0, fetchImpl);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("swallows a failed check (offline) and stays current", async () => {
		const fetchImpl = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new TypeError("Failed to fetch"));
		await version.checkServerBuild(0, fetchImpl);
		expect(version.isClientOutdated()).toBe(false);
	});
});

describe("reloadIntoNewBuild", () => {
	const leaveWorld = {
		action: "PUSH",
		currentLocation: { pathname: "/world" },
		nextLocation: {
			pathname: "/character-select",
			href: "/character-select",
		},
	};

	it("lets every navigation through while the client is current", () => {
		const loadDocument = vi.fn<(href: string) => void>();
		expect(version.reloadIntoNewBuild(leaveWorld, loadDocument)).toBe(false);
		expect(loadDocument).not.toHaveBeenCalled();
	});

	it("turns a route change of an outdated client into a document load of the target", () => {
		version.noteServerBuild("a-newer-build");
		const loadDocument = vi.fn<(href: string) => void>();
		const enterWorld = {
			action: "PUSH",
			currentLocation: { pathname: "/character-select" },
			nextLocation: { pathname: "/world", href: "/world?characterId=7" },
		};
		expect(version.reloadIntoNewBuild(enterWorld, loadDocument)).toBe(true);
		expect(loadDocument).toHaveBeenCalledWith("/world?characterId=7");
	});

	it("keeps an outdated client in place for a search-only or replace step", () => {
		version.noteServerBuild("a-newer-build");
		const loadDocument = vi.fn<(href: string) => void>();
		const sameRoute = {
			action: "PUSH",
			currentLocation: { pathname: "/world" },
			nextLocation: { pathname: "/world", href: "/world?characterId=8" },
		};
		expect(version.reloadIntoNewBuild(sameRoute, loadDocument)).toBe(false);
		expect(
			version.reloadIntoNewBuild(
				{ ...leaveWorld, action: "REPLACE" },
				loadDocument,
			),
		).toBe(false);
		expect(loadDocument).not.toHaveBeenCalled();
	});
});
