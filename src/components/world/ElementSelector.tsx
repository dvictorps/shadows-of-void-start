import { Flame, Snowflake, Zap } from "lucide-react";
import { useEffect, useState } from "react";

type Element = "fire" | "cold" | "lightning";

const ELEMENT_CONFIG: Record<
	Element,
	{ icon: typeof Flame; color: string; glowColor: string }
> = {
	fire: {
		icon: Flame,
		color: "#ff6b35",
		glowColor: "rgba(255, 107, 53, 0.6)",
	},
	cold: {
		icon: Snowflake,
		color: "#4fc3f7",
		glowColor: "rgba(79, 195, 247, 0.6)",
	},
	lightning: {
		icon: Zap,
		color: "#ffd54f",
		glowColor: "rgba(255, 213, 79, 0.6)",
	},
};

const COOLDOWN_MS = 5_000;
const ELEMENTS: Element[] = ["fire", "cold", "lightning"];

type HoverKey = `element_${Element}`;

export default function ElementSelector({
	selected,
	onSwitch,
	onHover,
	disabled,
	lastSwitchAt,
}: {
	selected: Element;
	onSwitch: (element: Element) => void;
	onHover?: (key: HoverKey | null) => void;
	disabled?: boolean;
	lastSwitchAt?: number;
}) {
	const [cooldownEnd, setCooldownEnd] = useState(
		lastSwitchAt ? lastSwitchAt + COOLDOWN_MS : 0,
	);
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		if (!lastSwitchAt) return;
		const end = lastSwitchAt + COOLDOWN_MS;
		if (end > Date.now()) setCooldownEnd(end);
	}, [lastSwitchAt]);

	const remaining = Math.max(0, cooldownEnd - now);
	const onCooldown = remaining > 0;

	useEffect(() => {
		if (!onCooldown) return;
		const id = setInterval(() => setNow(Date.now()), 100);
		return () => clearInterval(id);
	}, [onCooldown]);

	function handleClick(element: Element) {
		if (element === selected || onCooldown || disabled) return;
		onSwitch(element);
	}

	return (
		<div className="flex gap-1.5">
			{ELEMENTS.map((el) => {
				const cfg = ELEMENT_CONFIG[el];
				const Icon = cfg.icon;
				const isActive = el === selected;
				return (
					<button
						key={el}
						type="button"
						onClick={() => handleClick(el)}
						onMouseEnter={() => onHover?.(`element_${el}`)}
						onMouseLeave={() => onHover?.(null)}
						onFocus={() => onHover?.(`element_${el}`)}
						onBlur={() => onHover?.(null)}
						disabled={disabled || (onCooldown && !isActive)}
						className="relative flex h-10 w-10 items-center justify-center border transition disabled:cursor-not-allowed disabled:opacity-40"
						style={{
							borderColor: isActive ? cfg.color : "rgba(255,255,255,0.3)",
							backgroundColor: isActive
								? `${cfg.color}22`
								: "rgba(0,0,0,0.8)",
							boxShadow: isActive ? `0 0 8px ${cfg.glowColor}` : "none",
						}}
					>
						<Icon
							className="h-5 w-5"
							style={{
								color: isActive ? cfg.color : "rgba(255,255,255,0.5)",
							}}
						/>
						{onCooldown && !isActive && (
							<div
								className="absolute inset-0 bg-black/60"
								style={{
									clipPath: `inset(${((COOLDOWN_MS - remaining) / COOLDOWN_MS) * 100}% 0 0 0)`,
								}}
							/>
						)}
					</button>
				);
			})}
		</div>
	);
}
