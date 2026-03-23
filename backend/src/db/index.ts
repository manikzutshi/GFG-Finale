import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "../config/env.js";
import * as schema from "./schema.js";

const env = getEnv();

// In serverless environments, neon serverless might be preferred, but standard postgres works fine locally.
const connectionString = env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️ DATABASE_URL not set in environment. Bookmarks feature will not work.");
}

// Disable prefetch for Neon pools
const client = connectionString
  ? postgres(connectionString, { prepare: false })
  : null;

export const db = client ? drizzle(client, { schema }) : null;
