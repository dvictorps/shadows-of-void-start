import Tooltip from "#/components/ui/tooltip";
import {
	DEX_ACCURACY_PER_POINT,
	DEX_EVASION_PCT_PER_POINT,
	INT_BARRIER_PCT_PER_POINT,
	STR_LIFE_PER_POINT,
	STR_MELEE_PCT_PER_POINT,
} from "#/game/stats/compute";
import type { ComputedCharacterStats } from "#/game/stats/types";
import { m } from "#/paraglide/messages";

function readouts({ attributes }: Pick<ComputedCharacterStats, "attributes">) {
	return [
		{
			label: m.status_strength_label(),
			value: attributes.strength,
			glow: "text-glow-red",
			tooltip: m.attribute_tooltip_strength({
				melee: STR_MELEE_PCT_PER_POINT,
				life: STR_LIFE_PER_POINT,
			}),
		},
		{
			label: m.status_dexterity_label(),
			value: attributes.dexterity,
			glow: "text-glow-green",
			tooltip: m.attribute_tooltip_dexterity({
				accuracy: DEX_ACCURACY_PER_POINT,
				evasion: DEX_EVASION_PCT_PER_POINT,
			}),
		},
		{
			label: m.status_intelligence_label(),
			value: attributes.intelligence,
			glow: "text-glow-blue",
			tooltip: m.attribute_tooltip_intelligence({
				barrier: INT_BARRIER_PCT_PER_POINT,
			}),
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
