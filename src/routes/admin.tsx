import { createFileRoute, Link, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/admin")({
	component: AdminLayout,
})

function AdminLayout() {
	return (
		<div className="flex min-h-[calc(100vh-64px)]">
			<aside className="w-52 shrink-0 border-r border-[var(--line)] bg-neutral-50 p-4 dark:bg-neutral-900/50">
				<h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-neutral-400">
					Admin
				</h2>
				<nav className="space-y-1">
					<Link
						to="/admin/items"
						className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-700 no-underline transition hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
						activeProps={{
							className:
								"block rounded-md px-3 py-2 text-sm font-medium no-underline bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100",
						}}
					>
						Item Generator
					</Link>
				</nav>
			</aside>
			<main className="flex-1 p-6">
				<Outlet />
			</main>
		</div>
	)
}
