export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  twoFactorEnabled?: boolean;
  twoFactorSecretEnc?: string | null;
  twoFactorBackupCodes?: string[];
  twoFactorTempSecretEnc?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: UserProps): User {
    return new User({
      ...props,
      email: props.email.toLowerCase().trim(),
      twoFactorEnabled: props.twoFactorEnabled ?? false,
      twoFactorBackupCodes: props.twoFactorBackupCodes ?? [],
    });
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get twoFactorEnabled(): boolean {
    return !!this.props.twoFactorEnabled;
  }

  get twoFactorSecretEnc(): string | null | undefined {
    return this.props.twoFactorSecretEnc;
  }

  get twoFactorBackupCodes(): string[] {
    return this.props.twoFactorBackupCodes ?? [];
  }

  get twoFactorTempSecretEnc(): string | null | undefined {
    return this.props.twoFactorTempSecretEnc;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  setTempTwoFactorSecret(encryptedSecret: string): void {
    this.props.twoFactorTempSecretEnc = encryptedSecret;
  }

  enableTwoFactor(hashedBackupCodes: string[]): void {
    if (!this.props.twoFactorTempSecretEnc) {
      throw new Error('No pending 2FA secret found');
    }
    this.props.twoFactorSecretEnc = this.props.twoFactorTempSecretEnc;
    this.props.twoFactorTempSecretEnc = null;
    this.props.twoFactorEnabled = true;
    this.props.twoFactorBackupCodes = hashedBackupCodes;
  }

  disableTwoFactor(): void {
    this.props.twoFactorEnabled = false;
    this.props.twoFactorSecretEnc = null;
    this.props.twoFactorTempSecretEnc = null;
    this.props.twoFactorBackupCodes = [];
  }

  useBackupCode(hashedCode: string): void {
    this.props.twoFactorBackupCodes = (this.props.twoFactorBackupCodes ?? []).filter(
      (c) => c !== hashedCode,
    );
  }

  changePassword(newPasswordHash: string): void {
    this.props.passwordHash = newPasswordHash;
    this.props.updatedAt = new Date();
  }

  toPublic() {
    return {
      id: this.id,
      email: this.email,
      displayName: this.displayName,
      twoFactorEnabled: this.twoFactorEnabled,
      createdAt: this.createdAt,
    };
  }
}
