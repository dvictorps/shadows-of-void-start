import { useMemo } from "react";

import { Button } from "#/components/ui/button";
import { getClassDisplayName } from "#/game/classes/i18n";
import { estimateDps } from "#/game/stats/dps";
import type { ComputedCharacterStats } from "#/game/stats/types";
import { useCompactViewport } from "#/hooks/useCompactViewport";
import type { CharacterRow } from "#/lib/api-types";
import { m } from "#/paraglide/messages";

import { ConsumableSlot } from "./ConsumableSlot";
import HealthGlobe from "./HealthGlobe";
import { AttributeReadouts } from "./status-card/AttributeReadouts";
import { statusCardLayout } from "./status-card/layout";
import { statusVitals } from "./status-card/vitals";
import { XpBar } from "./XpBar";

type Props = {
	character: CharacterRow;
	stats: ComputedCharacterStats;
	hpOverride?: number;
	barrierOverride?: number;
	barrierRefillRemaining?: number;
	potionsOverride?: number;
	xpOverride?: number;
	teleportStones: number;
	onUsePotion?: () => void;
	onUseTeleportStone?: () => void;
	onShowStats?: () => void;
};

export default function StatusCard({
	character,
	stats,
	onUsePotion,
	onUseTeleportStone,
	onShowStats,
	barrierRefillRemaining,
	...overrides
}: Props) {
	const layout = statusCardLayout(useCompactViewport());
	const vitals = statusVitals({
		character,
		stats,
		...overrides,
		hasPotionHandler: !!onUsePotion,
		hasTeleportHandler: !!onUseTeleportStone,
	});
	const dps = useMemo(() => estimateDps(stats), [stats]);
	const line = `text-white/80 ${layout.line}`;

	return (
		<section className={`rounded-md border border-white/40 ${layout.padding}`}>
			<div className={`flex flex-col ${layout.stackGap}`}>
				<div className={`grid grid-cols-2 ${layout.gridGap}`}>
					<div className="min-w-0">
						<h3
							className={`display-title truncate uppercase tracking-wider text-white ${layout.name}`}
						>
							{character.name}
						</h3>
						<p className={`mt-1 ${line}`}>
							<span className="text-white/50">{m.status_class_label()}</span>{" "}
							{getClassDisplayName(character.classId)}
						</p>
						<p className={line}>
							<span className="text-white/50">{m.status_level_label()}</span>{" "}
							{character.level}
						</p>
						<p className={line}>
							<span className="text-white/50">{m.status_dps_label()}</span>{" "}
							{dps > 0 ? dps : "—"}
						</p>
					</div>
					<AttributeReadouts stats={stats} textSize={layout.attributes} />
				</div>

				<div className={`flex items-center ${layout.stackGap}`}>
					<XpBar
						xp={vitals.xp}
						xpNeeded={vitals.xpNeeded}
						size={layout.xpBar}
					/>
					<ConsumableSlot
						label={m.potion_use_aria()}
						count={vitals.potions}
						disabled={!vitals.canUsePotion}
						onUse={onUsePotion}
						tooltip={m.consumable_desc_potion()}
						size={layout.slot}
						art="/assets/sprites/ui/pocaoCura.png"
					/>
				</div>

				<hr className="border-white/15" />

				<div
					className={`grid grid-cols-[auto_1fr_auto] items-center ${layout.gridGap}`}
				>
					<div className="flex flex-col items-center gap-1">
						<span className="text-[10px] uppercase tracking-wider text-white/50">
							{m.status_header()}
						</span>
						<Button
							type="button"
							variant="stark"
							onClick={onShowStats}
							disabled={!onShowStats}
							className="px-3 py-1.5 text-xs uppercase tracking-wider"
						>
							{m.show_action()}
						</Button>
					</div>

					<div className="flex justify-center gap-2">
						<ConsumableSlot
							label={m.teleport_use_aria()}
							count={vitals.teleportStones}
							disabled={!vitals.canUseTeleportStone}
							onUse={onUseTeleportStone}
							tooltip={m.consumable_desc_teleport()}
							size={layout.slot}
							art="/assets/sprites/ui/pedraTeleporte.png"
						/>
					</div>

					<HealthGlobe
						hp={vitals.hp}
						maxHp={vitals.maxHp}
						barrier={vitals.barrier}
						maxBarrier={vitals.maxBarrier}
						barrierRefillRemaining={barrierRefillRemaining}
					/>
				</div>
			</div>
		</section>
	);
}
