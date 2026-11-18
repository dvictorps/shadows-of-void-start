import Modal from "#/components/Modal";
import type { ComputedCharacterStats } from "#/game/stats/types";
import { m } from "#/paraglide/messages";

import { AttributesSection } from "./show-stats-modal/AttributesSection";
import { DefensesSection } from "./show-stats-modal/DefensesSection";
import { OffenseSection } from "./show-stats-modal/OffenseSection";
import { UtilitySection } from "./show-stats-modal/UtilitySection";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	stats: ComputedCharacterStats;
	referenceEnemyLevel: number;
	currentBarrier: number;
	currentLife: number;
};

export default function ShowStatsModal({
	isOpen,
	onClose,
	stats,
	referenceEnemyLevel,
	currentBarrier,
	currentLife,
}: Props) {
	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.stats_title()}
			className="max-w-3xl"
		>
			<div className="grid grid-cols-2 gap-4">
				<AttributesSection stats={stats} />
				<DefensesSection
					stats={stats}
					currentBarrier={currentBarrier}
					currentLife={currentLife}
					referenceEnemyLevel={referenceEnemyLevel}
				/>
			</div>
			<hr className="my-4 border-white/15" />
			<OffenseSection stats={stats} />
			<hr className="my-4 border-white/15" />
			<UtilitySection stats={stats} />
		</Modal>
	);
}
