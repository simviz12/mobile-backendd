import { forwardRef, Module } from '@nestjs/common';
import { THEFT_MODE_REPOSITORY } from './domain/theft-mode.repository.js';
import { PrismaTheftModeRepository } from './infrastructure/prisma-theft-mode.repository.js';
import { ActivateTheftModeUseCase } from './application/activate-theft-mode.usecase.js';
import { GetTheftModeUseCase } from './application/get-theft-mode.usecase.js';
import { DeactivateTheftModeUseCase } from './application/deactivate-theft-mode.usecase.js';
import { TheftModeController } from './presentation/theft-mode.controller.js';
import { DevicesModule } from '../devices/devices.module.js';
import { DEVICE_REPOSITORY, type DeviceRepository } from '../devices/domain/device.repository.js';
import { CommandsModule } from '../commands/commands.module.js';
import { SendCommandUseCase } from '../commands/application/send-command.usecase.js';
import { AUDIT_EVENT_REPOSITORY, type AuditEventRepository } from '../commands/domain/audit-event.repository.js';
import { UsersModule } from '../users/users.module.js';
import { USER_REPOSITORY, type UserRepository } from '../users/domain/user.repository.js';
import { AuthModule } from '../auth/auth.module.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../auth/domain/auth-ports.js';
import { TheftModeRepository } from './domain/theft-mode.repository.js';

@Module({
  imports: [
    forwardRef(() => DevicesModule),
    forwardRef(() => CommandsModule),
    UsersModule,
    AuthModule,
  ],
  controllers: [TheftModeController],
  providers: [
    {
      provide: THEFT_MODE_REPOSITORY,
      useClass: PrismaTheftModeRepository,
    },
    {
      provide: ActivateTheftModeUseCase,
      useFactory: (
        deviceRepo: DeviceRepository,
        theftModeRepo: TheftModeRepository,
        sendCommandUseCase: SendCommandUseCase,
        auditRepo: AuditEventRepository,
      ) =>
        new ActivateTheftModeUseCase(
          deviceRepo,
          theftModeRepo,
          sendCommandUseCase,
          auditRepo,
        ),
      inject: [
        DEVICE_REPOSITORY,
        THEFT_MODE_REPOSITORY,
        SendCommandUseCase,
        AUDIT_EVENT_REPOSITORY,
      ],
    },
    {
      provide: GetTheftModeUseCase,
      useFactory: (
        deviceRepo: DeviceRepository,
        theftModeRepo: TheftModeRepository,
      ) => new GetTheftModeUseCase(deviceRepo, theftModeRepo),
      inject: [DEVICE_REPOSITORY, THEFT_MODE_REPOSITORY],
    },
    {
      provide: DeactivateTheftModeUseCase,
      useFactory: (
        deviceRepo: DeviceRepository,
        theftModeRepo: TheftModeRepository,
        userRepo: UserRepository,
        hasher: PasswordHasher,
        sendCommandUseCase: SendCommandUseCase,
        auditRepo: AuditEventRepository,
      ) =>
        new DeactivateTheftModeUseCase(
          deviceRepo,
          theftModeRepo,
          userRepo,
          hasher,
          sendCommandUseCase,
          auditRepo,
        ),
      inject: [
        DEVICE_REPOSITORY,
        THEFT_MODE_REPOSITORY,
        USER_REPOSITORY,
        PASSWORD_HASHER,
        SendCommandUseCase,
        AUDIT_EVENT_REPOSITORY,
      ],
    },
  ],
  exports: [THEFT_MODE_REPOSITORY, ActivateTheftModeUseCase, GetTheftModeUseCase, DeactivateTheftModeUseCase],
})
export class TheftModeModule {}
