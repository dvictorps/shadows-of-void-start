import type { ReactNode } from "react";

export function AdminPageHeader({
	title,
	subtitle,
	right,
}: {
	title: string;
	subtitle: ReactNode;
	right?: ReactNode;
}) {
	return (
		<header className="flex items-end justify-between border-b border-white/15 pb-4">
			<div>
				<h1 className="display-title text-2xl uppercase tracking-[0.15em] text-white">
					{title}
				</h1>
				<p className="mt-1 text-xs uppercase tracking-wider text-white/50">
					{subtitle}
				</p>
			</div>
			{right}
		</header>
	);
}

export function EmptyTableRow({
	colSpan,
	message,
}: {
	colSpan: number;
	message: string;
}) {
	return (
		<tr>
			<td
				colSpan={colSpan}
				className="px-3 py-8 text-center text-xs uppercase tracking-wider text-white/40"
			>
				{message}
			</td>
		</tr>
	);
}
