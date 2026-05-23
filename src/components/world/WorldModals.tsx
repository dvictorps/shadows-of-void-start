import BagPreviewModal from "#/components/world/BagPreviewModal";
import ExitZoneModal from "#/components/world/ExitZoneModal";
import InventoryModal from "#/components/world/InventoryModal";
import SettingsModal from "#/components/world/SettingsModal";
import VendorModal from "#/components/world/VendorModal";
import type { ComputedCharacterStats } from "#/game/stats/types";
import type { VendorProductId } from "#/game/vendor/products";
import type { ModalHandle } from "#/hooks/useModal";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

// ShowStatsModal lives as a sibling in world.tsx (mounted only while open).
// Bundling it here meant every combat tick re-evaluated its JSX tree even
// when the stats panel was closed, because `currentBarrier` / `currentLife`
// updates flowed through here as props.
export function WorldModals({
	bagModal,
	exitModal,
	inventoryModal,
	vendorModal,
	settingsModal,
	zoneBag,
	exitKeepCap,
	onExitClose,
	onPickSelected,
	onDiscardSelected,
	onPickAll,
	onDiscardAll,
	stats,
	characterId,
	characterLevel,
	equippedItems,
	inventoryItems,
	rubys,
	potions,
	teleportStones,
	onVendorBuy,
	onVendorSellMany,
}: {
	bagModal: ModalHandle;
	exitModal: ModalHandle;
	inventoryModal: ModalHandle;
	vendorModal: ModalHandle;
	settingsModal: ModalHandle;
	zoneBag: Doc<"items">[];
	exitKeepCap: number;
	onExitClose: () => void;
	onPickSelected: (ids: Id<"items">[]) => void | Promise<void>;
	onDiscardSelected: (ids: Id<"items">[]) => void | Promise<void>;
	onPickAll: (ids: Id<"items">[]) => void | Promise<void>;
	onDiscardAll: () => void | Promise<void>;
	stats: ComputedCharacterStats;
	characterId: Id<"characters">;
	characterLevel: number;
	equippedItems: Doc<"items">[];
	inventoryItems: Doc<"items">[];
	rubys: number;
	potions: number;
	teleportStones: number;
	onVendorBuy: (productId: VendorProductId) => Promise<void>;
	onVendorSellMany: (itemIds: Id<"items">[]) => Promise<void>;
}) {
	return (
		<>
			<BagPreviewModal
				isOpen={bagModal.isOpen}
				onClose={bagModal.close}
				items={zoneBag}
			/>
			<ExitZoneModal
				isOpen={exitModal.isOpen}
				onClose={onExitClose}
				onPickSelected={onPickSelected}
				onDiscardSelected={onDiscardSelected}
				onPickAll={onPickAll}
				onDiscardAll={onDiscardAll}
				bagItems={zoneBag}
				keepCap={exitKeepCap}
			/>
			<InventoryModal
				isOpen={inventoryModal.isOpen}
				onClose={inventoryModal.close}
				characterId={characterId}
				stats={stats}
				characterLevel={characterLevel}
				equippedItems={equippedItems}
				inventoryItems={inventoryItems}
			/>
			<VendorModal
				isOpen={vendorModal.isOpen}
				onClose={vendorModal.close}
				rubys={rubys}
				potions={potions}
				teleportStones={teleportStones}
				inventoryItems={inventoryItems}
				onBuy={onVendorBuy}
				onSellMany={onVendorSellMany}
			/>
			<SettingsModal
				isOpen={settingsModal.isOpen}
				onClose={settingsModal.close}
			/>
		</>
	);
}
