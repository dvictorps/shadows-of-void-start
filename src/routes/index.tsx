import { createFileRoute, Link } from "@tanstack/react-router"
import { authClient } from "#/lib/auth-client"
import { Button } from "#/components/ui/button"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
	const { data: session } = authClient.useSession()

	return (
		<main className="flex min-h-[70vh] items-center justify-center px-4">
			<div className="text-center">
				<h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
					Shadows of Void
				</h1>
				<p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400">
					A real-time browser combat game.
				</p>

				<div className="mt-8">
					{session?.user ? (
						<p className="text-sm text-neutral-600 dark:text-neutral-300">
							Logged in as{" "}
							<span className="font-medium">{session.user.name || session.user.email}</span>
						</p>
					) : (
						<Link to="/sign-in">
							<Button size="lg">Get started</Button>
						</Link>
					)}
				</div>
			</div>
		</main>
	)
}
