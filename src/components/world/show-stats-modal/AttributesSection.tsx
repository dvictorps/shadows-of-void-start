import type { ComputedCharacterStats } from "#/game/stats/types";
import { m } from "#/paraglide/messages";

import { attributeTooltips } from "../attribute-tooltips";
import { Row, SectionHeading } from "./Row";

export function AttributesSection({
	stats,
}: {
	stats: ComputedCharacterStats;
}) {
	const tooltips = attributeTooltips();
	return (
		<section>
			<SectionHeading>{m.stats_section_attributes()}</SectionHeading>
			<Row
				label={m.attribute_strength()}
				value={stats.attributes.strength}
				tooltip={tooltips.strength}
			/>
			<Row
				label={m.attribute_dexterity()}
				value={stats.attributes.dexterity}
				tooltip={tooltips.dexterity}
			/>
			<Row
				label={m.attribute_intelligence()}
				value={stats.attributes.intelligence}
				tooltip={tooltips.intelligence}
			/>
		</section>
	);
}
