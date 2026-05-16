import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { fetchAuthQuery } from "#/lib/auth-server";
import { api } from "../../convex/_generated/api";

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

function AdminLayout() {
	return (
		<div className="flex min-h-[calc(100vh-64px)] bg-black text-white">
			<aside className="w-56 shrink-0 border-r border-white/15 p-4">
				<h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
					Admin
				</h2>
				<nav className="space-y-1">
					<Link
						to="/admin/items"
						className="block border border-transparent px-3 py-2 text-sm font-medium uppercase tracking-wider text-white/80 no-underline transition hover:border-white/40 hover:text-white"
						activeProps={{
							className:
								"block border border-white px-3 py-2 text-sm font-medium uppercase tracking-wider text-white no-underline bg-white/10",
						}}
					>
						Item Generator
					</Link>
				</nav>
			</aside>
			<main className="flex-1 overflow-hidden p-6">
				<Outlet />
			</main>
		</div>
	);
}
