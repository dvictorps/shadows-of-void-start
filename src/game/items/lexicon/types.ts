// Item-naming lexicon types shared by all locales. Each language fills in
// concrete tables in lexicon/<locale>.ts. Template data (id, stats, sprite,
// implicits) stays language-neutral in src/game/items/data/; anything that's
// a grammar concern — gender, articles, adjective inflection — lives here.

export type GrammaticalGender = "m" | "f";

export interface GenderedForm {
	m: string;
	f: string;
}

export interface ItemNameLexicon {
	// Per-template noun ("Iron Sword" / "Espada de Ferro"). The renderer falls
	// back to the templateId itself when an entry is missing — useful while
	// adding a new base before translating it.
	templateNames: Record<string, string>;

	// Per-prefix modifier adjective. EN: single form ("Heavy"). PT: gendered
	// ("Pesado"/"Pesada") so the renderer can agree with the template noun.
	prefixForms: Record<string, string | GenderedForm>;

	// Per-suffix modifier phrase, with its preposition baked in ("of Swiftness"
	// / "da Rapidez"). No gender concord — the suffix anchors to its own noun
	// ("Rapidez" is feminine intrinsically), not to the template.
	suffixPhrases: Record<string, string>;

	// Pools for rare/legendary/epic proper-name generation. Seed comes from
	// item.id (UUID hash), so the same item always renders the same proper
	// name and a locale switch picks the equivalent slot in the other pool.
	rareFirstWords: readonly string[];
	rareSecondWords: readonly string[];

	// Optional — only filled by languages that need gender concord on prefix
	// adjectives. EN omits.
	templateGender?: Record<string, GrammaticalGender>;
}
