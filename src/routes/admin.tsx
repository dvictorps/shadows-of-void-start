import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button } from "#/components/ui/button";
import { fetchAuthQuery } from "#/lib/auth-server";
import { api } from "../../convex/_generated/api";

// Server-side admin check used by the route guard. Runs on every navigation
// into the /admin subtree (TanStack Router caches per-navigation, not across
// navigations). The actual security boundary is `assertAdmin(ctx)` inside
// every admin Convex endpoint — this guard is UX only.
const checkIsAdmin = createServerFn({ method: "GET" }).handler(async () => {
	return await fetchAuthQuery(api.users.isAdmin);
});

export const Route = createFileRoute("/admin")({
	beforeLoad: async ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/sign-in" });
		}

		try {
			const isAdmin = await checkIsAdmin();
			if (!isAdmin) {
				throw redirect({ to: "/" });
			}
		} catch (err) {
			if (err instanceof Response) throw err;
			if (typeof err === "object" && err !== null && "isRedirect" in err)
				throw err;
			throw redirect({ to: "/" });
		}
	},
	component: AdminLayout,
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

function AdminLayout() {
	return (
		<div className="flex min-h-[calc(100vh-64px)] bg-black text-white">
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
			<main className="flex-1 overflow-auto p-6">
				<Outlet />
			</main>
		</div>
	);
}
