import { z } from "zod";

const optionalString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().optional());

const EnvSchema = z.object({
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: optionalString.default("gemini-2.5-flash"),
  DATABASE_URL: optionalString,
  TAVILY_API_KEY: optionalString,
  BACKEND_PORT: z.coerce.number().int().positive().default(4311),
  CORS_ORIGINS: optionalString.default("http://localhost:4310"),
  AI_DETECTION_API_URL: optionalString.pipe(z.string().url().optional()),
  AI_DETECTION_API_KEY: optionalString
});

export type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

export function getEnv(overrides?: Partial<NodeJS.ProcessEnv>): Env {
  if (!overrides && cachedEnv) {
    return cachedEnv;
  }

  const parsed = EnvSchema.parse({ ...process.env, ...overrides });

  if (!overrides) {
    cachedEnv = parsed;
  }

  return parsed;
}

export function parseCorsOrigins(origins: string): true | string[] {
  if (origins.trim() === "*") {
    return true;
  }

  return origins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
