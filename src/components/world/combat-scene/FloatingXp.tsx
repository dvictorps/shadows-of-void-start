import { motion } from "framer-motion";

export default function FloatingXp({ amount }: { amount: number }) {
	return (
		<motion.span
			className="pointer-events-none select-none font-bold text-3xl text-yellow-300"
			style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
			initial={{ opacity: 1, y: 0 }}
			animate={{ opacity: 0, y: -70 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.8, ease: "easeOut" }}
		>
			+{amount} XP
		</motion.span>
	);
}
