import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { getConfig } from './config';
import { PrismaModule } from './prisma/prisma.module';
import { CoreModule } from './common/core.module';

import { AllExceptionsFilter, JwtAuthGuard, RequestIdInterceptor, ResponseEnvelopeInterceptor, RolesGuard } from './common';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { RfqModule } from './modules/rfq/rfq.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => {
          const cfg = getConfig();
          return {
            ...cfg,
            // Make these top-level for config.get() convenience
            JWT_PRIVATE_KEY: cfg.jwtPrivateKey,
            JWT_PUBLIC_KEY: cfg.jwtPublicKey,
          };
        },
      ],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({
        pinoHttp: {
          level: cs.get<string>('APP_LOG_LEVEL') ?? 'info',
          transport:
            process.env.NODE_ENV === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
            censor: '[REDACTED]',
          },
          customProps: () => ({ app: 'vendorbridge-api' }),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => [
        {
          ttl: Number(cs.get('RATE_LIMIT_TTL') ?? 60) * 1000,
          limit: Number(cs.get('RATE_LIMIT_MAX') ?? 120),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    JwtModule.register({}),

    PrismaModule,
    CoreModule,

    AuditLogsModule,
    NotificationsModule,
    FilesModule,

    AuthModule,
    UsersModule,
    VendorsModule,
    RfqModule,
    QuotationsModule,
    ApprovalsModule,
    PurchaseOrdersModule,
    InvoicesModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule {}
