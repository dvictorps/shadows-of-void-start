import {
	RARITY_COLORS,
	RarityCard,
	RarityHeader,
	TooltipSeparator,
} from "#/components/ui/rarity-card";
import {
	translateItemName,
	translateTemplateName,
} from "#/game/items/item-name";
import { localizeImplicit, localizeMod } from "#/game/items/mod-i18n";
import type { GeneratedItem, ItemRarity } from "#/game/items/types";
import { m } from "#/paraglide/messages";

const HAS_GENERATED_NAME = new Set<ItemRarity>(["rare", "legendary", "epic"]);
const HAS_GLOW = new Set<ItemRarity>(["legendary", "epic"]);
const HAS_ORNAMENTS = new Set<ItemRarity>(["rare", "legendary", "epic"]);
const SPELL_WEAPONS = new Set(["staff", "wand"]);

const MODIFIED_COLOR = RARITY_COLORS.magic;
const LABEL_COLOR = "rgba(255, 255, 255, 0.45)";
const DIM_COLOR = "rgba(255, 255, 255, 0.35)";

const ELEMENT_NAME: Record<string, () => string> = {
	Cold: m.element_cold,
	Fire: m.element_fire,
	Lightning: m.element_lightning,
	Void: m.element_void,
};

function elementDamageLabel(element: string): string {
	const name = ELEMENT_NAME[element]?.() ?? element;
	return m.tooltip_damage_line({ element: name });
}

function ImplicitSeparator() {
	return (
		<div className="my-1 px-2">
			<div className="border-t border-white/15 border-dashed" />
		</div>
	);
}

function CornerOrnaments({ color }: { color: string }) {
	const style = { borderColor: color };
	const base = "absolute h-2 w-2 pointer-events-none";
	return (
		<>
			<div
				className={`${base} top-0 left-0 border-t-2 border-l-2`}
				style={style}
			/>
			<div
				className={`${base} top-0 right-0 border-t-2 border-r-2`}
				style={style}
			/>
			<div
				className={`${base} bottom-0 left-0 border-b-2 border-l-2`}
				style={style}
			/>
			<div
				className={`${base} bottom-0 right-0 border-b-2 border-r-2`}
				style={style}
			/>
		</>
	);
}

// Identify which base stats are modified by local mods
function getModifiedStats(item: GeneratedItem): Set<string> {
	const modified = new Set<string>();
	if (!item.computedStats) return modified;

	const stats = item.baseStats;
	const computed = item.computedStats;

	if (
		computed.physicalDamage.min !== (stats.minDamage ?? 0) ||
		computed.physicalDamage.max !== (stats.maxDamage ?? 0)
	) {
		modified.add("physicalDamage");
	}
	if (computed.attackSpeed !== (stats.attackSpeed ?? 1)) {
		modified.add("attackSpeed");
	}
	if (computed.criticalChance !== (stats.criticalChance ?? 5)) {
		modified.add("criticalChance");
	}

	return modified;
}

