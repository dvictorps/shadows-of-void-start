import { Home, type LucideIcon, MapPin, Settings, Skull, Trees } from "lucide-react";
import { useMemo } from "react";
import type { Act, WorldNode } from "#/game/world";
import { translateNodeName } from "#/game/world/i18n";
import { m } from "#/paraglide/messages";

type Props = {
	act: Act;
	onEnterNode: (nodeId: string) => void;
	onHoverNode: (nodeId: string | null) => void;
	hoveredNodeId: string | null;
	currentLocationNodeId: string;
	onOpenSettings: () => void;
};

const NODE_ICONS: Record<WorldNode["kind"], LucideIcon> = {
	city: Home,
	combat: Trees,
	boss: Skull,
};

export default function MapScene({
	act,
	onEnterNode,
	onHoverNode,
	hoveredNodeId,
	currentLocationNodeId,
	onOpenSettings,
}: Props) {
	const edges = useMemo(() => buildEdges(act.nodes), [act.nodes]);

	return (
		<section className="relative overflow-hidden rounded-md border border-white/40 bg-black">
			<button
				type="button"
				onClick={onOpenSettings}
				aria-label={m.open_settings()}
				className="absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center border border-white/40 bg-black text-white/80 transition hover:border-white hover:bg-white/10 hover:text-white"
			>
				<Settings className="h-4 w-4" strokeWidth={2} />
			</button>
			<svg
				aria-hidden
				className="absolute inset-0 h-full w-full"
				preserveAspectRatio="none"
			>
				<title>Connections</title>
				{edges}
			</svg>

			{act.nodes.map((node) => (
				<MapNode
					key={node.id}
					node={node}
					hovered={hoveredNodeId === node.id}
					isCurrent={node.id === currentLocationNodeId}
					onEnter={() => onEnterNode(node.id)}
					onHover={() => onHoverNode(node.id)}
					onLeave={() => onHoverNode(null)}
				/>
			))}
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
	onEnter,
	onHover,
	onLeave,
}: {
	node: WorldNode;
	hovered: boolean;
	isCurrent: boolean;
	onEnter: () => void;
	onHover: () => void;
	onLeave: () => void;
}) {
	const Icon = NODE_ICONS[node.kind];
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
				className={`flex h-7 w-7 items-center justify-center rounded-full border-2 bg-black transition ${
					hovered
						? "border-white text-white shadow-[0_0_12px_rgba(255,255,255,0.5)]"
						: "border-white/40 text-white/70 hover:border-white/80"
				}`}
			>
				<Icon className="h-4 w-4" strokeWidth={1.5} />
			</button>
			{isCurrent && (
				<MapPin
					aria-hidden
					className="-top-4 -right-2 pointer-events-none absolute h-5 w-5 fill-yellow-300 text-yellow-300 drop-shadow-[0_0_4px_rgba(253,224,71,0.7)]"
					strokeWidth={1.5}
				/>
			)}
		</div>
	);
}
