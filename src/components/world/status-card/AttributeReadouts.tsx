import Tooltip from "#/components/ui/tooltip";
import type { ComputedCharacterStats } from "#/game/stats/types";
import { m } from "#/paraglide/messages";

import { attributeTooltips } from "../attribute-tooltips";

function readouts({ attributes }: Pick<ComputedCharacterStats, "attributes">) {
	const tooltips = attributeTooltips();
	return [
		{
			label: m.status_strength_label(),
			value: attributes.strength,
			glow: "text-glow-red",
			tooltip: tooltips.strength,
		},
		{
			label: m.status_dexterity_label(),
			value: attributes.dexterity,
			glow: "text-glow-green",
			tooltip: tooltips.dexterity,
		},
		{
			label: m.status_intelligence_label(),
			value: attributes.intelligence,
			glow: "text-glow-blue",
			tooltip: tooltips.intelligence,
		},
	];
}

/** Strength / Dexterity / Intelligence, each with what a point of it does. */
export function AttributeReadouts({
	stats,
	textSize,
}: {
	stats: Pick<ComputedCharacterStats, "attributes">;
	textSize: string;
}) {
	return (
		<div
			className={`display-title space-y-1.5 text-right tracking-wider ${textSize}`}
		>
			{readouts(stats).map((row) => (
				<Tooltip
					key={row.label}
					content={<span className="whitespace-pre-line">{row.tooltip}</span>}
				>
					<p className={row.glow}>
						{row.label} {row.value}
					</p>
				</Tooltip>
			))}
		</div>
	);
}
