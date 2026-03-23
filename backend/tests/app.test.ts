import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

describe("backend app", () => {
  it("responds to /health", async () => {
    const app = createApp({
      env: {
        GEMINI_API_KEY: undefined,
        GEMINI_MODEL: "mock",
        TAVILY_API_KEY: undefined,
        BACKEND_PORT: 4000,
        CORS_ORIGINS: "*",
        AI_DETECTION_API_URL: undefined,
        AI_DETECTION_API_KEY: undefined
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ok");
  });

  it("rejects empty analyze payloads", async () => {
    const app = createApp({
      env: {
        GEMINI_API_KEY: undefined,
        GEMINI_MODEL: "mock",
        TAVILY_API_KEY: undefined,
        BACKEND_PORT: 4000,
        CORS_ORIGINS: "*",
        AI_DETECTION_API_URL: undefined,
        AI_DETECTION_API_KEY: undefined
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: {}
    });

    expect(response.statusCode).toBe(400);
  });
});
