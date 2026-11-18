// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Modules = {
	version: typeof import("#/lib/app-version");
	hook: typeof import("./useReloadIntoNewBuild");
};

let mods: Modules;

beforeEach(async () => {
	vi.resetModules();
	mods = {
		version: await import("#/lib/app-version"),
		hook: await import("./useReloadIntoNewBuild"),
	};
});

afterEach(cleanup);

async function setup() {
	const loadDocument = vi.fn<(href: string) => void>();
	const { useReloadIntoNewBuild } = mods.hook;
	function Root() {
		useReloadIntoNewBuild(loadDocument);
		return <Outlet />;
	}
	const root = createRootRoute({ component: Root });
	const page = (path: string) =>
		createRoute({
			getParentRoute: () => root,
			path,
			component: () => <p>{path}</p>,
		});
	const router = createRouter({
		routeTree: root.addChildren([page("/character-select"), page("/world")]),
		history: createMemoryHistory({ initialEntries: ["/character-select"] }),
	});
	render(<RouterProvider router={router} />);
	expect(await screen.findByText("/character-select")).toBeTruthy();
	const go = async () => {
		await act(async () => {
			void router.navigate({ to: "/world", search: { characterId: 7 } });
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
		});
	};
	return { router, loadDocument, go };
}

describe("useReloadIntoNewBuild", () => {
	it("navigates in place while the client is current", async () => {
		const { router, loadDocument, go } = await setup();
		await go();
		expect(await screen.findByText("/world")).toBeTruthy();
		expect(router.state.location.pathname).toBe("/world");
		expect(loadDocument).not.toHaveBeenCalled();
	});

	it("loads the target as a new document once the server runs another build", async () => {
		const { router, loadDocument, go } = await setup();
		mods.version.noteServerBuild("a-newer-build");
		await go();
		expect(loadDocument).toHaveBeenCalledWith("/world?characterId=7");
		expect(router.state.location.pathname).toBe("/character-select");
	});
});
