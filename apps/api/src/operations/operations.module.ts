import { Module } from "@nestjs/common";
import { SecurityModule } from "../security/security.module.js";
import { AmenityController } from "./amenity.controller.js";
import { AmenityRepository } from "./amenity.repository.js";
import { AmenityService } from "./amenity.service.js";
import { AssetController } from "./asset.controller.js";
import { AssetRepository } from "./asset.repository.js";
import { AssetService } from "./asset.service.js";
import { IncidentController } from "./incident.controller.js";
import { IncidentRepository } from "./incident.repository.js";
import { IncidentService } from "./incident.service.js";
import { PackageController } from "./package.controller.js";
import { PackageRepository } from "./package.repository.js";
import { PackageService } from "./package.service.js";
import { ParkingController } from "./parking.controller.js";
import { ParkingRepository } from "./parking.repository.js";
import { ParkingService } from "./parking.service.js";
import { StaffController } from "./staff.controller.js";
import { StaffRepository } from "./staff.repository.js";
import { StaffService } from "./staff.service.js";
import { VisitorController } from "./visitor.controller.js";
import { VisitorRepository } from "./visitor.repository.js";
import { VisitorService } from "./visitor.service.js";

@Module({
  imports: [SecurityModule],
  controllers: [
    VisitorController,
    PackageController,
    StaffController,
    ParkingController,
    AmenityController,
    AssetController,
    IncidentController,
  ],
  providers: [
    VisitorRepository,
    VisitorService,
    PackageRepository,
    PackageService,
    StaffRepository,
    StaffService,
    ParkingRepository,
    ParkingService,
    AmenityRepository,
    AmenityService,
    AssetRepository,
    AssetService,
    IncidentRepository,
    IncidentService,
  ],
  exports: [
    VisitorService,
    PackageService,
    StaffService,
    ParkingService,
    AmenityService,
    AssetService,
    IncidentService,
  ],
})
export class OperationsModule {}
