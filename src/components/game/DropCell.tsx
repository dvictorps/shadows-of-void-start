import { type UseDroppableArguments, useDroppable } from "@dnd-kit/core";

import { SLOT_EMPTY } from "#/components/game/ItemCard";

const OVER_RING = "ring-2 ring-yellow-300/80";

export default function DropCell({
	id,
	data,
	size,
	idleRing = "",
	children,
}: {
	id: string;
	data: UseDroppableArguments["data"];
	size: number;
	idleRing?: string;
	children?: React.ReactNode;
}) {
	const { setNodeRef, isOver } = useDroppable({ id, data });
	return (
		<div
			ref={setNodeRef}
			style={{ width: size, height: size }}
			className={`relative rounded-md transition-shadow ${isOver ? OVER_RING : idleRing}`}
		>
			<div className={`absolute inset-0 rounded-md ${SLOT_EMPTY}`} />
			{children}
		</div>
	);
}
