export enum CommandType {
  RING = 'RING',
  VIBRATE = 'VIBRATE',
  MESSAGE = 'MESSAGE',
  LOCK = 'LOCK',
}

export enum CommandStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export interface CommandProps {
  id: string;
  deviceId: string;
  issuedById: string;
  type: CommandType;
  payload?: Record<string, any> | null;
  status: CommandStatus;
  failureReason?: string | null;
  createdAt: Date;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  executedAt?: Date | null;
  expiresAt: Date;
}

export class DomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class Command {
  private constructor(private readonly props: CommandProps) {}

  static create(props: CommandProps): Command {
    return new Command({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get deviceId(): string {
    return this.props.deviceId;
  }

  get issuedById(): string {
    return this.props.issuedById;
  }

  get type(): CommandType {
    return this.props.type;
  }

  get payload(): Record<string, any> | null | undefined {
    return this.props.payload;
  }

  get status(): CommandStatus {
    return this.props.status;
  }

  get failureReason(): string | null | undefined {
    return this.props.failureReason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get sentAt(): Date | null | undefined {
    return this.props.sentAt;
  }

  get deliveredAt(): Date | null | undefined {
    return this.props.deliveredAt;
  }

  get executedAt(): Date | null | undefined {
    return this.props.executedAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  isFinal(): boolean {
    return (
      this.props.status === CommandStatus.EXECUTED ||
      this.props.status === CommandStatus.FAILED ||
      this.props.status === CommandStatus.EXPIRED
    );
  }

  markSent(now: Date = new Date()): void {
    if (this.props.status !== CommandStatus.PENDING) {
      throw new DomainError(
        'INVALID_STATE_TRANSITION',
        `Cannot transition command from ${this.props.status} to SENT`,
      );
    }
    this.props.status = CommandStatus.SENT;
    this.props.sentAt = now;
  }

  markDelivered(now: Date = new Date()): void {
    if (this.props.status === CommandStatus.DELIVERED) {
      // Idempotent ack
      return;
    }
    if (this.props.status !== CommandStatus.SENT) {
      throw new DomainError(
        'INVALID_STATE_TRANSITION',
        `Cannot transition command from ${this.props.status} to DELIVERED`,
      );
    }
    this.props.status = CommandStatus.DELIVERED;
    this.props.deliveredAt = now;
  }

  markExecuted(now: Date = new Date()): void {
    if (this.props.status === CommandStatus.EXECUTED) {
      // Idempotent ack
      return;
    }
    if (
      this.props.status !== CommandStatus.DELIVERED &&
      this.props.status !== CommandStatus.SENT
    ) {
      throw new DomainError(
        'INVALID_STATE_TRANSITION',
        `Cannot transition command from ${this.props.status} to EXECUTED`,
      );
    }
    if (!this.props.deliveredAt) {
      this.props.deliveredAt = now;
    }
    this.props.status = CommandStatus.EXECUTED;
    this.props.executedAt = now;
  }

  markFailed(reason: string): void {
    if (this.props.status === CommandStatus.FAILED) {
      // Idempotent ack
      return;
    }
    if (this.isFinal()) {
      throw new DomainError(
        'INVALID_STATE_TRANSITION',
        `Cannot fail command that is already in final state ${this.props.status}`,
      );
    }
    this.props.status = CommandStatus.FAILED;
    this.props.failureReason = reason;
  }

  markExpired(): void {
    if (this.props.status === CommandStatus.EXPIRED) {
      return;
    }
    if (this.isFinal()) {
      throw new DomainError(
        'INVALID_STATE_TRANSITION',
        `Cannot expire command in final state ${this.props.status}`,
      );
    }
    this.props.status = CommandStatus.EXPIRED;
    this.props.failureReason = 'COMMAND_EXPIRED';
  }

  toResponse() {
    return {
      id: this.id,
      deviceId: this.deviceId,
      issuedById: this.issuedById,
      type: this.type,
      payload: this.payload ?? null,
      status: this.status,
      failureReason: this.failureReason ?? null,
      createdAt: this.createdAt.toISOString(),
      sentAt: this.sentAt ? this.sentAt.toISOString() : null,
      deliveredAt: this.deliveredAt ? this.deliveredAt.toISOString() : null,
      executedAt: this.executedAt ? this.executedAt.toISOString() : null,
      expiresAt: this.expiresAt.toISOString(),
    };
  }
}
