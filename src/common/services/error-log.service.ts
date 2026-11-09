import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AppConfig } from 'src/common/config/env.validation';
import { ErrorLogModel, ModuleModel } from 'src/models';

export interface ErrorLogContext {
  moduleName?: string;
  targetId?: string;
  remarks?: string;
}

// Persists server errors to the error_logs table (when ERROR_LOG=true).
// Never throws: a failure to log must not change the response.
@Injectable()
export class ErrorLogService {
  private readonly logger = new Logger(ErrorLogService.name);
  private readonly moduleIdCache = new Map<string, string | null>();

  constructor(
    private readonly errorLogModel: ErrorLogModel,
    private readonly moduleModel: ModuleModel,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async logFromRequest(
    req: Request & { user?: { id?: string } },
    error: unknown,
    context: ErrorLogContext = {},
  ): Promise<void> {
    if (!this.config.get('ERROR_LOG')) return;

    try {
      const err = error as { message?: string; stack?: string };
      const errorMessage =
        typeof error === 'string' ? error : (err?.message ?? 'Unknown error');

      await this.errorLogModel.createLog({
        endpoint: req?.originalUrl || req?.url,
        errorMessage,
        adminId: req?.user?.id,
        moduleId: await this.resolveModuleId(context.moduleName),
        targetId: context.targetId,
        remarks: context.remarks ?? err?.stack,
        // req.ip honours TRUST_PROXY; raw forwarding headers are client-controlled
        ipAddress: req?.ip || req?.socket?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
      });
    } catch (logError) {
      this.logger.error('Failed to write error log', logError as Error);
    }
  }

  private async resolveModuleId(moduleName?: string) {
    if (!moduleName) return undefined;
    if (!this.moduleIdCache.has(moduleName)) {
      const module = await this.moduleModel.findByNameIgnoreStatus(moduleName);
      this.moduleIdCache.set(moduleName, module?.id ?? null);
    }
    return this.moduleIdCache.get(moduleName) ?? undefined;
  }
}
