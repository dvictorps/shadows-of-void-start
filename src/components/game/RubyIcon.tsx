const RUBY_ICON = "/assets/sprites/ui/moedaRubi.png";

/** The ruby coin shown next to a balance or a price; `className` sizes it. */
export default function RubyIcon({ className }: { className: string }) {
	return (
		<img
			src={RUBY_ICON}
			alt=""
			draggable={false}
			className={`pointer-events-none select-none object-contain ${className}`}
		/>
	);
}
