# Part 7 API Documentation — Heartbeat, Online/Offline Detection & WebSocket Real-time Events

## Overview
Part 7 adds device heartbeat / telemetry reporting (`POST /devices/:id/status`), online/offline status detection based on configurable heartbeat timeout (`HEARTBEAT_TIMEOUT_SECONDS`), background transition detection via scheduled cron job, and a real-time WebSocket gateway powered by Socket.IO (`/realtime`) providing authenticated, room-isolated live updates to user controllers.

---

## Data Models & Attributes

### Device Status Fields
| Field | Type | Description |
|---|---|---|
| `batteryLevel` | Int (0..100) | Current battery percentage reported by the device |
| `isCharging` | Boolean | Charging status reported by the device |
| `networkType` | String | Network connectivity (`wifi`, `mobile`, `none`, `unknown`) |
| `lastSeenAt` | Timestamp | Refreshed automatically on every authenticated device request |
| `isOnline` | Boolean (computed) | `true` if `now - lastSeenAt <= HEARTBEAT_TIMEOUT_SECONDS` (default: 300s) |
| `lastOnlineState` | Boolean | Internal tracking flag stored in DB to ensure single-fire event emissions |

---

## REST Endpoints

### 1. Report Device Status (Heartbeat)
`POST /devices/:id/status`

**Authentication**: Device Token (`Authorization: Device <token>`)  
**Response**: `204 No Content`

Refreshes device battery level, charging status, network connection type, and automatically bumps `lastSeenAt` to current timestamp.

#### Request Body
```json
{
  "batteryLevel": 88,
  "isCharging": true,
  "networkType": "wifi",
  "appVersion": "1.0.0"
}
```

#### Validation Rules
- `batteryLevel`: Integer between 0 and 100.
- `isCharging`: Boolean required.
- `networkType`: Enum string (`wifi`, `mobile`, `none`, `unknown`).
- `appVersion`: String (optional, max 50 chars).

#### Refreshing `lastSeenAt`
Every authenticated device request to the following endpoints automatically refreshes `lastSeenAt` and updates `lastOnlineState`:
- `POST /devices/:id/status`
- `POST /devices/:id/locations`
- `POST /commands/:id/ack`

---

## WebSocket Gateway (`/realtime`)

The Guardian Mobile backend exposes a real-time WebSocket service using **Socket.IO** at namespace `/realtime`.

### Handshake & Authentication
Clients must authenticate during the Socket.IO connection handshake by supplying their User JWT:
- Through `auth.token`: `{ auth: { token: "<user_jwt>" } }` or `{ auth: { token: "Bearer <user_jwt>" } }`
- Or via HTTP header `Authorization: Bearer <user_jwt>`

Invalid, missing, or expired tokens immediately result in connection rejection (`Unauthorized: Invalid or missing token`).

### Room Isolation
Upon successful authentication, the socket client automatically joins a private user room:
`user:<userId>`
All real-time events published for devices or commands owned by that user are routed exclusively to this room. Other users cannot eavesdrop on unauthorized devices.

### Connection Example (Client Snippet)
```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000/realtime", {
  auth: {
    token: userJwtToken,
  },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("Connected to Guardian Mobile Realtime Gateway");
});

socket.on("device.status", (data) => {
  console.log("Device status changed:", data);
});

socket.on("command.updated", (data) => {
  console.log("Command updated:", data);
});

socket.on("location.updated", (data) => {
  console.log("Location received:", data);
});

socket.on("connect_error", (err) => {
  console.error("Connection failed:", err.message);
});
```

---

## Real-time Events Specification

### 1. `device.status`
Emitted when:
- A device posts a status report (`POST /devices/:id/status`).
- The scheduled heartbeat job detects that an online device crossed `HEARTBEAT_TIMEOUT_SECONDS` without reporting (emitted **once** when transitioning to offline).
- An offline device performs an authenticated request and transitions back to online.

```json
{
  "deviceId": "f7ba6e3d-8e10-42b1-9093-178398a4239b",
  "isOnline": true,
  "batteryLevel": 88,
  "isCharging": true,
  "networkType": "wifi",
  "lastSeenAt": "2026-10-07T20:15:30.000Z"
}
```

### 2. `device.linked`
Emitted when a new protected device is linked:
```json
{
  "deviceId": "f7ba6e3d-8e10-42b1-9093-178398a4239b",
  "ownerId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
}
```

### 3. `device.unlinked`
Emitted when a device is unlinked:
```json
{
  "deviceId": "f7ba6e3d-8e10-42b1-9093-178398a4239b",
  "ownerId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
}
```

### 4. `command.updated`
Emitted whenever a command status updates (e.g. acknowledged by device as `DELIVERED`, `EXECUTED`, or `FAILED`):
```json
{
  "commandId": "e3a890bc-1234-5678-90ab-cdef12345678",
  "deviceId": "f7ba6e3d-8e10-42b1-9093-178398a4239b",
  "type": "VIBRATE",
  "status": "EXECUTED",
  "failureReason": null,
  "updatedAt": "2026-10-07T20:16:02.120Z"
}
```

### 5. `location.updated`
Emitted immediately whenever a device submits a new GPS location:
```json
{
  "deviceId": "f7ba6e3d-8e10-42b1-9093-178398a4239b",
  "location": {
    "id": "c1d2e3f4-0000-1111-2222-333344445555",
    "deviceId": "f7ba6e3d-8e10-42b1-9093-178398a4239b",
    "latitude": 4.60971,
    "longitude": -74.08175,
    "accuracyMeters": 5.2,
    "speedMps": 0.8,
    "recordedAt": "2026-10-07T20:15:00.000Z",
    "receivedAt": "2026-10-07T20:15:01.200Z",
    "source": "LOCATE_COMMAND"
  }
}
```

---

## Background Scheduled Jobs

### Heartbeat Offline Monitor (`DeviceHeartbeatJob`)
- **Interval**: Runs every 30 seconds (`@Cron('*/30 * * * * *')`).
- **Logic**: Evaluates all devices. If `now - lastSeenAt > HEARTBEAT_TIMEOUT_SECONDS` and `lastOnlineState == true`, it transitions `lastOnlineState = false`, persists to database, and publishes `device.status` with `isOnline: false` **once**.
- When the device comes back and sends any authenticated request, `lastOnlineState` is updated back to `true`, emitting `device.status` with `isOnline: true`.
