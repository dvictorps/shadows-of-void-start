import type { useDraggable } from "@dnd-kit/core";

type DraggableHandle = Pick<
	ReturnType<typeof useDraggable>,
	"attributes" | "listeners" | "setNodeRef"
>;

/** A draggable card's wrapper: invisible while its item is being dragged. */
export default function DragSlot({
	handle: { attributes, listeners, setNodeRef },
	hidden,
	children,
}: {
	handle: DraggableHandle;
	hidden: boolean;
	children: React.ReactNode;
}) {
	return (
		<div
			ref={setNodeRef}
			className="absolute inset-0"
			style={{
				opacity: hidden ? 0 : 1,
				cursor: hidden ? "grabbing" : "grab",
			}}
			{...listeners}
			{...attributes}
		>
			{children}
		</div>
	);
}
