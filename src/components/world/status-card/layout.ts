import type { SlotSize } from "../ConsumableSlot";

/** The status card's sizes, roomy on a wide viewport and tight on a compact one. */
export type StatusCardLayout = {
	padding: string;
	stackGap: string;
	gridGap: string;
	name: string;
	line: string;
	attributes: string;
	xpLabel: string;
	slot: SlotSize;
};

const WIDE: StatusCardLayout = {
	padding: "p-4",
	stackGap: "gap-3",
	gridGap: "gap-4",
	name: "text-2xl",
	line: "text-lg",
	attributes: "text-xl",
	xpLabel: "text-sm",
	slot: "md",
};

const COMPACT: StatusCardLayout = {
	padding: "p-2",
	stackGap: "gap-2",
	gridGap: "gap-2",
	name: "text-lg",
	line: "text-sm",
	attributes: "text-base",
	xpLabel: "text-xs",
	slot: "sm",
};

export function statusCardLayout(compact: boolean): StatusCardLayout {
	return compact ? COMPACT : WIDE;
}
