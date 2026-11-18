import { useId, useMemo } from "react";

import { findMonster } from "#/game/monsters";
import type { ZoneRoute } from "#/game/world/zone-route";
import { hashStringToUnit, seededRng } from "#/lib/rng";
import { m } from "#/paraglide/messages";

import { CANOPY_PERIOD, CANOPY_SIZE, canopyTrees } from "./canopy";
import {
	cellIndexAt,
	type PathCell,
	type PathLayout,
	pointAt,
	rollPathLayout,
} from "./path-layout";
import { type PathTileset, roadPieceAt } from "./path-tileset";

const VIEW_PADDING = 0.6;
const GROUND_REACH_PER_CELL = 2;
const EXIT_STROKE = { stroke: "#fcd34d", strokeWidth: 0.08 } as const;
const CLUSTER_OFFSET = 0.2;
const RADIUS = { player: 0.13, camp: 0.16, enemy: 0.1 } as const;
const ORBIT_RADIUS = { min: 0.1, max: 0.23 };
const ORBIT_SECONDS = { min: 2.6, max: 5.4 };
const WOBBLE_SECONDS = { min: 1.2, max: 2.4 };

function orbitOf(key: string) {
	const roll = (salt: number, range: { min: number; max: number }) =>
		range.min + hashStringToUnit(key, salt) * (range.max - range.min);
	const seconds = roll(1, ORBIT_SECONDS);
	return {
		radius: roll(2, ORBIT_RADIUS),
		spin: {
			animationDuration: `${seconds}s`,
			animationDirection: hashStringToUnit(key, 3) < 0.5 ? "normal" : "reverse",
			animationDelay: `-${roll(4, { min: 0, max: seconds })}s`,
		},
		wobble: { animationDuration: `${roll(5, WOBBLE_SECONDS)}s` },
	};
}
const HALO = 1.7;
const CENTERED = { dx: 0, dy: 0 };
const UNKNOWN_MONSTER_COLOR = "#888888";

type ZonePathProps = {
	route: ZoneRoute;
	routeSeed: number;
	nextStopIndex: number;
	elapsedMs: number;
	incenseCampsMs: readonly number[];
	tileset?: PathTileset | null;
};

export type ZonePathState = Omit<ZonePathProps, "route" | "tileset"> & {
	route: ZoneRoute | null;
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
	const add = (cell: number, marker: Marker) => {
		const members = cells.get(cell);
		if (members) members.push(marker);
		else cells.set(cell, [marker]);
	};
	route.stops.forEach((stop, index) => {
		if (stop.kind === "camp") {
			add(stop.tile, {
				key: `stop-${index}`,
				kind: "camp",
				used: index < nextStopIndex,
			});
		}
		if (stop.kind === "encounter" && index >= nextStopIndex) {
			add(stop.tile, {
				key: `stop-${index}`,
				kind: "enemy",
				monsterId: stop.monsterId,
				color: findMonster(stop.monsterId)?.pathColor ?? UNKNOWN_MONSTER_COLOR,
			});
		}
	});
	incenseCampsMs.forEach((atMs, index) => {
		add(cellIndexAt(layout, atMs / route.budgetMs), {
			key: `incense-${index}`,
			kind: "camp",
			used: true,
		});
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
	const orbit = orbitOf(marker.key);
	return (
		<g
			data-kind="enemy"
			data-monster={marker.monsterId}
			transform={`translate(${cx} ${cy})`}
			fill={marker.color}
		>
			<g className="path-orbit" style={orbit.spin}>
				<g className="path-orbit-wobble" style={orbit.wobble}>
					<circle cx={orbit.radius} cy={0} r={RADIUS.enemy} />
				</g>
			</g>
		</g>
	);
}

const PIECE_BLEED = 0.01;

function RoadPieceImage({
	cell,
	href,
	flip,
}: {
	cell: PathCell;
	href: string;
	flip: boolean;
}) {
	const size = 1 + 2 * PIECE_BLEED;
	const x = cell.x - PIECE_BLEED;
	const y = cell.y - PIECE_BLEED;
	return (
		<image
			data-kind="road"
			href={href}
			width={size}
			height={size}
			preserveAspectRatio="none"
			transform={
				flip
					? `translate(${x + size} ${y}) scale(-1 1)`
					: `translate(${x} ${y})`
			}
			style={{ imageRendering: "pixelated" }}
		/>
	);
}

const CANOPY = canopyTrees();

function CanopyPattern({ id, href }: { id: string; href: string }) {
	return (
		<pattern
			id={id}
			patternUnits="userSpaceOnUse"
			width={CANOPY_PERIOD}
			height={CANOPY_PERIOD}
		>
			{CANOPY.map((tree) => (
				<image
					key={`${tree.x},${tree.y}`}
					href={href}
					width={CANOPY_SIZE}
					height={CANOPY_SIZE}
					preserveAspectRatio="none"
					transform={
						tree.flip
							? `translate(${tree.x + CANOPY_SIZE} ${tree.y}) scale(-1 1)`
							: `translate(${tree.x} ${tree.y})`
					}
					style={{ imageRendering: "pixelated" }}
				/>
			))}
		</pattern>
	);
}

function TiledRoad({
	layout,
	tileset,
}: {
	layout: PathLayout;
	tileset: PathTileset;
}) {
	const id = useId().replaceAll(/[^a-zA-Z0-9]/g, "");
	const groundId = `ground-${id}`;
	const exit = layout.cells.at(-1);
	const reach = GROUND_REACH_PER_CELL * Math.max(layout.cols, layout.rows);
	return (
		<>
			<defs>
				<CanopyPattern id={groundId} href={tileset.ground} />
			</defs>
			<rect
				data-kind="ground"
				x={-reach}
				y={-reach}
				width={layout.cols + 2 * reach}
				height={layout.rows + 2 * reach}
				fill={`url(#${groundId})`}
			/>
			{layout.cells.map((cell, index) => {
				const piece = roadPieceAt(layout.cells, index);
				return (
					<RoadPieceImage
						key={`${cell.x},${cell.y}`}
						cell={cell}
						href={tileset.road[piece.id]}
						flip={piece.flip}
					/>
				);
			})}
			{exit && (
				<rect
					data-kind="exit"
					x={exit.x}
					y={exit.y}
					width={1}
					height={1}
					fill="none"
					{...EXIT_STROKE}
				/>
			)}
		</>
	);
}

function PathRoad({ layout }: { layout: PathLayout }) {
	const exit = layout.cells.length - 1;
	return (
		<>
			{layout.cells.map((cell, index) => (
				<rect
					key={`${cell.x},${cell.y}`}
					data-kind={index === exit ? "exit" : "tile"}
					x={cell.x}
					y={cell.y}
					width={1}
					height={1}
					fill={index === exit ? "#451a03" : "#3a332d"}
					stroke={index === exit ? EXIT_STROKE.stroke : "#2a2420"}
					strokeWidth={index === exit ? EXIT_STROKE.strokeWidth : 0.03}
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
	tileset = null,
}: ZonePathProps) {
	const { budgetMs, tiles } = route;
	const layout = useMemo(
		() => rollPathLayout(tiles, seededRng(routeSeed)),
		[tiles, routeSeed],
	);
	const road = useMemo(
		() =>
			tileset ? (
				<TiledRoad layout={layout} tileset={tileset} />
			) : (
				<PathRoad layout={layout} />
			),
		[layout, tileset],
	);
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
			overflow="visible"
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
