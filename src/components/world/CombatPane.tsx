import type { BarrierState } from "#/game/combat/barrier";
import { canLightIncense } from "#/game/combat/incense";
import { xpToNextLevel } from "#/game/progression/levels";
import type { SelectableElement } from "#/game/stats/types";
import type { WorldNode } from "#/game/world";
import { translateNodeName } from "#/game/world/i18n";
import type { useCombatLoop } from "#/hooks/useCombatLoop";
import type { CharacterRow } from "#/lib/api-types";

import CombatScene, { type ConsumableKey } from "./CombatScene";

export function CombatPane({
	node,
	zoneLevel,
	combat,
	maxHp,
	barrier,
	character,
	selectedElement,
	bagSize,
	isUsingPotion,
	isUsingTeleportStone,
	isUsingIncense,
	onUsePotion,
	onUseTeleportStone,
	onUseIncense,
	onRetreat,
	onOpenBag,
	onConsumableHover,
	onSwitchElement,
}: {
	node: WorldNode;
	zoneLevel: number;
	combat: ReturnType<typeof useCombatLoop>;
	maxHp: number;
	barrier: BarrierState;
	character: CharacterRow;
	selectedElement: SelectableElement | null;
	bagSize: number | undefined;
	isUsingPotion: boolean;
	isUsingTeleportStone: boolean;
	isUsingIncense: boolean;
	onUsePotion: () => void;
	onUseTeleportStone: () => void;
	onUseIncense: () => void;
	onRetreat: () => void;
	onOpenBag: () => void;
	onConsumableHover: (key: ConsumableKey | null) => void;
	onSwitchElement: (element: SelectableElement) => void;
}) {
	const isBossNode = node.kind === "boss";
	const canUseIncense =
		canLightIncense({
			incense: combat.incense,
			state: combat.state,
			enemyRarity: combat.enemy?.rarity,
			isBossNode,
			ambushActive: combat.ambushActive,
		}) && !isUsingIncense;

	return (
		<CombatScene
			zoneName={translateNodeName(node)}
			zoneLevel={zoneLevel}
			state={combat.state}
			isBossNode={isBossNode}
			rareIntroStage={combat.rareIntroStage}
			bossIntroStage={combat.bossIntroStage}
			enemy={combat.enemy}
			events={combat.events}
			playerHp={combat.playerHp}
			maxHp={maxHp}
			barrier={barrier.current}
			maxBarrier={barrier.max}
			barrierRefillRemaining={barrier.refillRemaining}
			xp={character.xp}
			xpNeeded={xpToNextLevel(character.level)}
			lastKillXp={combat.lastKill?.xp}
			potions={combat.potions}
			canUsePotion={
				combat.potions > 0 && combat.playerHp < maxHp && !isUsingPotion
			}
			onUsePotion={onUsePotion}
			teleportStones={character.teleportStones}
			canUseTeleportStone={
				character.teleportStones > 0 && !isUsingTeleportStone
			}
			onUseTeleportStone={onUseTeleportStone}
			incense={combat.incense}
			canUseIncense={canUseIncense}
			onUseIncense={onUseIncense}
			campSource={combat.campSource}
			ambushActive={combat.ambushActive}
			onRetreat={onRetreat}
			bagCount={bagSize ?? 0}
			onOpenBag={onOpenBag}
			onConsumableHover={onConsumableHover}
			calmariaElapsedMs={combat.calmariaElapsedMs}
			calmariaBudgetMs={combat.calmariaBudgetMs}
			campThresholdsMs={combat.campThresholdsMs}
			onDismissMinibossModal={combat.dismissMinibossModal}
			zoneId={node.id}
			onDismissCamp={combat.dismissCamp}
			classId={character.classId}
			selectedElement={selectedElement ?? "fire"}
			onSwitchElement={onSwitchElement}
			lastElementSwitchAt={character.lastElementSwitchAt ?? undefined}
		/>
	);
}
