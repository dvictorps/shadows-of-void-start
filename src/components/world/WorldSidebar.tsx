import type { BarrierState } from "#/game/combat/barrier";
import type {
	ComputedCharacterStats,
	EquippedItem,
	EquippedSlot,
} from "#/game/stats/types";
import type { WorldViewMode } from "#/game/world";
import type { CharacterRow } from "#/lib/api-types";

import EquipmentPanel from "./EquipmentPanel";
import StatusCard from "./StatusCard";

export type EquippedBySlot = ReadonlyMap<
	EquippedSlot,
	{ id: string; data: EquippedItem["item"] }
>;

export function WorldSidebar({
	compact,
	view,
	character,
	stats,
	equippedBySlot,
	barrier,
	combatHp,
	combatPotions,
	isUsingPotion,
	isUsingTeleportStone,
	onUsePotion,
	onUseTeleportStone,
	onOpenInventory,
	onShowStats,
}: {
	compact: boolean;
	view: WorldViewMode;
	character: CharacterRow;
	stats: ComputedCharacterStats;
	equippedBySlot: EquippedBySlot;
	barrier: BarrierState;
	combatHp: number;
	combatPotions: number;
	isUsingPotion: boolean;
	isUsingTeleportStone: boolean;
	onUsePotion: () => void;
	onUseTeleportStone: () => void;
	onOpenInventory: () => void;
	onShowStats: () => void;
}) {
	const inCombat = view === "combat";
	const potionEnabled = view !== "city" && !isUsingPotion;
	const rubys = character.rubys ?? 0;

	return (
		<aside
			className={`grid grid-rows-world-sidebar ${compact ? "gap-1" : "gap-3"}`}
		>
			<EquipmentPanel
				equippedBySlot={equippedBySlot}
				stats={stats}
				characterLevel={character.level}
				rubys={rubys}
				onOpenInventory={onOpenInventory}
			/>
			<StatusCard
				character={character}
				stats={stats}
				hpOverride={
					inCombat ? combatHp : Math.min(character.hpCurrent, stats.maxLife)
				}
				barrierOverride={barrier.current}
				barrierRefillRemaining={barrier.refillRemaining}
				potionsOverride={inCombat ? combatPotions : character.potions}
				xpOverride={character.xp}
				teleportStones={character.teleportStones}
				onUsePotion={potionEnabled ? onUsePotion : undefined}
				onUseTeleportStone={
					isUsingTeleportStone ? undefined : onUseTeleportStone
				}
				onShowStats={onShowStats}
			/>
		</aside>
	);
}
