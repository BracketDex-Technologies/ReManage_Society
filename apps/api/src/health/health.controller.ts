import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  DatabaseReadinessService,
  DatabaseReadinessSnapshot,
} from "../database/database-readiness.service.js";

interface HealthResponse {
  service: "api";
  status: "ok";
  timestamp: string;
}

interface ApiReadinessResponse extends HealthResponse {
  checks: {
    database: DatabaseReadinessSnapshot;
  };
}

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly databaseReadiness: DatabaseReadinessService) {}

  @Get("live")
  @ApiOkResponse({ description: "The API process is running." })
  live(): HealthResponse {
    return this.ok();
  }

  @Get("ready")
  @ApiOkResponse({ description: "The API is ready to receive traffic." })
  async ready(): Promise<ApiReadinessResponse> {
    const database = await this.databaseReadiness.snapshot();
    const response: ApiReadinessResponse = {
      ...this.ok(),
      checks: {
        database,
      },
    };

    if (database.status !== "ok") {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  private ok(): HealthResponse {
    return {
      service: "api",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}

