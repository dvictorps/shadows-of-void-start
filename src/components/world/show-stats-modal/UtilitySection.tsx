import type { ComputedCharacterStats } from "#/game/stats/types";
import { m } from "#/paraglide/messages";

import { Row, SectionHeading } from "./Row";

export function UtilitySection({ stats }: { stats: ComputedCharacterStats }) {
	return (
		<section>
			<SectionHeading>{m.stats_section_utility()}</SectionHeading>
			<div className="grid grid-cols-2 gap-x-6">
				<Row
					label={m.stats_movement_speed()}
					value={`+${stats.movementSpeed}%`}
				/>
				<Row label={m.stats_life_on_hit()} value={stats.lifeGainOnHit} />
				<Row label={m.stats_mana_on_hit()} value={stats.manaGainOnHit} />
				<Row
					label={m.stats_life_leech()}
					value={`${Math.round(stats.lifeLeechPercent * 10) / 10}%`}
				/>
				<Row label={m.stats_life_on_kill()} value={stats.lifeOnKill} />
				<Row label={m.stats_mana_on_kill()} value={stats.manaOnKill} />
				<Row label={m.stats_magic_find()} value={`+${stats.magicFind}%`} />
			</div>
		</section>
	);
}
