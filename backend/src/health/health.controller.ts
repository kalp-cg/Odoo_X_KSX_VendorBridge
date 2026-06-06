import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, SkipRequestId } from '../common';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @SkipRequestId()
  @ApiOperation({ summary: 'Liveness + DB ping' })
  async health() {
    const dbOk = await this.prisma.healthCheck();
    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { database: dbOk ? 'up' : 'down' },
    };
  }
}
