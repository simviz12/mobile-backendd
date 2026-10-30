export interface RefreshTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedById?: string | null;
  createdAt: Date;
  userAgent?: string | null;
}

export class RefreshToken {
  private constructor(private readonly props: RefreshTokenProps) {}

  static create(props: RefreshTokenProps): RefreshToken {
    return new RefreshToken({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get revokedAt(): Date | null | undefined {
    return this.props.revokedAt;
  }

  get replacedById(): string | null | undefined {
    return this.props.replacedById;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get userAgent(): string | null | undefined {
    return this.props.userAgent;
  }

  isExpired(): boolean {
    return new Date() > this.props.expiresAt;
  }

  isRevoked(): boolean {
    return !!this.props.revokedAt;
  }

  revoke(replacedById?: string): void {
    this.props.revokedAt = new Date();
    if (replacedById) {
      this.props.replacedById = replacedById;
    }
  }
}
