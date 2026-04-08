import { Link } from "@tanstack/react-router";
import BetterAuthHeader from "../integrations/better-auth/header-user.tsx";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
	return (
		<header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
			<nav className="page-wrap flex items-center gap-3 py-3 sm:py-4">
				<h2 className="m-0 text-base font-semibold tracking-tight">
					<Link
						to="/"
						className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
					>
						Shadows of Void
					</Link>
				</h2>

				<div className="ml-auto flex items-center gap-2">
					<BetterAuthHeader />
					<ThemeToggle />
				</div>
			</nav>
		</header>
	);
}
