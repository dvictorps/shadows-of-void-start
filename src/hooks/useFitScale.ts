import { useLayoutEffect, useState } from "react";

export function fitScale(available: number, natural: number): number {
	if (available <= 0 || natural <= 0) return 1;
	return Math.min(1, available / natural);
}

export function useFitScale(
	naturalHeight: number,
): [(box: HTMLElement | null) => void, number] {
	const [box, setBox] = useState<HTMLElement | null>(null);
	const [scale, setScale] = useState(1);

	useLayoutEffect(() => {
		if (!box || !("ResizeObserver" in globalThis)) return;
		const measure = () => setScale(fitScale(box.clientHeight, naturalHeight));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(box);
		return () => observer.disconnect();
	}, [box, naturalHeight]);

	return [setBox, scale];
}
