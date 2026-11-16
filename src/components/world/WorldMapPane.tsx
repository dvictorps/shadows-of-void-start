import { ACT_1, findNode, type WorldNode } from "#/game/world";
import { translateNodeName } from "#/game/world/i18n";

import MapScene from "./MapScene";
import TravelProgressBar from "./TravelProgressBar";

/**
 * The map view of /world: the act map plus the travel overlay. The overlay
 * renders only when both ends of the trip resolve (defensive: the server
 * validated the route on `startTravel`).
 */
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
	isTraveling,
	travelDestination,
	travelArrivesAt,
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
	isTraveling: boolean;
	travelDestination: string | null;
	travelArrivesAt: number | null;
}) {
	const travelToNode = travelDestination
		? findNode(ACT_1, travelDestination)
		: null;
	const showTravel =
		isTraveling && travelArrivesAt !== null && currentNode && travelToNode;

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
			{showTravel ? (
				<TravelProgressBar
					key={travelDestination}
					fromName={translateNodeName(currentNode)}
					toName={translateNodeName(travelToNode)}
					arrivesAtMs={travelArrivesAt}
				/>
			) : null}
		</div>
	);
}
