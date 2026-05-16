import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { toast } from "sonner";
import Modal from "#/components/Modal";
import { CLASS_DEFINITIONS } from "#/game/classes/data";
import type { CharacterClassId } from "#/game/classes/types";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const MAX_NAME_LENGTH = 20;

const CLASS_LIST: CharacterClassId[] = ["warrior", "rogue", "mage"];

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onCreated: (id: Id<"characters">) => void;
};

export default function CreateCharacterModal({
	isOpen,
	onClose,
	onCreated,
}: Props) {
	const createCharacter = useMutation(api.characters.create);
	const [name, setName] = useState("");
	const [classId, setClassId] = useState<CharacterClassId>("warrior");
	const [submitting, setSubmitting] = useState(false);

	const reset = () => {
		setName("");
		setClassId("warrior");
		setSubmitting(false);
	};

	const handleClose = () => {
		if (submitting) return;
		reset();
		onClose();
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = name.trim();
		if (trimmed.length === 0) {
			toast.error("Name cannot be empty");
			return;
		}
		setSubmitting(true);
		try {
			const id = await createCharacter({ name: trimmed, classId });
			toast.success(`${trimmed} created`);
			reset();
			onCreated(id);
		} catch (err) {
			const message =
				err instanceof ConvexError ? String(err.data) : "Failed to create";
			toast.error(message);
			setSubmitting(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Create Character"
			className="max-w-lg"
		>
			<form onSubmit={handleSubmit} className="space-y-5">
				<div>
					<label
						htmlFor="char-name"
						className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/60"
					>
						Name
					</label>
					<input
						id="char-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={MAX_NAME_LENGTH}
						required
						autoFocus
						className="w-full border border-white/40 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white"
						placeholder="Enter name"
					/>
					<p className="mt-1 text-right text-xs text-white/40">
						{name.length}/{MAX_NAME_LENGTH}
					</p>
				</div>

				<div>
					<span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/60">
						Class
					</span>
					<div className="grid grid-cols-3 gap-2">
						{CLASS_LIST.map((id) => {
							const def = CLASS_DEFINITIONS[id];
							const selected = classId === id;
							return (
								<button
									key={id}
									type="button"
									onClick={() => setClassId(id)}
									className={`border p-3 text-left transition ${
										selected
											? "border-white bg-white/10"
											: "border-white/40 bg-black hover:bg-white/5"
									}`}
								>
									<div className="display-title text-base uppercase tracking-wider text-white">
										{def.name}
									</div>
									<div className="mt-1 text-[10px] uppercase tracking-wider text-white/50">
										{def.primaryAttribute}
									</div>
								</button>
							);
						})}
					</div>
					<p className="mt-2 text-xs leading-relaxed text-white/60">
						{CLASS_DEFINITIONS[classId].description}
					</p>
				</div>

				<div className="flex justify-end gap-3 pt-2">
					<button
						type="button"
						onClick={handleClose}
						disabled={submitting}
						className="border border-white/40 bg-black px-5 py-2 text-sm font-medium uppercase tracking-wider text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={submitting}
						className="border border-white bg-black px-5 py-2 text-sm font-medium uppercase tracking-wider text-white transition hover:bg-white/10 disabled:opacity-50"
					>
						{submitting ? "Creating..." : "Create"}
					</button>
				</div>
			</form>
		</Modal>
	);
}
