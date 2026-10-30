# Security Policy and Threat Model

## 1. Overview
Guardian Mobile provides legitimate remote anti-theft capabilities (location tracking, siren, screen lock, theft mode and remote wipe) for authorized phone owners.

Given the destructive or intrusive capabilities of the system, security safeguards are implemented at every layer to prevent misuse, account takeover (ATO), or rogue command dispatching.

---

## 2. Threat Model & Safeguards

### Threat 1: Credential Stuffing & Password Compromise
- **Risk**: An attacker obtains user credentials from a third-party breach and attempts to trigger emergency lockdown, theft mode or wipe.
- **Safeguards**:
  - **Argon2id**: State-of-the-art password hashing with high memory cost.
  - **Two-Factor Authentication (2FA)**: Standard RFC 6238 TOTP (Google Authenticator, Authy).
  - **Secondary Action Verification**: Critical actions (`DELETE /theft-mode` and `POST /devices/:id/wipe`) require re-verifying the account password **plus** a valid TOTP code (`twoFactorCode`) when 2FA is active.
  - **Account Lockout**: 5 failed 2FA attempts trigger a 15-minute account lock.
  - **Rotated Refresh Tokens**: Sessions detect token reuse and revoke token families automatically.

### Threat 2: Remote Wipe Sabotage
- **Risk**: Malicious or accidental factory reset destroying victim's personal data.
- **Safeguards**:
  - **Server Safety Switch**: `ALLOW_REMOTE_WIPE=false` default environment variable.
  - **Double Confirmation**: Requires exact uppercase confirmation string `"BORRAR"`.
  - **Explicit Password & 2FA Re-verification**.
  - **Rate Limiting**: Hard limit of 3 wipe attempts per hour per user.
  - **Immutable Audit Trail**: Logs IP, userAgent, deviceId, timestamp and outcome.

### Threat 3: Rogue Device Impersonation
- **Risk**: An attacker attempts to forge location reports or ACK fake command completions.
- **Safeguards**:
  - **Cryptographic Device Tokens**: 256-bit high-entropy device tokens issued during pairing.
  - **Token Hashing**: Stored only as SHA-256 hashes in the database.
  - **Immediate Invalidation**: Token invalidated immediately on unlinking or remote wipe ACK.

---

## 3. OS Limitations & Boundary Constraints

Android OS enforces rigorous security sandbox constraints that the platform respects:
1. **Device Admin Requirements**: Commands such as `LOCK` and `WIPE` require Device Admin permission. If revoked by the user or an attacker, the backend rejects activation with `409 CAPABILITY_NOT_AVAILABLE`.
2. **Network Dependency**: Commands rely on Google FCM (Firebase Cloud Messaging). If the device is offline, powered off, or battery is dead, commands remain queued until TTL expiration.
3. **No Root Exploits**: The system runs as a standard or Device Owner/Admin application without exploiting kernel vulnerabilities or circumventing factory reset protection (FRP).
