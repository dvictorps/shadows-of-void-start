import { useEffect, useState } from "react";

const MQ = "(max-height: 800px), (max-width: 1500px)";

export function useCompactViewport(): boolean {
	const [compact, setCompact] = useState(
		() => typeof window !== "undefined" && window.matchMedia(MQ).matches,
	);
	useEffect(() => {
		const mq = window.matchMedia(MQ);
		const handler = (e: MediaQueryListEvent) => setCompact(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);
	return compact;
}
