import { randomUUID } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";
import z from "zod";

import { db } from "../db/index.js";
import { bookmarks } from "../db/schema.js";

const BookmarkSchema = z.object({
  inputUrl: z.string().optional(),
  inputText: z.string().optional(),
  analysisResult: z.any()
});

export const bookmarkRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    if (!db) {
      return reply.code(503).send({ error: "Database not configured." });
    }

    const body = BookmarkSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid bookmark data." });
    }

    const { inputUrl, inputText, analysisResult } = body.data;

    try {
      const result = await db
        .insert(bookmarks)
        .values({
          id: randomUUID(),
          inputUrl: inputUrl ?? null,
          inputText: inputText ?? null,
          analysisResult
        })
        .returning();

      return reply.code(201).send(result[0]);
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ error: "Failed to save bookmark." });
    }
  });

  app.get("/", async (request, reply) => {
    if (!db) {
      return reply.code(503).send({ error: "Database not configured." });
    }

    try {
      const results = await db.select().from(bookmarks).orderBy(bookmarks.createdAt);
      return reply.send(results);
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ error: "Failed to fetch bookmarks." });
    }
  });
};
