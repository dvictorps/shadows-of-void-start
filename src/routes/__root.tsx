import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRouteWithContext,
	useRouteContext,
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
import Footer from "../components/Footer"
import Header from "../components/Header"

import PostHogProvider from "../integrations/posthog/provider"

import TanStackQueryProvider from "../integrations/tanstack-query/root-provider"

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools"

import { getLocale } from "#/paraglide/runtime"
import { authClient } from "#/lib/auth-client"
import { getToken } from "#/lib/auth-server"

import appCss from "../styles.css?url"

import type { QueryClient } from "@tanstack/react-query"
import type { ConvexQueryClient } from "@convex-dev/react-query"

interface MyRouterContext {
	queryClient: QueryClient
	convexQueryClient: ConvexQueryClient
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
	return await getToken()
})

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: async (ctx) => {
		if (typeof document !== "undefined") {
			document.documentElement.setAttribute("lang", getLocale())
		}

		const token = await getAuth()
		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
		}

		return {
			isAuthenticated: !!token,
			token,
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
})

function RootComponent() {
	const context = useRouteContext({ from: Route.id })

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
	)
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang={getLocale()} suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]">
				<PostHogProvider>
					<TanStackQueryProvider>
						<Header />
						{children}
						<Footer />
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
	)
}
