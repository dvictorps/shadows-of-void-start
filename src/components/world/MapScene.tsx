import { Home, type LucideIcon, Skull, Trees } from "lucide-react";
import { useMemo } from "react";
import type { Act, WorldNode } from "#/game/world";
import { translateNodeName } from "#/game/world/i18n";
import { m } from "#/paraglide/messages";

type Props = {
	act: Act;
	onEnterNode: (nodeId: string) => void;
	onHoverNode: (nodeId: string | null) => void;
	hoveredNodeId: string | null;
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
}: Props) {
	const edges = useMemo(() => buildEdges(act.nodes), [act.nodes]);

	return (
		<section className="relative overflow-hidden rounded-md border border-white/40 bg-black">
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
		for (const otherId of node.connections) {
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
	onEnter,
	onHover,
	onLeave,
}: {
	node: WorldNode;
	hovered: boolean;
	onEnter: () => void;
	onHover: () => void;
	onLeave: () => void;
}) {
	const Icon = NODE_ICONS[node.kind];
	return (
		<button
			type="button"
			onClick={onEnter}
			onMouseEnter={onHover}
			onMouseLeave={onLeave}
			onFocus={onHover}
			onBlur={onLeave}
			aria-label={m.enter_node({ name: translateNodeName(node) })}
			style={{
				left: `${node.position.x * 100}%`,
				top: `${node.position.y * 100}%`,
			}}
			className={`-translate-x-1/2 -translate-y-1/2 absolute flex h-20 w-20 items-center justify-center rounded-full border-2 bg-black transition ${
				hovered
					? "border-white text-white shadow-[0_0_20px_rgba(255,255,255,0.4)]"
					: "border-white/40 text-white/70 hover:border-white/80"
			}`}
		>
			<Icon className="h-9 w-9" strokeWidth={1.5} />
		</button>
	);
}
