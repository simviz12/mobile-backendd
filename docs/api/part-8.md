# Part 8 API Documentation — Theft Mode

## Overview
Part 8 adds comprehensive **Theft Mode** functionality to the Guardian Mobile platform. Theft mode allows a device owner to trigger an emergency security posture on a lost or stolen device via a single, atomic remote command (`THEFT_MODE_ON`).

When activated, the backend creates one unified command containing all lockdown instructions (custom lockscreen message, optional owner contact phone, periodic high-frequency location interval, screen lock, and siren alarm). The protected device applies all configurations atomically and sends back a single acknowledgment.

---

## Data Models

### TheftMode
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `deviceId` | UUID | Foreign key referencing `devices(id)` |
| `activatedById` | UUID | Foreign key referencing `users(id)` |
| `activatedAt` | Timestamp | Timestamp when theft mode was initiated |
| `deactivatedAt` | Timestamp? | Timestamp when theft mode was deactivated (`null` when currently active) |
| `message` | String | Custom lockscreen message (1..200 characters) |
| `contactPhone` | String? | Alternate contact phone number for the finder |
| `locationIntervalSeconds`| Int | High-frequency GPS reporting interval (60..900 seconds) |
| `alarm` | Boolean | Whether high-volume siren alarm is sounding |
| `lock` | Boolean | Whether device screen is locked via Device Admin |

Constraint: Partial unique index on `(deviceId)` where `deactivatedAt IS NULL` ensuring at most **one** active record per device.

### Device
- Includes `theftModeActive` (boolean, default: `false`). Exposed across all device queries and serialized payloads.

---

## Endpoints

### 1. Activate Theft Mode
`POST /devices/:id/theft-mode`

**Authentication**: User JWT (`Authorization: Bearer <token>`)  
**Rate Limit**: 10 requests / minute per IP

#### Constraints & Validation:
- Device must be in `PROTECTED` mode and belong to the authenticated user (strict 404 on mismatch).
- If `lock: true`, target device must have `adminEnabled: true`; otherwise returns `409 CAPABILITY_NOT_AVAILABLE` with details `[{ capability: "DEVICE_ADMIN" }]`.
- If device already has an active theft mode record, returns `409 THEFT_MODE_ALREADY_ACTIVE`.
- Dispatches a single atomic command `THEFT_MODE_ON` with the full payload.
- Creates an `AuditEvent` with action `THEFT_MODE_ACTIVATED` logging the user ID, device ID, IP address, and parameters.

#### Request Body
```json
{
  "message": "Este teléfono fue reportado como robado. Por favor devolverlo al dueño.",
  "contactPhone": "+573001234567",
  "locationIntervalSeconds": 60,
  "alarm": true,
  "lock": true
}
```

#### Response (`201 Created`)
```json
{
  "theftMode": {
    "id": "e81d89b1-561b-4f4f-b672-911850d995c7",
    "deviceId": "2690fc16-f30c-43f6-95ff-43bc919e1e23",
    "activatedById": "6942c7aa-00b8-4c12-9c17-eb71887e2b10",
    "activatedAt": "2026-10-07T20:45:00.000Z",
    "deactivatedAt": null,
    "message": "Este teléfono fue reportado como robado. Por favor devolverlo al dueño.",
    "contactPhone": "+573001234567",
    "locationIntervalSeconds": 60,
    "alarm": true,
    "lock": true
  },
  "command": {
    "id": "92fcfb3d-1a87-4d7a-a63e-7b70e70b02ce",
    "deviceId": "2690fc16-f30c-43f6-95ff-43bc919e1e23",
    "issuedById": "6942c7aa-00b8-4c12-9c17-eb71887e2b10",
    "type": "THEFT_MODE_ON",
    "payload": {
      "message": "Este teléfono fue reportado como robado. Por favor devolverlo al dueño.",
      "contactPhone": "+573001234567",
      "locationIntervalSeconds": 60,
      "alarm": true,
      "lock": true
    },
    "status": "SENT",
    "createdAt": "2026-10-07T20:45:00.000Z"
  }
}
```

---

### 2. Get Active Theft Mode
`GET /devices/:id/theft-mode`

**Authentication**: User JWT (`Authorization: Bearer <token>`)

#### Response (`200 OK`)
```json
{
  "id": "e81d89b1-561b-4f4f-b672-911850d995c7",
  "deviceId": "2690fc16-f30c-43f6-95ff-43bc919e1e23",
  "activatedById": "6942c7aa-00b8-4c12-9c17-eb71887e2b10",
  "activatedAt": "2026-10-07T20:45:00.000Z",
  "deactivatedAt": null,
  "message": "Este teléfono fue reportado como robado.",
  "contactPhone": "+573001234567",
  "locationIntervalSeconds": 60,
  "alarm": true,
  "lock": true
}
```

If not active, returns `404 THEFT_MODE_NOT_ACTIVE`.

---

### 3. Get Theft Mode History
`GET /devices/:id/theft-mode/history`

**Authentication**: User JWT (`Authorization: Bearer <token>`)

Returns all theft mode activations (past and present) ordered newest first.

---

### 4. Deactivate Theft Mode
`DELETE /devices/:id/theft-mode?force=true|false`

**Authentication**: User JWT (`Authorization: Bearer <token>`)  
**Rate Limit**: 10 requests / minute per IP

#### Security & Rules:
- Re-authenticates user password using Argon2id. On failure, returns `401 INVALID_CREDENTIALS`.
- Issues a `THEFT_MODE_OFF` command (no payload).
- **Default flow (`force=false`)**: Command is sent to device. Database record remains active until device acks `POST /commands/:id/ack` with `status: EXECUTED`.
- **Force flow (`force=true`)**: Database record is immediately closed (`deactivatedAt` set and `theftModeActive=false`) server-side so controller dashboards update right away while the phone is offline. The `THEFT_MODE_OFF` command remains pending until the phone reconnects and executes it.
- Creates an `AuditEvent` with action `THEFT_MODE_DEACTIVATED` logging user, device, IP, and whether it was forced.

#### Request Body
```json
{
  "password": "UserAccountPassword123!"
}
```

#### Response (`200 OK`)
```json
{
  "theftMode": {
    "id": "e81d89b1-561b-4f4f-b672-911850d995c7",
    "deviceId": "2690fc16-f30c-43f6-95ff-43bc919e1e23",
    "activatedById": "6942c7aa-00b8-4c12-9c17-eb71887e2b10",
    "activatedAt": "2026-10-07T20:45:00.000Z",
    "deactivatedAt": "2026-10-07T20:48:00.000Z",
    "message": "Este teléfono fue reportado como robado.",
    "contactPhone": "+573001234567",
    "locationIntervalSeconds": 60,
    "alarm": true,
    "lock": true
  },
  "command": {
    "id": "673f821c-bcde-4200-a111-223344556677",
    "type": "THEFT_MODE_OFF",
    "status": "SENT"
  },
  "forced": true
}
```
