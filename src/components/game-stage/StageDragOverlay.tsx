import { DragOverlay, type DropAnimation } from "@dnd-kit/core";
import { createPortal } from "react-dom";

import { useGameStage } from "./context";

const DROP_ANIMATION: DropAnimation = { duration: 180, easing: "ease-out" };

export default function StageDragOverlay({
	children,
}: {
	children: React.ReactNode;
}) {
	const stage = useGameStage();
	if (globalThis.document === undefined) return null;
	return createPortal(
		<DragOverlay dropAnimation={DROP_ANIMATION}>
			{children ? (
				<div className="stage-scaled" style={{ "--stage-scale": stage.scale }}>
					{children}
				</div>
			) : null}
		</DragOverlay>,
		document.body,
	);
}
