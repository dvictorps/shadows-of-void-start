import { useState } from "react";
import { toast } from "sonner";

import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { CLASS_DEFINITIONS } from "#/game/classes/data";
import { getClassDisplayName } from "#/game/classes/i18n";
import type { CharacterClassId } from "#/game/classes/types";
import { serverErrorMessage } from "#/lib/server-error-message";
import { m } from "#/paraglide/messages";

const MAX_NAME_LENGTH = 20;

const CLASS_LIST: CharacterClassId[] = ["warrior", "rogue", "mage"];

const CLASS_DESCRIPTION = {
	warrior: m.class_warrior_description,
	rogue: m.class_rogue_description,
	mage: m.class_mage_description,
} satisfies Record<CharacterClassId, () => string>;

const ATTRIBUTE_LABEL = {
	strength: m.attribute_strength,
	dexterity: m.attribute_dexterity,
	intelligence: m.attribute_intelligence,
} satisfies Record<"strength" | "dexterity" | "intelligence", () => string>;

export type NewCharacter = {
	name: string;
	classId: CharacterClassId;
	hardcore: boolean;
};

/** The server call the modal makes; the route passes the real mutation. */
export interface CreateCharacterServer {
	/** Resolves with the new character's id. */
	create: (input: NewCharacter) => Promise<number>;
}

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onCreated: (id: number) => void;
	server: CreateCharacterServer;
};

export default function CreateCharacterModal({
	isOpen,
	onClose,
	onCreated,
	server,
}: Props) {
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

	const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		const trimmed = name.trim();
		if (trimmed.length === 0) {
			toast.error(m.name_cannot_be_empty());
			return;
		}
		setSubmitting(true);
		try {
			const id = await server.create({ name: trimmed, classId, hardcore });
			toast.success(m.character_created({ name: trimmed }));
			reset();
			onCreated(id);
		} catch (err) {
			toast.error(serverErrorMessage(err, m.failed_to_create_character()));
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
					<Label htmlFor="char-name" variant="caps" className="mb-1.5 block">
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
						variant="stark"
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
								<Button
									key={id}
									type="button"
									variant="toggle"
									size="card"
									aria-pressed={selected}
									onClick={() => setClassId(id)}
								>
									<div className="display-title text-base uppercase tracking-wider text-white">
										{getClassDisplayName(id)}
									</div>
									<div className="mt-1 text-2xs uppercase tracking-wider text-white/50">
										{ATTRIBUTE_LABEL[CLASS_DEFINITIONS[id].primaryAttribute]()}
									</div>
								</Button>
							);
						})}
					</div>
					<p className="mt-2 text-xs leading-relaxed text-white/60">
						{CLASS_DESCRIPTION[classId]()}
					</p>
				</div>

				<label className="flex cursor-pointer items-start gap-2 border border-danger-strong/30 bg-danger-muted/10 p-3 transition hover:border-danger-strong/50">
					<input
						type="checkbox"
						checked={hardcore}
						onChange={(e) => setHardcore(e.target.checked)}
						className="mt-0.5 accent-danger-strong"
					/>
					<div>
						<div className="text-xs font-medium uppercase tracking-wider text-danger-soft">
							{m.hardcore_label()}
						</div>
						<div className="mt-0.5 text-caption leading-snug text-white/60">
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
						size="wide"
						caps
					>
						{m.cancel()}
					</Button>
					<Button
						type="submit"
						variant="stark"
						disabled={submitting}
						size="wide"
						caps
					>
						{submitting ? m.creating() : m.create_action()}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
