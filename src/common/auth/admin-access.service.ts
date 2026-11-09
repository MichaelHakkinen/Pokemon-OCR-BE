import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/common/services/redis.service';
import { AdminModel } from 'src/models';

export type AdminGroupDetail = {
  groups: { id: string; name: string }[];
  modules: any[];
};

const CACHE_TTL_SECONDS = 300;
const VERSION_KEY = 'admin_access:version';

// Resolves an admin's groups + module/rule access, which every authenticated
// admin request needs. Cached in Redis under a global version number: any
// RBAC change calls invalidateAll(), bumping the version so every cached
// entry is skipped at once without having to know which admins it affected.
@Injectable()
export class AdminAccessService {
  constructor(
    private readonly redis: RedisService,
    private readonly adminModel: AdminModel,
  ) {}

  async getGroupDetail(adminId: string): Promise<AdminGroupDetail> {
    const version = (await this.redis.get(VERSION_KEY)) ?? '0';
    const cacheKey = `admin_access:${version}:${adminId}`;

    const cached = await this.redis.getJSON<AdminGroupDetail>(cacheKey);
    if (cached) return cached;

    const detail = await this.loadGroupDetail(adminId);
    await this.redis.setJSON(cacheKey, detail, CACHE_TTL_SECONDS);
    return detail;
  }

  async invalidateAll(): Promise<void> {
    await this.redis.incr(VERSION_KEY);
  }

  private async loadGroupDetail(adminId: string): Promise<AdminGroupDetail> {
    const adminGroups = await this.adminModel.getAdminGroups(adminId);
    const adminGroupAccess = await this.adminModel.getAdminGroupAccess(
      adminGroups.map((ag) => ag.adminGroupId),
    );

    return {
      groups: adminGroups.map((g) => ({
        id: g.adminGroup.id,
        name: g.adminGroup.name,
      })),
      modules: adminGroupAccess.map((access) => access.module),
    };
  }
}
