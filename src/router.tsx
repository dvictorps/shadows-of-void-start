import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,

		context: getContext(),

		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// Fire hover-intent preload with no dwell time. Default is ~50ms, which
		// loses the window when a user hovers briefly before clicking. With 0
		// the loader starts on the first hover event — by the click, beforeLoad
		// + loader are usually done, so the route swap is sync.
		defaultPreloadDelay: 0,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
