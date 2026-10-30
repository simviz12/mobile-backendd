# API Specification - Part 5: LOCK Command, Capabilities & Audit Trail

## Base URL
- Local: `http://localhost:3000`
- Android Emulator: `http://10.0.2.2:3000` or `http://localhost:3000` via `adb reverse tcp:3000 tcp:3000`
- Swagger UI Documentation: `http://localhost:3000/docs`
- OpenAPI Specification: [`openapi.yaml`](../../openapi.yaml)

---

## Overview

Part 5 implements hardware security enforcement via the `LOCK` command and device capability reporting:
1. **Device Admin Capability**: Devices report whether they have Device Admin privileges active (`adminEnabled: boolean`) via the hardware daemon endpoint `PATCH /devices/:id/capabilities`.
2. **`adminEnabled` Exposure**: `adminEnabled` is exposed across all device representation responses (`POST /devices`, `GET /devices`, `GET /devices/:id`, `PATCH /devices/:id`).
3. **Capability Guard on `LOCK`**: Issuing a `LOCK` command to a device with `adminEnabled: false` is rejected with `409 Conflict` (`code: CAPABILITY_NOT_AVAILABLE`, `details: [{ capability: "DEVICE_ADMIN" }]`).
4. **No-Payload Enforcement**: `LOCK` does not accept a payload; any non-empty payload is rejected with `400 VALIDATION_ERROR`.
5. **Shorter TTL for `LOCK`**: Uses `LOCK_COMMAND_TTL_SECONDS` (default `60` seconds) instead of the standard command TTL (`120` seconds).
6. **Audit Trail**: Every issued `LOCK` command automatically writes an `AuditEvent` record (`id`, `userId`, `deviceId`, `action: "COMMAND_LOCK_ISSUED"`, `metadata: { commandId, ttlSeconds, expiresAt }`, `createdAt`).

---

## Endpoints

### 1. Update Device Capabilities (Device Daemon)
- **Method**: `PATCH`
- **Path**: `/devices/:id/capabilities`
- **Auth Required**: YES (`Authorization: Device <deviceToken>`)
- **Access Rule**: The authenticated device token must match `:id` (returns `403 Forbidden` otherwise).

#### Request Body
```json
{
  "adminEnabled": true
}
```
*Validation:* `adminEnabled` must be a boolean and is required.

#### Response: `200 OK`
```json
{
  "device": {
    "id": "6d770a46-d6f3-42e4-9f84-870a1b0e49d8",
    "ownerId": "c3384f95-f44b-4550-8985-68ccacb4a200",
    "installId": "p5_install_1791304961235",
    "name": "Pixel 8 Admin",
    "platform": "android",
    "model": null,
    "osVersion": null,
    "appVersion": null,
    "mode": "PROTECTED",
    "fcmToken": "mock_token_for_p5_test",
    "adminEnabled": true,
    "batteryLevel": null,
    "isCharging": null,
    "lastSeenAt": null,
    "isOnline": false,
    "createdAt": "2026-10-06T16:42:41.241Z",
    "updatedAt": "2026-10-06T16:42:41.276Z"
  }
}
```

---

### 2. Issue `LOCK` Command
- **Method**: `POST`
- **Path**: `/devices/:id/commands`
- **Auth Required**: YES (`Authorization: Bearer <accessToken>`)
- **Rules**:
  - Device must belong to authenticated user (`404 DEVICE_NOT_FOUND` otherwise).
  - Device mode must be `PROTECTED` (`409 DEVICE_NOT_PROTECTED` otherwise).
  - Device must have `adminEnabled === true` (`409 CAPABILITY_NOT_AVAILABLE` otherwise).
  - No payload allowed (`400 VALIDATION_ERROR` otherwise).

#### Request Body
```json
{
  "type": "LOCK"
}
```

#### Rejection Response (`409 Conflict`) - Missing Capability:
```json
{
  "error": {
    "code": "CAPABILITY_NOT_AVAILABLE",
    "message": "Target device does not have required capability",
    "details": [
      {
        "capability": "DEVICE_ADMIN"
      }
    ]
  }
}
```

#### Success Response (`201 Created` / Sent to FCM with 60s TTL):
```json
{
  "id": "e49f8742-9907-4e67-8cf1-97b7cb3f1011",
  "deviceId": "6d770a46-d6f3-42e4-9f84-870a1b0e49d8",
  "issuedById": "c3384f95-f44b-4550-8985-68ccacb4a200",
  "type": "LOCK",
  "payload": null,
  "status": "SENT",
  "failureReason": null,
  "createdAt": "2026-10-06T16:43:00.000Z",
  "sentAt": "2026-10-06T16:43:00.120Z",
  "deliveredAt": null,
  "executedAt": null,
  "expiresAt": "2026-10-06T16:44:00.000Z"
}
```

---

## Audit Event Structure

Every `LOCK` command generates an immutable entry in the `audit_events` table:

| Column | Type | Description |
|---|---|---|
| `id` | `UUID` | Event unique ID |
| `userId` | `String` | ID of user who issued the action |
| `deviceId` | `String?` | Target device ID (cascade SetNull) |
| `action` | `String` | `COMMAND_LOCK_ISSUED` |
| `metadata` | `Json?` | `{ commandId, ttlSeconds: 60, expiresAt }` |
| `createdAt` | `DateTime` | Timestamp of event |
