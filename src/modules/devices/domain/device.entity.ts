export enum DeviceMode {
  PROTECTED = 'PROTECTED',
  CONTROLLER = 'CONTROLLER',
}

export interface LastLocationSummary {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  recordedAt: string;
}

export interface DevicePermissions {
  notifications?: boolean | null;
  locationForeground?: boolean | null;
  locationBackground?: boolean | null;
  batteryOptimizationIgnored?: boolean | null;
  deviceAdmin?: boolean | null;
  fullScreenIntent?: boolean | null;
}

export interface DeviceProps {
  id: string;
  ownerId: string;
  installId: string;
  name: string;
  platform: 'android' | 'ios';
  model?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
  mode: DeviceMode;
  fcmToken?: string | null;
  deviceTokenHash?: string | null;
  adminEnabled?: boolean;
  batteryLevel?: number | null;
  isCharging?: boolean | null;
  lastSeenAt?: Date | null;
  permissions?: DevicePermissions | null;
  createdAt: Date;
  updatedAt: Date;
  lastLocation?: LastLocationSummary | null;
}

export class Device {
  private constructor(private readonly props: DeviceProps) {}

  static create(props: DeviceProps): Device {
    return new Device({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get installId(): string {
    return this.props.installId;
  }

  get name(): string {
    return this.props.name;
  }

  get platform(): 'android' | 'ios' {
    return this.props.platform;
  }

  get model(): string | null | undefined {
    return this.props.model;
  }

  get osVersion(): string | null | undefined {
    return this.props.osVersion;
  }

  get appVersion(): string | null | undefined {
    return this.props.appVersion;
  }

  get mode(): DeviceMode {
    return this.props.mode;
  }

  get fcmToken(): string | null | undefined {
    return this.props.fcmToken;
  }

  get deviceTokenHash(): string | null | undefined {
    return this.props.deviceTokenHash;
  }

  get adminEnabled(): boolean {
    return this.props.adminEnabled ?? false;
  }

  get lastLocation(): LastLocationSummary | null | undefined {
    return this.props.lastLocation;
  }

  get batteryLevel(): number | null | undefined {
    return this.props.batteryLevel;
  }

  get isCharging(): boolean | null | undefined {
    return this.props.isCharging;
  }

  get lastSeenAt(): Date | null | undefined {
    return this.props.lastSeenAt;
  }

  get permissions(): DevicePermissions | null | undefined {
    return this.props.permissions;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  belongsTo(userId: string): boolean {
    return this.props.ownerId === userId;
  }

  isOnline(heartbeatTimeoutSeconds: number, now: Date = new Date()): boolean {
    if (!this.props.lastSeenAt) {
      return false;
    }
    const diffSeconds = (now.getTime() - this.props.lastSeenAt.getTime()) / 1000;
    return diffSeconds <= heartbeatTimeoutSeconds && diffSeconds >= 0;
  }

  recordHeartbeat(now: Date = new Date()): void {
    this.props.lastSeenAt = now;
    this.props.updatedAt = now;
  }

  updateDetails(params: { name?: string; fcmToken?: string | null }): void {
    if (params.name !== undefined) {
      this.props.name = params.name.trim();
    }
    if (params.fcmToken !== undefined) {
      this.props.fcmToken = params.fcmToken;
    }
    this.props.updatedAt = new Date();
  }

  updateCapabilities(capabilities: {
    adminEnabled?: boolean;
    permissions?: DevicePermissions | null;
    batteryLevel?: number | null;
    isCharging?: boolean | null;
  }): void {
    if (capabilities.adminEnabled !== undefined) {
      this.props.adminEnabled = capabilities.adminEnabled;
    }
    if (capabilities.permissions !== undefined) {
      this.props.permissions = {
        ...this.props.permissions,
        ...capabilities.permissions,
      };
    }
    if (capabilities.batteryLevel !== undefined) {
      this.props.batteryLevel = capabilities.batteryLevel;
    }
    if (capabilities.isCharging !== undefined) {
      this.props.isCharging = capabilities.isCharging;
    }
    const now = new Date();
    this.props.lastSeenAt = now;
    this.props.updatedAt = now;
  }

  setLastLocation(lastLocation: LastLocationSummary | null): void {
    this.props.lastLocation = lastLocation;
  }

  updateDeviceTokenHash(hash: string): void {
    this.props.deviceTokenHash = hash;
    this.props.updatedAt = new Date();
  }

  invalidateDeviceToken(): void {
    this.props.deviceTokenHash = null;
    this.props.updatedAt = new Date();
  }

  toResponse(heartbeatTimeoutSeconds: number, now: Date = new Date()) {
    return {
      id: this.id,
      ownerId: this.ownerId,
      installId: this.installId,
      name: this.name,
      platform: this.platform,
      model: this.model ?? null,
      osVersion: this.osVersion ?? null,
      appVersion: this.appVersion ?? null,
      mode: this.mode,
      fcmToken: this.fcmToken ?? null,
      adminEnabled: this.adminEnabled,
      batteryLevel: this.batteryLevel ?? null,
      isCharging: this.isCharging ?? null,
      lastSeenAt: this.lastSeenAt ? this.lastSeenAt.toISOString() : null,
      isOnline: this.isOnline(heartbeatTimeoutSeconds, now),
      lastLocation: this.props.lastLocation ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
