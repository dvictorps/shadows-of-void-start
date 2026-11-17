import { TooltipSeparator } from "#/components/game/rarity-card";

import { MODIFIED_COLOR } from "./colors";
import type { StatRow } from "./stat-rows";

const LABEL_COLOR = "rgba(255, 255, 255, 0.45)";

export default function StatBlock({ rows }: { rows: readonly StatRow[] }) {
	if (rows.length === 0) return null;
	return (
		<>
			<div className="space-y-0.5 px-4 py-1">
				{rows.map((row, i) => (
					<div key={`${row.label}:${i}`} className="flex justify-between">
						<span style={{ color: LABEL_COLOR }}>{row.label}</span>
						<span style={{ color: row.modified ? MODIFIED_COLOR : "white" }}>
							{row.value}
						</span>
					</div>
				))}
			</div>
			<TooltipSeparator />
		</>
	);
}
