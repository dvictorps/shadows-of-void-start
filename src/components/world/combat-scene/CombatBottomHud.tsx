import { AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import type { SelectableElement } from "#/game/stats/types";
import type { DamageEvent } from "#/hooks/useCombatLoop";
import { m } from "#/paraglide/messages";

import { ConsumableSlot } from "../ConsumableSlot";
import ElementSelector from "../ElementSelector";
import HealthGlobe from "../HealthGlobe";
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
	// Hover bubbles back to the parent so the world's TextLog can describe the
	// consumable the player is pointing at. Null on mouse leave.
	onConsumableHover?: HoverReporter;
	classId?: string;
	selectedElement?: SelectableElement;
	onSwitchElement?: (element: SelectableElement) => void;
	lastElementSwitchAt?: number;
};

/**
 * The bottom HUD: HP globe with the player's damage popups, the mage's
 * element selector, the XP bar and the consumable slots.
 */
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
	// Latest event where the player actually took damage. Drives the lighter
	// health-globe shake — miss/block don't trigger it.
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
				{/* Damage popups over the globe */}
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

			<XpBar xp={xp} xpNeeded={xpNeeded} />

			{/* Teleport stone — sends to city by default from the HUD (panic
			 * exit). Non-city destinations are picked from the map view. */}
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

			{/* Incenso Etéreo — invokes a camp on demand. Blocked during boss
			 * fight / camp / boss intro (see useCombatLoop.triggerIncense). */}
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

function XpBar({ xp, xpNeeded }: { xp: number; xpNeeded: number }) {
	const xpPct = xpNeeded > 0 ? Math.min(100, (xp / xpNeeded) * 100) : 0;
	return (
		<div className="flex-1 space-y-1">
			<div className="text-[10px] uppercase tracking-wider text-yellow-300/80">
				{m.status_xp_label({ current: xp, needed: xpNeeded })}
			</div>
			<div
				role="progressbar"
				aria-label={m.xp_bar_aria()}
				aria-valuenow={xp}
				aria-valuemin={0}
				aria-valuemax={xpNeeded}
				className="h-3 w-full overflow-hidden rounded-full bg-white/10"
			>
				<div
					className="h-full bg-yellow-300 transition-[width] duration-200"
					style={{ width: `${xpPct}%` }}
				/>
			</div>
		</div>
	);
}

// Each slot keeps its own column wrapper: CombatScene.test finds the bottom
// HUD (to check its fade) as the potion button's grandparent.
function SlotCell({ children }: { children: ReactNode }) {
	return <div className="flex flex-col items-center gap-1">{children}</div>;
}
