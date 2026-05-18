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
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						"radial-gradient(ellipse 60% 45% at 50% 42%, rgba(168, 85, 247, 0.18), rgba(88, 28, 135, 0.08) 45%, transparent 75%)",
				}}
			/>

			<div className="relative flex h-full flex-col items-center justify-center gap-12 px-6 py-6">
				<h1 className="display-title text-glow-purple text-center text-7xl uppercase leading-[0.95] md:text-9xl">
					Shadows
					<br />
					of Void
				</h1>

				<Link to={playTarget} className="no-underline">
					<Button
						size="lg"
						variant="ghost-purple"
						disabled={isPending}
						className="px-12 py-6 text-xl uppercase tracking-[0.25em]"
					>
						Play
					</Button>
				</Link>
			</div>
		</main>
	);
}
