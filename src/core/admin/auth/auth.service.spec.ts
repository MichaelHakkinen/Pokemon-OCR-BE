import {
  BadRequestException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { hashSecret } from 'src/common/helpers/token.helper';
import { MemoryStore } from 'src/common/services/memory-store';
import { testConfig } from 'src/common/config/config.testing';

const ADMIN = {
  id: 'admin-1',
  fullname: 'Admin One',
  email: 'admin@example.com',
  password: 'hash',
  avatar: null,
  phoneNumber: null,
  isActive: true,
  deletedAt: null,
};

function createPrismaMock() {
  const prisma: any = {
    admin: { update: jest.fn().mockResolvedValue({}) },
    adminResetPassword: {
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    adminRefreshToken: {
      create: jest.fn().mockResolvedValue({ sessionId: 'session-1' }),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  prisma.$transaction = jest.fn((arg) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
  );
  return prisma;
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let adminModel: any;
  let mailService: any;
  let jwtService: any;
  let helperService: any;
  let store: MemoryStore;
  let service: AuthService;
  let makeService: (overrides?: Record<string, string>) => AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    adminModel = {
      findByEmail: jest.fn().mockResolvedValue(ADMIN),
      findByUsername: jest.fn().mockResolvedValue(ADMIN),
    };
    mailService = { sendForgotPasswordOtp: jest.fn().mockResolvedValue({}) };
    jwtService = { signAsync: jest.fn().mockResolvedValue('access-token') };
    helperService = {
      comparePassword: jest.fn().mockResolvedValue(true),
      validatePassword: jest.fn().mockResolvedValue(true),
      generateFileUrl: jest.fn(),
      logAction: jest.fn(),
    };
    const adminAccess: any = {
      getGroupDetail: jest.fn().mockResolvedValue({ groups: [], modules: [] }),
    };

    store = new MemoryStore();
    const redis: any = {
      incr: async (key: string) => store.incr(key),
      expire: async (key: string, ttl: number) => store.expire(key, ttl),
    };

    // Builds the service with schema defaults (OTP_LENGTH 6, 5 attempts,
    // 60 s resend delay, 3d refresh tokens) plus any overrides.
    makeService = (overrides = {}) => {
      const built = new AuthService(
        jwtService,
        helperService,
        {} as any,
        mailService,
        adminAccess,
        prisma,
        adminModel,
        redis,
        testConfig(overrides),
      );
      jest
        .spyOn((built as any).logger, 'error')
        .mockImplementation(() => undefined);
      return built;
    };
    service = makeService();
  });

  afterEach(() => store.clear());

  describe('forgotPassword', () => {
    // Background work (store OTP + send email) finishes on shutdown drain.
    const drain = () => service.onModuleDestroy();

    it('emails an OTP of OTP_LENGTH digits but stores only its hash', async () => {
      service = makeService({ OTP_LENGTH: '4' });
      await service.forgotPassword({ email: ADMIN.email });
      await drain();

      const { otp } = mailService.sendForgotPasswordOtp.mock.calls[0][0];
      expect(otp).toMatch(/^\d{4}$/);

      const stored = prisma.adminResetPassword.create.mock.calls[0][0].data;
      expect(stored.otp).toBe(hashSecret(otp));
      expect(stored.otp).not.toBe(otp);
    });

    it('retires earlier OTPs so only one is live', async () => {
      await service.forgotPassword({ email: ADMIN.email });
      await drain();

      expect(prisma.adminResetPassword.updateMany).toHaveBeenCalledWith({
        where: { adminId: ADMIN.id, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('does not reveal whether the email exists', async () => {
      adminModel.findByEmail.mockResolvedValue(null);
      await expect(
        service.forgotPassword({ email: 'nobody@example.com' }),
      ).resolves.toBe(true);
      await drain();
      expect(mailService.sendForgotPasswordOtp).not.toHaveBeenCalled();
      expect(prisma.adminResetPassword.create).not.toHaveBeenCalled();
    });

    it.each([
      ['registered', ADMIN.email],
      ['unknown', 'nobody@example.com'],
    ])(
      'enforces the resend delay for %s emails alike',
      async (_label, email) => {
        if (email !== ADMIN.email)
          adminModel.findByEmail.mockResolvedValue(null);
        await service.forgotPassword({ email });
        await expect(service.forgotPassword({ email })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it('keys the resend delay case-insensitively', async () => {
      await service.forgotPassword({ email: 'Admin@Example.com' });
      await expect(
        service.forgotPassword({ email: ' admin@example.com ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('responds before the email is sent', async () => {
      let finishSending: () => void = () => undefined;
      mailService.sendForgotPasswordOtp.mockImplementation(
        () => new Promise<void>((resolve) => (finishSending = resolve)),
      );

      await expect(
        service.forgotPassword({ email: ADMIN.email }),
      ).resolves.toBe(true);
      finishSending();
      await drain();
    });

    it('logs email failures instead of failing the request', async () => {
      mailService.sendForgotPasswordOtp.mockRejectedValue(
        new Error('SMTP down'),
      );

      await expect(
        service.forgotPassword({ email: ADMIN.email }),
      ).resolves.toBe(true);
      await drain();
      expect((service as any).logger.error).toHaveBeenCalledWith(
        expect.stringContaining('SMTP down'),
        expect.anything(),
      );
    });
  });

  describe('verifyOtp', () => {
    const request = { id: 'reset-1', otp: hashSecret('123456') };

    beforeEach(() =>
      prisma.adminResetPassword.findFirst.mockResolvedValue(request),
    );

    it('returns a reset token and stores only its hash', async () => {
      const { token } = await service.verifyOtp({
        email: ADMIN.email,
        otp: '123456',
      });

      const update = prisma.adminResetPassword.update.mock.calls[0][0];
      expect(update.data.resetToken).toBe(hashSecret(token));
      expect(update.data.otpVerifiedAt).toBeInstanceOf(Date);
    });

    it('reserves an attempt atomically before comparing', async () => {
      await service
        .verifyOtp({ email: ADMIN.email, otp: '000000' })
        .catch(() => undefined);

      expect(prisma.adminResetPassword.updateMany).toHaveBeenCalledWith({
        where: { id: request.id, failedAttempts: { lt: 5 } },
        data: { failedAttempts: { increment: 1 } },
      });
    });

    it('rejects a wrong OTP', async () => {
      await expect(
        service.verifyOtp({ email: ADMIN.email, otp: '000000' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.adminResetPassword.update).not.toHaveBeenCalled();
    });

    it('invalidates the OTP once attempts are used up, even if correct', async () => {
      prisma.adminResetPassword.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.verifyOtp({ email: ADMIN.email, otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.adminResetPassword.update).toHaveBeenCalledWith({
        where: { id: request.id },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('resetPassword', () => {
    it('signs out every session', async () => {
      prisma.adminResetPassword.findFirst = jest
        .fn()
        .mockResolvedValue({ id: 'reset-1', admin: ADMIN });

      await service.resetPassword({ token: 'raw', password: 'NewPass123!' });

      expect(prisma.adminResetPassword.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resetToken: hashSecret('raw') }),
        }),
      );
      expect(prisma.adminRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { adminId: ADMIN.id, isRevoked: false },
        data: { isRevoked: true },
      });
    });
  });

  describe('login', () => {
    it('stores a hashed refresh token and puts the session id in the JWT', async () => {
      const result = await service.login({
        username: 'admin',
        password: 'pw',
      });

      const created = prisma.adminRefreshToken.create.mock.calls[0][0].data;
      expect(created.token).toBe(hashSecret(result.refreshToken));
      expect(jwtService.signAsync.mock.calls[0][0]).toMatchObject({
        sub: ADMIN.id,
        sid: 'session-1',
      });
    });

    it('runs a bcrypt comparison even for unknown usernames (no timing leak)', async () => {
      adminModel.findByUsername.mockResolvedValue(null);
      helperService.comparePassword.mockResolvedValue(true); // must not matter

      await expect(
        service.login({ username: 'nobody', password: 'pw' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(helperService.comparePassword).toHaveBeenCalledTimes(1);
      const [, hash] = helperService.comparePassword.mock.calls[0];
      expect(hash).toMatch(/^\$2[aby]\$10\$/); // same cost as real hashes
      expect(prisma.adminRefreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a wrong password', async () => {
      helperService.comparePassword.mockResolvedValue(false);
      await expect(
        service.login({ username: 'admin', password: 'bad' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('refreshToken', () => {
    const stored = {
      id: 'rt-1',
      sessionId: 'session-1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 60_000),
      admin: ADMIN,
    };

    it('rotates within the same session', async () => {
      prisma.adminRefreshToken.findUnique.mockResolvedValue(stored);

      const result = await service.refreshToken('raw-token');

      expect(prisma.adminRefreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: hashSecret('raw-token') } }),
      );
      const created = prisma.adminRefreshToken.create.mock.calls[0][0].data;
      expect(created.sessionId).toBe('session-1');
      expect(created.token).toBe(hashSecret(result.refreshToken));
    });

    it('treats reuse of a revoked token as theft and ends the session', async () => {
      prisma.adminRefreshToken.findUnique.mockResolvedValue({
        ...stored,
        isRevoked: true,
      });

      await expect(service.refreshToken('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.adminRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1', isRevoked: false },
        data: { isRevoked: true },
      });
      expect(prisma.adminRefreshToken.create).not.toHaveBeenCalled();
    });

    it('lets only one of two concurrent refreshes win', async () => {
      prisma.adminRefreshToken.findUnique.mockResolvedValue(stored);
      prisma.adminRefreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.refreshToken('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.adminRefreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      prisma.adminRefreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refreshToken('nope')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('ends the whole session the token belongs to', async () => {
      prisma.adminRefreshToken.findUnique.mockResolvedValue({
        sessionId: 'session-1',
      });

      await service.logout('raw-token');

      expect(prisma.adminRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1', isRevoked: false },
        data: { isRevoked: true },
      });
    });
  });
});
