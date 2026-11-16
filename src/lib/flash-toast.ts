import { toast } from "sonner";
import { z } from "zod";

const FlashSchema = z.object({
	type: z.enum(["success", "error", "info"]),
	message: z.string(),
});

type Flash = z.infer<typeof FlashSchema>;

const KEY = "sov-flash-toast";

export function queueFlashToast(type: Flash["type"], message: string) {
	if (globalThis.window === undefined) return;
	sessionStorage.setItem(KEY, JSON.stringify({ type, message }));
}

export function consumeFlashToast() {
	if (globalThis.window === undefined) return;
	const raw = sessionStorage.getItem(KEY);
	if (!raw) return;
	sessionStorage.removeItem(KEY);

	try {
		const parsed = FlashSchema.safeParse(JSON.parse(raw));
		if (parsed.success) {
			toast[parsed.data.type](parsed.data.message);
		}
	} catch {
		// malformed JSON — ignore
	}
}
