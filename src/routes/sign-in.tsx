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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			if (isSignUp) {
				await authClient.signUp.email(
					{ email, password, name },
					{
						onSuccess: () => {
							queueFlashToast("success", "Account created");
							window.location.href = "/character-select";
						},
						onError: (ctx) => {
							setError(ctx.error.message);
							toast.error(ctx.error.message);
						},
					},
				);
			} else {
				await authClient.signIn.email(
					{ email, password },
					{
						onSuccess: () => {
							queueFlashToast("success", "Signed in");
							window.location.href = "/character-select";
						},
						onError: (ctx) => {
							setError(ctx.error.message);
							toast.error(ctx.error.message);
						},
					},
				);
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="min-h-screen bg-black text-white">
			<div className="mx-auto flex min-h-screen max-w-[1400px] flex-col items-center justify-center gap-16 px-6 py-12 md:flex-row md:justify-between md:gap-32 md:px-20">
				{/* Title — left */}
				<div className="flex w-full items-center justify-center md:flex-1 md:justify-start">
					<h1 className="display-title text-glow-purple text-center text-6xl uppercase leading-[0.95] md:text-left md:text-8xl">
						Shadows
						<br />
						of Void
					</h1>
				</div>

				{/* Form — right */}
				<div className="w-full max-w-sm">
					<div className="space-y-6">
						<div>
							<h2 className="text-2xl font-semibold text-white">
								{isSignUp ? "Create account" : "Sign in"}
							</h2>
							<p className="mt-1 text-sm text-neutral-400">
								{isSignUp
									? "Enter your details to create an account"
									: "Enter your credentials to continue"}
							</p>
						</div>

						<form onSubmit={handleSubmit} className="space-y-4">
							{isSignUp && (
								<div className="space-y-2">
									<Label htmlFor="name" className="text-neutral-300">
										Name
									</Label>
									<Input
										id="name"
										type="text"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="Your name"
										required
										className="border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-500"
									/>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="email" className="text-neutral-300">
									Email
								</Label>
								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="you@example.com"
									required
									className="border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-500"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="password" className="text-neutral-300">
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
									className="border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-500"
								/>
							</div>

							{error && <p className="text-sm text-red-400">{error}</p>}

							<Button
								type="submit"
								className="w-full border border-white bg-black text-white hover:bg-white/10 hover:text-white"
								disabled={loading}
							>
								{loading
									? "Loading..."
									: isSignUp
										? "Create account"
										: "Sign in"}
							</Button>
						</form>

						<p className="text-center text-sm text-neutral-400">
							{isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
							<button
								type="button"
								onClick={() => {
									setIsSignUp(!isSignUp);
									setError("");
								}}
								className="font-medium text-purple-400 underline hover:text-purple-300"
							>
								{isSignUp ? "Sign in" : "Sign up"}
							</button>
						</p>
					</div>
				</div>
			</div>
		</main>
	);
}
