import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useCachedQuery } from "#/hooks/useCachedQuery";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/admin/")({
	component: AdminOverviewPage,
});

const PULSE_CACHE_KEY = "admin.pulse.v1";

type Pulse = {
	userCount: number;
	characterCount: number;
	adminCount: number;
	hardcoreCount: number;
	softcoreCount: number;
};

function AdminOverviewPage() {
	const live = useQuery(api.admin.pulse) as Pulse | undefined;
	const pulse = useCachedQuery(PULSE_CACHE_KEY, live);

	return (
		<div className="flex h-full flex-col gap-6">
			<header className="flex items-end justify-between border-b border-white/15 pb-4">
				<div>
					<h1 className="display-title text-2xl uppercase tracking-[0.15em] text-white">
						Overview
					</h1>
					<p className="mt-1 text-xs uppercase tracking-wider text-white/50">
						Pulse do servidor — atualizado em tempo real
					</p>
				</div>
				<span className="text-[10px] uppercase tracking-wider text-white/40">
					{pulse ? "live" : "loading…"}
				</span>
			</header>

			<section className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<MetricCard
					label="Users"
					value={pulse?.userCount}
					hint="contas registradas"
				/>
				<MetricCard
					label="Admins"
					value={pulse?.adminCount}
					hint="com permissão"
					accent="white"
				/>
				<MetricCard
					label="Characters"
					value={pulse?.characterCount}
					hint="total no jogo"
				/>
				<MetricCard
					label="Hardcore"
					value={
						pulse
							? `${pulse.hardcoreCount} / ${pulse.softcoreCount}`
							: undefined
					}
					hint="hardcore vs softcore"
					accent="muted"
				/>
			</section>

			<section className="grid gap-4 md:grid-cols-2">
				<InfoCard
					title="Permissões"
					body="Use a aba Admins para promover ou revogar admins. O backend bloqueia auto-revogação para evitar lockout."
				/>
				<InfoCard
					title="Investigando um usuário?"
					body="Vá em Users e clique numa linha pra abrir os personagens dela. Útil pra suporte e debug."
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
	value: number | string | undefined;
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
				{value === undefined ? "—" : value}
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
