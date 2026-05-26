# Elemental Attunement + Leaderboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the Mage's Elemental Attunement class mechanic (element selector + damage conversion + level bonus) and a Leaderboard system (cron-snapshotted top-50 rankings for level and boss kills).

**Architecture:** Two independent features that share one schema migration (character doc gets `selectedElement` + `bossKillCounts`; new `leaderboardSnapshot` table). The stat engine converts spell weapon physical damage to the selected element and adds a per-level flat bonus. The leaderboard uses a 5-minute Convex cron job that writes pre-computed snapshots to a dedicated table. Hardcore death changes from character deletion to a `dead` flag so fallen heroes can appear in rankings.

**Tech Stack:** React + TypeScript + Tailwind CSS, Convex (backend + cron), Paraglide (i18n), Vitest (tests)

---

## Task 1: Schema Changes

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Add new fields to characters table and new leaderboardSnapshot table**

In `convex/schema.ts`, add these fields to the `characters` table (after `activeSessionAt`):

```typescript
// Mage elemental attunement — see CONTEXT.md → Elemental Attunement.
selectedElement: v.optional(
    v.union(v.literal("fire"), v.literal("cold"), v.literal("lightning")),
),
// Timestamp of the last element switch — server-side cooldown enforcement.
lastElementSwitchAt: v.optional(v.number()),
// Boss kill counters — keyed by boss id (e.g., { gralfor: 12 }).
// Incremented atomically in recordKill when monsterRarity === "unique".
bossKillCounts: v.optional(v.any()),
// Hardcore death — instead of deleting the character, mark as dead.
// Dead characters are excluded from character-select and leaderboards
// by default, but can appear in the "Fallen Heroes" view.
dead: v.optional(v.boolean()),
```

Add a new table after the `items` table:

```typescript
leaderboardSnapshot: defineTable({
    // "level" | "bossKills"
    category: v.string(),
    // "softcore" | "hardcore"
    mode: v.string(),
    entries: v.array(
        v.object({
            characterId: v.string(),
            characterName: v.string(),
            classId: v.string(),
            level: v.number(),
            xp: v.number(),
            totalBossKills: v.number(),
            hardcore: v.boolean(),
            dead: v.boolean(),
        }),
    ),
    updatedAt: v.number(),
}).index("by_category_mode", ["category", "mode"]),
```

**Step 2: Run `npx convex dev` to confirm schema deploys**

Run: `npx convex dev --once` (or check the running dev process)
Expected: Schema accepted, no errors

**Step 3: Commit**

```
feat(schema): add selectedElement, bossKillCounts, dead flag, leaderboardSnapshot table
```

---

## Task 2: Hardcore Death — Soft Delete Instead of Hard Delete

**Files:**
- Modify: `convex/combat.ts` — the `respawnDead` mutation (around line 381)
- Modify: `convex/characters.ts` — the `list` query (filter out dead)
- Modify: `src/routes/world.tsx` — handle `dead` in respawn response

**Step 1: Change hardcore death from delete to soft-delete**

In `convex/combat.ts`, the `respawnDead` handler (line 381), replace the hardcore block:

```typescript
// BEFORE:
if (char.hardcore) {
    // Cascade item delete then character delete (mirrors `remove`).
    const ownedItems = await ctx.db
        .query("items")
        .withIndex("by_character_kind", (q) =>
            q.eq("characterId", args.characterId),
        )
        .collect()
    await Promise.all(ownedItems.map((item) => ctx.db.delete(item._id)))
    await ctx.db.delete(args.characterId)
    return { mode: "hardcore" as const, xpLost: 0 }
}

// AFTER:
if (char.hardcore) {
    // Soft-delete: mark dead, cascade-delete items, but keep the character
    // document for leaderboard "Fallen Heroes". Stash items (no characterId)
    // are untouched — they're account-wide.
    const ownedItems = await ctx.db
        .query("items")
        .withIndex("by_character_kind", (q) =>
            q.eq("characterId", args.characterId),
        )
        .collect()
    await Promise.all(ownedItems.map((item) => ctx.db.delete(item._id)))
    await ctx.db.patch(args.characterId, {
        dead: true,
        ...clearPerVisitZoneState(),
        currentLocation: undefined,
        travelDestination: undefined,
        travelStartedAt: undefined,
        travelArrivesAt: undefined,
        activeSessionToken: undefined,
    })
    return { mode: "hardcore" as const, xpLost: 0 }
}
```

