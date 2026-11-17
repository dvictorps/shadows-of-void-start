import { AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import type { SelectableElement } from "#/game/stats/types";
import type { DamageEvent } from "#/hooks/useCombatLoop";
import { m } from "#/paraglide/messages";

import { ConsumableSlot } from "../ConsumableSlot";
import ElementSelector from "../ElementSelector";
import HealthGlobe from "../HealthGlobe";
import { XpBar } from "../XpBar";
import FloatingDamage from "./FloatingDamage";

export type ConsumableKey =
	| "potion"
	| "teleport"
	| "incense"
	| `element_${SelectableElement}`;

type HoverReporter = (key: ConsumableKey | null) => void;

export type CombatBottomHudProps = {
	hudFading: boolean;
	events: DamageEvent[];
	playerHp: number;
	maxHp: number;
	barrier: number;
	maxBarrier: number;
	barrierRefillRemaining?: number;
	xp: number;
	xpNeeded: number;
	potions: number;
	canUsePotion: boolean;
	onUsePotion: () => void;
	teleportStones: number;
	canUseTeleportStone: boolean;
	onUseTeleportStone: () => void;
	incense: number;
	canUseIncense: boolean;
	onUseIncense: () => void;
	onConsumableHover?: HoverReporter;
	classId?: string;
	selectedElement?: SelectableElement;
	onSwitchElement?: (element: SelectableElement) => void;
	lastElementSwitchAt?: number;
};

export default function CombatBottomHud({
	hudFading,
	events,
	playerHp,
	maxHp,
	barrier,
	maxBarrier,
	barrierRefillRemaining,
	xp,
	xpNeeded,
	potions,
	canUsePotion,
	onUsePotion,
	teleportStones,
	canUseTeleportStone,
	onUseTeleportStone,
	incense,
	canUseIncense,
	onUseIncense,
	onConsumableHover,
	classId,
	selectedElement,
	onSwitchElement,
	lastElementSwitchAt,
}: CombatBottomHudProps) {
	const playerEvents = useMemo(
		() => events.filter((e) => e.target === "player"),
		[events],
	);
	const lastPlayerHit = useMemo(
		() => playerEvents.findLast((e) => !e.isMiss && !e.isBlocked) ?? null,
		[playerEvents],
	);
	const onHover: HoverReporter = (key) => onConsumableHover?.(key);
	const hoverAs = (key: ConsumableKey) => (hovered: boolean) =>
		onHover(hovered ? key : null);

	return (
		<div
			className={`relative flex items-center gap-4 border-t border-white/15 bg-black/60 p-4 transition-opacity duration-[1200ms] ease-out ${
				hudFading ? "pointer-events-none opacity-0" : "opacity-100"
			}`}
		>
			<div className="relative">
				<HealthGlobe
					hp={playerHp}
					maxHp={maxHp}
					barrier={barrier}
					maxBarrier={maxBarrier}
					barrierRefillRemaining={barrierRefillRemaining}
					size="xl"
					hitToken={lastPlayerHit?.id ?? null}
				/>
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<AnimatePresence>
						{playerEvents.map((event) => (
							<FloatingDamage key={event.id} event={event} variant="player" />
						))}
					</AnimatePresence>
				</div>
			</div>

			{classId === "mage" && selectedElement && onSwitchElement && (
				<ElementSelector
					selected={selectedElement}
					onSwitch={onSwitchElement}
					onHover={onHover}
					lastSwitchAt={lastElementSwitchAt}
				/>
			)}

			<XpBar xp={xp} xpNeeded={xpNeeded} size="hud" />

			<SlotCell>
				<ConsumableSlot
					label={m.teleport_use_aria()}
					count={teleportStones}
					disabled={!canUseTeleportStone}
					onUse={onUseTeleportStone}
					onHover={hoverAs("teleport")}
					art="/assets/sprites/ui/pedraTeleporte.png"
				/>
			</SlotCell>

			<SlotCell>
				<ConsumableSlot
					label={m.incense_use_aria()}
					count={incense}
					disabled={!canUseIncense}
					onUse={onUseIncense}
					onHover={hoverAs("incense")}
				>
					<Sparkles className="pointer-events-none size-10 text-purple-300/80" />
				</ConsumableSlot>
			</SlotCell>

			<SlotCell>
				<ConsumableSlot
					label={m.potion_use_aria()}
					count={potions}
					disabled={!canUsePotion}
					onUse={onUsePotion}
					onHover={hoverAs("potion")}
					art="/assets/sprites/ui/pocaoCura.png"
				/>
			</SlotCell>
		</div>
	);
}

function SlotCell({ children }: { children: ReactNode }) {
	return <div className="flex flex-col items-center gap-1">{children}</div>;
}
