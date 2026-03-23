import type { FastifyPluginAsync } from "fastify";
import z from "zod";

const CheckImageSchema = z.object({
  imageUrl: z.string().url()
});

export const checkImageRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const body = CheckImageSchema.safeParse(request.body);
    
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid image URL." });
    }

    const { imageUrl } = body.data;

    try {
      // Mocked response since no AI Detection API was designated/configured for this build.
      // E.g., Sightengine / Hive Moderation would be placed here.
      
      // We simulate an AI check by hashing the URL length as a pseudo-random result 
      // or simply returning a dummy response.
      const isLikelyFake = imageUrl.includes("synthetic") || imageUrl.includes("midjourney");
      
      const payload = {
        imageUrl,
        isFake: isLikelyFake,
        confidenceScore: isLikelyFake ? 92.5 : 88.0,
        provider: "Mock-AI-Detector",
        message: isLikelyFake 
          ? "High probability of AI generation detected." 
          : "Image appears to be natural or from a camera."
      };

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));

      return reply.code(200).send(payload);
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ error: "Failed to detect AI image." });
    }
  });
};
