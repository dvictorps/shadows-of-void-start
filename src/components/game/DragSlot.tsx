import type { useDraggable } from "@dnd-kit/core";

type DraggableHandle = Pick<
	ReturnType<typeof useDraggable>,
	"attributes" | "listeners" | "setNodeRef"
>;

/**
 * A draggable card's wrapper, shared by the inventory and stash modals:
 * invisible while its item is being dragged. `onClick` is dropped while
 * hidden.
 */
export default function DragSlot({
	handle: { attributes, listeners, setNodeRef },
	hidden,
	onClick,
	children,
}: {
	handle: DraggableHandle;
	hidden: boolean;
	onClick?: (event: React.MouseEvent) => void;
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
			onClick={hidden ? undefined : onClick}
			{...listeners}
			{...attributes}
		>
			{children}
		</div>
	);
}
