import { localizeImplicit, localizeMod } from "#/game/items/mod-i18n";
import type { GeneratedItem, ItemRarity } from "#/game/items/types";

const RARITY_COLORS: Record<ItemRarity, string> = {
	normal: "#c8c8c8",
	magic: "#8888ff",
	rare: "#ffff77",
	legendary: "#dc143c",
	epic: "#1eff00",
};

const RARITY_HEADER_BG: Record<ItemRarity, string> = {
	normal: "transparent",
	magic: "rgba(56, 56, 120, 0.35)",
	rare: "rgba(120, 110, 30, 0.35)",
	legendary: "rgba(140, 10, 30, 0.3)",
	epic: "rgba(15, 130, 0, 0.3)",
};

const HAS_GENERATED_NAME = new Set<ItemRarity>(["rare", "legendary", "epic"]);
const HAS_GLOW = new Set<ItemRarity>(["legendary", "epic"]);
const HAS_ORNAMENTS = new Set<ItemRarity>(["rare", "legendary", "epic"]);
const SPELL_WEAPONS = new Set(["staff", "wand"]);

const MODIFIED_COLOR = "#8888ff";
const LABEL_COLOR = "rgba(255, 255, 255, 0.45)";
const DIM_COLOR = "rgba(255, 255, 255, 0.35)";

function Separator() {
	return (
		<div className="my-1 flex items-center gap-1.5 px-2">
			<div className="h-px flex-1 bg-white/20" />
			<div className="h-1 w-1 rotate-45 bg-white/40" />
			<div className="h-px flex-1 bg-white/20" />
		</div>
	);
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
	const headerBg = RARITY_HEADER_BG[item.rarity];
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

	const borderColor = showGlow ? nameColor : "rgba(255, 255, 255, 0.4)";
	const glowStyle = showGlow
		? {
				borderColor,
				boxShadow: `0 0 12px ${nameColor}66, inset 0 0 8px ${nameColor}22, 0 0 20px rgba(0,0,0,0.9)`,
			}
		: { boxShadow: "0 0 20px rgba(0,0,0,0.9)" };

	return (
		<div
			className="relative inline-block min-w-[260px] max-w-[380px] border bg-black text-sm leading-relaxed tracking-wide"
			style={{
				borderColor,
				...glowStyle,
			}}
		>
			{/* Accent line for legendary/epic */}
			{showGlow && (
				<div className="h-[2px]" style={{ backgroundColor: nameColor }} />
			)}

			{/* Broken-state warning band — overrides the rarity accent above it. */}
			{brokenReasons && brokenReasons.length > 0 && (
				<div className="bg-red-900/40 px-4 py-1 font-bold text-red-300 text-xs uppercase tracking-wider">
					{brokenReasons.map((r) => (
						<div key={r}>{r}</div>
					))}
				</div>
			)}

			{/* Corner ornaments for rare+ */}
			{showOrnaments && <CornerOrnaments color={nameColor} />}

			{/* Item name header */}
			<div
				className="display-title px-4 py-2 text-center uppercase tracking-[0.15em]"
				style={{
					background: `linear-gradient(to bottom, ${headerBg}, transparent)`,
				}}
			>
				{showGeneratedName && (
					<div className="text-lg" style={{ color: nameColor }}>
						{item.name}
					</div>
				)}
				<div
					className={showGeneratedName ? "text-sm" : "text-lg"}
					style={{ color: nameColor }}
				>
					{showGeneratedName ? item.templateName : item.name}
				</div>
			</div>

			<Separator />

			{/* Attack weapon stats */}
			{isAttackWeapon && (
				<>
					<div className="space-y-0.5 px-4 py-1">
						<div className="flex justify-between">
							<span style={{ color: LABEL_COLOR }}>Physical Damage</span>
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
								<span style={{ color: LABEL_COLOR }}>{elem.element} Damage</span>
								<span style={{ color: MODIFIED_COLOR }}>
									{elem.min}-{elem.max}
								</span>
							</div>
						))}
						{(computed?.criticalChance ?? stats.criticalChance) != null && (
							<div className="flex justify-between">
								<span style={{ color: LABEL_COLOR }}>Critical Strike Chance</span>
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
								<span style={{ color: LABEL_COLOR }}>Attacks per Second</span>
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
					<Separator />
				</>
			)}

			{/* Spell weapon stats — only base crit chance */}
			{isSpellWeapon && stats.criticalChance != null && (
				<>
					<div className="space-y-0.5 px-4 py-1">
						<div className="flex justify-between">
							<span style={{ color: LABEL_COLOR }}>Critical Strike Chance</span>
							<span className="text-white">
								{stats.criticalChance.toFixed(1)}%
							</span>
						</div>
					</div>
					<Separator />
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
								<span style={{ color: LABEL_COLOR }}>Armour</span>
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
								<span style={{ color: LABEL_COLOR }}>Evasion Rating</span>
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
								<span style={{ color: LABEL_COLOR }}>Barrier</span>
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
								<span style={{ color: LABEL_COLOR }}>Block Chance</span>
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
					<Separator />
				</>
			)}

			{/* Implicit mods */}
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

			{/* Explicit mods */}
			{item.explicits.length > 0 && (
				<div className="space-y-0.5 px-4 py-1">
					{item.explicits.map((mod) => (
						<div
							key={`${mod.modifierId}:${mod.value}:${mod.tier}`}
							style={{ color: MODIFIED_COLOR }}
						>
							{localizeMod(mod)}
							{!mod.isGlobalStat && mod.modifierType === "increased" && (
								<span style={{ color: "rgba(136, 136, 255, 0.5)" }}> (Local)</span>
							)}
						</div>
					))}
				</div>
			)}

			{/* Requirements */}
			{item.requirements &&
				(item.requirements.str ||
					item.requirements.dex ||
					item.requirements.int) && (
					<>
						<Separator />
						<div
							className="px-4 py-1 text-xs uppercase tracking-wider"
							style={{ color: DIM_COLOR }}
						>
							<span>Requires </span>
							{[
								item.requirements.level > 1 &&
									`Level ${item.requirements.level}`,
								item.requirements.str && `${item.requirements.str} Str`,
								item.requirements.dex && `${item.requirements.dex} Dex`,
								item.requirements.int && `${item.requirements.int} Int`,
							]
								.filter(Boolean)
								.join(", ")}
						</div>
					</>
				)}

			{/* Item level */}
			<Separator />
			<div
				className="px-4 py-1 pb-2 text-xs uppercase tracking-wider"
				style={{ color: DIM_COLOR }}
			>
				Item Level: <span className="text-white">{item.itemLevel}</span>
			</div>
		</div>
	);
}