**Step 2: Filter dead characters from character list**

In `convex/characters.ts`, the `list` query, add a filter after collecting:

```typescript
// After .collect(), filter dead characters:
return characters.filter((c) => !c.dead)
```

**Step 3: Verify client-side handling**

In `src/routes/world.tsx`, the `handlePlayerDeath` callback (around line 270) already checks `mode === "hardcore"` and redirects to `/character-select`. Since the character is now soft-deleted (marked `dead: true`) instead of hard-deleted, the character select will simply not show it. No client change needed — the redirect works the same.

**Step 4: Commit**

```
feat(hardcore): soft-delete on death instead of hard-delete for leaderboard fallen heroes
```

---

## Task 3: Switch Element Mutation

**Files:**
- Modify: `convex/combat.ts` — add `switchElement` mutation

**Step 1: Add the mutation**

Add to `convex/combat.ts`:

```typescript
export const switchElement = mutation({
    args: {
        characterId: v.id("characters"),
        sessionToken: v.string(),
        element: v.union(
            v.literal("fire"),
            v.literal("cold"),
            v.literal("lightning"),
        ),
    },
    handler: async (ctx, args) => {
        const authUser = await authComponent.getAuthUser(ctx);
        if (!authUser) throw new ConvexError("Not authenticated");
        const char = await loadOwnedCharacterWithSession(
            ctx,
            authUser._id,
            args.characterId,
            args.sessionToken,
        );

        if (char.classId !== "mage")
            throw new ConvexError("Only mages can switch elements");

        if (args.element === char.selectedElement) return;

        const COOLDOWN_MS = 5_000;
        const now = Date.now();
        if (
            char.lastElementSwitchAt &&
            now - char.lastElementSwitchAt < COOLDOWN_MS
        ) {
            throw new ConvexError("Element switch on cooldown");
        }

        await ctx.db.patch(args.characterId, {
            selectedElement: args.element,
            lastElementSwitchAt: now,
        });
    },
});
```

**Step 2: Commit**

```
feat(mage): add switchElement mutation with 5s cooldown
```

---

## Task 4: Boss Kill Counter in recordKill

**Files:**
- Modify: `convex/combat.ts` — the `recordKill` handler

**Step 1: Increment boss kill counter**

In the `recordKill` handler, find the block where `isBossKill` is true (around the `if (grantsCampTier)` block). Add the boss kill counter increment inside the `if (isBossKill)` path. Look for where `isBossKill` is defined and add after the camp/completion logic:

```typescript
// After the existing boss kill handling:
if (isBossKill) {
    const counts = char.bossKillCounts ?? {};
    const currentCount =
        typeof counts === "object" && counts !== null
            ? ((counts as Record<string, number>)[args.monsterId] ?? 0)
            : 0;
    updates.bossKillCounts = {
        ...(typeof counts === "object" && counts !== null ? counts : {}),
        [args.monsterId]: currentCount + 1,
    };
}
```

Place this just before `await ctx.db.patch(args.characterId, updates)`.

**Step 2: Commit**

```
feat(leaderboard): increment bossKillCounts in recordKill for unique monsters
```

---

## Task 5: Stat Engine — Elemental Conversion + Level Bonus

**Files:**
- Modify: `src/game/stats/types.ts` — add `selectedElement` to `StatEngineInput`
- Modify: `src/game/stats/compute.ts` — conversion logic in `buildSwing()`

**Step 1: Extend StatEngineInput**

