export function formatDate(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "2-digit",
	});
}
