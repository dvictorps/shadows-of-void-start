import { motion } from "framer-motion";
import type { WeaponType } from "#/game/items/types/base";

type EffectKind = "slash" | "impact" | "magic";

function effectKindFor(weaponType: WeaponType): EffectKind {
	switch (weaponType) {
		case "sword":
		case "dagger":
		case "axe":
		case "greatsword":
		case "twoHandedAxe":
			return "slash";
		case "mace":
		case "bow":
			return "impact";
		case "wand":
		case "staff":
			return "magic";
	}
}

type Props = {
	weaponType: WeaponType;
	isCrit?: boolean;
};

export default function HitFx({ weaponType, isCrit = false }: Props) {
	const kind = effectKindFor(weaponType);
	const critScale = isCrit ? 1.4 : 1;
	if (kind === "slash") return <SlashFx critScale={critScale} />;
	if (kind === "impact") return <ImpactFx critScale={critScale} />;
	return <MagicFx critScale={critScale} />;
}

function SlashFx({ critScale }: { critScale: number }) {
	const width = 160 * critScale;
	return (
		<motion.div
			aria-hidden
			className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2"
			style={{
				width,
				height: 6,
				background:
					"linear-gradient(90deg, transparent, #ffffff 30%, #d0e8ff 50%, #ffffff 70%, transparent)",
				rotate: "-30deg",
				filter: "drop-shadow(0 0 4px rgba(208, 232, 255, 0.8))",
			}}
			initial={{ scaleX: 0, opacity: 1 }}
			animate={{ scaleX: 1, opacity: 0 }}
			transition={{ duration: 0.25, ease: "easeOut" }}
		/>
	);
}

function ImpactFx({ critScale }: { critScale: number }) {
	const lineCount = 8;
	const length = 32 * critScale;
	const reach = 48 * critScale;
	return (
		<div
			aria-hidden
			className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2"
		>
			{Array.from({ length: lineCount }, (_, i) => {
				const angle = (i / lineCount) * 360;
				return (
					<motion.div
						// biome-ignore lint/suspicious/noArrayIndexKey: deterministic per-render
						key={i}
						className="absolute top-0 left-0"
						style={{
							width: length,
							height: 3,
							background:
								"linear-gradient(90deg, #ffd166, #ff7a30 70%, transparent)",
							borderRadius: 2,
							transformOrigin: "0 50%",
							rotate: `${angle}deg`,
						}}
						initial={{ x: 0, opacity: 1, scaleX: 0 }}
						animate={{ x: reach, opacity: 0, scaleX: 1 }}
						transition={{ duration: 0.3, ease: "easeOut" }}
					/>
				);
			})}
		</div>
	);
}

function MagicFx({ critScale }: { critScale: number }) {
	const sparkleCount = 6;
	const glowSize = 80 * critScale;
	const reach = 45 * critScale;
	return (
		<div
			aria-hidden
			className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2"
		>
			<motion.div
				className="-translate-x-1/2 -translate-y-1/2 absolute top-0 left-0 rounded-full"
				style={{
					width: glowSize,
					height: glowSize,
					background:
						"radial-gradient(circle, rgba(120, 160, 255, 0.7) 0%, rgba(80, 120, 255, 0.4) 40%, transparent 70%)",
					filter: "blur(2px)",
				}}
				initial={{ scale: 0.5, opacity: 0.9 }}
				animate={{ scale: 1.4, opacity: 0 }}
				transition={{ duration: 0.4, ease: "easeOut" }}
			/>
			{Array.from({ length: sparkleCount }, (_, i) => {
				const angle = (i / sparkleCount) * Math.PI * 2;
				const dx = Math.cos(angle) * reach;
				const dy = Math.sin(angle) * reach;
				const hue = 200 + ((i * 30) % 180);
				return (
					<motion.div
						// biome-ignore lint/suspicious/noArrayIndexKey: deterministic per-render
						key={i}
						className="absolute top-0 left-0 rounded-full"
						style={{
							width: 6,
							height: 6,
							background: `hsl(${hue}, 90%, 75%)`,
							filter: "drop-shadow(0 0 3px currentColor)",
						}}
						initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
						animate={{ x: dx, y: dy, opacity: 0, scale: 1.2 }}
						transition={{ duration: 0.4, ease: "easeOut" }}
					/>
				);
			})}
		</div>
	);
}
