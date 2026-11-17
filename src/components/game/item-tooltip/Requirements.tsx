import { TooltipSeparator } from "#/components/game/rarity-card";
import { isQuiver } from "#/game/items/equipment";
import type { GeneratedItem } from "#/game/items/types";
import { m } from "#/paraglide/messages";

import { DIM_COLOR } from "./colors";

export default function Requirements({ item }: { item: GeneratedItem }) {
	const reqs = item.requirements;
	const hasReq = !!(
		reqs &&
		(reqs.level > 1 || reqs.str || reqs.dex || reqs.int)
	);
	const needsBow = isQuiver(item);
	if (!hasReq && !needsBow) return null;
	return (
		<>
			<TooltipSeparator />
			<div
				className="px-4 py-1 text-xs uppercase tracking-wider"
				style={{ color: DIM_COLOR }}
			>
				{hasReq && reqs && (
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
