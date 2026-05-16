import { Link } from "@tanstack/react-router";
import { authClient } from "#/lib/auth-client";
import { queueFlashToast } from "#/lib/flash-toast";

export default function BetterAuthHeader() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <div className="h-9 w-24 animate-pulse bg-white/5" />;
	}

	if (session?.user) {
		return (
			<div className="flex items-center gap-2">
				<span className="text-sm text-white/80">
					{session.user.name || session.user.email}
				</span>
				<button
					type="button"
					onClick={() => {
						void authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									queueFlashToast("success", "Signed out");
									window.location.href = "/";
								},
							},
						});
					}}
					className="inline-flex h-9 items-center border border-white bg-black px-4 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-white/10"
				>
					Sign out
				</button>
			</div>
		);
	}

	return (
		<Link
			to="/sign-in"
			className="inline-flex h-9 items-center border border-white bg-black px-4 text-sm font-medium uppercase tracking-wider text-white no-underline transition-colors hover:bg-white/10"
		>
			Sign in
		</Link>
	);
}
