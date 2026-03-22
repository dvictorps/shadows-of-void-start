# Shadows of Void

An online Action RPG with automatic stat-check combat, deep itemization, and infinite endgame progression. Inspired by classic ARPGs like Path of Exile and Diablo, Shadows of Void focuses on the loot grind fantasy — where every item drop matters and builds are defined by gear choices.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/dvictorps/shadows-of-void.git
cd shadows-of-void

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Fill in your Convex and auth credentials (see below)
```

### Running the Project

You need two terminals running simultaneously:

```bash
# Terminal 1 — Start the Convex backend
npx convex dev

# Terminal 2 — Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Environment Variables

Create a `.env.local` file with:

```
VITE_CONVEX_URL=<your-convex-url>
CONVEX_DEPLOYMENT=<your-convex-deployment>
BETTER_AUTH_SECRET=<generate with: npx @better-auth/cli secret>
```

### Other Commands

```bash
npm run build    # Production build
npm run test     # Run tests (Vitest)
npm run lint     # Lint with Biome
npm run format   # Format with Biome
```

## About the Project

Shadows of Void is a browser-based ARPG where combat is resolved automatically through stat checks — no manual aiming or clicking on enemies. Players focus entirely on build crafting: choosing their class, allocating passive skills, and hunting for powerful gear. The core loop is loot-driven: items are procedurally generated with randomized modifiers, rarity tiers, and base types that scale with content difficulty.

The game draws heavy inspiration from the itemization depth of classic ARPGs. Equipment features a tiered modifier system with prefixes and suffixes, multiple rarity levels (Normal, Magic, Rare, Legendary, Epic), and local vs. global stat interactions. Weapons, armor, jewelry, and shields all have distinct base types that progress through level-gated tiers, ensuring upgrades remain meaningful throughout progression.

Combat is presented as a node-based campaign map. Players select zones, and encounters are resolved by the stat engine comparing the player's build against enemy stats. Victory unlocks the next node, driving progression through a themed story campaign and into repeatable endgame content.

## Current State

The project is in early development. Here's what's already built:

- **Procedural Item Generator** — Full item generation engine with 10 modifier tiers, 5 rarity levels, prefix/suffix system, local/global stat resolution, and weighted modifier rolling. Covers 9 weapon types, 4 armor slots (3 variants each), shields, and jewelry.
- **Item Tooltip UI** — Rich tooltip display with color-coded stats, rarity-specific styling (glows, ornaments), and modifier formatting.
- **Equipment Base Progression** — 21-tier base item progression for weapons and armor, 8 tiers for jewelry, all level-gated.
- **Authentication System** — User registration and login via Better Auth + Convex.
- **Admin Panel** — Admin interface for item generation testing and inspection.
- **Internationalization** — i18n support via Paraglide (English/Portuguese).
- **71+ Unit Tests** — Comprehensive test suite covering the item generation system.

## Roadmap

### Unique Items
Hand-crafted item templates with fixed, curated modifiers — some exclusive to that item. Uniques sit above Epic rarity and define build-around fantasies: powerful but narrow. Each unique is a complete item definition, separate from the random generator.

### Class System
Multiple playable classes, each with distinct stat profiles and playstyle identities. Classes influence which weapon types and armor variants are most effective, encouraging diverse build paths.

### Passive Skill Tree
A branching passive tree where players allocate points to customize their character's strengths. Nodes grant stat bonuses, unlock build-defining keystones, and create meaningful choices between offensive, defensive, and utility paths.

### Auto-Combat System
A stat-check combat engine where encounters are resolved automatically based on the player's build. The system compares offensive stats (damage, speed, crit) against enemy defenses, with results influenced by gear, passives, and class bonuses. No manual aiming — the depth comes from preparation, not execution.

### Campaign Mode
A node-based world map where players progress through themed zones. Each node represents a combat encounter; defeating all enemies in a zone unlocks the next node. The campaign tells the story of the Void through a sequence of increasingly challenging areas, serving as the introduction to the game's mechanics and lore.

### Infinite Endgame
After completing the campaign, players enter a theoretically infinite endgame loop designed for long-term grinding. Endgame content scales in difficulty and rewards, providing a reason to keep optimizing builds and hunting for better gear.

### Ranking Systems
Competitive leaderboards tracking:
- **Character Level** — Highest level reached
- **Boss Eliminations** — Fastest kills and hardest bosses defeated
- **Dungeon Depth** — Deepest floor reached in endgame dungeons

### Player Trading
A trade system allowing players to exchange items with each other, creating a player-driven economy. Trading adds a social layer to the loot hunt and enables build completion through commerce rather than pure RNG.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS 4 + TanStack Router/Start
- **Backend:** Convex (database + serverless functions)
- **Auth:** Better Auth
- **Build:** Vite + Biome (lint/format) + Vitest (testing)
- **i18n:** Paraglide
- **Analytics:** PostHog

## License

This project is proprietary. All rights reserved.
