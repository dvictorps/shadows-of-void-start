import { convexQuery } from "@convex-dev/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { prefetchAdminTabs } from "#/lib/admin-prefetch";
import { m } from "#/paraglide/messages";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/admin")({
	// Auth fence is sync — no server roundtrip on the navigation hot path.
	// The actual security boundary is `assertAdmin(ctx)` on every admin
	// Convex endpoint; this guard is UX only, so we resolve the admin check
	// from the React Query cache instead of an HTTP server fn.
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/sign-in" });
		}
	},
	loader: async ({ context }) => {
		const role = await context.queryClient.ensureQueryData(
			convexQuery(api.users.getUserRole, {}),
		);
		if (role?.role !== "admin") {
			throw redirect({ to: "/" });
		}
		prefetchAdminTabs(context.queryClient);
	},
	component: AdminLayout,
	pendingComponent: AdminLayoutPending,
	// Defense-in-depth for direct-URL hits where the role isn't pre-cached.
	// In the typical /character-select → /admin flow the loader is sync, so
	// this pending shell never paints.
	pendingMs: 0,
	pendingMinMs: 0,
});

type NavItem = {
	to: "/admin" | "/admin/users" | "/admin/admins" | "/admin/items";
	label: string;
	exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
	{ to: "/admin", label: "Overview", exact: true },
	{ to: "/admin/users", label: "Users" },
	{ to: "/admin/admins", label: "Admins" },
	{ to: "/admin/items", label: "Item Generator" },
];

// Outer container is viewport-constrained (h - header) so the sidebar can't
// scroll out of view and `<main>` is the only scroll container.
function AdminShell({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-[calc(100dvh-4rem)] bg-black text-white">
			<aside className="flex w-56 shrink-0 flex-col justify-between border-r border-white/15 p-4">
				<div>
					<h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
						Admin
					</h2>
					<nav className="space-y-1">
						{NAV_ITEMS.map((item) => (
							<Link
								key={item.to}
								to={item.to}
								preload="render"
								activeOptions={{ exact: item.exact ?? false }}
								className="block border border-transparent px-3 py-2 text-sm font-medium uppercase tracking-wider text-white/80 no-underline transition hover:border-white/40 hover:text-white"
								activeProps={{
									className:
										"block border border-white px-3 py-2 text-sm font-medium uppercase tracking-wider text-white no-underline bg-white/10",
								}}
							>
								{item.label}
							</Link>
						))}
					</nav>
				</div>
				<Link to="/character-select" className="no-underline">
					<Button
						type="button"
						variant="starkMuted"
						className="w-full uppercase tracking-wider"
					>
						← Characters
					</Button>
				</Link>
			</aside>
			<main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
		</div>
	);
}

function AdminLayout() {
	return (
		<AdminShell>
			<Outlet />
		</AdminShell>
	);
}

// Same shell as the real layout — flipping to /admin from character-select
// without it leaves the header on top of stale content while the loader runs.
function AdminLayoutPending() {
	return (
		<AdminShell>
			<p className="text-[10px] uppercase tracking-wider text-white/40">
				{m.admin_loading()}
			</p>
		</AdminShell>
	);
}

