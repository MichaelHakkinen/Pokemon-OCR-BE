import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from 'src/common/config/env.validation';
import { MailRelayLogModel } from 'src/models';

const SEND_TIMEOUT_MS = 15_000;

export type MailAttachment = {
  filename: string;
  content: string;
  contentType: string;
  encoding: string;
};

/**
 * Sends email through Marley, the office HTTP mail relay, instead of SMTP.
 * Same public API as MailService, so callers can switch by swapping the
 * injection. Every request/response is recorded in mail_relay_logs.
 */
@Injectable()
export class MailRelayService {
  private readonly logger = new Logger(MailRelayService.name);
  private readonly enabled: boolean;
  private readonly serviceUrl?: string;
  private readonly vaultToken: string;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly mailRelayLogModel: MailRelayLogModel,
  ) {
    this.enabled = config.get('MAIL_SERVICE_ENABLED');
    this.serviceUrl = config.get('MAIL_SERVICE_URL');
    this.vaultToken = config.get('MAIL_VAULT_TOKEN') ?? '';
    if (!this.enabled) {
      this.logger.warn(
        'Mail relay is off (MAIL_SERVICE_ENABLED=false): emails sent through MailRelayService are skipped.',
      );
    } else if (!this.serviceUrl) {
      this.logger.warn(
        'MAIL_SERVICE_URL is not set: emails sent through MailRelayService will fail.',
      );
    }
  }

  private async dispatch(
    to: string,
    subject: string,
    html: string,
    attachments?: MailAttachment[],
    templateName?: string,
  ): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(`Mail relay is off: not sending "${subject}" to ${to}`);
      return;
    }

    const url = `${this.serviceUrl}/send-mail`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.vaultToken}`,
    };
    const body: Record<string, any> = { to: [to], subject, html };
    if (attachments?.length) body.attachments = attachments;

    const startedAt = Date.now();
    try {
      if (!this.serviceUrl) throw new Error('MAIL_SERVICE_URL is not set');
      // Bounded, so a hung relay can't stall a request or block shutdown
      const response = await axios.post(url, body, {
        headers,
        timeout: SEND_TIMEOUT_MS,
      });
      this.writeLog({
        url,
        to,
        subject,
        templateName,
        headers,
        body,
        startedAt,
        status: response.status,
        responseHeaders: response.headers,
        responseBody: response.data,
        isSuccess: true,
      });
      this.logger.log(`Send Email "${subject}" to ${to}`);
    } catch (error: any) {
      // error.response is absent on network failures (timeout, ECONNREFUSED, DNS)
      this.writeLog({
        url,
        to,
        subject,
        templateName,
        headers,
        body,
        startedAt,
        status: error.response?.status,
        responseHeaders: error.response?.headers,
        responseBody: error.response?.data,
        isSuccess: false,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Persist one Marley request/response pair. Fire-and-forget: a logging
   * failure must never change the outcome of sending the email.
   */
  private writeLog(params: {
    url: string;
    to: string;
    subject: string;
    templateName?: string;
    headers: Record<string, string>;
    body: Record<string, any>;
    startedAt: number;
    status?: number;
    responseHeaders?: any;
    responseBody?: any;
    isSuccess: boolean;
    errorMessage?: string;
  }): void {
    this.mailRelayLogModel
      .createLog({
        method: 'POST',
        url: params.url,
        recipient: params.to,
        subject: params.subject,
        templateName: params.templateName ?? null,
        requestHeaders: this.stringify(this.maskHeaders(params.headers)),
        requestBody: this.stringify(this.stripAttachmentContent(params.body)),
        responseStatus: params.status ?? null,
        responseHeaders: this.stringify(params.responseHeaders),
        responseBody: this.stringify(params.responseBody),
        isSuccess: params.isSuccess,
        errorMessage: params.errorMessage ?? null,
        durationMs: Date.now() - params.startedAt,
      })
      .catch((err) =>
        this.logger.error('Failed to write mail relay log', err as Error),
      );
  }

  private maskHeaders(headers: Record<string, string>): Record<string, string> {
    const token = this.vaultToken;
    const masked = token ? `Bearer ****${token.slice(-4)}` : 'Bearer (empty)';
    return { ...headers, Authorization: masked };
  }

  // Keep attachment metadata but drop the base64 payload so rows stay small.
  private stripAttachmentContent(
    body: Record<string, any>,
  ): Record<string, any> {
    if (!body.attachments?.length) return body;
    return {
      ...body,
      attachments: body.attachments.map((a: MailAttachment) => ({
        ...a,
        content: `<omitted ${a.content?.length ?? 0} chars>`,
      })),
    };
  }

  private stringify(value: any): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  async sendMail(
    to: string,
    subject: string,
    _text: string,
    html: string,
  ): Promise<void> {
    await this.dispatch(to, subject, html);
  }

  async sendMailWithTemplate(
    to: string,
    subject: string,
    templateName: string,
    context: Record<string, any>,
    attachments?: MailAttachment[],
  ): Promise<void> {
    if (!this.isValidTemplateName(templateName)) {
      throw new Error('Invalid template name');
    }

    const templatePath = path.join(
      process.cwd(),
      'mails',
      `${templateName}.hbs`,
    );
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template ${templateName} not found`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource, {
      strict: true,
      noEscape: false,
    });
    const html = template(this.sanitizeContext(context));

    await this.dispatch(to, subject, html, attachments, templateName);
  }

  private isValidTemplateName(templateName: string): boolean {
    return (
      /^[a-zA-Z0-9_-]+$/.test(templateName) && !templateName.includes('..')
    );
  }

  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(context)) {
      if (key !== '__proto__' && key !== 'constructor') {
        sanitized[key] = context[key];
      }
    }
    return sanitized;
  }

  async sendForgotPasswordOtp(params: {
    to: string;
    otp: string;
    fullname: string;
    expireMinutes: string;
  }): Promise<void> {
    return this.sendMailWithTemplate(
      params.to,
      'Reset Your Password - OTP Verification',
      'forgot-password',
      {
        otp: params.otp,
        fullname: params.fullname,
        expireMinutes: params.expireMinutes,
        currentYear: new Date().getFullYear(),
      },
    );
  }

  async sendRegisterOtp(params: {
    to: string;
    otp: string;
    fullname: string;
    expireMinutes: string;
  }): Promise<void> {
    return this.sendMailWithTemplate(
      params.to,
      'Verify Your Account - OTP Verification',
      'register-otp',
      {
        otp: params.otp,
        fullname: params.fullname,
        expireMinutes: params.expireMinutes,
      },
    );
  }

  async sendResetPasswordLink(params: {
    to: string;
    fullname: string;
    resetLink: string;
    expireMinutes: string;
  }): Promise<void> {
    return this.sendMailWithTemplate(
      params.to,
      'Reset Your Password',
      'reset-password-link',
      {
        fullname: params.fullname,
        resetLink: params.resetLink,
        expireMinutes: params.expireMinutes,
      },
    );
  }
}
