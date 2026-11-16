import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createContext } from "#/server/trpc/context";
import { appRouter } from "#/server/trpc/router";

function handle({ request }: { request: Request }) {
	return fetchRequestHandler({
		endpoint: "/api/trpc",
		req: request,
		router: appRouter,
		createContext: () => createContext(request),
		responseMeta: ({ ctx }) => ({ headers: ctx?.responseHeaders }),
	});
}

export const Route = createFileRoute("/api/trpc/$")({
	server: { handlers: { GET: handle, POST: handle } },
});
