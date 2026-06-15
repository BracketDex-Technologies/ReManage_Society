import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { RequestIdMiddleware } from "./common/request-id.middleware.js";
import { SecurityHeadersMiddleware } from "./common/security-headers.middleware.js";
import { CommunityModule } from "./community/community.module.js";
import { FinanceCoreModule } from "./finance-core/finance-core.module.js";
import { OperationsModule } from "./operations/operations.module.js";
import { SecurityModule } from "./security/security.module.js";
import { SocietyCoreModule } from "./society-core/society-core.module.js";

@Module({
  imports: [
    HealthModule,
    SecurityModule,
    SocietyCoreModule,
    FinanceCoreModule,
    OperationsModule,
    CommunityModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityHeadersMiddleware, RequestIdMiddleware).forRoutes("*");
  }
}

