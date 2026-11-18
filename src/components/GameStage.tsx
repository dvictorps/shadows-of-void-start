import { useMemo, useState, useSyncExternalStore } from "react";

import { GameStageContext } from "./game-stage/context";
import { fitStage } from "./game-stage/fit";

function subscribeToResize(onChange: () => void) {
	window.addEventListener("resize", onChange);
	return () => window.removeEventListener("resize", onChange);
}

const readViewport = () => `${window.innerWidth}x${window.innerHeight}`;
const NOT_MEASURED = "";

export default function GameStage({ children }: { children: React.ReactNode }) {
	const viewport = useSyncExternalStore(
		subscribeToResize,
		readViewport,
		() => NOT_MEASURED,
	);
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const measured = viewport !== NOT_MEASURED;
	const fit = useMemo(() => {
		const [width, height] = viewport.split("x").map(Number);
		return fitStage(width ?? 0, height ?? 0);
	}, [viewport]);
	const value = useMemo(() => ({ fit, container }), [fit, container]);

	return (
		<div className="fixed inset-0 overflow-hidden bg-black text-white">
			<div
				data-game-stage=""
				className={`game-stage absolute top-0 left-0 overflow-hidden ${measured ? "" : "invisible"}`}
				style={{
					"--stage-x": `${fit.offsetX}px`,
					"--stage-y": `${fit.offsetY}px`,
					"--stage-scale": fit.scale,
				}}
			>
				<GameStageContext.Provider value={value}>
					{children}
					<div ref={setContainer} data-game-stage-portal="" />
				</GameStageContext.Provider>
			</div>
		</div>
	);
}
