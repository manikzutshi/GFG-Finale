import {
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
  type AnalyzeRequest,
  type AnalyzeResponse
} from "@veritas/shared";

export async function analyzeContent(
  payload: AnalyzeRequest,
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4311"
): Promise<AnalyzeResponse> {
  const parsedPayload = AnalyzeRequestSchema.parse(payload);
  const response = await fetch(`${baseUrl}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(parsedPayload)
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Analysis request failed.");
  }

  return AnalyzeResponseSchema.parse(await response.json());
}
