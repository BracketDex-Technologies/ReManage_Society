import { Module } from "@nestjs/common";
import { WorkerHealthService } from "./health/worker-health.js";

@Module({
  providers: [WorkerHealthService],
  exports: [WorkerHealthService],
})
export class AppModule {}