In `src/game/stats/types.ts`, add to the `StatEngineInput` interface:

```typescript
selectedElement?: "fire" | "cold" | "lightning";
```

**Step 2: Implement conversion in buildSwing()**

In `src/game/stats/compute.ts`, inside the `buildSwing()` function (around line 472), after the existing swing profile is built but before the `return`, add conversion logic for the spell path:

```typescript
// After the existing `return { source, itemId, ... }` is constructed,
// modify the function to apply elemental conversion for mages.

// When path is "spell" and an element is selected, convert 100% of
// physical base damage to the selected element.
if (path === "spell" && selectedElement) {
    const elementName =
        selectedElement === "fire"
            ? "Fire"
            : selectedElement === "cold"
              ? "Cold"
              : "Lightning";

    // Move physical damage entirely to the selected element
    const existing = elem.find((e) => e.element === elementName);
    if (existing) {
        existing.min += phys.min;
        existing.max += phys.max;
    } else {
        elem.push({
            element: elementName,
            min: phys.min,
            max: phys.max,
        });
    }
    phys = { min: 0, max: 0 };
}
```

Note: `phys` and `elem` are built earlier in the function from the weapon's base stats. The conversion needs to happen on mutable copies before the return statement. Refactor the function to use mutable local variables instead of building the return object directly.

**Step 3: Add level bonus**

In the same conversion block, after converting physical to elemental, add the per-level flat bonus:

```typescript
// Per-level flat bonus: +1 min / +2 max per level
if (path === "spell" && selectedElement) {
    // ... (conversion code above)

    // Level bonus in the selected element
    const bonus = elem.find((e) => e.element === elementName);
    if (bonus) {
        bonus.min += level;
        bonus.max += level * 2;
    }
}
```

The `level` parameter needs to be threaded through. `buildSwing()` currently doesn't receive it — pass it from the calling function which has access to `input.level`.

**Step 4: Thread selectedElement and level through the call chain**

The `buildSwing()` function is called from within `computeCharacterStats()`. Thread `input.selectedElement` and `input.level` to where `buildSwing()` is called (around lines 626-642).

**Step 5: Update the call site in world.tsx**

In `src/routes/world.tsx`, where `computeCharacterStats` is called (around line 181), add `selectedElement`:

```typescript
const stats = useMemo(
    () =>
        computeCharacterStats({
            classDef,
            level: character.level,
            equippedItems: equippedSnapshot,
            selectedElement: character.selectedElement,
        }),
    [classDef, character.level, equippedSnapshot, character.selectedElement],
);
```

**Step 6: Also update the server-side call in recordKill**

In `convex/combat.ts`, wherever `computeCharacterStats` is called (on level-up, around line 158), add `selectedElement: char.selectedElement`:

```typescript
const stats = computeCharacterStats({
    classDef,
    level,
    equippedItems,
    selectedElement: char.selectedElement,
});
```

**Step 7: Commit**

```
feat(mage): convert spell weapon damage to selected element + per-level flat bonus
```

---

## Task 6: Stat Engine Tests

**Files:**
- Modify: `src/game/items/generator.test.ts` — or create a new `src/game/stats/compute.test.ts`

**Step 1: Write tests for elemental conversion**

