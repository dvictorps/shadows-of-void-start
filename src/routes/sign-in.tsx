import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { authClient } from "#/lib/auth-client";
import { queueFlashToast } from "#/lib/flash-toast";

export const Route = createFileRoute("/sign-in")({
	component: SignInPage,
});

function SignInPage() {
	const [isSignUp, setIsSignUp] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		const callbacks = {
			onSuccess: () => {
				queueFlashToast("success", isSignUp ? "Account created" : "Signed in");
				window.location.href = "/character-select";
			},
			onError: (ctx: { error: { message: string } }) => {
				setError(ctx.error.message);
				toast.error(ctx.error.message);
			},
		};

		try {
			if (isSignUp) {
				await authClient.signUp.email({ email, password, name }, callbacks);
			} else {
				await authClient.signIn.email({ email, password }, callbacks);
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="min-h-screen bg-black text-white">
			<div className="mx-auto flex min-h-screen max-w-350 flex-col items-center justify-center gap-16 px-6 py-12 md:flex-row md:justify-between md:gap-32 md:px-20">
				<div className="flex w-full items-center justify-center md:flex-1 md:justify-start">
					<h1 className="display-title glow-purple text-center text-6xl uppercase leading-display md:text-left md:text-8xl">
						Shadows
						<br />
						of Void
					</h1>
				</div>

				<div className="w-full max-w-sm">
					<div className="space-y-6">
						<h2 className="text-2xl font-semibold text-white">
							{isSignUp ? "Create account" : "Sign in"}
						</h2>

						<form onSubmit={handleSubmit} className="space-y-4">
							{isSignUp && (
								<div>
									<Label htmlFor="name" className="sr-only">
										Name
									</Label>
									<Input
										id="name"
										type="text"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="Name"
										required
									/>
								</div>
							)}

							<div>
								<Label htmlFor="email" className="sr-only">
									Email
								</Label>
								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="Email"
									required
								/>
							</div>

							<div>
								<Label htmlFor="password" className="sr-only">
									Password
								</Label>
								<Input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Password"
									required
									minLength={8}
								/>
							</div>

							{error && <p className="text-sm text-destructive">{error}</p>}

							<Button
								type="submit"
								variant="ghost-purple"
								className="w-full"
								disabled={loading}
							>
								{loading
									? "Loading..."
									: isSignUp
										? "Create account"
										: "Sign in"}
							</Button>
						</form>

						<p className="text-center text-sm text-muted-foreground">
							{isSignUp ? "Have an account?" : "No account?"}{" "}
							<Button
								type="button"
								variant="voidLink"
								size="inline"
								onClick={() => {
									setIsSignUp(!isSignUp);
									setError("");
								}}
							>
								{isSignUp ? "Sign in" : "Sign up"}
							</Button>
						</p>
					</div>
				</div>
			</div>
		</main>
	);
}
