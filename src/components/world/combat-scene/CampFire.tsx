import { useReducedMotion } from "framer-motion";
import { type CSSProperties, useState } from "react";

import { useTicker } from "#/hooks/useTicker";

import {
	CAMP_FIRE_ASPECT,
	CAMP_FIRE_CENTER,
	CAMP_FIRE_FRAME_MS,
	CAMP_FIRE_FRAMES,
	nextFireFrame,
	nextGlow,
} from "./camp-fire";

const { width, height } = CAMP_FIRE_ASPECT;
const { xPct, yPct } = CAMP_FIRE_CENTER;

const SCENE: CSSProperties = {
	position: "absolute",
	left: "50%",
	top: "50%",
	width: `max(100cqw, calc(100cqh * ${width} / ${height}))`,
	aspectRatio: `${width} / ${height}`,
	transform: "translate(-50%, -50%)",
	isolation: "isolate",
};

const LIGHTS = [
	{
		key: "halo",
		size: { w: 95, h: 150 },
		y: yPct,
		gradient:
			"radial-gradient(closest-side, rgba(255, 150, 50, 0.32), rgba(255, 110, 30, 0.14) 45%, transparent)",
	},
	{
		key: "floor",
		size: { w: 60, h: 30 },
		y: yPct + 16,
		gradient:
			"radial-gradient(closest-side, rgba(255, 140, 40, 0.3), rgba(255, 90, 20, 0.1) 55%, transparent)",
	},
	{
		key: "core",
		size: { w: 26, h: 46 },
		y: yPct - 2,
		gradient:
			"radial-gradient(closest-side, rgba(255, 210, 120, 0.26), rgba(255, 160, 60, 0.1) 50%, transparent)",
	},
] as const;

export default function CampFire() {
	const still = useReducedMotion();
	const [flame, setFlame] = useState({ frame: 0, glow: 1 });

	useTicker(!still, CAMP_FIRE_FRAME_MS, () => {
		setFlame((current) => ({
			frame: nextFireFrame(current.frame, CAMP_FIRE_FRAMES.length),
			glow: nextGlow(),
		}));
	});

	return (
		<div
			aria-hidden
			data-testid="camp-fire"
			className="pointer-events-none absolute inset-0 overflow-hidden bg-black"
			style={{ containerType: "size" }}
		>
			<div style={SCENE}>
				{CAMP_FIRE_FRAMES.map((src, i) => {
					const active = i === flame.frame;
					return (
						<img
							key={src}
							src={src}
							alt=""
							draggable={false}
							data-active={active}
							className="absolute inset-0 h-full w-full"
							style={{ opacity: active ? 1 : 0 }}
						/>
					);
				})}
				{LIGHTS.map((light) => (
					<div
						key={light.key}
						className="camp-glow absolute rounded-full"
						style={{
							left: `${xPct}%`,
							top: `${light.y}%`,
							width: `${light.size.w}%`,
							height: `${light.size.h}%`,
							background: light.gradient,
							mixBlendMode: "screen",
							opacity: flame.glow,
							transition: `opacity ${CAMP_FIRE_FRAME_MS}ms ease-out`,
						}}
					/>
				))}
			</div>
		</div>
	);
}
