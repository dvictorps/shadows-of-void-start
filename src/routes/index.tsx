import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { authClient } from "#/lib/auth-client"
import { Button } from "#/components/ui/button"
import { api } from "../../convex/_generated/api"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
	const { data: session } = authClient.useSession()

	if (!session?.user) {
		return <LandingPage />
	}

	return <WelcomeScreen />
}

function LandingPage() {
	return (
		<main className="flex min-h-[70vh] items-center justify-center px-4">
			<div className="text-center">
				<h1 className="display-title text-4xl font-bold tracking-tight sm:text-5xl">
					Shadows of Void
				</h1>
				<p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400">
					An ARPG with automatic combat. Gear up, loot, conquer.
				</p>
				<div className="mt-8">
					<Link to="/sign-in">
						<Button size="lg">Get started</Button>
					</Link>
				</div>
			</div>
		</main>
	)
}

function WelcomeScreen() {
	const { data: session } = authClient.useSession()
	const userRole = useQuery(api.users.getUserRole)
	const userName = session?.user?.name || session?.user?.email || "Adventurer"
	const isAdmin = userRole?.role === "admin"

	return (
		<main className="flex min-h-[70vh] items-center justify-center px-4">
			<div className="island-shell w-full max-w-lg rounded-2xl p-8 text-center">
				<p className="island-kicker mb-2">Welcome back</p>
				<h1 className="display-title text-3xl font-bold tracking-tight sm:text-4xl">
					{userName}
				</h1>
				<p className="mt-4 text-sm text-[var(--sea-ink-soft)]">
					The void awaits. Prepare your gear and face the shadows.
				</p>

				<div className="mt-8 flex flex-col items-center gap-3">
					{isAdmin && (
						<Link to="/admin" className="no-underline">
							<Button variant="outline" className="gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
								</svg>
								Admin Dashboard
							</Button>
						</Link>
					)}
				</div>
			</div>
		</main>
	)
}
