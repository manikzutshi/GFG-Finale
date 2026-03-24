import type { FastifyPluginAsync } from "fastify";
import z from "zod";

const CheckImageSchema = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional()
}).refine(data => data.imageUrl || data.imageBase64, {
  message: "Either imageUrl or imageBase64 must be provided."
});

export const checkImageRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const body = CheckImageSchema.safeParse(request.body);
    
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid payload." });
    }

    const { imageUrl, imageBase64 } = body.data;

    try {
      let imageBuffer: Buffer;
      
      if (imageBase64) {
        // Strip the data URL prefix if present (e.g., data:image/jpeg;base64,)
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        imageBuffer = Buffer.from(base64Data, "base64");
      } else if (imageUrl) {
        const fetchRes = await fetch(imageUrl);
        if (!fetchRes.ok) throw new Error("Failed to download image URL.");
        const arrayBuffer = await fetchRes.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } else {
        throw new Error("Missing image data.");
      }

      const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
      if (!HF_API_KEY) {
        throw new Error("Missing Hugging Face config. Please check your .env file.");
      }

      const hfResponse = await fetch(
        "https://router.huggingface.co/hf-inference/models/umm-maybe/AI-image-detector",
        {
          headers: {
            "Authorization": `Bearer ${HF_API_KEY}`,
            "Content-Type": "image/jpeg"
          },
          method: "POST",
          body: imageBuffer,
        }
      );

      if (!hfResponse.ok) {
        const txt = await hfResponse.text();
        app.log.error(`Hugging Face API Error: ${hfResponse.status} - ${txt}`);
        
        // HF models sometimes return 503 "Model is loading" if cold
        if (hfResponse.status === 503) {
           throw new Error("The AI model is currently booting up (cold start). Please try again in 10 seconds.");
        }
        throw new Error(`Hugging Face API Error: ${hfResponse.statusText}`);
      }

      const hfData = await hfResponse.json();
      
      /*
       * Expected HF output format for umm-maybe model:
       * [
       *   { "label": "artificial", "score": 0.98 },
       *   { "label": "human", "score": 0.02 }
       * ]
       */
      
      let aiScore = 0;
      if (Array.isArray(hfData) && hfData.length > 0) {
         let results = hfData;
         // Sometimes HF wraps it in a nested array: [[{...}, {...}]]
         if (Array.isArray(hfData[0])) results = hfData[0];
         
         const artif = results.find((item: any) => item.label === "artificial");
         if (artif) {
             aiScore = artif.score * 100;
         } else if (results[0] && results[0].score) {
             aiScore = results[0].score * 100;
         }
      }

      const isLikelyFake = aiScore > 50;
      
      const payload = {
        imageUrl: imageUrl || "Local File Upload",
        isFake: isLikelyFake,
        confidenceScore: Math.round(aiScore * 10) / 10,
        provider: "Hugging Face (umm-maybe/AI-image-detector)",
        message: isLikelyFake 
          ? `High probability (${Math.round(aiScore)}%) of AI generation detected.` 
          : `Image appears natural (${Math.round(100 - aiScore)}% human confidence).`
      };

      return reply.code(200).send(payload);
    } catch (err: any) {
      app.log.error(err);
      return reply.code(500).send({ error: err.message || "Failed to detect AI image." });
    }
  });
};
