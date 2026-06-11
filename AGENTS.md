# Statecraft Online Agent Notes

## Coding Conventions

- Keep Foundation Step 1 scoped to a clean shell, demo data, and expandable boundaries.
- Do not overbuild systems before the core loop is playable.
- Keep game logic modular and move reusable rules into small services or shared package helpers.
- Prefer types from `packages/shared` whenever frontend and backend agree on a domain object.
- Add tests for game logic when practical, especially event effects and later simulation rules.
- Keep frontend components small, readable, and domain-focused.
- Keep backend routes organized by domain.
- Keep nation creation logic centralized in `apps/api/src/services/nationCreationService.ts`.
- Do not duplicate nation creation constants between frontend and backend.
- Use shared package constants from `packages/shared` for government, economy, ideology, traits, emblems, and starting packages.
- Keep event engine logic centralized in `apps/api/src/services/eventEngineService.ts`.
- Do not hardcode event behavior inside React components.
- Prefer shared event types and structured event effects.
- Keep event effects modular and expandable; add helper functions rather than branching inside route handlers.
- Keep route-level fallback tests in `apps/api/src/routes/routes.fallback.test.ts` when changing playable-loop API behavior.
- Keep frontend realtime subscriptions centralized through `apps/web/src/realtime.ts`.
- Treat authentication, combat, diplomacy, uploads, AI, fog of war, pathfinding, and life-sim mechanics as future work unless explicitly assigned.

## Style

- Use TypeScript throughout.
- Keep API validation explicit and basic for now.
- Keep UI state local unless a feature clearly needs shared state.
- Prefer clear placeholder UI over decorative polish in the foundation phase.
