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
import { useReloadIntoNewBuild } from "#/hooks/useReloadIntoNewBuild";
import { SessionTokenProvider } from "#/hooks/useSessionToken";
import { useUpdateAvailable } from "#/hooks/useUpdateAvailable";
import { consumeFlashToast } from "#/lib/flash-toast";
import { m } from "#/paraglide/messages";
import { getLocale } from "#/paraglide/runtime";

import Footer from "../components/Footer";
import Header from "../components/Header";
import LanguagePicker from "../components/LanguagePicker";
import Toaster from "../components/Toaster";
import UpdateAvailableModal from "../components/UpdateAvailableModal";
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
					{m.not_found_message()}
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

function UpdatePrompt() {
	const { open, update, later } = useUpdateAvailable();
	useReloadIntoNewBuild();
	return <UpdateAvailableModal open={open} onUpdate={update} onLater={later} />;
}

function RootDocument({ children }: { children: React.ReactNode }) {
	const { pathname } = useLocation();
	const chromeless = CHROMELESS_ROUTES.has(pathname);
	const showFooter = !chromeless && !pathname.startsWith("/admin");
	const floatingLanguagePicker = chromeless && pathname !== "/world";

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
								{floatingLanguagePicker && (
									<div className="fixed top-4 left-4 z-50">
										<LanguagePicker />
									</div>
								)}
								{children}
								{showFooter && <Footer />}
							</TooltipPrimitive.Provider>
						</SessionTokenProvider>
					</ConfirmationProvider>
					<UpdatePrompt />
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
