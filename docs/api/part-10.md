# Part 10 API Documentation — Hardening, 2FA (TOTP) and Session Management

## Overview
Part 10 hardens the Guardian Mobile platform with:
- **Two-Factor Authentication (2FA)** using standard RFC 6238 TOTP (compatible with Google Authenticator, Authy, 1Password) plus one-time backup codes.
- **Login 2FA Challenge**: Two-step authentication flow returning a temporary single-purpose `twoFactorToken`.
- **Secondary Action Guard**: Sensitive actions (`POST /devices/:id/wipe` and `DELETE /devices/:id/theft-mode`) strictly require a valid TOTP / backup code (`twoFactorCode`) when 2FA is active.
- **Session Management**: List active refresh sessions (`GET /auth/sessions`), revoke specific sessions (`DELETE /auth/sessions/:id`), revoke all sessions (`POST /auth/logout-all`), and password change (`POST /auth/change-password`) with automatic session revocation.
- **Security Hardening**: Helmet HTTP headers, CORS origin restriction (`ALLOWED_ORIGINS`), 1MB body size limits, request ID tracking (`X-Request-ID`), and dependency vulnerability remediation.

---

## 2FA Endpoints

### 1. Setup 2FA
`POST /auth/2fa/setup`  
**Authentication**: User JWT (`Authorization: Bearer <token>`)

Generates an encrypted temporary TOTP secret and returns the setup secret and `otpauth://` QR-code URI.

**Response**: `200 OK`
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "otpauthUrl": "otpauth://totp/Guardian%20Mobile:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Guardian%20Mobile"
}
```

---

### 2. Enable 2FA
`POST /auth/2fa/enable`  
**Authentication**: User JWT (`Authorization: Bearer <token>`)

Validates a 6-digit TOTP code against the temporary secret, activates 2FA on the account, and returns 10 single-use backup codes (shown once).

**Request Body**:
```json
{
  "code": "123456"
}
```

**Response**: `200 OK`
```json
{
  "backupCodes": [
    "A1B2-C3D4",
    "E5F6-G7H8",
    "I9J0-K1L2",
    "M3N4-O5P6",
    "Q7R8-S9T0",
    "U1V2-W3X4",
    "Y5Z6-A7B8",
    "C9D0-E1F2",
    "G3H4-I5J6",
    "K7L8-M9N0"
  ]
}
```

---

### 3. Disable 2FA
`POST /auth/2fa/disable`  
**Authentication**: User JWT (`Authorization: Bearer <token>`)

Requires account password and valid TOTP or backup code to disable 2FA.

**Request Body**:
```json
{
  "password": "AccountPassword123!",
  "code": "123456"
}
```

**Response**: `204 No Content`

---

### 4. Complete 2FA Login
`POST /auth/2fa/verify`  
**Authentication**: None (uses `twoFactorToken`)  
**Rate Limit**: 5 attempts / minute per IP. 5 consecutive failures lock the account for 15 minutes (`429 ACCOUNT_LOCKED`).

**Request Body**:
```json
{
  "twoFactorToken": "eyJhbGciOi...",
  "code": "123456"
}
```

**Response**: `200 OK`
```json
{
  "user": {
    "id": "e458...",
    "email": "user@example.com",
    "displayName": "Alex Developer"
  },
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "7f8b9a...",
  "expiresIn": 900
}
```

---

## Session Management Endpoints

### 1. List Active Sessions
`GET /auth/sessions`  
**Authentication**: User JWT

**Response**: `200 OK`
```json
[
  {
    "id": "58f4a2...",
    "userAgent": "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
    "createdAt": "2026-10-08T10:00:00.000Z",
    "expiresAt": "2026-11-08T10:00:00.000Z"
  }
]
```

---

### 2. Revoke a Specific Session
`DELETE /auth/sessions/:id`  
**Authentication**: User JWT

**Response**: `204 No Content`

---

### 3. Logout All Sessions
`POST /auth/logout-all`  
**Authentication**: User JWT

**Response**: `204 No Content`

---

### 4. Change Password
`POST /auth/change-password`  
**Authentication**: User JWT

Verifies current password, applies new password, and revokes all refresh sessions.

**Request Body**:
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewStrongPassword123!"
}
```

**Response**: `204 No Content`
