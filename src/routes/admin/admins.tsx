import { convexQuery } from "@convex-dev/react-query";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { convexErrorMessage } from "#/lib/convex-errors";
import { formatDate } from "#/lib/format";
import { m } from "#/paraglide/messages";
import { AdminPageHeader, EmptyTableRow } from "#/routes/admin";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/admin/admins")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(convexQuery(api.admin.listAdmins, {})),
	component: AdminAdminsPage,
});

type AdminRow = FunctionReturnType<typeof api.admin.listAdmins>[number];

function AdminAdminsPage() {
	const { data: admins } = useSuspenseQuery(
		convexQuery(api.admin.listAdmins, {}),
	);
	const { data: me } = useQuery(convexQuery(api.users.getUserRole, {}));

	const setUserRole = useMutation(api.users.setUserRole);
	const confirm = useConfirmationModal();
	const [pendingId, setPendingId] = useState<string | null>(null);

	const handleRevoke = async (row: AdminRow) => {
		const ok = await confirm({
			title: m.admin_revoke_title(),
			message: m.admin_revoke_message({ email: row.email }),
			confirmLabel: m.admin_revoke_action(),
			cancelLabel: m.cancel(),
			variant: "destructive",
		});
		if (!ok) return;
		setPendingId(row.authUserId);
		try {
			await setUserRole({ authUserId: row.authUserId, role: "user" });
			toast.success(m.admin_revoke_success({ email: row.email }));
		} catch (err) {
			toast.error(convexErrorMessage(err, m.admin_revoke_failed()));
		} finally {
			setPendingId(null);
		}
	};

	return (
		<div className="flex h-full flex-col gap-5">
			<AdminPageHeader
				title={m.admin_admins_title()}
				subtitle={m.admin_admins_subtitle({ count: admins.length })}
				right={
					<p className="max-w-xs text-right text-[10px] uppercase tracking-wider text-white/40">
						{m.admin_admins_promote_hint()}
					</p>
				}
			/>

			<div className="flex-1 overflow-y-auto border border-white/15">
				<table className="w-full text-sm">
					<thead className="sticky top-0 bg-black">
						<tr className="border-b border-white/20 text-[10px] uppercase tracking-wider text-white/50">
							<th className="px-3 py-2 text-left font-medium">
								{m.admin_col_email()}
							</th>
							<th className="px-3 py-2 text-left font-medium">
								{m.admin_col_name()}
							</th>
							<th className="px-3 py-2 text-left font-medium">
								{m.admin_admins_col_granted()}
							</th>
							<th className="px-3 py-2 text-right font-medium">
								{m.admin_col_actions()}
							</th>
						</tr>
					</thead>
					<tbody>
						{admins.length === 0 ? (
							<EmptyTableRow colSpan={4} message={m.admin_admins_empty()} />
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
													{m.admin_admins_self_label()}
												</span>
											) : (
												<Button
													type="button"
													variant="starkDestructive"
													size="xs"
													onClick={() => handleRevoke(a)}
													disabled={pendingId === a.authUserId}
												>
													{pendingId === a.authUserId
														? "…"
														: m.admin_revoke_action()}
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
