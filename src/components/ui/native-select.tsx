import type * as React from "react";

import { cn } from "#/lib/utils";

/**
 * The browser's own `<select>` in the stark look: square, white border that
 * lights up on focus, black background. For a short list where the native
 * picker is the better control (the language setting, the leaderboard's
 * class filter); `Select` is the styled Radix menu.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
	return (
		<select
			data-slot="native-select"
			className={cn(
				"border border-white/30 bg-black text-white outline-none transition focus:border-white",
				className,
			)}
			{...props}
		/>
	);
}

export { NativeSelect };
