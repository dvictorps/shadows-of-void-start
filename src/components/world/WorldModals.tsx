import BagPreviewModal from "#/components/world/BagPreviewModal";
import ExitZoneModal from "#/components/world/ExitZoneModal";
import InventoryModal from "#/components/world/InventoryModal";
import SettingsModal from "#/components/world/SettingsModal";
import StashModal from "#/components/world/StashModal";
import VendorModal from "#/components/world/VendorModal";
import type { ComputedCharacterStats } from "#/game/stats/types";
import type { VendorProductId } from "#/game/vendor/products";
import type { ModalHandle } from "#/hooks/useModal";
import type { BagEntry, ItemRow } from "#/lib/api-types";

export function WorldModals({
	bagModal,
	exitModal,
	inventoryModal,
	vendorModal,
	stashModal,
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
	stashItems,
	rubys,
	potions,
	teleportStones,
	onVendorBuy,
	onVendorSellMany,
	onStashDeposit,
	onStashWithdraw,
	onReorderInventory,
	onReorderStash,
}: {
	bagModal: ModalHandle;
	exitModal: ModalHandle;
	inventoryModal: ModalHandle;
	vendorModal: ModalHandle;
	stashModal: ModalHandle;
	settingsModal: ModalHandle;
	zoneBag: BagEntry[];
	exitKeepCap: number;
	onExitClose: () => void;
	onPickSelected: (ids: string[]) => void | Promise<void>;
	onDiscardSelected: (ids: string[]) => void | Promise<void>;
	onPickAll: (ids: string[]) => void | Promise<void>;
	onDiscardAll: () => void | Promise<void>;
	stats: ComputedCharacterStats;
	characterId: number;
	characterLevel: number;
	equippedItems: ItemRow[];
	inventoryItems: ItemRow[];
	stashItems: ItemRow[];
	rubys: number;
	potions: number;
	teleportStones: number;
	onVendorBuy: (productId: VendorProductId, quantity: number) => Promise<void>;
	onVendorSellMany: (itemIds: number[]) => Promise<void>;
	onStashDeposit: (
		itemIds: number[],
	) => Promise<{ deposited: number; failed: number }>;
	onStashWithdraw: (
		itemIds: number[],
	) => Promise<{ withdrawn: number; failed: number }>;
	onReorderInventory: (args: {
		itemId: number;
		targetSlot: number;
		swapWithItemId?: number;
	}) => void;
	onReorderStash: (args: {
		itemId: number;
		targetSlot: number;
		swapWithItemId?: number;
	}) => void;
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
			<StashModal
				isOpen={stashModal.isOpen}
				onClose={stashModal.close}
				inventoryItems={inventoryItems}
				stashItems={stashItems}
				onDeposit={onStashDeposit}
				onWithdraw={onStashWithdraw}
				onReorderInventory={onReorderInventory}
				onReorderStash={onReorderStash}
			/>
			<SettingsModal
				isOpen={settingsModal.isOpen}
				onClose={settingsModal.close}
			/>
		</>
	);
}
