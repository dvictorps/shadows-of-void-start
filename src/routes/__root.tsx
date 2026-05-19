import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useLocation,
	useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { ConfirmationProvider } from "#/hooks/useConfirmationModal";
import { authClient } from "#/lib/auth-client";
import { getToken } from "#/lib/auth-server";
import { consumeFlashToast } from "#/lib/flash-toast";
import { getLocale } from "#/paraglide/runtime";
import Footer from "../components/Footer";
import Header from "../components/Header";
import Toaster from "../components/Toaster";
import PostHogProvider from "../integrations/posthog/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import TanStackQueryProvider from "../integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
	convexQueryClient: ConvexQueryClient;
}

const CHROMELESS_ROUTES = new Set([
	"/",
	"/sign-in",
	"/character-select",
	"/world",
]);

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
	return await getToken();
});

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: async (ctx) => {
		if (typeof document !== "undefined") {
			document.documentElement.setAttribute("lang", getLocale());
		}

		const token = await getAuth();
		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}

		return {
			isAuthenticated: !!token,
			token,
		};
	},

	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Shadows of Void",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
	return (
		<main className="flex h-screen items-center justify-center bg-black text-white">
			<div className="text-center">
				<h1 className="display-title text-4xl uppercase tracking-[0.3em]">
					404
				</h1>
				<p className="mt-3 text-sm uppercase tracking-wider text-white/60">
					Page not found
				</p>
			</div>
		</main>
	);
}

function RootComponent() {
	const context = useRouteContext({ from: Route.id });

	return (
		<ConvexBetterAuthProvider
			client={context.convexQueryClient.convexClient}
			authClient={authClient}
			initialToken={context.token}
		>
			<RootDocument>
				<Outlet />
			</RootDocument>
		</ConvexBetterAuthProvider>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	const { pathname } = useLocation();
	const chromeless = CHROMELESS_ROUTES.has(pathname);

	useEffect(() => {
		consumeFlashToast();
	}, []);

	return (
		<html lang={getLocale()} className="dark" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(168,85,247,0.32)]">
				<PostHogProvider>
					<TanStackQueryProvider>
						<ConfirmationProvider>
							{!chromeless && <Header />}
							{children}
							{!chromeless && <Footer />}
						</ConfirmationProvider>
						<Toaster />
						<TanStackDevtools
							config={{
								position: "bottom-right",
							}}
							plugins={[
								{
									name: "Tanstack Router",
									render: <TanStackRouterDevtoolsPanel />,
								},
								TanStackQueryDevtools,
							]}
						/>
					</TanStackQueryProvider>
				</PostHogProvider>
				<Scripts />
			</body>
		</html>
	);
}
