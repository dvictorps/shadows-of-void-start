import { ACT_1, findNode, type WorldNode } from "#/game/world";
import { translateNodeName } from "#/game/world/i18n";
import type { TravelSnapshot } from "#/lib/travel-clock";

import MapScene from "./MapScene";
import TravelProgressBar from "./TravelProgressBar";

export function WorldMapPane({
	currentNode,
	currentLocation,
	hoveredNodeId,
	onHoverNode,
	onEnterNode,
	unlockedNodeIds,
	completedZoneIds,
	teleportStones,
	onOpenSettings,
	onOpenLeaderboard,
	trip,
}: {
	currentNode: WorldNode | null;
	currentLocation: string;
	hoveredNodeId: string | null;
	onHoverNode: (nodeId: string | null) => void;
	onEnterNode: (nodeId: string) => void;
	unlockedNodeIds: ReadonlySet<string>;
	completedZoneIds: ReadonlySet<string>;
	teleportStones: number;
	onOpenSettings: () => void;
	onOpenLeaderboard: () => void;
	trip: TravelSnapshot | null;
}) {
	const travelToNode = trip ? findNode(ACT_1, trip.destination) : null;

	return (
		<div className="relative overflow-hidden">
			<MapScene
				act={ACT_1}
				onEnterNode={onEnterNode}
				onHoverNode={onHoverNode}
				hoveredNodeId={hoveredNodeId}
				currentLocationNodeId={currentLocation}
				unlockedNodeIds={unlockedNodeIds}
				completedZoneIds={completedZoneIds}
				hasTeleportStone={teleportStones > 0}
				onOpenSettings={onOpenSettings}
				onOpenLeaderboard={onOpenLeaderboard}
			/>
			{trip && currentNode && travelToNode ? (
				<TravelProgressBar
					key={trip.destination}
					fromName={translateNodeName(currentNode)}
					toName={translateNodeName(travelToNode)}
					startedAtMs={trip.startedAt}
					arrivesAtMs={trip.arrivesAt}
				/>
			) : null}
		</div>
	);
}
