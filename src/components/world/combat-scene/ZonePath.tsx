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

const VIEW_PADDING = 0.6;
const TILE_GAP = 0.04;
const CLUSTER_OFFSET = 0.22;
const RADIUS = { player: 0.2, camp: 0.16, enemy: 0.12 } as const;
const HALO = 1.7;
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
	cell,
	offset,
}: {
	marker: Marker;
	cell: PathCell;
	offset: { dx: number; dy: number };
}) {
	const cx = cell.x + 0.5 + offset.dx;
	const cy = cell.y + 0.5 + offset.dy;
	if (marker.kind === "camp") {
		return (
			<g
				data-kind="camp"
				data-used={marker.used}
				opacity={marker.used ? 0.3 : 1}
			>
				<circle
					cx={cx}
					cy={cy}
					r={RADIUS.camp * HALO}
					fill="#fbbf24"
					opacity={0.25}
				/>
				<circle cx={cx} cy={cy} r={RADIUS.camp} fill="#fbbf24" />
			</g>
		);
	}
	return (
		<circle
			data-kind="enemy"
			data-monster={marker.monsterId}
			cx={cx}
			cy={cy}
			r={RADIUS.enemy}
			fill={marker.color}
		/>
	);
}

function PathRoad({ layout }: { layout: PathLayout }) {
	const exit = layout.cells.length - 1;
	const size = 1 - 2 * TILE_GAP;
	return (
		<>
			{layout.cells.map((cell, index) => (
				<rect
					key={`${cell.x},${cell.y}`}
					data-kind={index === exit ? "exit" : "tile"}
					x={cell.x + TILE_GAP}
					y={cell.y + TILE_GAP}
					width={size}
					height={size}
					fill={index === exit ? "#451a03" : "#292524"}
					stroke={index === exit ? "#fcd34d" : "none"}
					strokeWidth={0.06}
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
							cell={layout.cells[cellIndex]}
							offset={clusterOffset(i, members.length)}
						/>
					)),
			),
		[layout, route, nextStopIndex, incenseCampsMs],
	);
	const player = pointAt(layout, elapsedMs / budgetMs);
	const viewBox = [
		-VIEW_PADDING,
		-VIEW_PADDING,
		layout.cols + 2 * VIEW_PADDING,
		layout.rows + 2 * VIEW_PADDING,
	].join(" ");

	return (
		<svg
			role="img"
			aria-label={m.zone_path_aria()}
			viewBox={viewBox}
			preserveAspectRatio="xMidYMid meet"
			className="h-full w-full"
		>
			{road}
			{markers}
			<g
				data-kind="player"
				style={{
					transform: `translate(${player.x + 0.5}px, ${player.y + 0.5}px)`,
					transition: "transform 100ms linear",
				}}
			>
				<circle r={RADIUS.player * HALO} fill="#ffffff" opacity={0.2} />
				<circle r={RADIUS.player} fill="#ffffff" />
			</g>
		</svg>
	);
}
