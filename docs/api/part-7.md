# Part 7 API Documentation — Device Connectivity & Diagnostics

## Overview
Part 7 addresses device connectivity, health tracking, and remote diagnostics. Protected devices can report hardware capabilities, battery status, and OS permissions, allowing controllers and owners to understand why a phone might not be receiving commands or posting location data.

---

## 1. Diagnostics Endpoint
`GET /devices/:id/diagnostics`

**Authentication**: User JWT (`Authorization: Bearer <jwt>`)  
**Authorization**: Device owner only. Other users receive `404 DEVICE_NOT_FOUND`.

### Response (`200 OK`)
```json
{
  "hasFcmToken": true,
  "hasDeviceToken": true,
  "lastSeenAt": "2026-10-07T18:20:08.648Z",
  "lastStatusAt": "2026-10-07T18:20:08.648Z",
  "lastLocationAt": "2026-10-07T18:25:00.000Z",
  "lastCommand": {
    "type": "VIBRATE",
    "status": "SENT",
    "failureReason": null,
    "at": "2026-10-07T18:20:05.000Z"
  },
  "permissions": {
    "notifications": true,
    "locationForeground": true,
    "locationBackground": true,
    "batteryOptimizationIgnored": true,
    "deviceAdmin": true,
    "fullScreenIntent": true
  },
  "problems": [
    "NO_LOCATION"
  ]
}
```

### Problem Codes (`problems` array)
Computed dynamically by the server:
- `NO_FCM_TOKEN`: Target device has not registered an FCM push token.
- `NO_HEARTBEAT`: Device has not communicated within `HEARTBEAT_TIMEOUT_SECONDS` (default 300s).
- `NO_LOCATION`: Device has never posted any GPS fix.
- `NOTIFICATIONS_DENIED`: Notification permission explicitly denied by the user.
- `LOCATION_DENIED`: Foreground location permission denied.
- `BACKGROUND_LOCATION_DENIED`: Background location permission denied.
- `BATTERY_OPTIMIZED`: Battery optimization is active (device may kill background daemons).
- `ADMIN_NOT_ENABLED`: Device Admin privilege is not enabled for a PROTECTED device (prevents `LOCK` command).

---

## 2. Extended Device Capabilities & Permissions Report
`PATCH /devices/:id/capabilities`

**Authentication**: Device Bearer Token (`Authorization: Device <token>`)

Allows the mobile device daemon to update its active permissions, hardware status, and touch the server heartbeat.

### Request Body
```json
{
  "adminEnabled": true,
  "batteryLevel": 94,
  "isCharging": false,
  "permissions": {
    "notifications": true,
    "locationForeground": true,
    "locationBackground": true,
    "batteryOptimizationIgnored": true,
    "deviceAdmin": true,
    "fullScreenIntent": true
  }
}
```

### Response (`200 OK`)
```json
{
  "device": {
    "id": "c9e88631-98e7-43d8-815b-da6dcaf12f48",
    "ownerId": "...",
    "name": "Xiaomi Real Phone",
    "mode": "PROTECTED",
    "adminEnabled": true,
    "batteryLevel": 94,
    "isCharging": false,
    "lastSeenAt": "2026-10-07T18:20:08.648Z",
    "isOnline": true
  }
}
```
