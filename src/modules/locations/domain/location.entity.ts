export enum LocationSource {
  LOCATE_COMMAND = 'LOCATE_COMMAND',
  PERIODIC = 'PERIODIC',
  THEFT_MODE = 'THEFT_MODE',
}

export interface LocationProps {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  speedMps?: number | null;
  recordedAt: Date;
  receivedAt: Date;
  source: LocationSource;
}

export class Location {
  private constructor(private readonly props: LocationProps) {}

  static create(props: LocationProps): Location {
    return new Location({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get deviceId(): string {
    return this.props.deviceId;
  }

  get latitude(): number {
    return this.props.latitude;
  }

  get longitude(): number {
    return this.props.longitude;
  }

  get accuracyMeters(): number | null | undefined {
    return this.props.accuracyMeters;
  }

  get speedMps(): number | null | undefined {
    return this.props.speedMps;
  }

  get recordedAt(): Date {
    return this.props.recordedAt;
  }

  get receivedAt(): Date {
    return this.props.receivedAt;
  }

  get source(): LocationSource {
    return this.props.source;
  }

  toResponse() {
    return {
      id: this.id,
      deviceId: this.deviceId,
      latitude: this.latitude,
      longitude: this.longitude,
      accuracyMeters: this.accuracyMeters ?? null,
      speedMps: this.speedMps ?? null,
      recordedAt: this.recordedAt.toISOString(),
      receivedAt: this.receivedAt.toISOString(),
      source: this.source,
    };
  }
}
