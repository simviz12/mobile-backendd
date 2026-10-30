export interface TheftModeProps {
  id: string;
  deviceId: string;
  activatedById: string;
  activatedAt: Date;
  deactivatedAt?: Date | null;
  message: string;
  contactPhone?: string | null;
  locationIntervalSeconds: number;
  alarm: boolean;
  lock: boolean;
}

export class TheftMode {
  private constructor(private readonly props: TheftModeProps) {}

  static create(props: TheftModeProps): TheftMode {
    return new TheftMode({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get deviceId(): string {
    return this.props.deviceId;
  }

  get activatedById(): string {
    return this.props.activatedById;
  }

  get activatedAt(): Date {
    return this.props.activatedAt;
  }

  get deactivatedAt(): Date | null | undefined {
    return this.props.deactivatedAt;
  }

  get message(): string {
    return this.props.message;
  }

  get contactPhone(): string | null | undefined {
    return this.props.contactPhone;
  }

  get locationIntervalSeconds(): number {
    return this.props.locationIntervalSeconds;
  }

  get alarm(): boolean {
    return this.props.alarm;
  }

  get lock(): boolean {
    return this.props.lock;
  }

  get isActive(): boolean {
    return !this.props.deactivatedAt;
  }

  deactivate(now: Date = new Date()): void {
    this.props.deactivatedAt = now;
  }

  toJSON() {
    return {
      id: this.id,
      deviceId: this.deviceId,
      activatedById: this.activatedById,
      activatedAt: this.activatedAt.toISOString(),
      deactivatedAt: this.deactivatedAt ? this.deactivatedAt.toISOString() : null,
      message: this.message,
      contactPhone: this.contactPhone ?? null,
      locationIntervalSeconds: this.locationIntervalSeconds,
      alarm: this.alarm,
      lock: this.lock,
    };
  }
}
