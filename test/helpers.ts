import { Type } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { MailService } from 'src/mail/mail.service';
import { MailRelayService } from 'src/mail-relay/mail-relay.service';
import { PrismaService } from 'src/prisma/prisma.service';

export type SentOtp = { to: string; otp: string };

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  sentOtps: SentOtp[];
  /** Request from a fresh client IP (each call gets a new X-Forwarded-For). */
  http: () => ReturnType<typeof agentFor>;
  /** Request pinned to one client IP — for rate-limit tests. */
  httpFrom: (ip: string) => ReturnType<typeof agentFor>;
  close: () => Promise<void>;
}

let ipCounter = 0;
const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

function agentFor(app: NestExpressApplication, ip: string) {
  const server = app.getHttpServer();
  const withIp = (req: request.Test) => req.set('X-Forwarded-For', ip);
  return {
    get: (url: string) => withIp(request(server).get(url)),
    post: (url: string) => withIp(request(server).post(url)),
    put: (url: string) => withIp(request(server).put(url)),
    delete: (url: string) => withIp(request(server).delete(url)),
  };
}

// Boots the real AppModule with configureApp() (as main.ts does). Only the
// mail senders (SMTP and the Marley relay) are replaced, so OTP emails are
// captured instead of sent.
export async function createTestApp(
  options: { controllers?: Type<unknown>[] } = {},
): Promise<TestContext> {
  const sentOtps: SentOtp[] = [];
  const fakeMail = {
    sendForgotPasswordOtp: async ({ to, otp }: SentOtp) => {
      sentOtps.push({ to, otp });
    },
    sendRegisterOtp: async ({ to, otp }: SentOtp) => {
      sentOtps.push({ to, otp });
    },
    sendResetPasswordLink: async () => undefined,
    sendMail: async () => undefined,
    sendMailWithTemplate: async () => undefined,
  };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    // extra controllers let a suite exercise features no real route uses yet
    controllers: options.controllers ?? [],
  })
    .overrideProvider(MailService)
    .useValue(fakeMail)
    .overrideProvider(MailRelayService)
    .useValue(fakeMail)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configureApp(app);
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    sentOtps,
    http: () => agentFor(app, nextIp()),
    httpFrom: (ip) => agentFor(app, ip),
    close: () => app.close(),
  };
}

export const SUPERADMIN = { username: 'superadmin', password: 'Admin123!' };

export async function login(
  ctx: TestContext,
  credentials: { username: string; password: string } = SUPERADMIN,
) {
  // Only the login fields: the API rejects unknown properties with a 422.
  const { username, password } = credentials;
  const res = await ctx
    .http()
    .post('/auth')
    .send({ username, password })
    .expect(200);
  return res.body.data as {
    token: string;
    refreshToken: string;
    user: { id: string };
  };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** OTP emails are sent in the background; poll until one reaches `to`. */
export async function waitForOtp(
  ctx: TestContext,
  to: string,
  timeoutMs = 5000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const sent = [...ctx.sentOtps].reverse().find((m) => m.to === to);
    if (sent) return sent.otp;
    if (Date.now() > deadline) throw new Error(`No OTP email sent to ${to}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}
