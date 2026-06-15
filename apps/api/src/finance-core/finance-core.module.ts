import { Module } from "@nestjs/common";
import { SecurityModule } from "../security/security.module.js";
import { FinanceCoreController } from "./finance-core.controller.js";
import { FinanceCoreRepository } from "./finance-core.repository.js";
import { FinanceCoreService } from "./finance-core.service.js";

@Module({
  imports: [SecurityModule],
  controllers: [FinanceCoreController],
  providers: [FinanceCoreRepository, FinanceCoreService],
  exports: [FinanceCoreService],
})
export class FinanceCoreModule {}
