import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Button } from "#/components/ui/button";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/character-select")({
	component: CharacterSelectPage,
});

function CharacterSelectPage() {
	const userRole = useQuery(api.users.getUserRole);
	const isAdmin = userRole?.role === "admin";

	return (
		<main className="relative h-screen overflow-hidden bg-black text-white">
			{isAdmin && (
				<div className="absolute right-6 top-6 z-10">
					<Link to="/admin" className="no-underline">
						<Button
							variant="outline"
							className="border border-white bg-black text-white hover:bg-white/10 hover:text-white"
						>
							Admin Dashboard
						</Button>
					</Link>
				</div>
			)}

			<div className="flex h-full items-center justify-center px-6 py-6">
				<div className="flex h-full max-h-[88vh] w-full max-w-md flex-col rounded-md border border-white/40 p-4">
					{/* Preview area — grows to fill */}
					<div className="mb-4 flex flex-1 items-center justify-center rounded-md border border-white/40">
						<span className="text-xs uppercase tracking-[0.2em] text-neutral-600">
							Character preview
						</span>
					</div>

					{/* Action buttons */}
					<div className="grid grid-cols-3 gap-3">
						<button
							type="button"
							className="rounded-md border border-white bg-black px-3 py-2.5 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-white/10"
						>
							Criar
						</button>
						<button
							type="button"
							className="rounded-md border border-white bg-black px-3 py-2.5 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-white/10"
						>
							Jogar
						</button>
						<Link to="/" className="no-underline">
							<button
								type="button"
								className="w-full rounded-md border border-white bg-black px-3 py-2.5 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-white/10"
							>
								Voltar
							</button>
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
