import { localizeImplicit, localizeMod } from "#/game/items/mod-i18n";
import type { GeneratedItem } from "#/game/items/types";
import { m } from "#/paraglide/messages";

import { MODIFIED_COLOR } from "./colors";

const LOCAL_TAG_COLOR = "rgba(136, 136, 255, 0.5)";

/**
 * The implicits (closed by a dashed separator) and the explicits, in blue. An
 * increased local mod carries the (Local) tag; nothing is tagged global.
 */
export default function ModLines({ item }: { item: GeneratedItem }) {
	return (
		<>
			{item.implicits.length > 0 && (
				<>
					<div className="space-y-0.5 px-4 py-1">
						{item.implicits.map((mod) => (
							<div
								key={`${mod.description}:${mod.value}`}
								style={{ color: MODIFIED_COLOR }}
							>
								{localizeImplicit(mod)}
							</div>
						))}
					</div>
					<div className="my-1 px-2">
						<div className="border-t border-white/15 border-dashed" />
					</div>
				</>
			)}

			{item.explicits.length > 0 && (
				<div className="space-y-0.5 px-4 py-1">
					{item.explicits.map((mod) => (
						<div
							key={`${mod.modifierId}:${mod.value}:${mod.tier}`}
							style={{ color: MODIFIED_COLOR }}
						>
							{localizeMod(mod, item)}
							{!mod.isGlobalStat && mod.modifierType === "increased" && (
								<span style={{ color: LOCAL_TAG_COLOR }}>
									{" "}
									{m.mod_local_suffix()}
								</span>
							)}
						</div>
					))}
				</div>
			)}
		</>
	);
}