export default function ItemTooltip({
	item,
	brokenReasons,
}: {
	item: GeneratedItem;
	brokenReasons?: string[];
}) {
	const nameColor = RARITY_COLORS[item.rarity];
	const showGeneratedName = HAS_GENERATED_NAME.has(item.rarity);
	const showGlow = HAS_GLOW.has(item.rarity);
	const showOrnaments = HAS_ORNAMENTS.has(item.rarity);

	const stats = item.baseStats;
	const computed = item.computedStats;
	const defense = item.computedDefenseStats;
	const modifiedStats = getModifiedStats(item);

	const isWeapon = "minDamage" in stats;
	const isSpellWeapon = SPELL_WEAPONS.has(item.weaponType ?? "");
	const isAttackWeapon = isWeapon && !isSpellWeapon;
	const hasDefenses =
		"armor" in stats ||
		"evasion" in stats ||
		"barrier" in stats ||
		"blockChance" in stats;

	return (
		<RarityCard
			rarity={item.rarity}
			showGlow={showGlow}
			className="min-w-[260px] max-w-[380px]"
		>
			{/* Broken-state warning band — overrides the rarity accent above it. */}
			{brokenReasons && brokenReasons.length > 0 && (
				<div className="bg-red-900/40 px-4 py-1 font-bold text-red-300 text-xs uppercase tracking-wider">
					{brokenReasons.map((r) => (
						<div key={r}>{r}</div>
					))}
				</div>
			)}

			{showOrnaments && <CornerOrnaments color={nameColor} />}

			<RarityHeader rarity={item.rarity}>
				{showGeneratedName && (
					<div className="text-lg" style={{ color: nameColor }}>
						{translateItemName(item)}
					</div>
				)}
				<div
					className={showGeneratedName ? "text-sm" : "text-lg"}
					style={{ color: nameColor }}
				>
					{showGeneratedName
						? translateTemplateName(item)
						: translateItemName(item)}
				</div>
			</RarityHeader>

			<TooltipSeparator />

			{isAttackWeapon && (
				<>
					<div className="space-y-0.5 px-4 py-1">
						<div className="flex justify-between">
							<span style={{ color: LABEL_COLOR }}>
								{m.tooltip_physical_damage()}
							</span>
							<span
								style={{
									color: modifiedStats.has("physicalDamage")
										? MODIFIED_COLOR
										: "white",
								}}
							>
								{computed
									? `${computed.physicalDamage.min}-${computed.physicalDamage.max}`
									: `${stats.minDamage}-${stats.maxDamage}`}
							</span>
						</div>
						{computed?.elementalDamage.map((elem) => (
							<div key={elem.element} className="flex justify-between">
								<span style={{ color: LABEL_COLOR }}>
									{elementDamageLabel(elem.element)}
								</span>
								<span style={{ color: MODIFIED_COLOR }}>
									{elem.min}-{elem.max}
								</span>
							</div>
						))}
						{(computed?.criticalChance ?? stats.criticalChance) != null && (
							<div className="flex justify-between">
								<span style={{ color: LABEL_COLOR }}>
									{m.tooltip_critical_strike_chance()}
								</span>
								<span
									style={{
										color: modifiedStats.has("criticalChance")
											? MODIFIED_COLOR
											: "white",
									}}
								>
									{(
										computed?.criticalChance ??
										stats.criticalChance ??
										5
									).toFixed(1)}
									%
								</span>
							</div>
						)}
						{(computed?.attackSpeed ?? stats.attackSpeed) != null && (
							<div className="flex justify-between">
								<span style={{ color: LABEL_COLOR }}>
									{m.tooltip_attacks_per_second()}
								</span>
								<span
									style={{
										color: modifiedStats.has("attackSpeed")
											? MODIFIED_COLOR
											: "white",
									}}
								>
									{(computed?.attackSpeed ?? stats.attackSpeed ?? 1).toFixed(2)}
								</span>
							</div>
						)}
					</div>
					<TooltipSeparator />
				</>
			)}

			{isSpellWeapon && (
				<>
					<div className="space-y-0.5 px-4 py-1">
						{stats.minDamage != null && stats.maxDamage != null && (
							<div className="flex justify-between">
								<span style={{ color: LABEL_COLOR }}>
									{m.tooltip_spell_damage()}
								</span>
								<span className="text-white">
									{stats.minDamage}-{stats.maxDamage}
								</span>
							</div>
						)}
						{stats.criticalChance != null && (
							<div className="flex justify-between">
								<span style={{ color: LABEL_COLOR }}>
									{m.tooltip_critical_strike_chance()}
								</span>
								<span className="text-white">
									{stats.criticalChance.toFixed(1)}%
								</span>
							</div>
						)}
						<div className="flex justify-between">
							<span style={{ color: LABEL_COLOR }}>
								{m.tooltip_casts_per_second()}
							</span>
							<span className="text-white">1.00</span>
						</div>
					</div>
					<TooltipSeparator />
				</>
			)}

			{/* Defence stats — modified-color (blue) only when computed differs from
			 * the template base. `computedDefenseStats` is always emitted for
			 * armor pieces (since the silent-defense fix), so a mere existence
			 * check would paint every defense value blue — compare values. */}
			{hasDefenses && (
				<>
					<div className="space-y-0.5 px-4 py-1">
						{"armor" in stats && (
							<div className="flex justify-between">
								<span style={{ color: LABEL_COLOR }}>{m.tooltip_armour()}</span>
								<span
									style={{
										color:
											defense?.armor != null && defense.armor !== stats.armor
												? MODIFIED_COLOR
												: "white",
									}}
								>
									{defense?.armor ?? stats.armor}
								</span>
							</div>
						)}
						{"evasion" in stats && (
							<div className="flex justify-between">
								<span style={{ color: LABEL_COLOR }}>
									{m.tooltip_evasion_rating()}
								</span>
								<span
									style={{
										color:
											defense?.evasion != null &&
											defense.evasion !== stats.evasion
												? MODIFIED_COLOR
												: "white",
									}}
								>
									{defense?.evasion ?? stats.evasion}
								</span>
							</div>
						)}
						{"barrier" in stats && (
							<div className="flex justify-between">
								<span style={{ color: LABEL_COLOR }}>{m.stats_barrier()}</span>
								<span
									style={{
										color:
											defense?.barrier != null &&
											defense.barrier !== stats.barrier
												? MODIFIED_COLOR
												: "white",
									}}
								>
									{defense?.barrier ?? stats.barrier}
								</span>
							</div>
						)}
						{"blockChance" in stats && (
							<div className="flex justify-between">
								<span style={{ color: LABEL_COLOR }}>
									{m.tooltip_block_chance()}
								</span>
								<span
									style={{
										color:
											defense?.blockChance != null &&
											defense.blockChance !== stats.blockChance
												? MODIFIED_COLOR
												: "white",
									}}
								>
									{defense?.blockChance ?? stats.blockChance}%
								</span>
							</div>
						)}
					</div>
					<TooltipSeparator />
				</>
			)}

			{item.implicits.length > 0 && (
				<>
					<div className="space-y-0.5 px-4 py-1">
						{item.implicits.map((mod) => (
							<div
								key={`${mod.description}:${mod.value}`}
								style={{ color: MODIFIED_COLOR }}
							>
								{localizeImplicit(mod)}
							</div>
						))}
					</div>
					<ImplicitSeparator />
				</>
			)}

			{item.explicits.length > 0 && (
				<div className="space-y-0.5 px-4 py-1">
					{item.explicits.map((mod) => (
						<div
							key={`${mod.modifierId}:${mod.value}:${mod.tier}`}
							style={{ color: MODIFIED_COLOR }}
						>
							{localizeMod(mod, item)}
							{!mod.isGlobalStat && mod.modifierType === "increased" && (
								<span style={{ color: "rgba(136, 136, 255, 0.5)" }}>
									{" "}
									{m.mod_local_suffix()}
								</span>
							)}
						</div>
					))}
				</div>
			)}

			{renderRequirements(item)}

			<TooltipSeparator />
			<div
				className="px-4 py-1 pb-2 text-xs uppercase tracking-wider"
				style={{ color: DIM_COLOR }}
			>
				{m.tooltip_item_level()}:{" "}
				<span className="text-white">{item.itemLevel}</span>
			</div>
		</RarityCard>
	);
}

function renderRequirements(item: GeneratedItem) {
	const reqs = item.requirements;
	const hasStatReq = !!(reqs && (reqs.str || reqs.dex || reqs.int));
	const needsBow = item.equipmentType === "quiver";
	if (!hasStatReq && !needsBow) return null;
	return (
		<>
			<TooltipSeparator />
			<div
				className="px-4 py-1 text-xs uppercase tracking-wider"
				style={{ color: DIM_COLOR }}
			>
				{hasStatReq && reqs && (
					<div>
						<span>{m.tooltip_requires()} </span>
						{[
							reqs.level > 1 && m.tooltip_level_value({ value: reqs.level }),
							reqs.str && m.tooltip_req_strength({ value: reqs.str }),
							reqs.dex && m.tooltip_req_dexterity({ value: reqs.dex }),
							reqs.int && m.tooltip_req_intelligence({ value: reqs.int }),
						]
							.filter(Boolean)
							.join(", ")}
					</div>
				)}
				{needsBow && <div>{m.tooltip_requires_bow_in_main_hand()}</div>}
			</div>
		</>
	);
}
