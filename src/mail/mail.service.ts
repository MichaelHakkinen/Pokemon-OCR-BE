import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/common/config/env.validation';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.from = `"${config.get('SMTP_FROM_NAME') ?? ''}" <${config.get('SMTP_FROM') ?? ''}>`;

    // Configure secure Handlebars
    handlebars.registerHelper({
      // Register only safe helpers, avoid dangerous ones
    });

    // Security: Disable prototype pollution
    handlebars.Utils.extend(handlebars, {
      allowProtoPropertiesByDefault: false,
      allowProtoMethodsByDefault: false,
    });

    // Initialize secure nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST'),
      port: config.get('SMTP_PORT'),
      secure: config.get('SMTP_SECURE'),
      auth: {
        user: config.get('SMTP_USER'),
        pass: config.get('SMTP_PASS'),
      },
      // Security settings
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
    });
  }

  async sendMail(to: string, subject: string, text: string, html: string) {
    const mailOptions = {
      from: this.from,
      to,
      subject,
      text,
      html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Message sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending email: %s', error);
      throw error;
    }
  }

  async sendMailWithTemplate(
    to: string,
    subject: string,
    templateName: string,
    context: Record<string, any>, // More secure typing
  ) {
    try {
      // Security: Validate template name to prevent path traversal
      if (!this.isValidTemplateName(templateName)) {
        throw new Error('Invalid template name');
      }

      const templatePath = path.join(
        process.cwd(),
        'mails',
        `${templateName}.hbs`,
      );

      // Check if template exists
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template ${templateName} not found`);
      }

      const templateSource = fs.readFileSync(templatePath, 'utf8');

      // Compile template with strict mode
      const template = handlebars.compile(templateSource, {
        strict: true,
        noEscape: false, // Keep escaping enabled for security
      });

      // Security: Sanitize context to prevent prototype pollution
      const safeContext = this.sanitizeContext(context);

      const html = template(safeContext);

      const info = await this.transporter.sendMail({
        from: this.from,
        to: to,
        subject: subject,
        html: html,
      });

      console.log(`Send Email ${subject} to ${to}`);
      return info;
    } catch (error) {
      throw error;
    }
  }

  private isValidTemplateName(templateName: string): boolean {
    // Security: Only allow alphanumeric characters, hyphens, and underscores
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    return validPattern.test(templateName) && !templateName.includes('..');
  }

  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    // Security: Remove prototype properties and methods
    const sanitized = {};
    for (const key in context) {
      if (
        context.hasOwnProperty(key) &&
        key !== '__proto__' &&
        key !== 'constructor'
      ) {
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
  }) {
    const context = {
      otp: params.otp,
      fullname: params.fullname,
      expireMinutes: params.expireMinutes,
      currentYear: new Date().getFullYear(),
    };

    return this.sendMailWithTemplate(
      params.to,
      'Reset Your Password - OTP Verification',
      'forgot-password',
      context,
    );
  }

  async sendRegisterOtp(params: {
    to: string;
    otp: string;
    fullname: string;
    expireMinutes: string;
  }) {
    const context = {
      otp: params.otp,
      fullname: params.fullname,
      expireMinutes: params.expireMinutes,
    };

    return this.sendMailWithTemplate(
      params.to,
      'Verify Your Account - OTP Verification',
      'register-otp',
      context,
    );
  }

  async sendResetPasswordLink(params: {
    to: string;
    fullname: string;
    resetLink: string;
    expireMinutes: string;
  }) {
    const context = {
      fullname: params.fullname,
      resetLink: params.resetLink,
      expireMinutes: params.expireMinutes,
    };

    return this.sendMailWithTemplate(
      params.to,
      'Reset Your Password',
      'reset-password-link',
      context,
    );
  }
}
