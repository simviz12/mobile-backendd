import { Device, DeviceMode } from '../domain/device.entity.js';
import { DeviceRepository } from '../domain/device.repository.js';
import { DeviceTokenGenerator } from '../domain/device-token.generator.js';
import { randomUUID } from 'crypto';

export interface LinkDeviceInput {
  ownerId: string;
  installId: string;
  name: string;
  platform: 'android' | 'ios';
  model?: string;
  osVersion?: string;
  appVersion?: string;
  mode: DeviceMode;
  fcmToken?: string;
}

export interface LinkDeviceResult {
  device: ReturnType<Device['toResponse']>;
  deviceToken: string;
  isNew: boolean;
}

export class LinkDeviceUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly tokenGenerator: DeviceTokenGenerator,
    private readonly heartbeatTimeoutSeconds: number,
  ) {}

  async execute(input: LinkDeviceInput): Promise<LinkDeviceResult> {
    const rawDeviceToken = this.tokenGenerator.generateToken();
    const tokenHash = this.tokenGenerator.hashToken(rawDeviceToken);
    const now = new Date();

    const existingDevice = await this.deviceRepository.findByOwnerAndInstallId(
      input.ownerId,
      input.installId,
    );

    if (existingDevice) {
      // Idempotent re-link: update details and rotate device token
      existingDevice.updateDetails({
        name: input.name,
        fcmToken: input.fcmToken,
      });
      existingDevice.updateDeviceTokenHash(tokenHash);
      const saved = await this.deviceRepository.save(existingDevice);

      return {
        device: saved.toResponse(this.heartbeatTimeoutSeconds, now),
        deviceToken: rawDeviceToken,
        isNew: false,
      };
    }

    // New device
    const newDevice = Device.create({
      id: randomUUID(),
      ownerId: input.ownerId,
      installId: input.installId,
      name: input.name.trim(),
      platform: input.platform,
      model: input.model ?? null,
      osVersion: input.osVersion ?? null,
      appVersion: input.appVersion ?? null,
      mode: input.mode,
      fcmToken: input.fcmToken ?? null,
      deviceTokenHash: tokenHash,
      batteryLevel: null,
      isCharging: null,
      lastSeenAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const created = await this.deviceRepository.create(newDevice);

    return {
      device: created.toResponse(this.heartbeatTimeoutSeconds, now),
      deviceToken: rawDeviceToken,
      isNew: true,
    };
  }
}
