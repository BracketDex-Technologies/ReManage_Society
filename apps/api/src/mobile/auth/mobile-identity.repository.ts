import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../../packages/db/src/index.ts";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import {
  isPermissionRoleValidForMobileRole,
  normalizeMobileRole,
  type MobilePermissionRole,
  type MobileRole,
} from "../common/mobile-role.ts";

export interface MobileIdentity {
  userId: string;
  name: string;
  email: string;
  passwordHash: string;
  societyId: string;
  societyName: string;
  membershipId: string;
  flatId: string | null;
  roles: readonly {
    role: MobileRole;
    permissionRole: MobilePermissionRole;
  }[];
}

interface MobileIdentityUserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  memberships: {
    id: string;
    societyId: string;
    flatId: string | null;
    society: { name: string };
    roleAssignments: {
      role: string;
      permissionRole: string;
      revokedAt: Date | null;
    }[];
  }[];
}

export interface MobileIdentityPersistenceClient {
  user: {
    findFirst(input: unknown): Promise<MobileIdentityUserRecord | null>;
  };
}

@Injectable()
export class MobileIdentityRepository {
  constructor(
    private readonly client: MobileIdentityPersistenceClient =
      prisma as unknown as MobileIdentityPersistenceClient,
    private readonly config: MobileConfigService = new MobileConfigService(),
  ) {}

  async findApprovedByEmail(identifier: string): Promise<MobileIdentity | null> {
    const email = identifier.trim().toLowerCase();
    const user = await this.client.user.findFirst({
      where: {
        email,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        memberships: {
          where: {
            societyId: this.config.value.betaSocietyId,
            status: "active",
          },
          take: 1,
          select: {
            id: true,
            societyId: true,
            flatId: true,
            society: { select: { name: true } },
            roleAssignments: {
              where: { revokedAt: null },
              select: {
                role: true,
                permissionRole: true,
                revokedAt: true,
              },
            },
          },
        },
      },
    });
    const membership = user?.memberships[0];
    if (!user || !membership) return null;

    const roles = new Map<
      MobileRole,
      { role: MobileRole; permissionRole: MobilePermissionRole }
    >();
    for (const assignment of membership.roleAssignments) {
      if (assignment.revokedAt) continue;
      const role = normalizeMobileRole(assignment.role);
      if (!role || !isPermissionRoleValidForMobileRole(role, assignment.permissionRole)) {
        continue;
      }
      if (!roles.has(role)) {
        roles.set(role, { role, permissionRole: assignment.permissionRole });
      }
    }
    if (roles.size === 0) return null;

    return {
      userId: user.id,
      name: user.name,
      email,
      passwordHash: user.password,
      societyId: membership.societyId,
      societyName: membership.society.name,
      membershipId: membership.id,
      flatId: membership.flatId,
      roles: [...roles.values()],
    };
  }
}
