import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/sign-in")({
	component: SignInPage,
});

function SignInPage() {
	const navigate = useNavigate();
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
							void navigate({ to: "/" });
						},
						onError: (ctx) => {
							setError(ctx.error.message);
						},
					},
				);
			} else {
				await authClient.signIn.email(
					{ email, password },
					{
						onSuccess: () => {
							void navigate({ to: "/" });
						},
						onError: (ctx) => {
							setError(ctx.error.message);
						},
					},
				);
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold">
						{isSignUp ? "Create account" : "Sign in"}
					</h1>
					<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
						{isSignUp
							? "Enter your details to create an account"
							: "Enter your credentials to continue"}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{isSignUp && (
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Your name"
								required
							/>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="password">Password</Label>
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

					{error && (
						<p className="text-sm text-red-600 dark:text-red-400">{error}</p>
					)}

					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? "Loading..." : isSignUp ? "Create account" : "Sign in"}
					</Button>
				</form>

				<p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
					{isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
					<button
						type="button"
						onClick={() => {
							setIsSignUp(!isSignUp);
							setError("");
						}}
						className="font-medium text-neutral-900 underline dark:text-neutral-100"
					>
						{isSignUp ? "Sign in" : "Sign up"}
					</button>
				</p>
			</div>
		</div>
	);
}
