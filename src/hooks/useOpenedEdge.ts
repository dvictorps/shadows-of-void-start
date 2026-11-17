import { useState } from "react";

export function useOpenedEdge(isOpen: boolean): boolean {
	const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
	if (isOpen === prevIsOpen) return false;
	setPrevIsOpen(isOpen);
	return isOpen;
}
