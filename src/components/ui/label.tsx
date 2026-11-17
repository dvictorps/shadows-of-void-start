"use client";

import { Label as LabelPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "#/lib/utils";

const LABEL_VARIANT = {
	default: "",
	caps: "text-xs uppercase tracking-wider text-white/60",
} as const;

function Label({
	className,
	variant = "default",
	...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
	variant?: keyof typeof LABEL_VARIANT;
}) {
	return (
		<LabelPrimitive.Root
			data-slot="label"
			className={cn(
				"flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
				LABEL_VARIANT[variant],
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
