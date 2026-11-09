import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/common/config/env.validation';
import { dayjs } from '../common/helpers/date.helper';
import * as bcrypt from 'bcrypt';
import { ErrorMessageHelper } from '../common/helpers/error-message.helper'; // Adjust the import path as necessary
import { LogAction } from '../common/constants/log-actions';
import { StorageService } from '../common/services/storage.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ModuleModel } from 'src/models';

// Audit-log values are whole DB rows; keep credentials out of them even when
// a caller passes a row that still contains one.
const SECRET_KEYS = new Set([
  'password',
  'token',
  'refreshToken',
  'resetToken',
  'otp',
]);
export const redactSecrets = (key: string, value: unknown) =>
  SECRET_KEYS.has(key) ? '[REDACTED]' : value;

@Injectable()
export class HelperService {
  // Cache for module IDs to avoid repeated database lookups
  private moduleIdCache: Map<string, string> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleModel: ModuleModel,
    private readonly config: ConfigService<AppConfig, true>,
    @Optional() private readonly storageService?: StorageService,
  ) {}

  localeTimestamp(
    date: string,
    format: string = 'YYYY-MM-DD HH:mm:ss',
    useTimezone: boolean = false,
  ) {
    const timestamp = this.config.get('APP_TIMEZONE');
    let localeTimestamp = dayjs.utc(date).tz(timestamp).format(format);

    if (useTimezone) {
      localeTimestamp += ` ${timestamp}`;
    }

    return localeTimestamp;
  }

  UTCTimestamp(date: string, format: string = 'YYYY-MM-DD HH:mm:ss') {
    const timestamp = 'UTC';

    const UTCTimestamp = dayjs.utc(date).tz(timestamp).format(format);

    return UTCTimestamp;
  }

  /**
   * Normalises a phone number to E.164 format (+{countryCode}{national}).
   * Handles common input variations:
   *   - "08123456789"   → strips leading 0
   *   - "628123456789"  → strips country-code prefix
   *   - "+628123456789" → strips + and country-code prefix
   *   - "8123456789"    → treated as plain national number
   *
   * countryCode defaults to APP_PHONE_COUNTRY_CODE env var, then "62".
   * Override per-call for multi-country projects.
   *
   * Static (usable from DTO @Transform, where there is no DI), so it reads the
   * validated value from process.env rather than ConfigService.
   */
  static normalizePhoneNumber(
    value: unknown,
    countryCode: string = process.env.APP_PHONE_COUNTRY_CODE ?? '62',
  ): string {
    const digits = String(value).replace(/\D/g, '');

    let national: string;
    if (digits.startsWith(countryCode)) {
      national = digits.slice(countryCode.length);
    } else if (digits.startsWith('0')) {
      national = digits.slice(1);
    } else {
      national = digits;
    }

    // Remove any residual leading zeros from the national part
    national = national.replace(/^0+/, '');

    return `+${countryCode}${national}`;
  }

  validateEmail(email: string): boolean {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(email);
  }

  validatePassword(password: string): boolean {
    const passwordPattern =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]|\\:;"'<>,.?/`~\-]).{8,}$/;
    return passwordPattern.test(password);
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // request.ip already resolves X-Forwarded-For according to TRUST_PROXY;
  // reading the header directly would let clients write any IP into logs.
  getIpAddress(request: any): string {
    return request.ip || request.socket?.remoteAddress;
  }

  formattedStringDate(date: string, format: string = 'YYYY-MM-DD HH:mm:ss') {
    return dayjs(date).format(format);
  }

  generateRandomString(length: number = 20): string {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }

    return result;
  }

  slugify(text: string): string {
    const slug = text
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, ''); // Trim - from end of text

    return slug;
  }

  convertBackslashToForwardSlash(path: string): string {
    return path.replace(/\\/g, '/');
  }

  generateFileUrl(filename: string | null): string | null {
    if (!filename) return null;

    // For OBS storage, delegate to StorageService for signed/public URL generation
    if (this.config.get('DISK_STORAGE') === 'obs' && this.storageService) {
      return this.storageService.getPublicUrl(filename);
    }

    // Check if it's already a full URL
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }

    // Fallback to local file URL for backward compatibility
    return `${this.config.get('APP_URL')}/response/${filename.replace(/[\\/]/g, '$')}`;
  }

  checkAuthorization(
    adminGroupDetail,
    moduleName: string,
    ruleName: string,
  ): boolean {
    if (!adminGroupDetail) {
      throw new ForbiddenException(
        ErrorMessageHelper.getMultiLanguageMessage(
          'ADMIN_GROUP_DETAIL_NOT_FOUND',
        ),
      );
    }

    // Check if user is Super Admin (*root group)
    const isSuperAdmin = adminGroupDetail.groups.some(
      (group) => group.name === '*root',
    );
    if (isSuperAdmin) {
      return true;
    }

    // Check if user has access to the specific module and rule
    const hasAccess = adminGroupDetail.modules.some(
      (module) =>
        module.name === moduleName &&
        module.rules.some((rule) => rule.name === ruleName),
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        ErrorMessageHelper.getMultiLanguageMessageWithReplace('ACCESS_DENIED', {
          rule_name: ruleName,
          module_name: moduleName,
        }),
      );
    }

    return true;
  }

  /**
   * Get module ID by module name
   * Uses cache to avoid repeated database lookups
   * @param moduleName - The name of the module
   * @returns The ID of the module or null if not found
   */
  async getModuleIdByName(moduleName: string): Promise<string | null> {
    try {
      // Check cache first
      if (this.moduleIdCache.has(moduleName)) {
        return this.moduleIdCache.get(moduleName);
      }

      // Fetch from database
      const model = this.moduleModel;
      const module = await model.findByNameIgnoreStatus(moduleName);

      if (module) {
        // Cache the result
        this.moduleIdCache.set(moduleName, module.id);
        return module.id;
      }

      return null;
    } catch (error) {
      console.error('Error fetching module ID:', error);
      return null;
    }
  }

  /**
   * Logging function to create a log entry in the database
   * @param logDetailId - ID of the log detail (action type)
   * @param moduleId - ID of the module (optional)
   * @param targetId - ID of the target entity (optional)
   * @param notes - Additional notes (optional)
   * @param valueBefore - Value before the change (optional)
   * @param valueAfter - Value after the change (optional)
   * @param adminId - ID of the admin performing the action
   * @param request - The request object to extract URL, IP, and user agent
   * @return void
   */
  async logging(
    logDetailId: string,
    moduleId: string | null = null,
    targetId: string | null = null,
    notes: string | null = null,
    valueBefore: string | null = null,
    valueAfter: string | null = null,
    adminId: string,
    request: any,
  ): Promise<void> {
    if (!this.config.get('SYSTEM_LOG')) {
      return;
    }

    await this.prisma.log.create({
      data: {
        logDetailId,
        moduleId,
        targetId,
        adminId,
        notes,
        valueBefore,
        valueAfter,
        url: request.url,
        ipAddress: this.getIpAddress(request),
        userAgent: request.headers['user-agent'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Simplified logging function with cleaner API
   * @param action - The action type (VIEW, ADD NEW, UPDATE, DELETE, RESTORE)
   * @param options - Logging options object
   * @returns void
   */
  async logAction(
    action: LogAction,
    options: {
      adminId?: string;
      request?: any;
      moduleName?: string;
      targetId?: string;
      notes?: string;
      valueBefore?: any;
      valueAfter?: any;
    },
  ): Promise<void> {
    const {
      adminId,
      request,
      moduleName,
      targetId = null,
      notes = null,
      valueBefore = null,
      valueAfter = null,
    } = options;

    // Only log if all required parameters are provided
    if (!adminId || !request) {
      return;
    }

    // Skip if system logging is disabled
    if (!this.config.get('SYSTEM_LOG')) {
      return;
    }

    try {
      // Get log detail ID for the action
      const logDetail = await this.prisma.logDetail.findFirst({
        where: { action },
        select: { id: true },
      });

      if (!logDetail) {
        console.warn(`Log detail not found for action: ${action}`);
        return;
      }

      // Get module ID if module name is provided
      const moduleId = moduleName
        ? await this.getModuleIdByName(moduleName)
        : null;

      // Serialize objects to JSON strings
      const valueBeforeStr =
        valueBefore !== null && typeof valueBefore === 'object'
          ? JSON.stringify(valueBefore, redactSecrets)
          : valueBefore;

      const valueAfterStr =
        valueAfter !== null && typeof valueAfter === 'object'
          ? JSON.stringify(valueAfter, redactSecrets)
          : valueAfter;

      // Call the existing logging method
      await this.logging(
        logDetail.id,
        moduleId,
        targetId,
        notes,
        valueBeforeStr,
        valueAfterStr,
        adminId,
        request,
      );
    } catch (error) {
      // Log errors but don't throw to avoid breaking the main operation
      console.error('Error logging action:', error);
    }
  }

  /**
   * Log an action without a request object — useful in cron tasks, queue handlers,
   * and other non-HTTP contexts where req is unavailable.
   */
  async logActionDirect(
    action: LogAction,
    options: {
      adminId: string;
      url: string;
      ipAddress: string;
      userAgent: string;
      moduleName?: string;
      targetId?: string;
      notes?: string;
      valueAfter?: any;
    },
  ): Promise<void> {
    if (!options.adminId) return;
    if (!this.config.get('SYSTEM_LOG')) return;

    try {
      const logDetail = await this.prisma.logDetail.findFirst({
        where: { action },
        select: { id: true },
      });
      if (!logDetail) return;

      const moduleId = options.moduleName
        ? await this.getModuleIdByName(options.moduleName)
        : null;

      const valueAfterStr =
        options.valueAfter !== null &&
        options.valueAfter !== undefined &&
        typeof options.valueAfter === 'object'
          ? JSON.stringify(options.valueAfter, redactSecrets)
          : (options.valueAfter ?? null);

      await this.prisma.log.create({
        data: {
          logDetailId: logDetail.id,
          moduleId,
          targetId: options.targetId ?? null,
          adminId: options.adminId,
          notes: options.notes ?? null,
          valueBefore: null,
          valueAfter: valueAfterStr,
          url: options.url,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error in logActionDirect:', error);
    }
  }
}
