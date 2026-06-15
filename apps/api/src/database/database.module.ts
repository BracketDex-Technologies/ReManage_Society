import { Module } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  DATABASE_PING_CLIENT,
  DATABASE_READINESS_OPTIONS,
  DatabaseReadinessService,
} from "./database-readiness.service.js";

@Module({
  providers: [
    {
      provide: DATABASE_PING_CLIENT,
      useValue: prisma,
    },
    {
      provide: DATABASE_READINESS_OPTIONS,
      useValue: {},
    },
    DatabaseReadinessService,
  ],
  exports: [DatabaseReadinessService],
})
export class DatabaseModule {}
