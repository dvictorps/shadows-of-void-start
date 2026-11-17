import {
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import CreateCharacterModal from "#/components/CreateCharacterModal";
import { Button } from "#/components/ui/button";
import { getClassDisplayName } from "#/game/classes/i18n";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { useInFlight } from "#/hooks/useInFlight";
import { useModal } from "#/hooks/useModal";
import { useSessionToken } from "#/hooks/useSessionToken";
import { useTRPC } from "#/integrations/trpc/client";
import { prefetchAdminTabs } from "#/lib/admin-prefetch";
import type { CharacterRow } from "#/lib/api-types";
import { authClient } from "#/lib/auth-client";
import { queueFlashToast } from "#/lib/flash-toast";
import { requireSession } from "#/lib/require-session";
import { serverErrorMessage } from "#/lib/server-error-message";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/character-select")({
	loader: async ({ context }) => {
		const me = await requireSession(context);
		if (me.role === "admin") {
			prefetchAdminTabs(context.queryClient, context.trpc);
		}
	},
	component: CharacterSelectPage,
});

function CharacterSelectPage() {
	const navigate = useNavigate();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: characters } = useQuery(trpc.characters.list.queryOptions());
	const { data: me } = useSuspenseQuery(trpc.users.getUserRole.queryOptions());
	const listKey = trpc.characters.list.queryKey();
	const { mutateAsync: removeCharacter } = useMutation(
		trpc.characters.remove.mutationOptions({
			onSuccess: (_result, { id }) =>
				queryClient.setQueryData(listKey, (list) =>
					list?.filter((c) => c.id !== id),
				),
		}),
	);
	const { mutateAsync: createCharacter } = useMutation(
		trpc.characters.create.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
		}),
	);
	const { mutateAsync: claimSession } = useMutation(
		trpc.characters.claimCharacterSession.mutationOptions(),
	);
	const { sessionToken } = useSessionToken();
	const [isClaiming, runClaim] = useInFlight();

	const isAdmin = me?.role === "admin";
	const confirm = useConfirmationModal();
	const createModal = useModal();

	const [selectedId, setSelectedId] = useState<number | null>(null);

	const selected = characters?.find((c) => c.id === selectedId) ?? null;

	const handleCreated = (id: number) => {
		createModal.close();
		setSelectedId(id);
	};

	const handleDelete = async (char: CharacterRow) => {
		const ok = await confirm({
			title: m.delete_character_title(),
			message: m.delete_character_message({ name: char.name }),
			confirmLabel: m.delete_action(),
			cancelLabel: m.keep_action(),
			variant: "destructive",
		});
		if (!ok) return;
		try {
			await removeCharacter({ id: char.id });
			toast.success(m.character_deleted_toast({ name: char.name }));
			if (selectedId === char.id) setSelectedId(null);
		} catch (err) {
			toast.error(serverErrorMessage(err, m.delete_failed()));
		}
	};

	const handlePlay = () =>
		runClaim(async () => {
			if (!selected) return;
			try {
				await claimSession({ characterId: selected.id, sessionToken });
				queryClient.setQueryData(
					trpc.characters.byId.queryKey({ id: selected.id }),
					(row) => (row ? { ...row, activeSessionToken: sessionToken } : row),
				);
				void navigate({ to: "/world", search: { characterId: selected.id } });
			} catch (err) {
				toast.error(serverErrorMessage(err, m.play_failed()));
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
				<Button type="button" variant="stark" caps onClick={handleSignOut}>
					{m.sign_out_button()}
				</Button>
			</div>

			<div className="flex h-full items-center justify-center p-6">
				<div className="flex h-full max-h-full w-full max-w-md flex-col rounded-md border border-white/40 p-4">
					<div className="mb-4 flex-1 overflow-hidden rounded-md border border-white/40">
						{characters === undefined ? (
							<div className="flex h-full items-center justify-center text-xs uppercase tracking-label text-muted-foreground">
								{m.loading()}
							</div>
						) : characters.length === 0 ? (
							<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
								<p className="text-xs uppercase tracking-label text-muted-foreground">
									{m.character_select_empty()}
								</p>
								<p className="text-sm text-white/60">
									{m.character_select_empty_hint()}
								</p>
							</div>
						) : (
							<ul className="flex h-full flex-col gap-2 overflow-y-auto p-2">
								{characters.map((char) => (
									<CharacterListRow
										key={char.id}
										character={char}
										selected={selectedId === char.id}
										onSelect={() => setSelectedId(char.id)}
										onDelete={() => handleDelete(char)}
									/>
								))}
							</ul>
						)}
					</div>

					<div className="grid grid-cols-3 gap-3">
						<Button
							type="button"
							variant="stark"
							size="tall"
							caps
							onClick={createModal.open}
						>
							{m.create_character_button()}
						</Button>
						<Button
							type="button"
							variant="stark"
							size="tall"
							caps
							onClick={handlePlay}
							disabled={!selected || isClaiming}
						>
							{m.play_character_button()}
						</Button>
						<Button asChild variant="stark" size="tall" caps>
							<Link to="/" className="no-underline">
								{m.back()}
							</Link>
						</Button>
					</div>
				</div>
			</div>

			<CreateCharacterModal
				isOpen={createModal.isOpen}
				onClose={createModal.close}
				onCreated={handleCreated}
				server={{ create: createCharacter }}
			/>
		</main>
	);
}

function CharacterListRow({
	character,
	selected,
	onSelect,
	onDelete,
}: {
	character: CharacterRow;
	selected: boolean;
	onSelect: () => void;
	onDelete: () => void;
}) {
	const className = getClassDisplayName(character.classId);

	return (
		<li
			className={`flex items-center border transition ${
				selected
					? "border-white bg-white/10"
					: "border-white/30 bg-black hover:bg-white/5"
			}`}
		>
			<Button
				type="button"
				variant="ghost"
				size="tall"
				onClick={onSelect}
				className="min-w-0 flex-1 justify-start"
			>
				<div className="min-w-0 text-left">
					<div className="display-title truncate text-base uppercase tracking-wider text-white">
						{character.name}
					</div>
					<div className="text-2xs uppercase tracking-wider text-white/50">
						{m.character_row_level()} {character.level} · {className}
					</div>
				</div>
			</Button>
			{selected && (
				<Button
					type="button"
					variant="starkDestructive"
					size="icon-sm"
					onClick={onDelete}
					aria-label={m.delete_aria_label({ name: character.name })}
					className="m-2 shrink-0"
				>
					<Trash2 aria-hidden="true" />
				</Button>
			)}
		</li>
	);
}
