import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
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
				<Button
					type="button"
					variant="stark"
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
					className="uppercase tracking-wider"
				>
					Sign out
				</Button>
			</div>
		);
	}

	return (
		<Link to="/sign-in" className="no-underline">
			<Button variant="stark" className="uppercase tracking-wider">
				Sign in
			</Button>
		</Link>
	);
}
