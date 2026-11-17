const RUBY_ICON = "/assets/sprites/ui/moedaRubi.png";

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
