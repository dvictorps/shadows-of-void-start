import { m } from "#/paraglide/messages";

export type LogTone = "info" | "warning" | "success" | "danger";

type Props = {
	message?: string;
	tone?: LogTone;
};

const TONE_CLASS: Record<LogTone, string> = {
	info: "text-white/80",
	warning: "text-yellow-300",
	success: "text-emerald-300",
	danger: "text-red-400",
};

export default function TextLog({ message, tone = "info" }: Props) {
	return (
		<section className="overflow-y-auto rounded-md border border-white/40 px-4 py-3">
			<p
				className={`display-title text-base uppercase tracking-wider ${TONE_CLASS[tone]}`}
			>
				{message ?? m.status_location_log()}
			</p>
		</section>
	);
}
