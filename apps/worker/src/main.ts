import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { assertProductionReady } from "../../../packages/config/src/production.ts";
import { AppModule } from "./app.module.js";
import { WorkerHealthService } from "./health/worker-health.js";

const logger = new Logger("WorkerBootstrap");

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

async function bootstrap() {
  assertProductionReady(process.env);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });
  app.enableShutdownHooks();

  const healthService = app.get(WorkerHealthService);
  const runtimeConfig = healthService.getRuntimeConfig();

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    if (request.url === "/health/live") {
      sendJson(response, 200, {
        service: "worker",
        status: "ok",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (request.url === "/health/ready") {
      const snapshot = healthService.snapshot();
      sendJson(response, snapshot.status === "ok" ? 200 : 503, snapshot);
      return;
    }

    sendJson(response, 404, {
      error: "Not Found",
      path: request.url || "/",
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(runtimeConfig.port, "0.0.0.0", () => resolve());
  });

  logger.log(
    `Worker listening on http://localhost:${runtimeConfig.port} with concurrency=${runtimeConfig.concurrency}`,
  );
  logger.log(
    `BullMQ placeholder configured for ${runtimeConfig.queueConnection.url} (queue connection not established in Phase 1)`,
  );

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`Received ${signal}; shutting down worker`);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await app.close();
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

bootstrap().catch((error: unknown) => {
  logger.error(
    "Worker failed to start",
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
});
