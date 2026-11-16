import { useState } from "react";

// True only on the render where `isOpen` flips false → true. Callers reset
// their per-session state on that render (React's "adjust state while
// rendering" pattern), so a reopened modal never paints with the previous
// session's selection.
export function useOpenedEdge(isOpen: boolean): boolean {
	const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
	if (isOpen === prevIsOpen) return false;
	setPrevIsOpen(isOpen);
	return isOpen;
}
