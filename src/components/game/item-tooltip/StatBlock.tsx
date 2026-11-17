import { TooltipSeparator } from "#/components/game/rarity-card";

import { MODIFIED_COLOR } from "./colors";
import type { StatRow } from "./stat-rows";

const LABEL_COLOR = "rgba(255, 255, 255, 0.45)";

/**
 * A block of stat lines (label left, value right, blue when a local mod
 * changed it) closed by a separator. Renders nothing for no rows.
 */
export default function StatBlock({ rows }: { rows: readonly StatRow[] }) {
	if (rows.length === 0) return null;
	return (
		<>
			<div className="space-y-0.5 px-4 py-1">
				{rows.map((row, i) => (
					// Two elemental lines can share a label; the rows are static per render.
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
