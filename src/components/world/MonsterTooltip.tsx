import type { MonsterModId, MonsterRarity } from "#/game/monsters";
import { translateMonsterName } from "#/game/world/i18n";
import type { Enemy } from "#/hooks/useCombatLoop";
import { m } from "#/paraglide/messages";

// Slim cousin of ItemTooltip. Rarity-tinted border + glow, header with name
// + level, and a list of modifier names. Only meaningful for magic / rare
// enemies — caller gates on enemy.rarity !== "normal" before mounting.

const RARITY_COLORS: Record<MonsterRarity, string> = {
	normal: "#c8c8c8",
	magic: "#8888ff",
	rare: "#ffff77",
};

const HEADER_BG: Record<MonsterRarity, string> = {
	normal: "transparent",
	magic: "rgba(56, 56, 120, 0.35)",
	rare: "rgba(120, 110, 30, 0.35)",
};

// Map of mod id → i18n message function. Keeping this as a switch (not a
// table) so TypeScript surfaces missing translations when a new mod is added.
function modName(id: MonsterModId): string {
	switch (id) {
		case "monsterIncreasedLife":
			return m.monster_mod_increased_life();
		case "monsterIncreasedDamage":
			return m.monster_mod_increased_damage();
		case "monsterIncreasedAttackSpeed":
			return m.monster_mod_increased_attack_speed();
		case "monsterIncreasedEvasion":
			return m.monster_mod_increased_evasion();
		case "monsterIncreasedAccuracy":
			return m.monster_mod_increased_accuracy();
		case "monsterColdResistance":
			return m.monster_mod_cold_resistance();
		case "monsterFireResistance":
			return m.monster_mod_fire_resistance();
		case "monsterLightningResistance":
			return m.monster_mod_lightning_resistance();
		case "monsterVoidResistance":
			return m.monster_mod_void_resistance();
		case "monsterAdditionalBarrier":
			return m.monster_mod_additional_barrier();
		case "monsterMoreArmor":
			return m.monster_mod_more_armor();
	}
}

export default function MonsterTooltip({ enemy }: { enemy: Enemy }) {
	const color = RARITY_COLORS[enemy.rarity];
	const headerBg = HEADER_BG[enemy.rarity];

	return (
		<div
			className="pointer-events-none inline-block min-w-[220px] max-w-[320px] border bg-black text-sm leading-relaxed tracking-wide"
			style={{
				borderColor: color,
				boxShadow: `0 0 12px ${color}66, inset 0 0 8px ${color}22, 0 0 20px rgba(0,0,0,0.9)`,
			}}
		>
			<div className="h-[2px]" style={{ backgroundColor: color }} />
			<div
				className="display-title px-4 py-2 text-center uppercase tracking-[0.15em]"
				style={{
					background: `linear-gradient(to bottom, ${headerBg}, transparent)`,
				}}
			>
				<div className="text-lg" style={{ color }}>
					{translateMonsterName(enemy.def)}
				</div>
				<div
					className="text-xs uppercase tracking-[0.2em]"
					style={{ color: "rgba(255, 255, 255, 0.6)" }}
				>
					Lv {enemy.level}
				</div>
			</div>
			<div className="my-1 flex items-center gap-1.5 px-2">
				<div className="h-px flex-1 bg-white/20" />
				<div className="h-1 w-1 rotate-45 bg-white/40" />
				<div className="h-px flex-1 bg-white/20" />
			</div>
			<div className="space-y-0.5 px-4 pb-3 pt-1">
				{enemy.mods.map((modId) => (
					<div key={modId} style={{ color: "#8888ff" }}>
						{modName(modId)}
					</div>
				))}
			</div>
		</div>
	);
}
