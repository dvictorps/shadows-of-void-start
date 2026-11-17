import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

const SessionTokenContext = createContext<string | null>(null);

export function SessionTokenProvider({ children }: { children: ReactNode }) {
	const [token] = useState(() => crypto.randomUUID());
	return (
		<SessionTokenContext.Provider value={token}>
			{children}
		</SessionTokenContext.Provider>
	);
}

export type WithSession<A> = A & { sessionToken: string };

export function useSessionToken(): {
	sessionToken: string;
	withSession: <A extends object>(args: A) => WithSession<A>;
} {
	const token = useContext(SessionTokenContext);
	if (token === null)
		throw new Error("useSessionToken: missing SessionTokenProvider in tree");
	return useMemo(
		() => ({
			sessionToken: token,
			withSession: <A extends object>(args: A): WithSession<A> => ({
				...args,
				sessionToken: token,
			}),
		}),
		[token],
	);
}

export function useSessionedMutation<
	TArgs extends { sessionToken: string },
	TReturn,
>(
	mutation: (args: TArgs) => TReturn,
): (args: Omit<TArgs, "sessionToken">) => TReturn {
	const { sessionToken } = useSessionToken();
	return useCallback(
		(args: Omit<TArgs, "sessionToken">) =>
			// SAFETY: `args` is TArgs minus exactly the `sessionToken` key, and the
			// spread adds that key back as a string, which is all TArgs' constraint
			// requires. TS can't recombine `Omit<T, K> & Pick<T, K>` into a generic T.
			mutation({ ...args, sessionToken } as TArgs),
		[mutation, sessionToken],
	);
}
