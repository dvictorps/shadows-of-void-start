# Adding a world component (or growing one)

Read this before adding a component under `src/components/` or a new concern to an existing one (a modal, a panel, a HUD block). It is the shape that keeps components from becoming the monoliths the refactor track had to split: `world.tsx` (970 lines, complexity 78), `CombatScene` (989 / 64), `InventoryModal` (750 / 24). All three grew the same way: decisions written inline in handlers and JSX, server calls made inside the component (so no tests), and subcomponents piling up in one file.

Living examples: `src/components/world/InventoryModal.tsx` + `inventory-modal/`, `src/components/world/CombatScene.tsx` + `combat-scene/`.

## The rules (two of them are lint errors)

1. **`complexity` ≤ 20 per function** (`oxlint`, error). Going over means a decision is living in a handler or in JSX. Don't split the function to dodge the count; move the decision out (rule 3).
2. **No server calls in components** (`shadows/no-server-calls-in-components`, error under `src/components/**`). No value import of `#/integrations/trpc/*`, `@trpc/tanstack-react-query`, `@tanstack/react-query` or a `#/hooks/use*Mutations` bundle. The route (or a hook it calls) makes the calls and passes:
   - data as props;
   - calls as a `server` prop typed by an interface the component declares, with `Promise<object>` returns (`InventoryServer` in `InventoryModal.tsx`, `ExitFlowServer` in `useExitFlow.ts`). `import type` from the hook is fine to derive the argument types.

   The lint sees direct imports only. A hook that wraps `useQuery` or the tRPC client (`useLeaderboardSnapshot`) is a server call too: call it in the route and pass its data down, as `world.tsx` does for `LeaderboardModal`.

3. **Handlers dispatch; they don't decide.** A choice with more than two branches over game data goes into a pure function with its own test:
   - a game rule → `src/game/<domain>/` (the engine; see `shadows/game-imports`);
   - an interaction rule (what a drop does, when a reveal shows) → a `.ts` next to the component, in its folder (`inventory-modal/drag.ts`, `combat-scene/reveal.ts`).
4. **A folder once there's a second subcomponent.** `Foo.tsx` composes and owns what spans the pieces (shared state, the server calls); the pieces live in `foo/` (`foo/FooPanel.tsx`, `foo/rules.ts`). Size alone is not the gate (a ~700-line route of flat wiring is fine); mixing concerns is.
5. **Game-art buttons are `<Button variant="hud">`** with a `hud*` size, never a raw `<button>` (`react/forbid-elements`, an error). One option of a set (a tab, a picker card) is `variant="toggle"` with `aria-pressed`, and its test reads `aria-pressed`, not a class. A `<select>` is `<NativeSelect>` (`#/components/ui/native-select`).

## Steps

1. Put the decisions first: write the pure function(s) and their tests (`npx vitest run <file>`).
2. Declare the `server` interface (if the component triggers server work) and the props.
3. Build the component in its folder, composing the pieces.
4. Wire it in the route or its parent: pass the data and the `server` bundle (e.g. `world.tsx` → `WorldModals` → `InventoryModal`).
5. Write the component test next to it (`Foo.test.tsx`, jsdom): props in, `vi.fn()` fakes for `server` and callbacks, no `vi.mock`. Reuse the harness:
   - `narrow` from `src/components/dom-test-utils.ts`;
   - item and row builders from `src/components/world/item-test-fixtures.ts`;
   - drag-and-drop through dnd-kit's real `PointerSensor` on `src/components/world/dnd-test-harness.ts` (`installDragHarness()`, `drag`, `startDrag`);
   - framer-motion runs for real on fake timers, but keep the clock faked for the whole file (its frame loop is a singleton that stalls if a pending frame is dropped), and call Testing Library's `cleanup` by hand (vitest runs without globals);
   - `ConfirmationProvider` and sonner's `<Toaster />` run for real; `toast.dismiss()` in `afterEach`. A rule error is a `TRPCClientError.from({ error: { message, code, data: { code } } })`;
   - the Escape layers (`useEscapeLayer`) read `key`, dnd-kit's sensor reads `code`: send both. While dragging, the overlay holds a second card with the same name, so look cards up per cell;
   - a toggle (tab, picker card) is asserted through `aria-pressed`, never a class.
6. Add the files to `docs/codebase-map.md`.

## Debt lists

There are no debt lists: `complexity` and `shadows/no-server-calls-in-components` are errors on every file (`COMPLEXITY_DEBT` and its server-call sibling were emptied and removed). New code meets the rules; don't bring a list back.

## Validation

```bash
npx tsc --noEmit
pnpm test
pnpm lint:errors   # zero, enforced by the pre-push hook
```
