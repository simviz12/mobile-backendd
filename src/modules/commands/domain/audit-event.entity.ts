export interface AuditEventProps {
  id: string;
  userId: string;
  deviceId?: string | null;
  action: string;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

export class AuditEvent {
  private constructor(private readonly props: AuditEventProps) {}

  static create(props: AuditEventProps): AuditEvent {
    return new AuditEvent({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get deviceId(): string | null | undefined {
    return this.props.deviceId;
  }

  get action(): string {
    return this.props.action;
  }

  get metadata(): Record<string, any> | null | undefined {
    return this.props.metadata;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
