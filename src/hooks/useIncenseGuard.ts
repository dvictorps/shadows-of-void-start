import { useState } from "react";

/**
 * Spam-click guard for the Incenso Etéreo button. Unlike the potion and the
 * stone, `trigger` is synchronous (it fires the mutation without awaiting),
 * so the flag can't clear in a `finally`: it clears when the incense count
 * changes instead. The count drops on the same render the mutation fires,
 * and if the mutation fails the count reverts, which clears the flag too.
 */
export function useIncenseGuard(incense: number, trigger: () => void) {
	const [isUsingIncense, setIsUsingIncense] = useState(false);

	// Adjusted during render by comparing with the previous count.
	const [prevIncense, setPrevIncense] = useState(incense);
	if (incense !== prevIncense) {
		setPrevIncense(incense);
		setIsUsingIncense(false);
	}

	const lightIncense = () => {
		if (isUsingIncense || incense <= 0) return;
		setIsUsingIncense(true);
		trigger();
	};

	return { isUsingIncense, lightIncense };
}
