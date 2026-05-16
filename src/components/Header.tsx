import { Link } from "@tanstack/react-router";
import BetterAuthHeader from "../integrations/better-auth/header-user.tsx";

export default function Header() {
	return (
		<header className="sticky top-0 z-50 border-b border-white/15 bg-black/80 px-4 backdrop-blur-lg">
			<nav className="page-wrap flex items-center gap-3 py-3 sm:py-4">
				<Link
					to="/"
					className="display-title text-lg uppercase tracking-[0.2em] text-white no-underline"
				>
					Shadows of Void
				</Link>

				<div className="ml-auto flex items-center gap-2">
					<BetterAuthHeader />
				</div>
			</nav>
		</header>
	);
}
