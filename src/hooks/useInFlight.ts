import { useCallback, useRef, useState } from "react";

type ResetBoundary = boolean | string | number;

export function useInFlight(
	resetOn?: ResetBoundary,
): [boolean, <T>(fn: () => Promise<T>) => Promise<T | undefined>] {
	const [isPending, setIsPending] = useState(false);
	const [epoch, setEpoch] = useState(0);
	const [prevResetOn, setPrevResetOn] = useState(resetOn);
	if (resetOn !== prevResetOn) {
		setPrevResetOn(resetOn);
		setEpoch((e) => e + 1);
		setIsPending(false);
	}

	const inFlightEpochRef = useRef<number | null>(null);

	const run = useCallback(
		async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
			if (inFlightEpochRef.current === epoch) return undefined;
			inFlightEpochRef.current = epoch;
			setIsPending(true);
			try {
				return await fn();
			} finally {
				if (inFlightEpochRef.current === epoch) {
					inFlightEpochRef.current = null;
					setIsPending(false);
				}
			}
		},
		[epoch],
	);

	return [isPending, run];
}
