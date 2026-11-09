import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';

const ROOT_CALLER = {
  id: 'root-1',
  adminGroupDetail: { groups: [{ id: 'g0', name: '*root' }], modules: [] },
};
const OPS_CALLER = {
  id: 'ops-1',
  adminGroupDetail: { groups: [{ id: 'g1', name: 'Ops' }], modules: [] },
};

describe('AdminService account protections', () => {
  let prisma: any;
  let adminModel: any;
  let storage: any;
  let service: AdminService;
  let rootIds: Set<string>;
  let activeRootCount: number;

  beforeEach(() => {
    rootIds = new Set(['root-1', 'root-2']);
    activeRootCount = 2;
    prisma = {
      adminGroupMember: {
        findFirst: jest.fn(async ({ where }) =>
          rootIds.has(where.adminId) ? { id: 'm' } : null,
        ),
        count: jest.fn(
          async ({ where }) =>
            activeRootCount - (rootIds.has(where.adminId.not) ? 1 : 0),
        ),
      },
      adminGroup: {
        findUnique: jest.fn(async ({ where }) =>
          where.id === 'root-group' ? { name: '*root' } : { name: 'Ops' },
        ),
      },
    };
    adminModel = {
      findOneIgnoreStatus: jest.fn(async (id: string) => ({
        id,
        avatar: 'old.png',
      })),
    };
    storage = { deleteFile: jest.fn(), uploadFile: jest.fn() };
    service = new AdminService(
      {} as any,
      storage,
      {} as any,
      prisma,
      adminModel,
    );
  });

  const update = (target: string, caller: any, dto: any = {}) =>
    service.update(
      target,
      dto,
      undefined,
      caller.id,
      { user: caller },
      'Admin Management',
    );
  const remove = (target: string, caller: any) =>
    service.delete(target, caller.id, { user: caller }, 'Admin Management');

  it('blocks a non-root admin from editing a root admin', async () => {
    await expect(
      update('root-2', OPS_CALLER, { password: 'X' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('checks before touching files (no avatar deleted on a refused update)', async () => {
    await expect(
      service.update(
        'root-2',
        {} as any,
        { buffer: Buffer.alloc(1) } as any,
        OPS_CALLER.id,
        { user: OPS_CALLER },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.deleteFile).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('blocks a non-root admin from deleting a root admin', async () => {
    await expect(remove('root-2', OPS_CALLER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks deleting or deactivating your own account', async () => {
    await expect(remove('ops-1', OPS_CALLER)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      update('ops-1', OPS_CALLER, { isActive: false }),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks removing the last active root admin', async () => {
    rootIds = new Set(['root-1', 'root-2']);
    activeRootCount = 1; // only root-2 is active
    await expect(remove('root-2', ROOT_CALLER)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      update('root-2', ROOT_CALLER, { isActive: false }),
    ).rejects.toThrow(BadRequestException);
  });

  it('only lets root assign the *root group', async () => {
    await expect(
      update('ops-2', OPS_CALLER, { adminGroupId: 'root-group' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.create(
        { adminGroupId: 'root-group' } as any,
        undefined,
        OPS_CALLER.id,
        {
          user: OPS_CALLER,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
