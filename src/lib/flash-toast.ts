import { toast } from "sonner";

type FlashType = "success" | "error" | "info";
const KEY = "sov-flash-toast";

export function queueFlashToast(type: FlashType, message: string) {
	if (typeof window === "undefined") return;
	sessionStorage.setItem(KEY, JSON.stringify({ type, message }));
}

export function consumeFlashToast() {
	if (typeof window === "undefined") return;
	const raw = sessionStorage.getItem(KEY);
	if (!raw) return;
	sessionStorage.removeItem(KEY);
	try {
		const parsed = JSON.parse(raw) as { type: FlashType; message: string };
		toast[parsed.type](parsed.message);
	} catch {
		// malformed entry — ignore
	}
}
