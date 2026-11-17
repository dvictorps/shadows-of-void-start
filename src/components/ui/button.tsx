import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "#/lib/utils";

const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90",
				destructive:
					"bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
				outline:
					"border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost:
					"hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
				link: "text-primary underline-offset-4 hover:underline",
				stark: "border border-white bg-black text-white hover:bg-white/10",
				starkDestructive:
					"border border-danger bg-black text-danger-foreground hover:bg-danger-muted/40 hover:text-danger-foreground",
				starkMuted:
					"border border-white/40 bg-black text-white/80 hover:bg-white/10 hover:text-white",
				"ghost-purple": "bg-transparent text-white hover:text-void",
				starkText: "text-white/60 hover:text-white",
				voidLink: "text-void underline hover:text-void/80",
				hud: "rounded-none border border-white/40 bg-black text-white/80 hover:border-white hover:bg-white/10 hover:text-white disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black",
				toggle:
					"rounded-none border border-white/40 bg-black text-white/60 hover:border-white/60 hover:text-white/80 aria-pressed:border-white aria-pressed:bg-white/10 aria-pressed:text-white",
				mapNode: "rounded-full border-2 bg-black",
				item: "relative flex rounded-md transition-colors",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
				lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
				icon: "size-9",
				"icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
				tall: "h-auto px-3 py-2.5",
				inline: "h-auto p-0",
				glyph: "h-auto p-0 text-lg leading-none",
				hud: "h-auto gap-1.5 px-3 py-1.5 text-2xs",
				"hud-lg": "h-auto px-4 py-2.5 [&_svg:not([class*='size-'])]:size-5",
				"hud-icon": "h-auto p-2.5 [&_svg:not([class*='size-'])]:size-5",
				"hud-slot": "relative size-20 p-0",
				"hud-slot-md": "relative h-16 w-16 p-0",
				"hud-slot-sm": "relative h-11 w-11 p-0",
				wide: "h-9 px-5 py-2",
				hero: "h-12 px-12 text-xl uppercase tracking-hero",
				tab: "h-auto px-3 py-1 font-normal",
				"tab-sm": "h-auto px-2 py-0.5 text-xs font-normal",
				card: "h-auto flex-col items-start justify-start gap-0 p-3 text-left font-normal whitespace-normal",
			},
			caps: {
				true: "uppercase tracking-wider",
				false: "",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
			caps: false,
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	caps = false,
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, caps, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
