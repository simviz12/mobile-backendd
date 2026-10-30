export interface DeviceStatusEventPayload {
  deviceId: string;
  isOnline: boolean;
  batteryLevel?: number | null;
  isCharging?: boolean | null;
  networkType?: string | null;
  lastSeenAt: string | null;
}

export interface DeviceLifecycleEventPayload {
  deviceId: string;
  ownerId: string;
}

export interface CommandUpdatedEventPayload {
  commandId: string;
  deviceId: string;
  type: string;
  status: string;
  failureReason?: string | null;
  updatedAt: string;
}

export interface LocationUpdatedEventPayload {
  deviceId: string;
  location: {
    id: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    speedMps?: number | null;
    recordedAt: string;
    source: string;
  };
}

export interface EventPublisherPort {
  publishToUser(userId: string, eventName: 'device.status', payload: DeviceStatusEventPayload): void;
  publishToUser(userId: string, eventName: 'device.linked', payload: DeviceLifecycleEventPayload): void;
  publishToUser(userId: string, eventName: 'device.unlinked', payload: DeviceLifecycleEventPayload): void;
  publishToUser(userId: string, eventName: 'command.updated', payload: CommandUpdatedEventPayload): void;
  publishToUser(userId: string, eventName: 'location.updated', payload: LocationUpdatedEventPayload): void;
  publishToUser(userId: string, eventName: string, payload: any): void;
}

export const EVENT_PUBLISHER_PORT = Symbol('EVENT_PUBLISHER_PORT');
