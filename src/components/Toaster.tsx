import { Toaster as SonnerToaster } from "sonner";

export default function Toaster() {
	return (
		<SonnerToaster
			theme="dark"
			position="top-right"
			toastOptions={{
				unstyled: true,
				classNames: {
					toast:
						"display-title flex w-full items-start gap-3 border bg-black px-4 py-3 text-base uppercase tracking-wider text-white shadow-[0_8px_24px_rgba(0,0,0,0.6)]",
					default: "border-white/60",
					success: "border-white",
					error: "border-red-400 text-red-100",
					info: "border-white/40",
					title: "font-medium",
					description: "mt-1 text-sm normal-case tracking-normal text-white/70",
					icon: "shrink-0",
				},
			}}
		/>
	);
}
