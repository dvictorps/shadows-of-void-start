import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import CreateCharacterModal from "#/components/CreateCharacterModal";
import { Button } from "#/components/ui/button";
import { getClassDisplayName } from "#/game/classes/i18n";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { useInFlight } from "#/hooks/useInFlight";
import { useModal } from "#/hooks/useModal";
import { useSessionToken } from "#/hooks/useSessionToken";
import { prefetchAdminTabs } from "#/lib/admin-prefetch";
import { authClient } from "#/lib/auth-client";
import { convexErrorMessage } from "#/lib/convex-errors";
import { queueFlashToast } from "#/lib/flash-toast";
import { m } from "#/paraglide/messages";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/character-select")({
	// Role check happens here so the page can render the admin button on the
	// very first frame (no flash where it appears late). Admin-only queries
	// are fired non-blocking from the same loader — by the time the user
	// reaches for the "Admin Dashboard" button, the three tab queries are
	// in-flight and TanStack Query caches the results. Non-admins never
	// trigger the admin queries.
	loader: async ({ context }) => {
		const role = await context.queryClient.ensureQueryData(
			convexQuery(api.users.getUserRole, {}),
		);
		if (role?.role === "admin") {
			prefetchAdminTabs(context.queryClient);
		}
	},
	component: CharacterSelectPage,
});

function CharacterSelectPage() {
	const navigate = useNavigate();
	const characters = useQuery(api.characters.list);
	const { data: userRole } = useSuspenseQuery(
		convexQuery(api.users.getUserRole, {}),
	);
	const removeCharacter = useMutation(api.characters.remove);
	const claimSession = useMutation(api.characters.claimCharacterSession);
	const { sessionToken } = useSessionToken();
	const [isClaiming, runClaim] = useInFlight();

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
			title: m.delete_character_title(),
			message: m.delete_character_message({ name: char.name }),
			confirmLabel: m.delete_action(),
			cancelLabel: m.keep_action(),
			variant: "destructive",
		});
		if (!ok) return;
		try {
			await removeCharacter({ id: char._id });
			toast.success(m.character_deleted_toast({ name: char.name }));
			if (selectedId === char._id) setSelectedId(null);
		} catch (err) {
			toast.error(convexErrorMessage(err, m.delete_failed()));
		}
	};

	// Claim-then-navigate: the active-session token must be stamped on the
	// character before /world mounts, so the combat loop's token-equality
	// gate sees a fresh snapshot and any prior tab gets bumped to the
	// "Session lost" modal on its next write. See docs/plans/in-progress.md
	// "Single active session per character".
	const handlePlay = () =>
		runClaim(async () => {
			if (!selected) return;
			try {
				await claimSession({
					characterId: selected._id,
					sessionToken,
				});
				navigate({ to: "/world", search: { characterId: selected._id } });
			} catch (err) {
				toast.error(convexErrorMessage(err, m.play_failed()));
			}
		});

	const handleSignOut = () => {
		void authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					queueFlashToast("success", m.sign_out_toast());
					window.location.href = "/";
				},
			},
		});
	};

	return (
		<main className="relative h-screen overflow-hidden bg-black text-white">
			{isAdmin && (
				<div className="absolute right-6 top-6 z-10">
					<Link to="/admin" preload="render" className="no-underline">
						<Button variant="stark">{m.admin_dashboard()}</Button>
					</Link>
				</div>
			)}

			<div className="absolute right-6 bottom-6 z-10">
				<Button
					type="button"
					variant="stark"
					onClick={handleSignOut}
					className="uppercase tracking-wider"
				>
					{m.sign_out_button()}
				</Button>
			</div>

			<div className="flex h-full items-center justify-center px-6 py-6">
				<div className="flex h-full max-h-[88vh] w-full max-w-md flex-col rounded-md border border-white/40 p-4">
					{/* List area */}
					<div className="mb-4 flex-1 overflow-hidden rounded-md border border-white/40">
						{characters === undefined ? (
							<div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-neutral-600">
								{m.loading()}
							</div>
						) : characters.length === 0 ? (
							<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
								<p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
									{m.character_select_empty()}
								</p>
								<p className="text-sm text-white/60">
									{m.character_select_empty_hint()}
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
							{m.create_character_button()}
						</Button>
						<Button
							type="button"
							variant="stark"
							onClick={handlePlay}
							disabled={!selected || isClaiming}
							className="px-3 py-2.5 uppercase tracking-wider"
						>
							{m.play_character_button()}
						</Button>
						<Link to="/" className="no-underline">
							<Button
								type="button"
								variant="stark"
								className="w-full px-3 py-2.5 uppercase tracking-wider"
							>
								{m.back()}
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
	const className = getClassDisplayName(character.classId);

	return (
		<li
			className={`flex items-stretch border transition ${
				selected
					? "border-white bg-white/10"
					: "border-white/30 bg-black hover:bg-white/5"
			}`}
		>
			<button
				type="button"
				onClick={onSelect}
				className="flex flex-1 items-center justify-between px-3 py-3 text-left"
			>
				<div className="min-w-0">
					<div className="display-title truncate text-base uppercase tracking-wider text-white">
						{character.name}
					</div>
					<div className="text-[10px] uppercase tracking-wider text-white/50">
						{m.character_row_level()} {character.level} · {className}
					</div>
				</div>
			</button>
			{selected && (
				<button
					type="button"
					onClick={onDelete}
					aria-label={m.delete_aria_label({ name: character.name })}
					className="m-2 shrink-0 self-center border border-red-400/50 bg-black p-1.5 text-red-300 transition hover:border-red-400 hover:bg-red-950/40 hover:text-red-200"
				>
					<TrashIcon />
				</button>
			)}
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
