import { Skull } from "lucide-react";
import { useMemo, useState } from "react";

import { CLASS_DEFINITIONS } from "#/game/classes/data";
import { getClassDisplayName } from "#/game/classes/i18n";
import { typedKeys } from "#/game/typed-object";
import type { LeaderboardQuery, LeaderboardSnapshot } from "#/lib/api-types";
import { m } from "#/paraglide/messages";

import Modal from "../Modal";

// The class filter's options, in the classes' declaration order.
const CLASS_IDS = typedKeys(CLASS_DEFINITIONS);

/**
 * The leaderboard: level or boss kills, softcore or hardcore, a class filter
 * and the hardcore fallen. The route fetches the snapshot for the tabs
 * picked (`useLeaderboardSnapshot`); `snapshot` is undefined while loading.
 */
export default function LeaderboardModal({
	isOpen,
	onClose,
	snapshot,
	failed = false,
	query,
	onQueryChange,
}: {
	isOpen: boolean;
	onClose: () => void;
	snapshot: LeaderboardSnapshot | null | undefined;
	/** The snapshot query failed (it retries on its polling interval). */
	failed?: boolean;
	query: LeaderboardQuery;
	onQueryChange: (query: LeaderboardQuery) => void;
}) {
	const { category, mode } = query;
	const setCategory = (next: LeaderboardQuery["category"]) =>
		onQueryChange({ ...query, category: next });
	const setMode = (next: LeaderboardQuery["mode"]) =>
		onQueryChange({ ...query, mode: next });
	const [classFilter, setClassFilter] = useState<string>("all");
	const [showFallen, setShowFallen] = useState(false);

	const entries = useMemo(() => {
		if (!snapshot?.entries) return [];
		let result = snapshot.entries;

		if (!showFallen && mode === "hardcore") {
			result = result.filter((e) => !e.dead);
		}

		if (classFilter !== "all" && category === "level") {
			result = result.filter((e) => e.classId === classFilter);
		}

		return result;
	}, [snapshot, showFallen, mode, classFilter, category]);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.leaderboard_title()}
			className="max-w-2xl"
		>
			<div className="space-y-4">
				{/* Category tabs */}
				<div className="flex gap-2">
					<TabButton
						active={category === "level"}
						onClick={() => setCategory("level")}
					>
						{m.leaderboard_level_tab()}
					</TabButton>
					<TabButton
						active={category === "bossKills"}
						onClick={() => setCategory("bossKills")}
					>
						{m.leaderboard_kills_tab()}
					</TabButton>
				</div>

				{/* Mode toggle + filters */}
				<div className="flex flex-wrap items-center gap-3">
					<div className="flex gap-1">
						<TabButton
							active={mode === "softcore"}
							onClick={() => setMode("softcore")}
							size="sm"
						>
							{m.leaderboard_softcore()}
						</TabButton>
						<TabButton
							active={mode === "hardcore"}
							onClick={() => setMode("hardcore")}
							size="sm"
						>
							{m.leaderboard_hardcore()}
						</TabButton>
					</div>

					{category === "level" && (
						<select
							value={classFilter}
							onChange={(e) => setClassFilter(e.target.value)}
							className="border border-white/30 bg-black px-2 py-1 text-xs text-white"
						>
							<option value="all">{m.leaderboard_all_classes()}</option>
							{CLASS_IDS.map((id) => (
								<option key={id} value={id}>
									{getClassDisplayName(id)}
								</option>
							))}
						</select>
					)}

					{mode === "hardcore" && (
						<label className="flex cursor-pointer items-center gap-1.5 text-xs text-white/70">
							<input
								type="checkbox"
								checked={showFallen}
								onChange={(e) => setShowFallen(e.target.checked)}
								className="accent-red-500"
							/>
							{m.leaderboard_show_fallen()}
						</label>
					)}
				</div>

				{/* Table */}
				<div className="max-h-[50vh] overflow-y-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-white/20 text-left text-xs uppercase tracking-wider text-white/50">
								<th className="w-10 py-2 pr-2">{m.leaderboard_rank()}</th>
								<th className="py-2 pr-2">{m.leaderboard_name()}</th>
								<th className="py-2 pr-2">{m.leaderboard_class()}</th>
								<th className="w-20 py-2 text-right">
									{category === "level"
										? m.leaderboard_level()
										: m.leaderboard_kills()}
								</th>
							</tr>
						</thead>
						<tbody>
							{entries.length === 0 && (
								<tr>
									<td colSpan={4} className="py-8 text-center text-white/40">
										{emptyMessage(snapshot, failed)}
									</td>
								</tr>
							)}
							{entries.map((entry, i) => (
								<tr
									key={entry.characterId}
									className={`border-b border-white/5 ${entry.dead ? "opacity-50" : ""}`}
								>
									<td className="py-1.5 pr-2 text-white/60">{i + 1}</td>
									<td className="py-1.5 pr-2">
										<span className="flex items-center gap-1.5">
											{entry.characterName}
											{entry.dead && <Skull className="h-3 w-3 text-red-400" />}
										</span>
									</td>
									<td className="py-1.5 pr-2 text-white/70">
										{getClassDisplayName(entry.classId)}
									</td>
									<td className="py-1.5 text-right font-bold">
										{category === "level" ? entry.level : entry.totalBossKills}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{snapshot?.updatedAt && (
					<div className="text-right text-[10px] text-white/30">
						{new Date(snapshot.updatedAt).toLocaleTimeString()}
					</div>
				)}
			</div>
		</Modal>
	);
}

function TabButton({
	active,
	onClick,
	children,
	size = "md",
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
	size?: "sm" | "md";
}) {
	const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
	return (
		<button
			type="button"
			onClick={onClick}
			className={`border transition ${pad} ${
				active
					? "border-white bg-white/10 text-white"
					: "border-white/30 bg-black text-white/60 hover:border-white/60 hover:text-white/80"
			}`}
		>
			{children}
		</button>
	);
}

/** What the table says with no rows: failed, still loading, or truly empty. */
function emptyMessage(
	snapshot: LeaderboardSnapshot | null | undefined,
	failed: boolean,
): string {
	if (failed) return m.leaderboard_load_failed();
	if (snapshot === undefined) return m.loading();
	return m.leaderboard_empty();
}
