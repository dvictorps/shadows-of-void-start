import {
	Castle,
	Check,
	Droplets,
	Home,
	Lock,
	type LucideIcon,
	MapPin,
	Settings,
	Skull,
	Tornado,
	TreePine,
	Trees,
} from "lucide-react";
import { useMemo } from "react";
import { type Act, isNodeAccessible, type WorldNode } from "#/game/world";
import { translateNodeName } from "#/game/world/i18n";
import { m } from "#/paraglide/messages";

type Props = {
	act: Act;
	onEnterNode: (nodeId: string) => void;
	onHoverNode: (nodeId: string | null) => void;
	hoveredNodeId: string | null;
	currentLocationNodeId: string;
	unlockedNodeIds: ReadonlySet<string>;
	completedZoneIds: ReadonlySet<string>;
	// True only when the player carries at least one Teleport Stone — drives
	// the cyan "reachable via stone" border tint. Without a stone the
	// unlocked-but-disconnected nodes still aren't clickable, so the cue
	// would be misleading.
	hasTeleportStone: boolean;
	onOpenSettings: () => void;
};

const NODE_ICONS: Record<WorldNode["kind"], LucideIcon> = {
	city: Home,
	combat: Trees,
	boss: Skull,
};

// Per-node-id icon overrides — themed to the zone's flavour. Falls back to
// NODE_ICONS[kind] when no override is set.
const NODE_ICON_OVERRIDES: Record<string, LucideIcon> = {
	forest_profunda: TreePine,
	pantano: Droplets,
	cripta: Skull,
	castelo: Castle,
	fenda_vazio: Tornado,
};

export default function MapScene({
	act,
	onEnterNode,
	onHoverNode,
	hoveredNodeId,
	currentLocationNodeId,
	unlockedNodeIds,
	completedZoneIds,
	hasTeleportStone,
	onOpenSettings,
}: Props) {
	const edges = useMemo(() => buildEdges(act.nodes), [act.nodes]);
	const connectedIds = useMemo(() => {
		const currentNode = act.nodes.find((n) => n.id === currentLocationNodeId);
		const ids = new Set(currentNode?.connections.map((c) => c.id) ?? []);
		ids.add(currentLocationNodeId);
		return ids;
	}, [act.nodes, currentLocationNodeId]);

	return (
		<section className="relative h-full overflow-hidden rounded-md border border-white/40 bg-black">
			<button
				type="button"
				onClick={onOpenSettings}
				aria-label={m.open_settings()}
				className="absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center border border-white/40 bg-black text-white/80 transition hover:border-white hover:bg-white/10 hover:text-white"
			>
				<Settings className="h-4 w-4" strokeWidth={2} />
			</button>
			<svg
				aria-hidden="true"
				className="absolute inset-0 h-full w-full"
				preserveAspectRatio="none"
			>
				{edges}
			</svg>

			{act.nodes.map((node) => {
				const reachableByStone =
					hasTeleportStone &&
					!connectedIds.has(node.id) &&
					unlockedNodeIds.has(node.id);
				const isComplete = completedZoneIds.has(node.id);
				const isLocked =
					node.kind !== "city" && !isNodeAccessible(node, completedZoneIds);
				return (
					<MapNode
						key={node.id}
						node={node}
						hovered={hoveredNodeId === node.id}
						isCurrent={node.id === currentLocationNodeId}
						isComplete={isComplete}
						isLocked={isLocked}
						reachableByStone={reachableByStone}
						onEnter={() => onEnterNode(node.id)}
						onHover={() => onHoverNode(node.id)}
						onLeave={() => onHoverNode(null)}
					/>
				);
			})}
		</section>
	);
}

function buildEdges(nodes: WorldNode[]) {
	const positions = new Map(nodes.map((n) => [n.id, n.position]));
	const drawn = new Set<string>();
	const edges: React.ReactElement[] = [];

	for (const node of nodes) {
		for (const conn of node.connections) {
			const otherId = conn.id;
			const key = [node.id, otherId].sort().join("|");
			if (drawn.has(key)) continue;
			drawn.add(key);
			const a = positions.get(node.id);
			const b = positions.get(otherId);
			if (!a || !b) continue;
			edges.push(
				<line
					key={key}
					x1={`${a.x * 100}%`}
					y1={`${a.y * 100}%`}
					x2={`${b.x * 100}%`}
					y2={`${b.y * 100}%`}
					stroke="rgba(255,255,255,0.35)"
					strokeWidth={2}
					strokeDasharray="6 6"
				/>,
			);
		}
	}

	return edges;
}

function MapNode({
	node,
	hovered,
	isCurrent,
	isComplete,
	isLocked,
	reachableByStone,
	onEnter,
	onHover,
	onLeave,
}: {
	node: WorldNode;
	hovered: boolean;
	isCurrent: boolean;
	isComplete: boolean;
	isLocked: boolean;
	reachableByStone: boolean;
	onEnter: () => void;
	onHover: () => void;
	onLeave: () => void;
}) {
	const Icon = NODE_ICON_OVERRIDES[node.id] ?? NODE_ICONS[node.kind];
	// Wind-crystal-reachable nodes (unlocked but not connected to currentLocation)
	// get a cyan tint so the player knows the click will offer the crystal flow
	// instead of just being a no-route dead-click.
	const borderClass = pickBorderClass({
		isLocked,
		hovered,
		reachableByStone,
	});
	return (
		<div
			style={{
				left: `${node.position.x * 100}%`,
				top: `${node.position.y * 100}%`,
			}}
			className="-translate-x-1/2 -translate-y-1/2 absolute"
		>
			<button
				type="button"
				onClick={onEnter}
				onMouseEnter={onHover}
				onMouseLeave={onLeave}
				onFocus={onHover}
				onBlur={onLeave}
				aria-label={m.enter_node({ name: translateNodeName(node) })}
				className={`flex h-10 w-10 items-center justify-center rounded-full border-2 bg-black transition ${borderClass}`}
			>
				<Icon className="h-5 w-5" strokeWidth={1.5} />
			</button>
			{isCurrent && (
				<MapPin
					aria-hidden
					className="-top-4 -translate-x-1/2 pointer-events-none absolute left-1/2 h-5 w-5 fill-yellow-300 text-yellow-300 drop-shadow-[0_0_4px_rgba(253,224,71,0.7)]"
					strokeWidth={1.5}
				/>
			)}
			{isComplete && (
				<NodeBadge icon={Check} colorClass="text-green-400" strokeWidth={3} />
			)}
			{isLocked && (
				<NodeBadge icon={Lock} colorClass="text-red-400" strokeWidth={2} />
			)}
		</div>
	);
}

function pickBorderClass({
	isLocked,
	hovered,
	reachableByStone,
}: {
	isLocked: boolean;
	hovered: boolean;
	reachableByStone: boolean;
}): string {
	if (isLocked) return "border-white/15 text-white/30";
	if (hovered)
		return "border-white text-white shadow-[0_0_12px_rgba(255,255,255,0.5)]";
	if (reachableByStone)
		return "border-cyan-400/70 text-cyan-200/80 hover:border-cyan-300";
	return "border-white/40 text-white/70 hover:border-white/80";
}

function NodeBadge({
	icon: Icon,
	colorClass,
	strokeWidth,
}: {
	icon: LucideIcon;
	colorClass: string;
	strokeWidth: number;
}) {
	return (
		<Icon
			aria-hidden
			className={`-bottom-2 -right-2 pointer-events-none absolute h-4 w-4 rounded-full bg-black p-0.5 ${colorClass}`}
			strokeWidth={strokeWidth}
		/>
	);
}
