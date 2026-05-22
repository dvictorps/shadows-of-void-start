// Literal-union ids for the decomposed naming system. Both lexicons
// (lexicon/en.ts, lexicon/pt.ts) MUST cover every member — TypeScript
// enforces this via Record<TemplateBaseId, ...> and
// Record<TemplateModifierId, ...> in lexicon/types.ts.
//
// Adding a new base / modifier:
//   1. Add the snake_case id to the union below.
//   2. Add an entry to en.ts and pt.ts (PT entries set gender / inflection).
//   3. Set nameBase / nameModifier on the template entry.
// Forgetting any of the three causes a compile error at the call site.

export type TemplateBaseId =
	// Weapons — swords
	| "sword"
	| "blade"
	| "falchion"
	| "sabre"
	| "edge"
	// Weapons — daggers
	| "dagger"
	| "shiv"
	| "stiletto"
	| "knife"
	| "dirk"
	// Weapons — axes
	| "axe"
	| "hatchet"
	| "cleaver"
	// Weapons — maces
	| "mace"
	| "flail"
	| "morning_star"
	// Weapons — two-handed
	| "greatsword"
	| "claymore"
	| "zweihander"
	| "greataxe"
	| "battleaxe"
	// Weapons — ranged + caster
	| "bow"
	| "shortbow"
	| "longbow"
	| "warbow"
	| "wand"
	| "staff"
	// Armor — bases shared across tiers 1-20
	| "hood"
	| "vest"
	| "boots"
	| "gloves"
	| "robe"
	| "slippers"
	| "wraps"
	// Armor — plate compound bases (a "Plate Helm" is distinct from a "Hood")
	| "plate_helm"
	| "plate_armor"
	| "plate_boots"
	| "plate_gauntlets"
	// Off-hand
	| "tower_shield"
	| "buckler"
	| "ward"
	| "tome"
	| "quiver"
	// Jewelry
	| "ring"
	| "amulet"
	| "belt"
	// Tier-21 void specials — compound bases that EN shows verbatim ("Void-
	// Touched Leather Hood") and PT renders with the material inline ("Capuz
	// de Couro Maculado pelo Vazio").
	| "void_touched_leather_hood"
	| "void_touched_leather_vest"
	| "void_touched_leather_boots"
	| "void_touched_leather_gloves"
	| "void_touched_buckler"
	| "void_woven_silk_hood"
	| "void_woven_silk_robe"
	| "void_woven_silk_slippers"
	| "void_woven_silk_wraps";

export type TemplateModifierId =
	// Weapon materials
	| "iron"
	| "copper"
	| "bronze"
	| "steel"
	| "damascus"
	// Possessives + tier ladder (used across most weapon + plate families)
	| "war"
	| "soldiers"
	| "knights"
	| "warden"
	| "champion"
	| "templar"
	| "relic"
	| "runed"
	| "hallowed"
	| "exalted"
	| "archon"
	| "sovereign"
	| "eternal"
	| "ascendant"
	| "celestial"
	// Void tier-21 prefixes (gendered adjectives in PT)
	| "void_touched"
	| "void_forged"
	| "void_inscribed"
	| "void_woven"
	// Bow lower tiers (woods + craft)
	| "oak"
	| "ash"
	| "elm"
	| "yew"
	| "maple"
	| "ironbark"
	| "recurve"
	| "composite"
	// Caster tier ladder (wand/staff/tome lower tiers)
	| "apprentice"
	| "acolyte"
	| "initiate"
	| "scholars"
	| "adept"
	| "magister"
	| "mystic"
	| "arcane"
	| "sage"
	| "oracle"
	| "hierophant"
	| "seer"
	| "invokers"
	| "channelers"
	| "conjurers"
	// Leather hides + leather tiers
	| "rawhide"
	| "tanned"
	| "cured"
	| "studded"
	| "hardened"
	| "rangers"
	| "scouts"
	| "treated"
	// Silk tier ladder
	| "linen"
	| "cotton"
	| "woven"
	| "fine"
	| "enchanted"
	// Quiver tier ladder
	| "hide"
	| "hunters"
	| "skirmisher"
	| "marksman"
	// Jewelry materials
	| "cobalt"
	| "garnet"
	| "topaz"
	| "obsidian"
	| "coral"
	| "lapis"
	| "gold"
	| "jade"
	| "amber"
	| "prismatic"
	// Belt materials
	| "leather"
	| "chain"
	| "cloth"
	| "silk"
	// Starter weapons (see starter-gear.ts)
	| "rusty"
	| "cracked";
