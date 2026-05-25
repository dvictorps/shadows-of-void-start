import { motion } from "framer-motion";
import { type HitFxKind, WEAPON_FX } from "#/game/combat/weapon-fx";
import type { WeaponType } from "#/game/items/types/base";

type Props = {
	weaponType: WeaponType;
	isCrit?: boolean;
};

export default function HitFx({ weaponType, isCrit = false }: Props) {
	const kind: HitFxKind = WEAPON_FX[weaponType].visual;
	const critScale = isCrit ? 1.4 : 1;
	switch (kind) {
		case "slash":
			return <SlashFx critScale={critScale} />;
		case "quickSlash":
			return <QuickSlashFx critScale={critScale} />;
		case "arrow":
			return <ArrowFx critScale={critScale} />;
		case "impact":
			return <ImpactFx critScale={critScale} />;
		case "magic":
			return <MagicFx critScale={critScale} />;
	}
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

// Dagger: two thin strokes forming a flicker, faster than the heavy slash.
// The crossed angle reads as "flurry" / "stab" instead of a single sweep.
function QuickSlashFx({ critScale }: { critScale: number }) {
	const width = 80 * critScale;
	return (
		<div
			aria-hidden
			className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2"
		>
			{[-30, 30].map((angle) => (
				<motion.div
					key={angle}
					className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2"
					style={{
						width,
						height: 4,
						background:
							"linear-gradient(90deg, transparent, #ffffff 35%, #d0e8ff 50%, #ffffff 65%, transparent)",
						rotate: `${angle}deg`,
						filter: "drop-shadow(0 0 3px rgba(208, 232, 255, 0.8))",
					}}
					initial={{ scaleX: 0, opacity: 1 }}
					animate={{ scaleX: 1, opacity: 0 }}
					transition={{ duration: 0.18, ease: "easeOut" }}
				/>
			))}
		</div>
	);
}

// Bow: directional projectile streak entering from off-screen-left, plus a
// small sparkle burst at the impact point so the arrow reads as "arrived"
// rather than "still mid-flight".
function ArrowFx({ critScale }: { critScale: number }) {
	const streakLength = 200 * critScale;
	const sparkCount = 4;
	const sparkReach = 16 * critScale;
	return (
		<div
			aria-hidden
			className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2"
		>
			<motion.div
				className="absolute top-0 left-0 -translate-y-1/2"
				style={{
					width: streakLength,
					height: 3,
					background:
						"linear-gradient(90deg, transparent, #fff4c2 40%, #ffe27a 70%, #fff8e0)",
					filter: "drop-shadow(0 0 3px rgba(255, 226, 122, 0.8))",
					transformOrigin: "100% 50%",
				}}
				initial={{ x: -streakLength * 1.2, opacity: 1 }}
				animate={{ x: -streakLength * 0.5, opacity: 0 }}
				transition={{ duration: 0.15, ease: "easeOut" }}
			/>
			{Array.from({ length: sparkCount }, (_, i) => {
				const angle = (i / sparkCount) * Math.PI * 2;
				const dx = Math.cos(angle) * sparkReach;
				const dy = Math.sin(angle) * sparkReach;
				return (
					<motion.div
						// biome-ignore lint/suspicious/noArrayIndexKey: deterministic per-render
						key={i}
						className="absolute top-0 left-0 rounded-full"
						style={{
							width: 4,
							height: 4,
							background: "#fff4c2",
							filter: "drop-shadow(0 0 2px #ffe27a)",
						}}
						initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
						animate={{ x: dx, y: dy, opacity: [0, 1, 0], scale: 1 }}
						transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
					/>
				);
			})}
		</div>
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
