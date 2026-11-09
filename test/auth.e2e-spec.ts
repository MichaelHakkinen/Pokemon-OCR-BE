import { createHash } from 'crypto';
import {
  bearer,
  createTestApp,
  login,
  TestContext,
  waitForOtp,
} from './helpers';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const decode = (jwt: string) =>
  JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

describe('Auth (e2e)', () => {
  let ctx: TestContext;
  let rootToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    rootToken = (await login(ctx)).token;
  });
  afterAll(() => ctx.close());

  // A throwaway admin per test that changes passwords, so seed data stays intact.
  async function createAdmin(suffix: string) {
    const group = await ctx.prisma.adminGroup.findUniqueOrThrow({
      where: { name: 'Admin' },
    });
    const admin = {
      fullname: `E2E ${suffix}`,
      username: `e2e-${suffix}`,
      email: `e2e-${suffix}@example.com`,
      phoneNumber: '+6281200000000',
      password: 'Start123!',
      adminGroupId: group.id,
      isActive: true,
    };
    await ctx
      .http()
      .post('/admin-account')
      .set(bearer(rootToken))
      .send(admin)
      .expect(201);
    return admin;
  }

  describe('sessions', () => {
    it('stores only a hash of the refresh token and puts the session in the JWT', async () => {
      const { token, refreshToken } = await login(ctx);
      const { sid, exp, iat } = decode(token);
      const row = await ctx.prisma.adminRefreshToken.findFirstOrThrow({
        where: { sessionId: sid },
      });
      expect(row.token).toBe(sha256(refreshToken));
      expect(exp - iat).toBe(15 * 60);
    });

    it('never returns the password hash', async () => {
      const res = await ctx
        .http()
        .get('/auth/profile')
        .set(bearer(rootToken))
        .expect(200);
      expect(res.body.data).not.toHaveProperty('password');
    });

    it('rotates refresh tokens and ends the session when an old one is replayed', async () => {
      const first = await login(ctx);
      const refreshed = await ctx
        .http()
        .post('/auth/refresh-token')
        .send({ refreshToken: first.refreshToken })
        .expect(200);
      const second = refreshed.body.data;
      expect(decode(second.token).sid).toBe(decode(first.token).sid);
      await ctx
        .http()
        .get('/auth/profile')
        .set(bearer(second.token))
        .expect(200);

      // replay the already-rotated token
      await ctx
        .http()
        .post('/auth/refresh-token')
        .send({ refreshToken: first.refreshToken })
        .expect(401);
      await ctx
        .http()
        .get('/auth/profile')
        .set(bearer(second.token))
        .expect(401);
      await ctx
        .http()
        .post('/auth/refresh-token')
        .send({ refreshToken: second.refreshToken })
        .expect(401);
    });

    it('logout ends only that session', async () => {
      const deviceA = await login(ctx);
      const deviceB = await login(ctx);
      await ctx
        .http()
        .post('/auth/logout')
        .send({ refreshToken: deviceA.refreshToken })
        .expect(200);
      await ctx
        .http()
        .get('/auth/profile')
        .set(bearer(deviceA.token))
        .expect(401);
      await ctx
        .http()
        .get('/auth/profile')
        .set(bearer(deviceB.token))
        .expect(200);
    });
  });

  describe('forgot / verify / reset password', () => {
    it('runs the full OTP flow and signs out every session', async () => {
      const admin = await createAdmin('reset');
      const session = await login(ctx, admin);

      await ctx
        .http()
        .post('/auth/forgot-password')
        .send({ email: admin.email })
        .expect(200);
      const otp = await waitForOtp(ctx, admin.email);
      expect(otp).toMatch(/^\d{6}$/);

      const stored = await ctx.prisma.adminResetPassword.findFirstOrThrow({
        where: { admin: { username: admin.username }, deletedAt: null },
      });
      expect(stored.otp).toBe(sha256(otp));

      const verified = await ctx
        .http()
        .post('/auth/verify-otp')
        .send({ email: admin.email, otp })
        .expect(200);
      const resetToken = verified.body.data.token;

      await ctx
        .http()
        .post('/auth/reset-password')
        .send({ token: resetToken, password: 'Reset123!' })
        .expect(200);

      await ctx
        .http()
        .get('/auth/profile')
        .set(bearer(session.token))
        .expect(401);
      await ctx
        .http()
        .post('/auth')
        .send({ username: admin.username, password: 'Start123!' })
        .expect(422);
      await login(ctx, { username: admin.username, password: 'Reset123!' });
      // reset tokens are single-use
      await ctx
        .http()
        .post('/auth/reset-password')
        .send({ token: resetToken, password: 'Again123!' })
        .expect(400);
    });

    it('invalidates an OTP after OTP_MAX_ATTEMPTS wrong guesses', async () => {
      const admin = await createAdmin('attempts');
      await ctx
        .http()
        .post('/auth/forgot-password')
        .send({ email: admin.email })
        .expect(200);
      const otp = await waitForOtp(ctx, admin.email);
      const wrong = otp === '000000' ? '111111' : '000000';

      for (let i = 0; i < 5; i++) {
        await ctx
          .http()
          .post('/auth/verify-otp')
          .send({ email: admin.email, otp: wrong })
          .expect(400);
      }
      const res = await ctx
        .http()
        .post('/auth/verify-otp')
        .send({ email: admin.email, otp })
        .expect(400);
      expect(res.body.message.en).toMatch(/too many incorrect attempts/i);
    });

    it('validates OTP length', async () => {
      await ctx
        .http()
        .post('/auth/verify-otp')
        .send({ email: 'superadmin@example.com', otp: '1234' })
        .expect(422);
    });

    it('answers registered and unknown emails the same way', async () => {
      const admin = await createAdmin('enum');
      const ask = (email: string) =>
        ctx.http().post('/auth/forgot-password').send({ email });

      const [known, unknown] = await Promise.all([
        ask(admin.email),
        ask('nobody-at-all@example.com'),
      ]);
      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(known.body).toEqual(unknown.body);

      // A quick resend is refused for both, not only for real accounts
      const [knownAgain, unknownAgain] = await Promise.all([
        ask(admin.email),
        ask('nobody-at-all@example.com'),
      ]);
      expect(knownAgain.status).toBe(400);
      expect(unknownAgain.status).toBe(400);
      expect(knownAgain.body).toEqual(unknownAgain.body);

      // ...and only the real account actually received an OTP
      await waitForOtp(ctx, admin.email);
      expect(
        ctx.sentOtps.some((m) => m.to === 'nobody-at-all@example.com'),
      ).toBe(false);
    });
  });

  it('change password keeps the current session and ends the others', async () => {
    const admin = await createAdmin('change');
    const current = await login(ctx, admin);
    const other = await login(ctx, admin);

    await ctx
      .http()
      .post('/auth/change-password')
      .set(bearer(current.token))
      .send({
        oldPassword: 'Start123!',
        newPassword: 'Change123!',
        confirmNewPassword: 'Change123!',
      })
      .expect(200);

    await ctx
      .http()
      .get('/auth/profile')
      .set(bearer(current.token))
      .expect(200);
    await ctx.http().get('/auth/profile').set(bearer(other.token)).expect(401);
  });
});
