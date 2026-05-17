type Props = {
	message?: string;
};

export default function TextLog({ message }: Props) {
	return (
		<section className="overflow-y-auto rounded-md border border-white/40 p-3">
			<p className="text-[11px] uppercase tracking-wider text-white/50">
				{message ?? "Status / location log"}
			</p>
		</section>
	);
}
