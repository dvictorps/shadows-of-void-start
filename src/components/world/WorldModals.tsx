// ─────────────────────────────────────────────────────────────────────────────
//  Modal render block extracted from /world. Each modal is independently
//  visible/dismissable — this component just bundles their JSX so world.tsx's
//  render body stays focused on the scene + side panels.
//
//  Props are split by modal target so a future addition (e.g. a new modal)
//  only touches the relevant block, not a megabag interface.
// ─────────────────────────────────────────────────────────────────────────────

import BagPreviewModal from "#/components/world/BagPreviewModal";
import ExitZoneModal from "#/components/world/ExitZoneModal";
import InventoryModal from "#/components/world/InventoryModal";
import SettingsModal from "#/components/world/SettingsModal";
import ShowStatsModal from "#/components/world/ShowStatsModal";
import VendorModal from "#/components/world/VendorModal";
import type { ComputedCharacterStats } from "#/game/stats/types";
import type { VendorProductId } from "#/game/vendor/products";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

type ModalHandle = { isOpen: boolean; close: () => void };

type EquippedDoc = Doc<"items">;
type InventoryDoc = Doc<"items">;
type BagItem = Doc<"items">;

export function WorldModals({
	// Modal visibility handles
	bagModal,
	exitModal,
	statsModal,
	inventoryModal,
	vendorModal,
	settingsModal,
	// Bag data
	zoneBag,
	exitKeepCap,
	// Exit modal handlers
	onExitClose,
	onPickSelected,
	onDiscardSelected,
	onPickAll,
	onDiscardAll,
	// Stats modal
	stats,
	zoneLevel,
	currentBarrier,
	currentLife,
	// Inventory modal
	characterId,
	characterLevel,
	equippedItems,
	inventoryItems,
	// Vendor modal
	rubys,
	potions,
	teleportStones,
	onVendorBuy,
	onVendorSellMany,
}: {
	bagModal: ModalHandle;
	exitModal: ModalHandle;
	statsModal: ModalHandle;
	inventoryModal: ModalHandle;
	vendorModal: ModalHandle;
	settingsModal: ModalHandle;
	zoneBag: BagItem[];
	exitKeepCap: number;
	onExitClose: () => void;
	onPickSelected: (ids: Id<"items">[]) => void | Promise<void>;
	onDiscardSelected: (ids: Id<"items">[]) => void | Promise<void>;
	onPickAll: (ids: Id<"items">[]) => void | Promise<void>;
	onDiscardAll: () => void | Promise<void>;
	stats: ComputedCharacterStats;
	zoneLevel: number;
	currentBarrier: number;
	currentLife: number;
	characterId: Id<"characters">;
	characterLevel: number;
	equippedItems: EquippedDoc[];
	inventoryItems: InventoryDoc[];
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
			<ShowStatsModal
				isOpen={statsModal.isOpen}
				onClose={statsModal.close}
				stats={stats}
				referenceEnemyLevel={zoneLevel}
				currentBarrier={currentBarrier}
				currentLife={currentLife}
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
