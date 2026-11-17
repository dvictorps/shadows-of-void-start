import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "#/components/ui/button";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	const { data: session, isPending } = authClient.useSession();
	const playTarget = session?.user ? "/character-select" : "/sign-in";

	return (
		<main className="relative h-screen overflow-hidden bg-black text-white">
			{/* Atmospheric radial vignette behind the title — purely decorative */}
			<div
				aria-hidden
				className="void-vignette pointer-events-none absolute inset-0"
			/>

			<div className="relative flex h-full flex-col items-center justify-center gap-12 px-6 py-6">
				<h1 className="display-title glow-purple text-center text-7xl uppercase leading-display md:text-9xl">
					Shadows
					<br />
					of Void
				</h1>

				{isPending ? (
					<Button size="hero" variant="ghost-purple" disabled>
						Play
					</Button>
				) : (
					<Button size="hero" variant="ghost-purple" asChild>
						<Link to={playTarget} className="no-underline">
							Play
						</Link>
					</Button>
				)}
			</div>
		</main>
	);
}
