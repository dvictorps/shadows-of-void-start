import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { BUILD_ID, BUILD_ID_HEADER } from "#/lib/app-version";
import { createContext } from "#/server/trpc/context";
import { appRouter } from "#/server/trpc/router";

function handle({ request }: { request: Request }) {
	return fetchRequestHandler({
		endpoint: "/api/trpc",
		req: request,
		router: appRouter,
		createContext: () => createContext(request),
		responseMeta: ({ ctx }) => {
			const headers = new Headers(ctx?.responseHeaders);
			headers.set(BUILD_ID_HEADER, BUILD_ID);
			return { headers };
		},
	});
}

export const Route = createFileRoute("/api/trpc/$")({
	server: { handlers: { GET: handle, POST: handle } },
});
