import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthGuard } from './AdminAuth.guard';

const contextFor = (request: any): any => ({
  switchToHttp: () => ({ getRequest: () => request }),
});

describe('AdminAuthGuard', () => {
  let jwt: any;
  let prisma: any;
  let adminModel: any;
  let guard: AdminAuthGuard;
  const request = () => ({ headers: { authorization: 'Bearer token' } }) as any;

  beforeEach(() => {
    jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'admin-1', sid: 's-1' }),
    };
    prisma = {
      adminRefreshToken: {
        findFirst: jest.fn().mockResolvedValue({ id: 'rt' }),
      },
    };
    adminModel = { findOne: jest.fn().mockResolvedValue({ id: 'admin-1' }) };
    const adminAccess: any = {
      getGroupDetail: jest.fn().mockResolvedValue({ groups: [], modules: [] }),
    };
    guard = new AdminAuthGuard(jwt, adminAccess, prisma, adminModel);
  });

  it('attaches the admin, session and permissions to the request', async () => {
    const req = request();
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(req.user).toMatchObject({
      id: 'admin-1',
      sessionId: 's-1',
      adminGroupDetail: { groups: [], modules: [] },
    });
  });

  it('checks the exact session named in the token', async () => {
    await guard.canActivate(contextFor(request()));
    expect(prisma.adminRefreshToken.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionId: 's-1',
          adminId: 'admin-1',
        }),
      }),
    );
  });

  it('throws when there is no bearer token', async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws on an invalid JWT', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('bad signature'));
    await expect(guard.canActivate(contextFor(request()))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects tokens without a session id', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'admin-1' });
    await expect(guard.canActivate(contextFor(request()))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token whose session was revoked (e.g. after logout)', async () => {
    prisma.adminRefreshToken.findFirst.mockResolvedValue(null);
    await expect(guard.canActivate(contextFor(request()))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects inactive or deleted admins', async () => {
    adminModel.findOne.mockResolvedValue(null);
    await expect(guard.canActivate(contextFor(request()))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
