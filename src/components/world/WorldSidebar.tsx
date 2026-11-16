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

/** Equipped items keyed by slot, as the paper doll reads them. */
export type EquippedBySlot = ReadonlyMap<
	EquippedSlot,
	{ id: string; data: EquippedItem["item"] }
>;

/**
 * The right column of /world: the equipment panel and the status card. In
 * combat the HUD numbers come from the live combat loop; elsewhere from the
 * character row (life clamped to the current max).
 */
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
	// Clearing the handler (rather than adding a prop) is how StatusCard
	// disables its button: on the city view, and while a drink is in flight.
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
