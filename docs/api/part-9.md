# Part 9 API Documentation — Remote Wipe with Safeguards

## Overview
Part 9 implements the ultimate safety measure for lost or stolen devices: **Remote Wipe (Factory Reset)**. Given the irreversible nature of wiping a device, the endpoint is guarded by multi-layered safeguards:
1. **Safety Switch (`ALLOW_REMOTE_WIPE`)**: Remote wipe is disabled globally by default (`ALLOW_REMOTE_WIPE=false`) to prevent accidental wipe during development or staging.
2. **Dedicated Endpoint**: Remote wipe cannot be triggered through generic command dispatching (`POST /devices/:id/commands`).
3. **Double Confirmation**: The caller must explicitly provide `confirmationText: "BORRAR"` (exact case-sensitive match) and re-verify their user password with Argon2id.
4. **Device Capability Checks**: The target device must be in `PROTECTED` mode, owned by the caller, reachable via FCM, and have `adminEnabled: true` with `DEVICE_ADMIN_WIPE` capability.
5. **Strict Rate Limiting**: Maximum 3 wipe attempts per hour per user. All attempts (successful or failed password) are tracked.
6. **Audit Trail**: Every wipe attempt logs an immutable `AuditEvent` (`REMOTE_WIPE_ATTEMPT`).
7. **ACK State Machine**: Device sends an `EXECUTING` acknowledgment prior to wiping itself. Since the device will be completely erased and cannot send subsequent `EXECUTED` ACKs, the backend maps `EXECUTING` to final status `EXECUTED` with reason `EXECUTED_PENDING_CONFIRMATION`, sets `wipedAt` timestamp, and immediately revokes all tokens.

---

## Safety Switch & Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `ALLOW_REMOTE_WIPE` | Boolean | `false` | Master safety switch. Must be explicitly set to `true` to allow wipe execution. Returns `403 WIPE_DISABLED` if false. |
| `WIPE_COMMAND_TTL_SECONDS` | Number | `600` | TTL for the `WIPE` command in seconds (default 10 minutes). |

---

## Endpoints

### 1. Request Remote Wipe
`POST /devices/:id/wipe`

**Authentication**: User JWT (`Authorization: Bearer <token>`)  
**Rate Limit**: 3 attempts per hour per user

**Request Body**:
```json
{
  "password": "UserPassword123!",
  "confirmationText": "BORRAR"
}
```

**Responses**:
- `202 Accepted`: Wipe command issued and queued for device delivery.
  ```json
  {
    "command": {
      "id": "c1f71df8-80e9-4e76-8051-7efd6b9d8858",
      "deviceId": "d4621c97-6a16-4318-ba23-c91888a7cecf",
      "type": "WIPE",
      "payload": null,
      "status": "SENT",
      "sentAt": "2026-10-08T02:30:00.000Z",
      "deliveredAt": null,
      "executedAt": null,
      "failureReason": null,
      "expiresAt": "2026-10-08T02:40:00.000Z"
    }
  }
  ```
- `400 Bad Request`: `VALIDATION_ERROR` (e.g. `confirmationText` does not match `"BORRAR"`).
- `401 Unauthorized`: `INVALID_CREDENTIALS` (password re-verification failed).
- `403 Forbidden`: `WIPE_DISABLED` (server safety switch `ALLOW_REMOTE_WIPE` is not enabled).
- `404 Not Found`: `DEVICE_NOT_FOUND` (device does not exist or does not belong to the user).
- `409 Conflict`:
  - `DEVICE_NOT_PROTECTED`: Device is in `UNPROTECTED` mode.
  - `CAPABILITY_NOT_AVAILABLE`: Device has `adminEnabled: false` (requires `DEVICE_ADMIN_WIPE`).
  - `DEVICE_NOT_REACHABLE`: Target device has no registered FCM push token.
- `429 Too Many Requests`: User exceeded 3 wipe attempts in 1 hour.

---

### 2. Device ACK Protocol
`POST /commands/:id/ack`

**Authentication**: Device Token (`Authorization: Device <token>`)

**Request Body**:
```json
{
  "status": "EXECUTING"
}
```

**Processing**:
1. When status is `EXECUTING` and command type is `WIPE`:
   - Command transitions to status `EXECUTED` with `failureReason = "EXECUTED_PENDING_CONFIRMATION"`.
   - Device is updated with `wipedAt = NOW()`, `deviceTokenHash = null`, and `fcmToken = null`.
   - Realtime event `command.updated` is emitted to the owner's WebSocket room.

---

### 3. Query Audit Trail
`GET /audit?deviceId=&limit=`

**Authentication**: User JWT (`Authorization: Bearer <token>`)

**Query Parameters**:
- `deviceId` (optional): Filter audit records by specific device ID.
- `limit` (optional): Max records to retrieve (default: 50, max: 100).

**Response**: `200 OK`
```json
[
  {
    "id": "e9b72a08-410a-4a25-9c59-bf72bc8cb7e5",
    "userId": "9cb934d4-28b3-4fba-bbcf-257a3e87d833",
    "deviceId": "d4621c97-6a16-4318-ba23-c91888a7cecf",
    "action": "REMOTE_WIPE_ATTEMPT",
    "metadata": {
      "result": "SUCCESS",
      "commandId": "c1f71df8-80e9-4e76-8051-7efd6b9d8858",
      "ip": "192.168.1.100",
      "userAgent": "Mozilla/5.0..."
    },
    "createdAt": "2026-10-08T02:30:00.000Z"
  }
]
```

---

## Device Capabilities Update
Devices report their wipe support via:
`PATCH /devices/:id/capabilities`

**Request Body**:
```json
{
  "adminEnabled": true,
  "wipeEnabled": true
}
```
