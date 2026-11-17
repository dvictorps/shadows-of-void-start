import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The theme tokens of src/styles.css, so a later class of the same kind wins
// over them instead of being read as a color.
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: ["2xs", "caption"],
			tracking: ["display", "label", "title", "hero"],
			shadow: ["dialog", "tooltip"],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
