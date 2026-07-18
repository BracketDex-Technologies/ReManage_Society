import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function createSocietyOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Society Connect API")
    .setDescription("Web, backend, and dedicated ReManage mobile contracts.")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config);
}
