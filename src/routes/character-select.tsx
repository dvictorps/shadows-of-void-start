import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import CreateCharacterModal from "#/components/CreateCharacterModal";
import { Button } from "#/components/ui/button";
import { findClassDefinition } from "#/game/classes/data";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { useModal } from "#/hooks/useModal";
import { convexErrorMessage } from "#/lib/convex-errors";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/character-select")({
	component: CharacterSelectPage,
});

function CharacterSelectPage() {
	const navigate = useNavigate();
	const characters = useQuery(api.characters.list);
	const userRole = useQuery(api.users.getUserRole);
	const removeCharacter = useMutation(api.characters.remove);

	const isAdmin = userRole?.role === "admin";
	const confirm = useConfirmationModal();
	const createModal = useModal();

	const [selectedId, setSelectedId] = useState<Id<"characters"> | null>(null);

	const selected = characters?.find((c) => c._id === selectedId) ?? null;

	const handleCreated = (id: Id<"characters">) => {
		createModal.close();
		setSelectedId(id);
	};

	const handleDelete = async (char: Doc<"characters">) => {
		const ok = await confirm({
			title: "Delete character?",
			message: `"${char.name}" will be permanently lost.`,
			confirmLabel: "Delete",
			cancelLabel: "Keep",
			variant: "destructive",
		});
		if (!ok) return;
		try {
			await removeCharacter({ id: char._id });
			toast.success(`${char.name} deleted`);
			if (selectedId === char._id) setSelectedId(null);
		} catch (err) {
			toast.error(convexErrorMessage(err, "Failed to delete"));
		}
	};

	const handlePlay = () => {
		if (!selected) return;
		navigate({ to: "/world", search: { characterId: selected._id } });
	};

	return (
		<main className="relative h-screen overflow-hidden bg-black text-white">
			{isAdmin && (
				<div className="absolute right-6 top-6 z-10">
					<Link to="/admin" className="no-underline">
						<Button variant="stark">Admin Dashboard</Button>
					</Link>
				</div>
			)}

			<div className="flex h-full items-center justify-center px-6 py-6">
				<div className="flex h-full max-h-[88vh] w-full max-w-md flex-col rounded-md border border-white/40 p-4">
					{/* List area */}
					<div className="mb-4 flex-1 overflow-hidden rounded-md border border-white/40">
						{characters === undefined ? (
							<div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-neutral-600">
								Loading...
							</div>
						) : characters.length === 0 ? (
							<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
								<p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
									No characters yet
								</p>
								<p className="text-sm text-white/60">
									Click "Criar" below to create your first hero.
								</p>
							</div>
						) : (
							<ul className="flex h-full flex-col gap-2 overflow-y-auto p-2">
								{characters.map((char) => (
									<CharacterRow
										key={char._id}
										character={char}
										selected={selectedId === char._id}
										onSelect={() => setSelectedId(char._id)}
										onDelete={() => handleDelete(char)}
									/>
								))}
							</ul>
						)}
					</div>

					{/* Action buttons */}
					<div className="grid grid-cols-3 gap-3">
						<Button
							type="button"
							variant="stark"
							onClick={createModal.open}
							className="px-3 py-2.5 uppercase tracking-wider"
						>
							Criar
						</Button>
						<Button
							type="button"
							variant="stark"
							onClick={handlePlay}
							disabled={!selected}
							className="px-3 py-2.5 uppercase tracking-wider"
						>
							Jogar
						</Button>
						<Link to="/" className="no-underline">
							<Button
								type="button"
								variant="stark"
								className="w-full px-3 py-2.5 uppercase tracking-wider"
							>
								Voltar
							</Button>
						</Link>
					</div>
				</div>
			</div>

			<CreateCharacterModal
				isOpen={createModal.isOpen}
				onClose={createModal.close}
				onCreated={handleCreated}
			/>
		</main>
	);
}

function CharacterRow({
	character,
	selected,
	onSelect,
	onDelete,
}: {
	character: Doc<"characters">;
	selected: boolean;
	onSelect: () => void;
	onDelete: () => void;
}) {
	const classDef = findClassDefinition(character.classId);
	const className = classDef?.name ?? "Unknown";

	return (
		<li>
			<button
				type="button"
				onClick={onSelect}
				className={`flex w-full items-center justify-between border px-3 py-3 text-left transition ${
					selected
						? "border-white bg-white/10"
						: "border-white/30 bg-black hover:bg-white/5"
				}`}
			>
				<div className="min-w-0">
					<div className="display-title truncate text-base uppercase tracking-wider text-white">
						{character.name}
					</div>
					<div className="text-[10px] uppercase tracking-wider text-white/50">
						LVL {character.level} · {className}
					</div>
				</div>
				{selected && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
						}}
						aria-label={`Delete ${character.name}`}
						className="ml-3 shrink-0 border border-red-400/50 bg-black p-1.5 text-red-300 transition hover:border-red-400 hover:bg-red-950/40 hover:text-red-200"
					>
						<TrashIcon />
					</button>
				)}
			</button>
		</li>
	);
}

function TrashIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M3 6h18" />
			<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
			<line x1="10" y1="11" x2="10" y2="17" />
			<line x1="14" y1="11" x2="14" y2="17" />
		</svg>
	);
}
