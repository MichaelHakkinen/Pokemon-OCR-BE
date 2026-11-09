import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from 'src/prisma/prisma.service';
import { RawResponse } from 'src/common/decorators/response-message.decorator';
import { RedisService } from 'src/common/services/redis.service';

@ApiTags('Healthz')
@Controller('healthz')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({
    summary: 'Readiness',
    description:
      'Checks that the database and Redis are reachable (Redis reports mode: memory when not configured). Intended for readiness probes, not liveness — a failing dependency should not trigger a pod restart.',
  })
  @ApiResponse({ status: 200, description: 'All dependencies are healthy' })
  @ApiResponse({
    status: 503,
    description: 'One or more dependencies are unreachable',
  })
  @Get('ready')
  @HealthCheck()
  @RawResponse()
  ready() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      async () => {
        const indicator = this.healthIndicatorService.check('redis');
        try {
          // mode is 'memory' when Redis isn't configured (in-process fallback)
          await this.redisService.ping();
          return indicator.up({ mode: this.redisService.mode });
        } catch (error: any) {
          return indicator.down(error?.message ?? 'Redis ping failed');
        }
      },
    ]);
  }
}
