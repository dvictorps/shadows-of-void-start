import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	const { data: session, isPending } = authClient.useSession();
	const playTarget = session?.user ? "/character-select" : "/sign-in";

	return (
		<main className="relative h-screen overflow-hidden bg-black text-white">
			<div className="flex h-full flex-col items-center justify-center gap-12 px-6 py-6">
				<h1 className="display-title text-glow-purple text-center text-7xl uppercase leading-[0.95] md:text-9xl">
					Shadows
					<br />
					of Void
				</h1>

				<Link to={playTarget} className="no-underline">
					<Button
						size="lg"
						disabled={isPending}
						className="border border-white bg-black px-12 py-6 text-xl uppercase tracking-[0.25em] text-white hover:bg-white/10 hover:text-white"
					>
						Play
					</Button>
				</Link>
			</div>
		</main>
	);
}
