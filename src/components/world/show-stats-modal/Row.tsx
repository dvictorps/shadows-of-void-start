import type { ReactNode } from "react";

import Tooltip from "#/components/ui/tooltip";

export function SectionHeading({ children }: { children: ReactNode }) {
	return (
		<h3 className="display-title mb-2 text-xs uppercase tracking-[0.2em] text-yellow-300/80">
			{children}
		</h3>
	);
}

export function Row({
	label,
	value,
	tooltip,
}: {
	label: string;
	value: ReactNode;
	tooltip?: string;
}) {
	const row = (
		<div className="flex items-center justify-between gap-2 py-0.5 text-sm">
			<span className={tooltip ? "cursor-help text-white/60" : "text-white/60"}>
				{label}
			</span>
			<span className="text-right tabular-nums text-white">{value}</span>
		</div>
	);
	if (!tooltip) return row;
	return (
		<Tooltip content={<span className="whitespace-pre-line">{tooltip}</span>}>
			{row}
		</Tooltip>
	);
}
