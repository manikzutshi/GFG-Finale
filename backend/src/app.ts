import cors from "@fastify/cors";
import { AnalyzeRequestSchema } from "@veritas/shared";
import Fastify from "fastify";

import { getEnv, parseCorsOrigins, type Env } from "./config/env.js";
import { AnalyzeService } from "./services/analyze-service.js";
import { bookmarkRoutes } from "./routes/bookmarks.js";
import { checkImageRoutes } from "./routes/check-image.js";

export function createApp(options: { env?: Env; analysisService?: AnalyzeService } = {}) {
  const env = options.env ?? getEnv();
  const analysisService = options.analysisService ?? new AnalyzeService({ env });
  const app = Fastify({
    logger: true
  });
  const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);

  app.register(cors, {
    origin: corsOrigins === true ? true : corsOrigins
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "veritas-backend"
  }));

  app.register(bookmarkRoutes, { prefix: "/api/bookmarks" });
  app.register(checkImageRoutes, { prefix: "/api/check-image" });

  app.post("/analyze", async (request, reply) => {
    const parsed = AnalyzeRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        error: parsed.error.issues[0]?.message ?? "Invalid request body."
      });
    }

    try {
      return await analysisService.analyze(parsed.data);
    } catch (error) {
      request.log.error(error);

      if (error instanceof Error && "statusCode" in error && typeof error.statusCode === "number") {
        return reply.code(error.statusCode).send({
          error: error.message
        });
      }

      return reply.code(500).send({
        error: error instanceof Error ? error.message : "Analysis failed."
      });
    }
  });

  return app;
}

