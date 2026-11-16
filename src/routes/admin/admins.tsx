import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader, EmptyTableRow } from "#/components/admin/AdminShared";
import { Button } from "#/components/ui/button";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { useTRPC } from "#/integrations/trpc/client";
import { adminTabQueries, useSetUserRole } from "#/lib/admin-prefetch";
import type { AdminOutputs } from "#/lib/api-types";
import { formatDate } from "#/lib/format";
import { serverErrorMessage } from "#/lib/server-error-message";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/admin/admins")({
	loader: ({ context }) =>
		context.queryClient.query({
			...adminTabQueries(context.trpc).listAdmins,
			staleTime: "static",
		}),
	component: AdminAdminsPage,
});

type AdminRow = AdminOutputs["listAdmins"][number];

function AdminAdminsPage() {
	const trpc = useTRPC();
	const { data: admins } = useSuspenseQuery(adminTabQueries(trpc).listAdmins);
	const { data: me } = useQuery(trpc.users.getUserRole.queryOptions());

	const setUserRole = useSetUserRole();
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
			toast.error(serverErrorMessage(err, m.admin_revoke_failed()));
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
