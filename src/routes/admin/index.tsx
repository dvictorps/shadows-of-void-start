import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { m } from "#/paraglide/messages";
import { AdminPageHeader } from "#/components/admin/AdminShared";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/admin/")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(convexQuery(api.admin.pulse, {})),
	component: AdminOverviewPage,
});

function AdminOverviewPage() {
	const { data: pulse } = useSuspenseQuery(convexQuery(api.admin.pulse, {}));

	return (
		<div className="flex h-full flex-col gap-6">
			<AdminPageHeader
				title={m.admin_overview_title()}
				subtitle={m.admin_overview_subtitle()}
				right={
					<span className="text-[10px] uppercase tracking-wider text-white/40">
						{m.admin_overview_live_pill()}
					</span>
				}
			/>

			<section className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<MetricCard
					label={m.admin_metric_users()}
					value={pulse.userCount}
					hint={m.admin_metric_users_hint()}
				/>
				<MetricCard
					label={m.admin_metric_admins()}
					value={pulse.adminCount}
					hint={m.admin_metric_admins_hint()}
					accent="white"
				/>
				<MetricCard
					label={m.admin_metric_characters()}
					value={pulse.characterCount}
					hint={m.admin_metric_characters_hint()}
				/>
				<MetricCard
					label={m.admin_metric_hardcore()}
					value={`${pulse.hardcoreCount} / ${pulse.softcoreCount}`}
					hint={m.admin_metric_hardcore_hint()}
					accent="muted"
				/>
			</section>

			<section className="grid gap-4 md:grid-cols-2">
				<InfoCard
					title={m.admin_info_permissions_title()}
					body={m.admin_info_permissions_body()}
				/>
				<InfoCard
					title={m.admin_info_investigate_title()}
					body={m.admin_info_investigate_body()}
				/>
			</section>
		</div>
	);
}

function MetricCard({
	label,
	value,
	hint,
	accent = "default",
}: {
	label: string;
	value: number | string;
	hint: string;
	accent?: "default" | "white" | "muted";
}) {
	const valueClass =
		accent === "white"
			? "text-white"
			: accent === "muted"
				? "text-white/70"
				: "text-white";
	return (
		<div className="border border-white/30 bg-black p-4 transition hover:border-white/60">
			<p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">
				{label}
			</p>
			<p
				className={`display-title mt-2 text-3xl uppercase tracking-wider ${valueClass}`}
			>
				{value}
			</p>
			<p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">
				{hint}
			</p>
		</div>
	);
}

function InfoCard({ title, body }: { title: string; body: string }) {
	return (
		<div className="border border-white/15 bg-black p-4">
			<p className="text-xs font-medium uppercase tracking-wider text-white/70">
				{title}
			</p>
			<p className="mt-2 text-sm text-white/60">{body}</p>
		</div>
	);
}
