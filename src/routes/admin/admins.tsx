import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { useCachedQuery } from "#/hooks/useCachedQuery";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { convexErrorMessage } from "#/lib/convex-errors";
import { formatDate } from "#/lib/format";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/admin/admins")({
	component: AdminAdminsPage,
});

type AdminRow = FunctionReturnType<typeof api.admin.listAdmins>[number];

function AdminAdminsPage() {
	const admins = useCachedQuery("admin.admins", useQuery(api.admin.listAdmins));
	const me = useQuery(api.users.getUserRole);

	const setUserRole = useMutation(api.users.setUserRole);
	const confirm = useConfirmationModal();
	const [pendingId, setPendingId] = useState<string | null>(null);

	const handleRevoke = async (row: AdminRow) => {
		const ok = await confirm({
			title: "Revoke admin",
			message: `Remover permissão de admin de ${row.email}?`,
			confirmLabel: "Revoke",
			cancelLabel: "Cancel",
			variant: "destructive",
		});
		if (!ok) return;
		setPendingId(row.authUserId);
		try {
			await setUserRole({ authUserId: row.authUserId, role: "user" });
			toast.success(`${row.email} removido dos admins`);
		} catch (err) {
			toast.error(convexErrorMessage(err, "Falha ao revogar"));
		} finally {
			setPendingId(null);
		}
	};

	return (
		<div className="flex h-full flex-col gap-5">
			<header className="flex items-end justify-between border-b border-white/15 pb-4">
				<div>
					<h1 className="display-title text-2xl uppercase tracking-[0.15em] text-white">
						Admins
					</h1>
					<p className="mt-1 text-xs uppercase tracking-wider text-white/50">
						{admins ? `${admins.length} admins ativos` : "carregando…"}
					</p>
				</div>
				<p className="max-w-xs text-right text-[10px] uppercase tracking-wider text-white/40">
					Promova novos admins pela aba Users
				</p>
			</header>

			<div className="flex-1 overflow-y-auto border border-white/15">
				<table className="w-full text-sm">
					<thead className="sticky top-0 bg-black">
						<tr className="border-b border-white/20 text-[10px] uppercase tracking-wider text-white/50">
							<th className="px-3 py-2 text-left font-medium">Email</th>
							<th className="px-3 py-2 text-left font-medium">Name</th>
							<th className="px-3 py-2 text-left font-medium">Granted</th>
							<th className="px-3 py-2 text-right font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{admins === undefined ? (
							<tr>
								<td
									colSpan={4}
									className="px-3 py-8 text-center text-xs uppercase tracking-wider text-white/40"
								>
									carregando admins…
								</td>
							</tr>
						) : admins.length === 0 ? (
							<tr>
								<td
									colSpan={4}
									className="px-3 py-8 text-center text-xs uppercase tracking-wider text-white/40"
								>
									nenhum admin ativo
								</td>
							</tr>
						) : (
							admins.map((a) => {
								const isMe = me?.authUserId === a.authUserId;
								return (
									<tr
										key={a.authUserId}
										className="border-b border-white/10 last:border-b-0"
									>
										<td className="px-3 py-2 text-white">{a.email}</td>
										<td className="px-3 py-2 text-white/80">{a.name || "—"}</td>
										<td className="px-3 py-2 text-xs text-white/50">
											{formatDate(a.grantedAt)}
										</td>
										<td className="px-3 py-2 text-right">
											{isMe ? (
												<span className="text-[10px] uppercase tracking-wider text-white/40">
													(você)
												</span>
											) : (
												<Button
													type="button"
													variant="starkDestructive"
													size="xs"
													onClick={() => handleRevoke(a)}
													disabled={pendingId === a.authUserId}
												>
													{pendingId === a.authUserId ? "…" : "Revoke"}
												</Button>
											)}
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
