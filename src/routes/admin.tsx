import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "#/components/ui/button";
import { prefetchAdminTabs } from "#/lib/admin-prefetch";
import { requireSession } from "#/lib/require-session";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/admin")({
	beforeLoad: async ({ context }) => {
		const me = await requireSession(context);
		if (me.role !== "admin") {
			throw redirect({ to: "/" });
		}
	},
	loader: ({ context }) => {
		prefetchAdminTabs(context.queryClient, context.trpc);
	},
	component: AdminLayout,
	pendingComponent: AdminLayoutPending,
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

function AdminShell({ children }: { children: ReactNode }) {
	return (
		<div className="below-header flex bg-black text-white">
			<aside className="flex w-56 shrink-0 flex-col justify-between border-r border-white/15 p-4">
				<div>
					<h2 className="mb-4 text-xs font-bold uppercase tracking-label text-white/60">
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
					<Button type="button" variant="starkMuted" caps className="w-full">
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

function AdminLayoutPending() {
	return (
		<AdminShell>
			<p className="text-2xs uppercase tracking-wider text-white/40">
				{m.admin_loading()}
			</p>
		</AdminShell>
	);
}
