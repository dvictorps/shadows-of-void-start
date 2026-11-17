import { useState } from "react";

export function useIncenseGuard(incense: number, trigger: () => void) {
	const [isUsingIncense, setIsUsingIncense] = useState(false);

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
