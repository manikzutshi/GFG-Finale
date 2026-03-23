import "dotenv/config";

import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";

const env = getEnv();
const app = createApp({ env });

app
  .listen({
    port: env.BACKEND_PORT,
    host: "0.0.0.0"
  })
  .then(() => {
    app.log.info(`Veritas backend listening on http://localhost:${env.BACKEND_PORT}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
