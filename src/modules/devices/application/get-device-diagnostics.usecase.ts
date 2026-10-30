import { DeviceRepository } from '../domain/device.repository.js';
import { CommandRepository } from '../../commands/domain/command.repository.js';
import { LocationRepository } from '../../locations/domain/location.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { DeviceMode } from '../domain/device.entity.js';

export interface DiagnosticsOutput {
  hasFcmToken: boolean;
  hasDeviceToken: boolean;
  lastSeenAt: string | null;
  lastStatusAt: string | null;
  lastLocationAt: string | null;
  lastCommand: {
    type: string;
    status: string;
    failureReason: string | null;
    at: string;
  } | null;
  permissions: {
    notifications: boolean | null;
    locationForeground: boolean | null;
    locationBackground: boolean | null;
    batteryOptimizationIgnored: boolean | null;
    deviceAdmin: boolean | null;
    fullScreenIntent: boolean | null;
  };
  problems: string[];
}

export class GetDeviceDiagnosticsUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly commandRepository: CommandRepository,
    private readonly locationRepository: LocationRepository,
    private readonly heartbeatTimeoutSeconds: number,
  ) {}

  async execute(deviceId: string, callerUserId: string): Promise<DiagnosticsOutput> {
    const device = await this.deviceRepository.findById(deviceId);

    // Ownership check: strict 404
    if (!device || !device.belongsTo(callerUserId)) {
      throw new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    const hasFcmToken = !!device.fcmToken && device.fcmToken.trim().length > 0;
    const hasDeviceToken = !!device.deviceTokenHash;

    const lastSeenAt = device.lastSeenAt ? device.lastSeenAt.toISOString() : null;
    const lastStatusAt = lastSeenAt; // Updated whenever device calls capabilities/heartbeat

    // Query latest location
    const latestLocation = await this.locationRepository.findLatestByDeviceId(deviceId);
    const lastLocationAt = latestLocation
      ? latestLocation.recordedAt.toISOString()
      : device.lastLocation
        ? device.lastLocation.recordedAt
        : null;

    // Query last command
    const commandsResult = await this.commandRepository.findAllByDeviceId(deviceId, { limit: 1 });
    const latestCommand = commandsResult.items.length > 0 ? commandsResult.items[0] : null;

    const lastCommand = latestCommand
      ? {
          type: latestCommand.type,
          status: latestCommand.status,
          failureReason: latestCommand.failureReason ?? null,
          at: latestCommand.createdAt.toISOString(),
        }
      : null;

    // Permissions
    const storedPermissions = device.permissions ?? {};
    const permissions = {
      notifications: storedPermissions.notifications ?? null,
      locationForeground: storedPermissions.locationForeground ?? null,
      locationBackground: storedPermissions.locationBackground ?? null,
      batteryOptimizationIgnored: storedPermissions.batteryOptimizationIgnored ?? null,
      deviceAdmin:
        storedPermissions.deviceAdmin !== undefined
          ? storedPermissions.deviceAdmin
          : device.adminEnabled !== undefined
            ? device.adminEnabled
            : null,
      fullScreenIntent: storedPermissions.fullScreenIntent ?? null,
    };

    // Evaluate problems
    const problems: string[] = [];

    if (!hasFcmToken) {
      problems.push('NO_FCM_TOKEN');
    }

    if (!device.isOnline(this.heartbeatTimeoutSeconds)) {
      problems.push('NO_HEARTBEAT');
    }

    if (!lastLocationAt) {
      problems.push('NO_LOCATION');
    }

    if (permissions.notifications === false) {
      problems.push('NOTIFICATIONS_DENIED');
    }

    if (permissions.locationForeground === false) {
      problems.push('LOCATION_DENIED');
    }

    if (permissions.locationBackground === false) {
      problems.push('BACKGROUND_LOCATION_DENIED');
    }

    if (permissions.batteryOptimizationIgnored === false) {
      problems.push('BATTERY_OPTIMIZED');
    }

    if (device.mode === DeviceMode.PROTECTED && (permissions.deviceAdmin === false || !device.adminEnabled)) {
      problems.push('ADMIN_NOT_ENABLED');
    }

    return {
      hasFcmToken,
      hasDeviceToken,
      lastSeenAt,
      lastStatusAt,
      lastLocationAt,
      lastCommand,
      permissions,
      problems,
    };
  }
}