Create `src/game/stats/compute.test.ts` (if it doesn't exist) with:

```typescript
import { describe, expect, it } from "vitest";
import { computeCharacterStats } from "./compute";
import { findClassDefinition } from "../classes/data";

// Helper to create a minimal wand equipped item
function makeWand(baseMin: number, baseMax: number) {
    return {
        id: "test-wand",
        equipmentType: "weapon" as const,
        weaponType: "wand" as const,
        equippedSlot: "weapon" as const,
        rarity: "normal" as const,
        itemLevel: 10,
        requirements: { level: 1 },
        baseStats: {
            minDamage: baseMin,
            maxDamage: baseMax,
            attackSpeed: 1.4,
            criticalChance: 7,
        },
        implicits: [],
        explicits: [],
        seed: 0,
    };
}

describe("Mage Elemental Attunement", () => {
    const mageClass = findClassDefinition("mage");

    it("converts 100% physical to selected element on spell path", () => {
        const stats = computeCharacterStats({
            classDef: mageClass,
            level: 1,
            equippedItems: [makeWand(10, 20)],
            selectedElement: "fire",
        });

        const swing = stats.swings[0];
        // Physical should be zeroed
        expect(swing.physicalDamage.min).toBe(0);
        expect(swing.physicalDamage.max).toBe(0);
        // Fire should have the base damage + level bonus (level 1: +1 min, +2 max)
        const fire = swing.elementalDamage.find((e) => e.element === "Fire");
        expect(fire).toBeDefined();
        expect(fire!.min).toBe(10 + 1); // base + level*1
        expect(fire!.max).toBe(20 + 2); // base + level*2
    });

    it("adds per-level bonus scaling", () => {
        const stats = computeCharacterStats({
            classDef: mageClass,
            level: 50,
            equippedItems: [makeWand(10, 20)],
            selectedElement: "cold",
        });

        const swing = stats.swings[0];
        const cold = swing.elementalDamage.find((e) => e.element === "Cold");
        expect(cold).toBeDefined();
        expect(cold!.min).toBe(10 + 50);  // base + level*1
        expect(cold!.max).toBe(20 + 100); // base + level*2
    });

    it("does not convert when no selectedElement is set", () => {
        const stats = computeCharacterStats({
            classDef: mageClass,
            level: 10,
            equippedItems: [makeWand(10, 20)],
        });

        const swing = stats.swings[0];
        // Physical should remain
        expect(swing.physicalDamage.min).toBeGreaterThan(0);
    });

    it("does not convert for attack weapons even if selectedElement is set", () => {
        const sword = {
            ...makeWand(10, 20),
            weaponType: "sword" as const,
        };
        const stats = computeCharacterStats({
            classDef: findClassDefinition("warrior"),
            level: 10,
            equippedItems: [sword],
            selectedElement: "fire", // should be ignored
        });

        const swing = stats.swings[0];
        expect(swing.physicalDamage.min).toBeGreaterThan(0);
    });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/game/stats/compute.test.ts`
Expected: All tests pass

**Step 3: Commit**

```
test(mage): add elemental attunement stat engine tests
```

---

## Task 7: Spell Weapon Tooltip — Show Spell Damage + Cast Speed

**Files:**
- Modify: `src/components/game/ItemTooltip.tsx` — the spell weapon section (around line 225)
- Modify: `messages/en.json` — add `tooltip_spell_damage` and `tooltip_casts_per_second`
- Modify: `messages/pt.json` — same keys

**Step 1: Add i18n keys**

In `messages/en.json`, near the existing `tooltip_physical_damage` key (line 345):

```json
"tooltip_spell_damage": "Spell Damage",
"tooltip_casts_per_second": "Casts per Second",
```

In `messages/pt.json`:

```json
"tooltip_spell_damage": "Dano de Conjuração",
"tooltip_casts_per_second": "Conjurações por Segundo",
```

**Step 2: Update the spell weapon tooltip section**

In `ItemTooltip.tsx`, replace the spell weapon block (lines 225-240):

```typescript
// BEFORE: only shows crit chance
{isSpellWeapon && stats.criticalChance != null && (
    <>
        <div className="space-y-0.5 px-4 py-1">
            <div className="flex justify-between">
                <span style={{ color: LABEL_COLOR }}>
                    {m.tooltip_critical_strike_chance()}
                </span>
                <span className="text-white">
                    {stats.criticalChance.toFixed(1)}%
                </span>
            </div>
        </div>
        <TooltipSeparator />
    </>
)}

// AFTER: shows Spell Damage + Crit Chance + Cast Speed
{isSpellWeapon && (
    <>
        <div className="space-y-0.5 px-4 py-1">
            {stats.minDamage != null && stats.maxDamage != null && (
                <div className="flex justify-between">
                    <span style={{ color: LABEL_COLOR }}>
                        {m.tooltip_spell_damage()}
                    </span>
                    <span className="text-white">
                        {stats.minDamage}-{stats.maxDamage}
                    </span>
                </div>
            )}
            {stats.criticalChance != null && (
                <div className="flex justify-between">
                    <span style={{ color: LABEL_COLOR }}>
                        {m.tooltip_critical_strike_chance()}
                    </span>
                    <span className="text-white">
                        {stats.criticalChance.toFixed(1)}%
                    </span>
                </div>
            )}
            <div className="flex justify-between">
                <span style={{ color: LABEL_COLOR }}>
                    {m.tooltip_casts_per_second()}
                </span>
                <span className="text-white">1.00</span>
            </div>
        </div>
        <TooltipSeparator />
    </>
)}
```

**Step 3: Commit**

```
feat(tooltip): show Spell Damage and Cast Speed on caster weapon tooltips
```

---

## Task 8: Element Selector UI in Combat HUD

**Files:**
- Create: `src/components/world/ElementSelector.tsx`
- Modify: `src/components/world/CombatScene.tsx` — add element selector
- Modify: `src/routes/world.tsx` — pass element data + switch handler to CombatScene

**Step 1: Create ElementSelector component**

Create `src/components/world/ElementSelector.tsx`:

```typescript
import { Flame, Snowflake, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as m from "#/paraglide/messages";

type Element = "fire" | "cold" | "lightning";

const ELEMENT_CONFIG: Record<
    Element,
    {
        icon: typeof Flame;
        color: string;
        glowColor: string;
        label: () => string;
    }
> = {
    fire: {
        icon: Flame,
        color: "#ff6b35",
        glowColor: "rgba(255, 107, 53, 0.6)",
        label: () => m.element_fire(),
    },
    cold: {
        icon: Snowflake,
        color: "#4fc3f7",
        glowColor: "rgba(79, 195, 247, 0.6)",
        label: () => m.element_cold(),
    },
    lightning: {
        icon: Zap,
        color: "#ffd54f",
        glowColor: "rgba(255, 213, 79, 0.6)",
        label: () => m.element_lightning(),
    },
};

const COOLDOWN_MS = 5_000;

export default function ElementSelector({
    selected,
    onSwitch,
    disabled,
}: {
    selected: Element;
    onSwitch: (element: Element) => void;
    disabled?: boolean;
}) {
    const [cooldownEnd, setCooldownEnd] = useState(0);
    const [now, setNow] = useState(Date.now());
    const rafRef = useRef<number>(0);

    const remaining = Math.max(0, cooldownEnd - now);
    const onCooldown = remaining > 0;

    useEffect(() => {
        if (!onCooldown) return;
        const tick = () => {
            setNow(Date.now());
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [onCooldown]);

    function handleClick(element: Element) {
        if (element === selected || onCooldown || disabled) return;
        onSwitch(element);
        setCooldownEnd(Date.now() + COOLDOWN_MS);
    }

    const elements: Element[] = ["fire", "cold", "lightning"];

    return (
        <div className="flex gap-1.5">
            {elements.map((el) => {
                const cfg = ELEMENT_CONFIG[el];
                const Icon = cfg.icon;
                const isActive = el === selected;
                return (
                    <button
                        key={el}
                        type="button"
                        onClick={() => handleClick(el)}
                        disabled={disabled || (onCooldown && !isActive)}
                        className="relative flex h-10 w-10 items-center justify-center border transition disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                            borderColor: isActive ? cfg.color : "rgba(255,255,255,0.3)",
                            backgroundColor: isActive
                                ? `${cfg.color}22`
                                : "rgba(0,0,0,0.8)",
                            boxShadow: isActive
                                ? `0 0 8px ${cfg.glowColor}`
                                : "none",
                        }}
                        aria-label={cfg.label()}
                        aria-pressed={isActive}
                    >
                        <Icon
                            className="h-5 w-5"
                            style={{
                                color: isActive ? cfg.color : "rgba(255,255,255,0.5)",
                            }}
                        />
                        {onCooldown && !isActive && (
                            <div
                                className="absolute inset-0 bg-black/60"
                                style={{
                                    clipPath: `inset(0 0 ${(1 - remaining / COOLDOWN_MS) * 100}% 0)`,
                                }}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
```

**Step 2: Wire into CombatScene**

In `CombatScene.tsx`, add props:

```typescript
// Add to the props type:
classId?: string;
selectedElement?: "fire" | "cold" | "lightning";
onSwitchElement?: (element: "fire" | "cold" | "lightning") => void;
```

Add the `ElementSelector` in the bottom HUD, to the left of the health globe (or between the health globe and the consumable buttons). Only render for mages:

```typescript
{classId === "mage" && selectedElement && onSwitchElement && (
    <ElementSelector
        selected={selectedElement}
        onSwitch={onSwitchElement}
        disabled={state !== "engaged" && state !== "exploring"}
    />
)}
```

**Step 3: Wire in world.tsx**

In `src/routes/world.tsx`:

1. Import `useMutation` for `switchElement`:
```typescript
const switchElement = useSessionedMutation(api.combat.switchElement);
```

2. Create the handler:
```typescript
const handleSwitchElement = useCallback(
    async (element: "fire" | "cold" | "lightning") => {
        try {
            await switchElement({ characterId: character._id, element });
        } catch {
            // Cooldown or non-mage — silently ignore
        }
    },
    [switchElement, character._id],
);
```

3. Pass to CombatScene:
```typescript
<CombatScene
    // ... existing props
    classId={character.classId}
    selectedElement={character.selectedElement ?? "fire"}
    onSwitchElement={handleSwitchElement}
/>
```

**Step 4: Set default selectedElement on mage creation**

In `convex/characters.ts`, in the `create` mutation handler, add after the character insert:

```typescript
if (args.classId === "mage") {
    await ctx.db.patch(characterId, { selectedElement: "fire" });
}
```

Or include it in the initial insert object.

**Step 5: Commit**

```
feat(mage): add element selector UI in combat HUD with 5s cooldown
```

---

## Task 9: Leaderboard Cron Job

**Files:**
- Create: `convex/crons.ts`
- Create: `convex/leaderboard.ts` — internal mutation + public query

**Step 1: Create leaderboard module**

Create `convex/leaderboard.ts`:

```typescript
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const computeSnapshot = internalMutation({
    handler: async (ctx) => {
        const allCharacters = await ctx.db.query("characters").collect();

        const categories = ["level", "bossKills"] as const;
        const modes = ["softcore", "hardcore"] as const;

        for (const category of categories) {
            for (const mode of modes) {
                const filtered = allCharacters.filter((c) => {
                    const isHardcore = !!c.hardcore;
                    return mode === "hardcore" ? isHardcore : !isHardcore;
                });

                const sorted = [...filtered].sort((a, b) => {
                    if (category === "level") {
                        if (b.level !== a.level) return b.level - a.level;
                        return (b.xp ?? 0) - (a.xp ?? 0);
                    }
                    const aKills = sumBossKills(a.bossKillCounts);
                    const bKills = sumBossKills(b.bossKillCounts);
                    return bKills - aKills;
                });

                const top50 = sorted.slice(0, 50);

                const entries = top50.map((c) => ({
                    characterId: c._id,
                    characterName: c.name,
                    classId: c.classId,
                    level: c.level,
                    xp: c.xp ?? 0,
                    totalBossKills: sumBossKills(c.bossKillCounts),
                    hardcore: !!c.hardcore,
                    dead: !!c.dead,
                }));

                // Upsert: find existing snapshot for this category+mode, or insert new
                const existing = await ctx.db
                    .query("leaderboardSnapshot")
                    .withIndex("by_category_mode", (q) =>
                        q.eq("category", category).eq("mode", mode),
                    )
                    .unique();

                if (existing) {
                    await ctx.db.patch(existing._id, {
                        entries,
                        updatedAt: Date.now(),
                    });
                } else {
                    await ctx.db.insert("leaderboardSnapshot", {
                        category,
                        mode,
                        entries,
                        updatedAt: Date.now(),
                    });
                }
            }
        }
    },
});

function sumBossKills(counts: unknown): number {
    if (!counts || typeof counts !== "object") return 0;
    return Object.values(counts as Record<string, number>).reduce(
        (sum, n) => sum + (typeof n === "number" ? n : 0),
        0,
    );
}

export const getSnapshot = query({
    args: {
        category: v.string(),
        mode: v.string(),
    },
    handler: async (ctx, args) => {
        return ctx.db
            .query("leaderboardSnapshot")
            .withIndex("by_category_mode", (q) =>
                q.eq("category", args.category).eq("mode", args.mode),
            )
            .unique();
    },
});
```

**Step 2: Create crons.ts**

Create `convex/crons.ts`:

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
    "leaderboard snapshot",
    { minutes: 5 },
    internal.leaderboard.computeSnapshot,
);

