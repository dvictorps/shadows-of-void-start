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
import { m } from "#/paraglide/messages";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const MAX_NAME_LENGTH = 20;

const CLASS_LIST: CharacterClassId[] = ["warrior", "rogue", "mage"];

const CLASS_NAME: Record<CharacterClassId, () => string> = {
	warrior: m.class_warrior_name,
	rogue: m.class_rogue_name,
	mage: m.class_mage_name,
};

const CLASS_DESCRIPTION: Record<CharacterClassId, () => string> = {
	warrior: m.class_warrior_description,
	rogue: m.class_rogue_description,
	mage: m.class_mage_description,
};

const ATTRIBUTE_LABEL: Record<
	"strength" | "dexterity" | "intelligence",
	() => string
> = {
	strength: m.attribute_strength,
	dexterity: m.attribute_dexterity,
	intelligence: m.attribute_intelligence,
};

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
			toast.error(m.name_cannot_be_empty());
			return;
		}
		setSubmitting(true);
		try {
			const id = await createCharacter({ name: trimmed, classId, hardcore });
			toast.success(m.character_created({ name: trimmed }));
			reset();
			onCreated(id);
		} catch (err) {
			toast.error(convexErrorMessage(err, m.failed_to_create_character()));
			setSubmitting(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title={m.create_character_title()}
			className="max-w-lg"
		>
			<form onSubmit={handleSubmit} className="space-y-5">
				<div>
					<Label
						htmlFor="char-name"
						className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/60"
					>
						{m.name_label()}
					</Label>
					<Input
						id="char-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={MAX_NAME_LENGTH}
						required
						autoFocus
						placeholder={m.name_placeholder()}
						className="border-white/40 bg-black text-white placeholder:text-white/30 focus:border-white"
					/>
					<p className="mt-1 text-right text-xs text-white/40">
						{name.length}/{MAX_NAME_LENGTH}
					</p>
				</div>

				<div>
					<span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/60">
						{m.class_label()}
					</span>
					<div className="grid grid-cols-3 gap-2">
						{CLASS_LIST.map((id) => {
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
										{CLASS_NAME[id]()}
									</div>
									<div className="mt-1 text-[10px] uppercase tracking-wider text-white/50">
										{ATTRIBUTE_LABEL[CLASS_DEFINITIONS[id].primaryAttribute]()}
									</div>
								</button>
							);
						})}
					</div>
					<p className="mt-2 text-xs leading-relaxed text-white/60">
						{CLASS_DESCRIPTION[classId]()}
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
							{m.hardcore_label()}
						</div>
						<div className="mt-0.5 text-[11px] leading-snug text-white/60">
							{m.hardcore_description()}
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
						{m.cancel()}
					</Button>
					<Button
						type="submit"
						variant="stark"
						disabled={submitting}
						className="px-5 py-2 uppercase tracking-wider"
					>
						{submitting ? m.creating() : m.create_action()}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
