import BagPreviewModal from "#/components/world/BagPreviewModal";
import ExitZoneModal from "#/components/world/ExitZoneModal";
import InventoryModal, {
	type InventoryServer,
} from "#/components/world/InventoryModal";
import { reorderOrToast } from "#/components/world/reorder-or-toast";
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
	onReorderStash,
	inventoryServer,
}: {
	bagModal: ModalHandle;
	exitModal: ModalHandle;
	inventoryModal: ModalHandle;
	vendorModal: ModalHandle;
	stashModal: ModalHandle;
	settingsModal: ModalHandle;
	zoneBag: BagEntry[] | undefined;
	exitKeepCap: number;
	onExitClose: () => void;
	onPickSelected: (ids: string[]) => void | Promise<void>;
	onDiscardSelected: (ids: string[]) => void | Promise<void>;
	onPickAll: (ids: string[]) => void | Promise<void>;
	onDiscardAll: () => void | Promise<void>;
	stats: ComputedCharacterStats;
	characterId: number;
	characterLevel: number;
	equippedItems: ItemRow[] | undefined;
	inventoryItems: ItemRow[] | undefined;
	stashItems: ItemRow[] | undefined;
	rubys: number | null;
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
	onReorderStash: (args: {
		itemId: number;
		targetSlot: number;
		swapWithItemId?: number;
	}) => void;
	inventoryServer: InventoryServer;
}) {
	const bag = zoneBag ?? [];
	const inventory = inventoryItems ?? [];
	return (
		<>
			<BagPreviewModal
				isOpen={bagModal.isOpen}
				onClose={bagModal.close}
				items={bag}
			/>
			<ExitZoneModal
				isOpen={exitModal.isOpen}
				onClose={onExitClose}
				onPickSelected={onPickSelected}
				onDiscardSelected={onDiscardSelected}
				onPickAll={onPickAll}
				onDiscardAll={onDiscardAll}
				bagItems={bag}
				keepCap={exitKeepCap}
			/>
			<InventoryModal
				isOpen={inventoryModal.isOpen}
				onClose={inventoryModal.close}
				characterId={characterId}
				stats={stats}
				characterLevel={characterLevel}
				equippedItems={equippedItems ?? []}
				inventoryItems={inventory}
				server={inventoryServer}
			/>
			<VendorModal
				isOpen={vendorModal.isOpen}
				onClose={vendorModal.close}
				rubys={rubys ?? 0}
				potions={potions}
				teleportStones={teleportStones}
				inventoryItems={inventory}
				onBuy={onVendorBuy}
				onSellMany={onVendorSellMany}
			/>
			<StashModal
				isOpen={stashModal.isOpen}
				onClose={stashModal.close}
				inventoryItems={inventory}
				stashItems={stashItems ?? []}
				onDeposit={onStashDeposit}
				onWithdraw={onStashWithdraw}
				onReorderInventory={(move) =>
					void reorderOrToast(
						inventoryServer.reorderInventory,
						characterId,
						move,
					)
				}
				onReorderStash={onReorderStash}
			/>
			<SettingsModal
				isOpen={settingsModal.isOpen}
				onClose={settingsModal.close}
			/>
		</>
	);
}