export default crons;
```

**Step 3: Commit**

```
feat(leaderboard): add cron job + snapshot query for top-50 rankings every 5 minutes
```

---

## Task 10: Leaderboard Modal UI

**Files:**
- Create: `src/components/world/LeaderboardModal.tsx`
- Modify: `src/components/world/MapScene.tsx` — add leaderboard button
- Modify: `src/routes/world.tsx` — manage leaderboard modal state
- Modify: `messages/en.json` — add leaderboard i18n keys
- Modify: `messages/pt.json` — same

**Step 1: Add i18n keys**

In `messages/en.json`:

```json
"leaderboard_title": "Leaderboard",
"leaderboard_level_tab": "Highest Level",
"leaderboard_kills_tab": "Boss Kills",
"leaderboard_softcore": "Softcore",
"leaderboard_hardcore": "Hardcore",
"leaderboard_show_fallen": "Show Fallen Heroes",
"leaderboard_rank": "#",
"leaderboard_name": "Name",
"leaderboard_class": "Class",
"leaderboard_level": "Level",
"leaderboard_kills": "Kills",
"leaderboard_empty": "No entries yet",
"leaderboard_all_classes": "All Classes",
"leaderboard_filter_class": "Filter by Class"
```

In `messages/pt.json`:

```json
"leaderboard_title": "Ranking",
"leaderboard_level_tab": "Maior Nível",
"leaderboard_kills_tab": "Boss Kills",
"leaderboard_softcore": "Softcore",
"leaderboard_hardcore": "Hardcore",
"leaderboard_show_fallen": "Exibir Heróis Caídos",
"leaderboard_rank": "#",
"leaderboard_name": "Nome",
"leaderboard_class": "Classe",
"leaderboard_level": "Nível",
"leaderboard_kills": "Kills",
"leaderboard_empty": "Nenhuma entrada ainda",
"leaderboard_all_classes": "Todas as Classes",
"leaderboard_filter_class": "Filtrar por Classe"
```

**Step 2: Create LeaderboardModal component**

Create `src/components/world/LeaderboardModal.tsx`. Use the existing `Modal` component. Structure:

- Two category tabs: "Highest Level" / "Boss Kills"
- Two mode tabs: "Softcore" / "Hardcore"
- Class filter dropdown (only on level tab): All / Warrior / Rogue / Mage
- "Show Fallen Heroes" checkbox (only on hardcore tab)
- Table with: Rank, Name, Class, Level (or Kills)
- Dead characters rendered with reduced opacity and skull indicator

Use `useQuery(api.leaderboard.getSnapshot, { category, mode })` to fetch data. Filter client-side for class and fallen heroes.

**Step 3: Add leaderboard button to MapScene**

In `MapScene.tsx`, add a new prop `onOpenLeaderboard` and render a button next to the existing settings button:

```typescript
// Add to props:
onOpenLeaderboard?: () => void;

