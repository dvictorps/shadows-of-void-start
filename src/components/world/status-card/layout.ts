import type { SlotSize } from "../ConsumableSlot";
import type { XpBarSize } from "../XpBar";

export type StatusCardLayout = {
	padding: string;
	stackGap: string;
	gridGap: string;
	name: string;
	line: string;
	attributes: string;
	xpBar: XpBarSize;
	slot: SlotSize;
};

const WIDE: StatusCardLayout = {
	padding: "p-4",
	stackGap: "gap-3",
	gridGap: "gap-4",
	name: "text-2xl",
	line: "text-lg",
	attributes: "text-xl",
	xpBar: "md",
	slot: "md",
};

const COMPACT: StatusCardLayout = {
	padding: "p-2",
	stackGap: "gap-2",
	gridGap: "gap-2",
	name: "text-lg",
	line: "text-sm",
	attributes: "text-base",
	xpBar: "sm",
	slot: "sm",
};

export function statusCardLayout(compact: boolean): StatusCardLayout {
	return compact ? COMPACT : WIDE;
}
