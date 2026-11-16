import { TooltipSeparator } from "#/components/ui/rarity-card";
import { isQuiver } from "#/game/items/equipment";
import type { GeneratedItem } from "#/game/items/types";
import { m } from "#/paraglide/messages";

import { DIM_COLOR } from "./colors";

/**
 * "Requires" with the level (above 1) and attributes on one line, and a
 * quiver's bow line. Renders nothing for an item with neither.
 */
export default function Requirements({ item }: { item: GeneratedItem }) {
	const reqs = item.requirements;
	const hasStatReq = !!(reqs && (reqs.str || reqs.dex || reqs.int));
	const needsBow = isQuiver(item);
	if (!hasStatReq && !needsBow) return null;
	return (
		<>
			<TooltipSeparator />
			<div
				className="px-4 py-1 text-xs uppercase tracking-wider"
				style={{ color: DIM_COLOR }}
			>
				{hasStatReq && reqs && (
					<div>
						<span>{m.tooltip_requires()} </span>
						{[
							reqs.level > 1 && m.tooltip_level_value({ value: reqs.level }),
							reqs.str && m.tooltip_req_strength({ value: reqs.str }),
							reqs.dex && m.tooltip_req_dexterity({ value: reqs.dex }),
							reqs.int && m.tooltip_req_intelligence({ value: reqs.int }),
						]
							.filter(Boolean)
							.join(", ")}
					</div>
				)}
				{needsBow && <div>{m.tooltip_requires_bow_in_main_hand()}</div>}
			</div>
		</>
	);
}