// Next to the settings button (inside the top-right absolute container):
<button
    type="button"
    onClick={onOpenLeaderboard}
    className="inline-flex h-9 w-9 items-center justify-center border border-white/40 bg-black text-white/80 transition hover:border-white hover:bg-white/10 hover:text-white"
    aria-label={m.leaderboard_title()}
>
    <Trophy className="h-4 w-4" />
</button>
```

Group both buttons in a `flex gap-2` container.

**Step 4: Wire in world.tsx**

Add leaderboard modal state in world.tsx alongside the existing modal states:

```typescript
const leaderboardModal = useModalState(); // or useState<boolean>
```

Pass `onOpenLeaderboard={leaderboardModal.open}` to `MapScene`, and render:

```typescript
<LeaderboardModal
    isOpen={leaderboardModal.isOpen}
    onClose={leaderboardModal.close}
/>
```

**Step 5: Commit**

```
feat(leaderboard): add leaderboard modal with level/boss-kills tabs, class filter, fallen heroes
```

---

## Task 11: i18n for Element Selector

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt.json`

**Step 1: Add element selector i18n keys**

In `messages/en.json`:

```json
"element_selector_cooldown": "Switching in {seconds}s",
"element_selector_fire": "Fire Attunement",
"element_selector_cold": "Cold Attunement",
"element_selector_lightning": "Lightning Attunement"
```

