import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { useEffect } from "react";

import { ConfirmationProvider } from "#/hooks/useConfirmationModal";
import { SessionTokenProvider } from "#/hooks/useSessionToken";
import { consumeFlashToast } from "#/lib/flash-toast";
import { getLocale } from "#/paraglide/runtime";

import Footer from "../components/Footer";
import Header from "../components/Header";
import Toaster from "../components/Toaster";
import PostHogProvider from "../integrations/posthog/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import type { TRPC } from "../integrations/trpc/client";

import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
	trpc: TRPC;
}

const CHROMELESS_ROUTES = new Set([
	"/",
	"/sign-in",
	"/character-select",
	"/world",
]);

export const Route = createRootRouteWithContext<MyRouterContext>()({
	// The session is checked by the routes that need it (`requireSession` in
	// world / admin), from the query cache, not on every navigation here.
	beforeLoad: () => {
		if (globalThis.document !== undefined) {
			document.documentElement.setAttribute("lang", getLocale());
		}
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
				<h1 className="display-title text-4xl uppercase tracking-display">
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
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	const { pathname } = useLocation();
	const chromeless = CHROMELESS_ROUTES.has(pathname);
	// Admin is a control dashboard — header for nav consistency, no footer.
	const showFooter = !chromeless && !pathname.startsWith("/admin");

	useEffect(() => {
		consumeFlashToast();
	}, []);

	return (
		<html lang={getLocale()} className="dark" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="font-sans antialiased wrap-anywhere selection:bg-selection">
				<PostHogProvider>
					<ConfirmationProvider>
						<SessionTokenProvider>
							<TooltipPrimitive.Provider delayDuration={150}>
								{!chromeless && <Header />}
								{children}
								{showFooter && <Footer />}
							</TooltipPrimitive.Provider>
						</SessionTokenProvider>
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
				</PostHogProvider>
				<Scripts />
			</body>
		</html>
	);
}
