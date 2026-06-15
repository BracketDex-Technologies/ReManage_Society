import { Module } from "@nestjs/common";
import { SecurityModule } from "../security/security.module.js";
import { SocietyCoreController } from "./society-core.controller.js";
import { SocietyCoreRepository } from "./society-core.repository.js";
import { SocietyCoreService } from "./society-core.service.js";

@Module({
  imports: [SecurityModule],
  controllers: [SocietyCoreController],
  providers: [SocietyCoreRepository, SocietyCoreService],
  exports: [SocietyCoreService],
})
export class SocietyCoreModule {}
