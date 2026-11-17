import type * as React from "react";

import { cn } from "#/lib/utils";

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
