import axios from 'axios';
import { testConfig } from 'src/common/config/config.testing';
import { MailRelayService } from './mail-relay.service';

jest.mock('axios');
const post = axios.post as jest.Mock;

describe('MailRelayService', () => {
  let service: MailRelayService;
  let mailRelayLogModel: { createLog: jest.Mock };

  beforeEach(() => {
    post.mockReset();
    mailRelayLogModel = { createLog: jest.fn().mockResolvedValue({}) };
    service = new MailRelayService(
      testConfig({
        MAIL_SERVICE_URL: 'http://marley.test',
        MAIL_VAULT_TOKEN: 'secret-token-abcd',
      }),
      mailRelayLogModel as any,
    );
  });

  it('posts to /send-mail with the vault token and logs a masked request', async () => {
    post.mockResolvedValue({ status: 200, headers: {}, data: { ok: true } });

    await service.sendMail('a@example.com', 'Hi', 'text', '<p>Hi</p>');

    expect(post).toHaveBeenCalledWith(
      'http://marley.test/send-mail',
      { to: ['a@example.com'], subject: 'Hi', html: '<p>Hi</p>' },
      {
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token-abcd',
        }),
        timeout: 15_000,
      },
    );
    const log = mailRelayLogModel.createLog.mock.calls[0][0];
    expect(log).toMatchObject({ isSuccess: true, responseStatus: 200 });
    expect(log.requestHeaders).toContain('Bearer ****abcd');
    expect(log.requestHeaders).not.toContain('secret-token');
  });

  it('fails with a clear, logged error when MAIL_SERVICE_URL is not set', async () => {
    const unset = new MailRelayService(
      testConfig({ MAIL_VAULT_TOKEN: 'secret-token-abcd' }),
      mailRelayLogModel as any,
    );

    await expect(
      unset.sendMail('a@example.com', 'Hi', 'text', '<p>Hi</p>'),
    ).rejects.toThrow('MAIL_SERVICE_URL is not set');
    expect(post).not.toHaveBeenCalled();
    expect(mailRelayLogModel.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        isSuccess: false,
        errorMessage: 'MAIL_SERVICE_URL is not set',
      }),
    );
  });

  it('skips every send when MAIL_SERVICE_ENABLED=false', async () => {
    const off = new MailRelayService(
      testConfig({ MAIL_SERVICE_ENABLED: 'false' }),
      mailRelayLogModel as any,
    );

    await expect(
      off.sendMail('a@example.com', 'Hi', 'text', '<p>Hi</p>'),
    ).resolves.toBeUndefined();
    await expect(
      off.sendForgotPasswordOtp({
        to: 'a@example.com',
        otp: '123456',
        fullname: 'Ana',
        expireMinutes: '5',
      }),
    ).resolves.toBeUndefined();
    expect(post).not.toHaveBeenCalled();
    expect(mailRelayLogModel.createLog).not.toHaveBeenCalled();
  });

  it('logs the failure and rethrows when Marley rejects the request', async () => {
    const error = Object.assign(new Error('Request failed'), {
      response: { status: 401, headers: {}, data: 'unauthorized' },
    });
    post.mockRejectedValue(error);

    await expect(
      service.sendMail('a@example.com', 'Hi', 'text', '<p>Hi</p>'),
    ).rejects.toBe(error);
    expect(mailRelayLogModel.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        isSuccess: false,
        responseStatus: 401,
        errorMessage: 'Request failed',
      }),
    );
  });

  it('still sends when writing the log fails', async () => {
    post.mockResolvedValue({ status: 200, headers: {}, data: {} });
    mailRelayLogModel.createLog.mockRejectedValue(new Error('db down'));

    await expect(
      service.sendMail('a@example.com', 'Hi', 'text', '<p>Hi</p>'),
    ).resolves.toBeUndefined();
  });

  it('rejects template names that could escape the mails directory', async () => {
    await expect(
      service.sendMailWithTemplate('a@example.com', 'Hi', '../secret', {}),
    ).rejects.toThrow('Invalid template name');
    expect(post).not.toHaveBeenCalled();
  });

  describe('built-in templates', () => {
    beforeEach(() =>
      post.mockResolvedValue({ status: 200, headers: {}, data: {} }),
    );
    const sentHtml = () => post.mock.calls[0][1].html as string;

    it('renders forgot-password with the OTP', async () => {
      await service.sendForgotPasswordOtp({
        to: 'a@example.com',
        otp: '123456',
        fullname: 'Ana',
        expireMinutes: '5',
      });
      expect(sentHtml()).toContain('123456');
      expect(sentHtml()).toContain('Hello Ana');
    });

    it('renders register-otp with the OTP', async () => {
      await service.sendRegisterOtp({
        to: 'a@example.com',
        otp: '654321',
        fullname: 'Ana',
        expireMinutes: '10',
      });
      expect(post.mock.calls[0][1].subject).toBe(
        'Verify Your Account - OTP Verification',
      );
      expect(sentHtml()).toContain('654321');
      expect(sentHtml()).toContain('<strong>10 minutes</strong>');
    });

    it('renders reset-password-link with the escaped link', async () => {
      await service.sendResetPasswordLink({
        to: 'a@example.com',
        fullname: '<b>Ana</b>',
        resetLink: 'https://app.example.com/reset?token=abc&x=1',
        expireMinutes: '30',
      });
      expect(sentHtml()).toContain(
        'href="https://app.example.com/reset?token&#x3D;abc&amp;x&#x3D;1"',
      );
      expect(sentHtml()).toContain('Hello &lt;b&gt;Ana&lt;/b&gt;');
    });
  });
});
