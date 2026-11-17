import { useMemo } from "react";

import { findMonster } from "#/game/monsters";
import type { ZoneRoute } from "#/game/world/zone-route";
import { seededRng } from "#/lib/rng";
import { m } from "#/paraglide/messages";

import {
	type PathCell,
	type PathLayout,
	pointAt,
	rollPathLayout,
	stopCellIndex,
} from "./path-layout";

const ROAD_INSET = 0.16;
const CLUSTER_OFFSET = 0.2;
const DOT_SCALE = { player: 0.5, camp: 0.42, enemy: 0.3 } as const;
const CENTERED = { dx: 0, dy: 0 };
const UNKNOWN_MONSTER_COLOR = "#888888";

export type ZonePathState = {
	route: ZoneRoute;
	routeSeed: number;
	nextStopIndex: number;
	elapsedMs: number;
	incenseCampsMs: readonly number[];
};

type Marker =
	| { key: string; kind: "camp"; used: boolean }
	| { key: string; kind: "enemy"; monsterId: string; color: string };

type Rect = { x: number; y: number; w: number; h: number };

function rectStyle(layout: PathLayout, r: Rect) {
	return {
		left: `${(r.x / layout.cols) * 100}%`,
		top: `${(r.y / layout.rows) * 100}%`,
		width: `${(r.w / layout.cols) * 100}%`,
		height: `${(r.h / layout.rows) * 100}%`,
	};
}

function tileRect(cell: PathCell): Rect {
	const size = 1 - 2 * ROAD_INSET;
	return { x: cell.x + ROAD_INSET, y: cell.y + ROAD_INSET, w: size, h: size };
}

function linkRect(a: PathCell, b: PathCell): Rect {
	const size = 1 - 2 * ROAD_INSET;
	if (a.y === b.y) {
		return { x: Math.min(a.x, b.x) + 0.5, y: a.y + ROAD_INSET, w: 1, h: size };
	}
	return { x: a.x + ROAD_INSET, y: Math.min(a.y, b.y) + 0.5, w: size, h: 1 };
}

function dotStyle(
	layout: PathLayout,
	cell: PathCell,
	scale: number,
	offset: { dx: number; dy: number } = CENTERED,
) {
	return {
		left: `${((cell.x + 0.5 + offset.dx) / layout.cols) * 100}%`,
		top: `${((cell.y + 0.5 + offset.dy) / layout.rows) * 100}%`,
		width: `${(scale / layout.cols) * 100}%`,
	};
}

function clusterOffset(index: number, size: number) {
	if (size <= 1) return CENTERED;
	const angle = (index / size) * 2 * Math.PI - Math.PI / 2;
	return {
		dx: Math.cos(angle) * CLUSTER_OFFSET,
		dy: Math.sin(angle) * CLUSTER_OFFSET,
	};
}

function markersByCell(
	layout: PathLayout,
	route: ZoneRoute,
	nextStopIndex: number,
	incenseCampsMs: readonly number[],
) {
	const cells = new Map<number, Marker[]>();
	const add = (atMs: number, marker: Marker) => {
		const cell = stopCellIndex(layout, atMs / route.budgetMs);
		const members = cells.get(cell);
		if (members) members.push(marker);
		else cells.set(cell, [marker]);
	};
	route.stops.forEach((stop, index) => {
		if (stop.kind === "camp") {
			add(stop.atMs, {
				key: `stop-${index}`,
				kind: "camp",
				used: index < nextStopIndex,
			});
		}
		if (stop.kind === "encounter" && index >= nextStopIndex) {
			add(stop.atMs, {
				key: `stop-${index}`,
				kind: "enemy",
				monsterId: stop.monsterId,
				color: findMonster(stop.monsterId)?.pathColor ?? UNKNOWN_MONSTER_COLOR,
			});
		}
	});
	incenseCampsMs.forEach((atMs, index) => {
		add(atMs, { key: `incense-${index}`, kind: "camp", used: true });
	});
	return cells;
}

function PathMarker({
	marker,
	style,
}: {
	marker: Marker;
	style: ReturnType<typeof dotStyle>;
}) {
	if (marker.kind === "camp") {
		return (
			<span
				data-kind="camp"
				data-used={marker.used}
				className={`-translate-x-1/2 -translate-y-1/2 absolute aspect-square rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] ${marker.used ? "opacity-30" : ""}`}
				style={style}
			/>
		);
	}
	return (
		<span
			data-kind="enemy"
			data-monster={marker.monsterId}
			className="-translate-x-1/2 -translate-y-1/2 absolute aspect-square rounded-full shadow-[0_0_4px_rgba(0,0,0,0.9)]"
			style={{ ...style, backgroundColor: marker.color }}
		/>
	);
}

function PathRoad({ layout }: { layout: PathLayout }) {
	const exit = layout.cells.length - 1;
	return (
		<>
			{layout.cells.slice(1).map((cell, i) => (
				<div
					key={`link-${cell.x},${cell.y}`}
					className="absolute bg-stone-800"
					style={rectStyle(layout, linkRect(layout.cells[i], cell))}
				/>
			))}
			{layout.cells.map((cell, index) => (
				<div
					key={`${cell.x},${cell.y}`}
					data-kind={index === exit ? "exit" : "tile"}
					className={
						index === exit
							? "absolute z-10 border border-amber-300 bg-amber-950 shadow-[0_0_12px_rgba(252,211,77,0.6)]"
							: "absolute bg-stone-800"
					}
					style={rectStyle(layout, tileRect(cell))}
				/>
			))}
		</>
	);
}

export default function ZonePath({
	route,
	routeSeed,
	nextStopIndex,
	elapsedMs,
	incenseCampsMs,
}: ZonePathState) {
	const { budgetMs } = route;
	const layout = useMemo(
		() => rollPathLayout(budgetMs, seededRng(routeSeed)),
		[budgetMs, routeSeed],
	);
	const road = useMemo(() => <PathRoad layout={layout} />, [layout]);
	const markers = useMemo(
		() =>
			[...markersByCell(layout, route, nextStopIndex, incenseCampsMs)].flatMap(
				([cellIndex, members]) =>
					members.map((marker, i) => (
						<PathMarker
							key={marker.key}
							marker={marker}
							style={dotStyle(
								layout,
								layout.cells[cellIndex],
								DOT_SCALE[marker.kind],
								clusterOffset(i, members.length),
							)}
						/>
					)),
			),
		[layout, route, nextStopIndex, incenseCampsMs],
	);
	const player = pointAt(layout, elapsedMs / budgetMs);

	return (
		<div
			role="img"
			aria-label={m.zone_path_aria()}
			className="relative max-h-full w-full"
			style={{ aspectRatio: `${layout.cols} / ${layout.rows}` }}
		>
			{road}
			{markers}

			<span
				data-kind="player"
				className="-translate-x-1/2 -translate-y-1/2 absolute z-20 aspect-square rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-[left,top] duration-100 ease-linear"
				style={dotStyle(layout, player, DOT_SCALE.player)}
			/>
		</div>
	);
}
