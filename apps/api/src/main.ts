import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { assertProductionReady } from "../../../packages/config/src/production.ts";
import { AppModule } from "./app.module.js";
import { ProblemJsonFilter } from "./common/problem-json.filter.js";

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

  const openApiConfig = new DocumentBuilder()
    .setTitle("Society Connect API")
    .setDescription("Production API scaffold for the society-management platform.")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.API_PORT || 4000);
  await app.listen(port, "0.0.0.0");
  logger.log(`API listening on http://localhost:${port}`);
}

bootstrap().catch((error: unknown) => {
  logger.error("API failed to start", error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

