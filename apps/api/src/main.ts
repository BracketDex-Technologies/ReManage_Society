import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { SwaggerModule } from "@nestjs/swagger";
import { assertProductionReady } from "../../../packages/config/src/production.ts";
import { AppModule } from "./app.module.js";
import { ProblemJsonFilter } from "./common/problem-json.filter.js";
import { createSocietyOpenApiDocument } from "./openapi.js";

const logger = new Logger("ApiBootstrap");

async function bootstrap() {
  assertProductionReady(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      trustProxy: true,
    })
  );

  app.useGlobalFilters(new ProblemJsonFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: true,
      transform: true,
      whitelist: true,
    })
  );

  const allowedOrigin = process.env.API_CORS_ORIGIN || "http://localhost:3000";
  app.enableCors({
    credentials: true,
    origin: allowedOrigin,
  });

  const document = createSocietyOpenApiDocument(app);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.API_PORT || 4000);
  await app.listen(port, "0.0.0.0");
  logger.log(`API listening on http://localhost:${port}`);
}

bootstrap().catch((error: unknown) => {
  logger.error("API failed to start", error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