In `messages/pt.json`:

```json
"element_selector_cooldown": "Troca em {seconds}s",
"element_selector_fire": "Sintonia de Fogo",
"element_selector_cold": "Sintonia de Gelo",
"element_selector_lightning": "Sintonia de Raio"
```

**Step 2: Commit**

```
feat(i18n): add element selector and leaderboard translation keys
```

---

## Task 12: Manual Testing Checklist

After all tasks are implemented:

1. **Create a new mage** — verify `selectedElement` defaults to "fire"
2. **Open inventory, hover a wand** — tooltip should show "Spell Damage: X–Y", "Critical Strike Chance: 7.0%", "Casts per Second: 1.00"
3. **Enter a zone** — element selector visible in combat HUD with fire active
4. **Click cold button** — selector switches, cooldown visual appears for 5s
5. **Click during cooldown** — button disabled, no switch
6. **Check stats panel** — damage should reflect converted element (all fire/cold/lightning, no physical)
7. **Level up the mage** — damage should increase by +1 min / +2 max
8. **Non-mage class** — element selector should not appear
9. **Open leaderboard from map** — trophy button next to settings
10. **Check level tab** — characters sorted by level, class filter works
11. **Check boss kills tab** — characters sorted by total boss kills
12. **Kill Gralfor** — after 5 minutes, character should appear in boss kills ranking
13. **Toggle hardcore/softcore** — different rankings shown
14. **Hardcore death** — character disappears from ranking, reappears with "Show Fallen Heroes"
15. **Refresh page** — selected element persists, leaderboard still loads

---

## Task 13: Doc Updates

**Files:**
- Verify: `CONTEXT.md` — already updated with Elemental Attunement and Leaderboard sections
- Verify: `docs/adr/0006-leaderboard-cron-snapshot.md` — already created
- Modify: `docs/codebase-map.md` — add new files (ElementSelector.tsx, LeaderboardModal.tsx, convex/leaderboard.ts, convex/crons.ts)

**Step 1: Update codebase-map.md**

Add entries for:
- `convex/crons.ts` — Cron job definitions (leaderboard snapshot every 5 min)
- `convex/leaderboard.ts` — Leaderboard snapshot compute + query
- `src/components/world/ElementSelector.tsx` — Mage element attunement selector
- `src/components/world/LeaderboardModal.tsx` — Leaderboard modal with rankings

**Step 2: Commit**

```
docs: update codebase-map with new leaderboard and element selector files
```
