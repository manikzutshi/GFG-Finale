import type { FastifyPluginAsync } from "fastify";
import z from "zod";

const CheckAudioSchema = z.object({
  audioUrl: z.string().url().optional(),
  audioBase64: z.string().optional()
}).refine(data => data.audioUrl || data.audioBase64, {
  message: "Either audioUrl or audioBase64 must be provided."
});

export const checkAudioRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const body = CheckAudioSchema.safeParse(request.body);
    
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid payload." });
    }

    const { audioUrl, audioBase64 } = body.data;

    try {
      let base64Audio: string;
      let mimeType = "audio/mpeg";
      
      if (audioBase64) {
        // Extract mime type from data URL if present
        const mimeMatch = audioBase64.match(/^data:(audio\/\w+);base64,/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
        // Strip data URL prefix
        base64Audio = audioBase64.replace(/^data:audio\/[^;]+;base64,/, "");
      } else if (audioUrl) {
        const fetchRes = await fetch(audioUrl);
        if (!fetchRes.ok) throw new Error("Failed to download audio URL.");
        const contentType = fetchRes.headers.get("content-type");
        if (contentType && contentType.startsWith("audio/")) {
          mimeType = contentType.split(";")[0];
        }
        const arrayBuffer = await fetchRes.arrayBuffer();
        base64Audio = Buffer.from(arrayBuffer).toString("base64");
      } else {
        throw new Error("Missing audio data.");
      }

      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        throw new Error("Missing Gemini API key. Please check your .env file.");
      }

      // Use Gemini 2.5 Flash with inline audio data for deepfake analysis
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Audio
                  }
                },
                {
                  text: `You are an expert forensic audio analyst. Your job is to determine if this audio contains AI-generated or cloned speech.

CRITICAL CALIBRATION RULES:
- DEFAULT TO REAL. Most audio you receive will be genuine human speech. Only flag as fake if you find UNMISTAKABLE synthetic artifacts.
- Phone recordings, voice memos, compressed audio (m4a/mp3), and amateur recordings naturally have quality artifacts. These are NOT signs of AI generation. Do not confuse low recording quality with AI synthesis.
- Real human speech often has: uneven volume, background noise, mouth clicks, breathing, filler words ("um", "uh"), slight stammering, variable pacing. These are signs of AUTHENTICITY.
- AI-generated speech typically has: unnaturally perfect pacing with no hesitation, zero background variation, a "too smooth" quality with no vocal fry or creak, identical breath spacing, and sometimes subtle metallic/watery artifacts in sibilants.

Only classify as fake (isFake: true) if you detect at least 2-3 STRONG synthetic markers that cannot be explained by recording quality.

Respond in STRICT JSON format only:
{
  "isFake": true/false,
  "confidenceScore": 0-100,
  "reasoning": "Brief 1-2 sentence explanation",
  "indicators": ["indicator1", "indicator2", "indicator3"]
}

If the audio sounds like a normal person talking (even with poor quality), set isFake to false and confidenceScore below 20.`
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        app.log.error(`Gemini API Error: ${geminiResponse.status} - ${errText}`);
        throw new Error(`Gemini API Error: ${geminiResponse.statusText}`);
      }

      const geminiData = await geminiResponse.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!responseText) {
        throw new Error("Gemini did not return a valid response.");
      }

      const analysis = JSON.parse(responseText);

      const payload = {
        audioUrl: audioUrl || "Local Audio Upload",
        isFake: analysis.isFake,
        confidenceScore: analysis.confidenceScore,
        provider: "Google Gemini 2.5 Flash (Audio Forensics)",
        message: analysis.reasoning,
        indicators: analysis.indicators || []
      };

      return reply.code(200).send(payload);
    } catch (err: any) {
      app.log.error(err);
      return reply.code(500).send({ error: err.message || "Failed to analyze audio." });
    }
  });
};
