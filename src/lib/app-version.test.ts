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
