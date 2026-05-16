import { createContext, useCallback, useContext, useState } from "react";
import ConfirmationModal, {
	type ConfirmationConfig,
} from "#/components/ConfirmationModal";

type Confirm = (config: ConfirmationConfig) => Promise<boolean>;

const ConfirmationContext = createContext<Confirm | null>(null);

type PendingState = {
	config: ConfirmationConfig;
	resolve: (result: boolean) => void;
};

export function ConfirmationProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [pending, setPending] = useState<PendingState | null>(null);

	const confirm = useCallback<Confirm>((config) => {
		return new Promise<boolean>((resolve) => {
			setPending({ config, resolve });
		});
	}, []);

	const resolveAndClose = useCallback(
		(result: boolean) => {
			if (pending) {
				pending.resolve(result);
				setPending(null);
			}
		},
		[pending],
	);

	return (
		<ConfirmationContext.Provider value={confirm}>
			{children}
			<ConfirmationModal
				isOpen={pending !== null}
				title={pending?.config.title ?? ""}
				message={pending?.config.message}
				confirmLabel={pending?.config.confirmLabel}
				cancelLabel={pending?.config.cancelLabel}
				variant={pending?.config.variant}
				onConfirm={() => resolveAndClose(true)}
				onCancel={() => resolveAndClose(false)}
			/>
		</ConfirmationContext.Provider>
	);
}

export function useConfirmationModal(): Confirm {
	const ctx = useContext(ConfirmationContext);
	if (!ctx) {
		throw new Error(
			"useConfirmationModal must be used within ConfirmationProvider",
		);
	}
	return ctx;
}
