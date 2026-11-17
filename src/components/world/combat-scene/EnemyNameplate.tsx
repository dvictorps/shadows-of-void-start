import { motion } from "framer-motion";

import type { BossConfig } from "#/game/bosses";
import type { MonsterRarity } from "#/game/monsters";
import type { Enemy } from "#/hooks/useCombatLoop";
import { m } from "#/paraglide/messages";

import { type IntroStages, isStagedEnemy, nameplateVisible } from "./reveal";

const RARITY_NAMEPLATE_COLOR = {
	normal: "#ffffff",
	magic: "#8888ff",
	rare: "#ffff77",
	unique: "#af6025",
} satisfies Record<MonsterRarity, string>;

const RARITY_NAMEPLATE_SHADOW = {
	normal: "0 2px 4px rgba(0, 0, 0, 0.9)",
	magic: "0 0 14px rgba(136, 136, 255, 0.75), 0 2px 4px rgba(0, 0, 0, 0.9)",
	rare: "0 0 18px rgba(255, 255, 119, 0.7), 0 2px 4px rgba(0, 0, 0, 0.9)",
	unique: "0 0 22px rgba(175, 96, 37, 0.75), 0 2px 4px rgba(0, 0, 0, 0.9)",
} satisfies Record<MonsterRarity, string>;

export default function EnemyNameplate({
	enemy,
	displayName,
	bossConfig,
	stages,
}: {
	enemy: Enemy | null;
	displayName: string;
	bossConfig: BossConfig | null;
	stages: IntroStages;
}) {
	return (
		<div className="flex h-[120px] flex-col items-center gap-1 px-6 pt-14">
			{enemy && (
				<Nameplate
					enemy={enemy}
					displayName={displayName}
					bossConfig={bossConfig}
					visible={nameplateVisible(stages)}
				/>
			)}
		</div>
	);
}

function Nameplate({
	enemy,
	displayName,
	bossConfig,
	visible,
}: {
	enemy: Enemy;
	displayName: string;
	bossConfig: BossConfig | null;
	visible: boolean;
}) {
	const color =
		bossConfig?.nameplateColor ?? RARITY_NAMEPLATE_COLOR[enemy.rarity];
	const shadow =
		bossConfig?.nameplateShadow ?? RARITY_NAMEPLATE_SHADOW[enemy.rarity];
	return (
		<motion.div
			className="flex flex-col items-center gap-1"
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 8 }}
			transition={{
				duration: 0.45,
				ease: "easeOut",
				delay: visible && !isStagedEnemy(enemy) ? 0.08 : 0,
			}}
		>
			<div
				className="display-title text-4xl uppercase tracking-[0.15em]"
				style={{ color, textShadow: shadow }}
			>
				{displayName}
			</div>
			<div className="text-lg uppercase tracking-[0.2em] text-white/60">
				{m.level_short({ level: enemy.level })}
			</div>
		</motion.div>
	);
}
