import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { CLASS_DEFINITIONS } from "#/game/classes/data";
import type { CharacterClassId } from "#/game/classes/types";
import { convexErrorMessage } from "#/lib/convex-errors";
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
	const [hardcore, setHardcore] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const reset = () => {
		setName("");
		setClassId("warrior");
		setHardcore(false);
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
			const id = await createCharacter({ name: trimmed, classId, hardcore });
			toast.success(`${trimmed} created`);
			reset();
			onCreated(id);
		} catch (err) {
			toast.error(convexErrorMessage(err, "Failed to create"));
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
					<Label
						htmlFor="char-name"
						className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/60"
					>
						Name
					</Label>
					<Input
						id="char-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={MAX_NAME_LENGTH}
						required
						autoFocus
						placeholder="Enter name"
						className="border-white/40 bg-black text-white placeholder:text-white/30 focus:border-white"
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

				<label className="flex cursor-pointer items-start gap-2 border border-red-500/30 bg-red-950/10 p-3 transition hover:border-red-500/50">
					<input
						type="checkbox"
						checked={hardcore}
						onChange={(e) => setHardcore(e.target.checked)}
						className="mt-0.5 accent-red-500"
					/>
					<div>
						<div className="text-xs font-medium uppercase tracking-wider text-red-300">
							Hardcore
						</div>
						<div className="mt-0.5 text-[11px] leading-snug text-white/60">
							Death is permanent. Cannot be toggled after creation. Hardcore
							characters use a separate stash.
						</div>
					</div>
				</label>

				<div className="flex justify-end gap-3 pt-2">
					<Button
						type="button"
						variant="starkMuted"
						onClick={handleClose}
						disabled={submitting}
						className="px-5 py-2 uppercase tracking-wider"
					>
						Cancel
					</Button>
					<Button
						type="submit"
						variant="stark"
						disabled={submitting}
						className="px-5 py-2 uppercase tracking-wider"
					>
						{submitting ? "Creating..." : "Create"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
