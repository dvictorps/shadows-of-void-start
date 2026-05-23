import { convexQuery } from "@convex-dev/react-query";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { findClassDefinition } from "#/game/classes/data";
import type { CharacterClassId } from "#/game/classes/types";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { convexErrorMessage } from "#/lib/convex-errors";
import { formatDate } from "#/lib/format";
import { m } from "#/paraglide/messages";
import { AdminPageHeader, EmptyTableRow } from "#/routes/admin";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/admin/users")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(convexQuery(api.admin.listUsers, {})),
	component: AdminUsersPage,
});

type UserRow = FunctionReturnType<typeof api.admin.listUsers>[number];

const CLASS_NAME: Record<CharacterClassId, () => string> = {
	warrior: m.class_warrior_name,
	rogue: m.class_rogue_name,
	mage: m.class_mage_name,
};

function classDisplayName(classId: string): string {
	const def = findClassDefinition(classId);
	return def ? CLASS_NAME[def.id]() : classId;
}

function AdminUsersPage() {
	const { data: users } = useSuspenseQuery(
		convexQuery(api.admin.listUsers, {}),
	);

	const [search, setSearch] = useState("");
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (q.length === 0) return users;
		return users.filter(
			(u) =>
				u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
		);
	}, [users, search]);

	const setUserRole = useMutation(api.users.setUserRole);
	const confirm = useConfirmationModal();
	const [pendingId, setPendingId] = useState<string | null>(null);

	const handlePromote = async (row: UserRow) => {
		const ok = await confirm({
			title: m.admin_promote_title(),
			message: m.admin_promote_message({ email: row.email }),
			confirmLabel: m.admin_promote_action(),
			cancelLabel: m.cancel(),
		});
		if (!ok) return;
		setPendingId(row.authUserId);
		try {
			await setUserRole({ authUserId: row.authUserId, role: "admin" });
			toast.success(m.admin_promote_success({ email: row.email }));
		} catch (err) {
			toast.error(convexErrorMessage(err, m.admin_promote_failed()));
		} finally {
			setPendingId(null);
		}
	};

	return (
		<div className="flex h-full flex-col gap-5">
			<AdminPageHeader
				title={m.admin_users_title()}
				subtitle={`${filtered.length} / ${users.length}`}
				right={
					<input
						type="search"
						placeholder={m.admin_users_search_placeholder()}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-72 border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
					/>
				}
			/>

			<div className="flex-1 overflow-y-auto border border-white/15">
				<table className="w-full text-sm">
					<thead className="sticky top-0 bg-black">
						<tr className="border-b border-white/20 text-[10px] uppercase tracking-wider text-white/50">
							<th
								className="w-8"
								aria-label={m.admin_users_col_toggle_aria()}
							/>
							<th className="px-3 py-2 text-left font-medium">
								{m.admin_col_email()}
							</th>
							<th className="px-3 py-2 text-left font-medium">
								{m.admin_col_name()}
							</th>
							<th className="px-3 py-2 text-left font-medium">
								{m.admin_users_col_role()}
							</th>
							<th className="px-3 py-2 text-right font-medium">
								{m.admin_users_col_chars()}
							</th>
							<th className="px-3 py-2 text-left font-medium">
								{m.admin_users_col_joined()}
							</th>
							<th className="px-3 py-2 text-right font-medium">
								{m.admin_col_actions()}
							</th>
						</tr>
					</thead>
					<tbody>
						{filtered.length === 0 ? (
							<EmptyTableRow colSpan={7} message={m.admin_users_empty()} />
						) : (
							filtered.map((u) => (
								<UserRowDisplay
									key={u.authUserId}
									user={u}
									expanded={expandedId === u.authUserId}
									onToggle={() =>
										setExpandedId((prev) =>
											prev === u.authUserId ? null : u.authUserId,
										)
									}
									onPromote={() => handlePromote(u)}
									pending={pendingId === u.authUserId}
								/>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function UserRowDisplay({
	user,
	expanded,
	onToggle,
	onPromote,
	pending,
}: {
	user: UserRow;
	expanded: boolean;
	onToggle: () => void;
	onPromote: () => void;
	pending: boolean;
}) {
	return (
		<>
			<tr
				className={`border-b border-white/10 transition hover:bg-white/5 ${
					expanded ? "bg-white/5" : ""
				}`}
			>
				<td className="px-1 py-2 text-center">
					<button
						type="button"
						onClick={onToggle}
						aria-expanded={expanded}
						aria-label={
							expanded
								? m.admin_users_row_hide_aria()
								: m.admin_users_row_show_aria()
						}
						className="inline-flex h-6 w-6 items-center justify-center text-white/60 transition hover:text-white"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
							className={`transition-transform ${expanded ? "rotate-90" : ""}`}
						>
							<path d="M9 18l6-6-6-6" />
						</svg>
					</button>
				</td>
				<td className="px-3 py-2 text-white">{user.email}</td>
				<td className="px-3 py-2 text-white/80">{user.name || "—"}</td>
				<td className="px-3 py-2">
					<RoleBadge role={user.role} />
				</td>
				<td className="px-3 py-2 text-right tabular-nums text-white/80">
					{user.characterCount}
				</td>
				<td className="px-3 py-2 text-xs text-white/50">
					{formatDate(user.createdAt)}
				</td>
				<td className="px-3 py-2 text-right">
					{user.role === "user" ? (
						<Button
							type="button"
							variant="stark"
							size="xs"
							onClick={onPromote}
							disabled={pending}
						>
							{pending ? "…" : m.admin_promote_action()}
						</Button>
					) : (
						<span className="text-[10px] uppercase tracking-wider text-white/40">
							{m.admin_users_already_admin()}
						</span>
					)}
				</td>
			</tr>
			{expanded && (
				<tr className="bg-black">
					<td colSpan={7} className="px-3 py-4">
						<UserCharacters authUserId={user.authUserId} />
					</td>
				</tr>
			)}
		</>
	);
}

function RoleBadge({ role }: { role: "user" | "admin" }) {
	if (role === "admin") {
		return (
			<span className="border border-white bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-black">
				{m.admin_role_admin()}
			</span>
		);
	}
	return (
		<span className="border border-white/30 bg-black px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/60">
			{m.admin_role_user()}
		</span>
	);
}

function UserCharacters({ authUserId }: { authUserId: string }) {
	const { data: characters } = useQuery(
		convexQuery(api.admin.listCharactersForUser, { authUserId }),
	);

	if (characters === undefined) {
		return (
			<p className="text-xs uppercase tracking-wider text-white/40">
				{m.admin_users_chars_loading()}
			</p>
		);
	}

	if (characters.length === 0) {
		return (
			<p className="text-xs uppercase tracking-wider text-white/40">
				{m.admin_users_chars_empty()}
			</p>
		);
	}

	return (
		<div className="overflow-hidden border border-white/15">
			<table className="w-full text-xs">
				<thead className="bg-white/5">
					<tr className="border-b border-white/15 text-[10px] uppercase tracking-wider text-white/50">
						<th className="px-3 py-1.5 text-left font-medium">
							{m.admin_users_chars_col_name()}
						</th>
						<th className="px-3 py-1.5 text-left font-medium">
							{m.admin_users_chars_col_class()}
						</th>
						<th className="px-3 py-1.5 text-right font-medium">
							{m.admin_users_chars_col_level()}
						</th>
						<th className="px-3 py-1.5 text-left font-medium">
							{m.admin_users_chars_col_mode()}
						</th>
						<th className="px-3 py-1.5 text-left font-medium">
							{m.admin_users_chars_col_location()}
						</th>
						<th className="px-3 py-1.5 text-left font-medium">
							{m.admin_users_chars_col_created()}
						</th>
					</tr>
				</thead>
				<tbody>
					{characters.map((c) => (
						<tr key={c._id} className="border-b border-white/5 last:border-b-0">
							<td className="px-3 py-1.5 text-white">{c.name}</td>
							<td className="px-3 py-1.5 text-white/70">
								{classDisplayName(c.classId)}
							</td>
							<td className="px-3 py-1.5 text-right tabular-nums text-white">
								{c.level}
							</td>
							<td className="px-3 py-1.5">
								{c.hardcore ? (
									<span className="text-red-300">
										{m.admin_users_chars_hardcore()}
									</span>
								) : (
									<span className="text-white/50">
										{m.admin_users_chars_softcore()}
									</span>
								)}
							</td>
							<td className="px-3 py-1.5 text-white/60">{c.currentLocation}</td>
							<td className="px-3 py-1.5 text-white/50">
								{formatDate(c.createdAt)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
