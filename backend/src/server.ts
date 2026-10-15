import { app } from "./app.js";
import { env } from "./config/env.js";
import { checkDatabaseConnection, pool } from "./config/database.js";

async function bootstrap() {
  const databaseReady = await checkDatabaseConnection();

  if (!databaseReady) {
    console.error("Cannot start API without database connection");
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log("");
    console.log("JMC Backend API started");
    console.log(`Environment : ${env.NODE_ENV}`);
    console.log(`API URL     : http://localhost:${env.PORT}`);
    console.log(`Health      : http://localhost:${env.PORT}/api/health`);
    console.log(`Database    : Connected`);
    console.log("");
  });

  async function shutdown() {
    console.log("Shutting down...");

    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
