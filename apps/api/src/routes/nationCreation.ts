import type { FastifyInstance } from "fastify";
import { requirePrincipal } from "../auth/principal.js";
import {
  CULTURE_TRAITS,
  ECONOMY_TYPE_OPTIONS,
  EMBLEM_OPTIONS,
  FOUNDING_ORIGIN_OPTIONS,
  GOVERNMENT_TYPE_OPTIONS,
  IDEOLOGY_AXES,
  STARTING_PACKAGES,
  type NationCreationDraft
} from "@statecraft/shared";
import { getOrCreateDemoUser } from "../services/demoUser.js";
import { createFallbackNationFromInput, isDatabaseUnavailable } from "../services/fallbackDemo.js";
import {
  buildNationCreationPreview,
  createNationFromInput,
  validateNationCreationInput
} from "../services/nationCreationService.js";
import { emitRealtime } from "../realtime.js";

export async function registerNationCreationRoutes(app: FastifyInstance) {
  app.get("/api/nation-creation/options", async () => ({
    governmentTypes: GOVERNMENT_TYPE_OPTIONS,
    economyTypes: ECONOMY_TYPE_OPTIONS,
    foundingOrigins: FOUNDING_ORIGIN_OPTIONS,
    ideologyAxes: IDEOLOGY_AXES,
    cultureTraits: CULTURE_TRAITS,
    startingPackages: STARTING_PACKAGES,
    emblemOptions: EMBLEM_OPTIONS
  }));

  app.post("/api/nation-creation/preview", async (request) => {
    return buildNationCreationPreview((request.body ?? {}) as NationCreationDraft);
  });

  app.post("/api/nations/create", async (request, reply) => {
    const draft = (request.body ?? {}) as NationCreationDraft;
    const principal = requirePrincipal(request);

    try {
      const userId = principal.kind === "demo-user" ? (await getOrCreateDemoUser()).id : principal.userId;
      const result = await createNationFromInput(draft, userId);

      if (!result.ok) {
        return reply.code(400).send({
          message: "Nation creation input is invalid.",
          validationMessages: result.messages
        });
      }

      emitRealtime("world:territory-claimed", { nationId: result.result.nation.id });
      return reply.code(201).send(result.result);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        const validation = validateNationCreationInput(draft);

        if (!validation.isValid) {
          return reply.code(400).send({
            message: "Nation creation input is invalid.",
            validationMessages: validation.messages
          });
        }

        const created = createFallbackNationFromInput(validation.input, principal.userId);
        emitRealtime("world:territory-claimed", { nationId: created.nation.id });
        return reply.code(201).send(created);
      }

      throw error;
    }
  });
}
