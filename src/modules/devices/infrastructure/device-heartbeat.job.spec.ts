import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Device, DeviceMode } from '../domain/device.entity.js';
import { DeviceRepository } from '../domain/device.repository.js';
import { DeviceHeartbeatJob } from './device-heartbeat.job.js';
import { EventPublisherPort } from '../../../shared/events/event-publisher.port.js';
import { ConfigService } from '@nestjs/config';

describe('DeviceHeartbeatJob (Unit Tests)', () => {
  let deviceRepo: DeviceRepository;
  let eventPublisher: EventPublisherPort;
  let configService: ConfigService;
  let heartbeatJob: DeviceHeartbeatJob;

  const timeoutSeconds = 60; // controlled timeout

  beforeEach(() => {
    deviceRepo = {
      findById: vi.fn(),
      findByOwnerAndInstallId: vi.fn(),
      findByTokenHash: vi.fn(),
      findAllByOwnerId: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      save: vi.fn().mockImplementation(async (d) => d),
      delete: vi.fn(),
    };

    eventPublisher = {
      publishToUser: vi.fn(),
    };

    configService = {
      get: vi.fn().mockReturnValue(timeoutSeconds),
    } as any;

    heartbeatJob = new DeviceHeartbeatJob(
      deviceRepo,
      eventPublisher,
      configService,
    );
  });

  it('detects online to offline transition and emits device.status ONCE', async () => {
    const controlledNow = new Date('2026-10-07T12:00:00.000Z');
    // Device last seen 120 seconds ago (> 60s timeout)
    const lastSeenAt = new Date('2026-10-07T11:58:00.000Z');

    const device = Device.create({
      id: 'dev-1',
      ownerId: 'user-1',
      installId: 'inst-1',
      name: 'Pixel Phone',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      lastSeenAt,
      lastOnlineState: true, // was previously marked online
      batteryLevel: 80,
      isCharging: false,
      networkType: 'wifi',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(deviceRepo.findAll).mockResolvedValue([device]);

    // 1st run: transitions to offline
    const transitioned1 = await heartbeatJob.checkHeartbeats(controlledNow);
    expect(transitioned1).toBe(1);
    expect(device.lastOnlineState).toBe(false);
    expect(eventPublisher.publishToUser).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publishToUser).toHaveBeenCalledWith('user-1', 'device.status', {
      deviceId: 'dev-1',
      isOnline: false,
      batteryLevel: 80,
      isCharging: false,
      networkType: 'wifi',
      lastSeenAt: lastSeenAt.toISOString(),
    });

    // 2nd run: already offline -> does not emit again!
    vi.clearAllMocks();
    vi.mocked(deviceRepo.findAll).mockResolvedValue([device]);

    const transitioned2 = await heartbeatJob.checkHeartbeats(new Date('2026-10-07T12:00:30.000Z'));
    expect(transitioned2).toBe(0);
    expect(eventPublisher.publishToUser).not.toHaveBeenCalled();
  });

  it('detects offline to online transition and emits device.status ONCE', async () => {
    const controlledNow = new Date('2026-10-07T12:00:00.000Z');
    // Device seen 10 seconds ago (<= 60s timeout)
    const lastSeenAt = new Date('2026-10-07T11:59:50.000Z');

    const device = Device.create({
      id: 'dev-2',
      ownerId: 'user-2',
      installId: 'inst-2',
      name: 'Galaxy Phone',
      platform: 'android',
      mode: DeviceMode.PROTECTED,
      lastSeenAt,
      lastOnlineState: false, // was offline
      batteryLevel: 95,
      isCharging: true,
      networkType: 'mobile',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(deviceRepo.findAll).mockResolvedValue([device]);

    const transitioned = await heartbeatJob.checkHeartbeats(controlledNow);
    expect(transitioned).toBe(1);
    expect(device.lastOnlineState).toBe(true);
    expect(eventPublisher.publishToUser).toHaveBeenCalledWith('user-2', 'device.status', {
      deviceId: 'dev-2',
      isOnline: true,
      batteryLevel: 95,
      isCharging: true,
      networkType: 'mobile',
      lastSeenAt: lastSeenAt.toISOString(),
    });
  });
});
