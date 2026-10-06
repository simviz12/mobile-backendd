# API Specification - Part 2: Devices Management

## Base URL
- Local: `http://localhost:3000`
- Android Emulator: `http://10.0.2.2:3000` or `http://localhost:3000` via `adb reverse tcp:3000 tcp:3000`
- Swagger UI Documentation: `http://localhost:3000/docs`
- OpenAPI Specification: [`openapi.yaml`](../../openapi.yaml)

---

## Device Token & Independent Authentication Model
- When a device is linked (`POST /devices`), a random 256-bit token is generated.
- The backend stores **ONLY** the SHA-256 hash (`deviceTokenHash`). The raw token is returned **EXACTLY ONCE** in the response.
- Mobile devices executing future hardware-level commands (location, ack, status) will authenticate using:
  `Authorization: Device <deviceToken>`
- This authentication is decoupled from the user's interactive JWT session via `DeviceAuthGuard`.
- Re-linking the same `installId` for the same user is **idempotent**: it updates device metadata, rotates the device token, and returns the new raw token (`200 OK`).
- Unlinking a device (`DELETE /devices/:id`) immediately invalidates the device token and deletes the device record.

---

## Device Online Status Rule (`isOnline`)
- When `lastSeenAt` is `null`, `isOnline` is strictly `false`.
- A device is considered `isOnline: true` if `(now - lastSeenAt) <= HEARTBEAT_TIMEOUT_SECONDS` (default: 300 seconds).

---

## Strict Ownership & Privacy
- If a user requests, patches, or deletes a device ID belonging to another user, the API responds with `404 Not Found` (`code: DEVICE_NOT_FOUND`).
- The backend **never leaks** device existence across user accounts.
- The `deviceTokenHash` is internal and **never returned** in any API response.

---

## Endpoints

### 1. Link or Re-link Device
- **Method**: `POST`
- **Path**: `/devices`
- **Auth Required**: YES (`Authorization: Bearer <accessToken>`)

#### Request Body
```json
{
  "installId": "app-installation-uuid",
  "name": "My Pixel 8 Pro",
  "platform": "android",
  "model": "Pixel 8 Pro",
  "osVersion": "14",
  "appVersion": "1.0.0",
  "mode": "PROTECTED",
  "fcmToken": "fcm_token_sample"
}
```
*Validation:* `name` 1..40 chars. `platform` must be `"android"` or `"ios"`. `mode` must be `"PROTECTED"` or `"CONTROLLER"`.

#### Responses
- **201 Created** (First time link for this `installId`):
```json
{
  "device": {
    "id": "fa0363eb-72f2-486a-b3a2-d3c897542be3",
    "ownerId": "d9833c44-ec7a-40bb-99bd-7622c0e20f3f",
    "installId": "app-installation-uuid",
    "name": "My Pixel 8 Pro",
    "platform": "android",
    "model": "Pixel 8 Pro",
    "osVersion": "14",
    "appVersion": "1.0.0",
    "mode": "PROTECTED",
    "fcmToken": "fcm_token_sample",
    "batteryLevel": null,
    "isCharging": null,
    "lastSeenAt": null,
    "isOnline": false,
    "createdAt": "2026-10-06T02:52:24.407Z",
    "updatedAt": "2026-10-06T02:52:24.407Z"
  },
  "deviceToken": "b3589670723b9fae4fa7f166a23ba69d263519ef5069a2b9f9603dfe74b158be"
}
```
- **200 OK** (Idempotent update for existing `installId`, rotates `deviceToken`):
  Same JSON shape as 201 Created, returning the new raw `deviceToken`.
- **400 Bad Request**: `{"error":{"code":"VALIDATION_ERROR","message":"Validation failed","details":["..."]}}`

---

### 2. List Caller's Devices
- **Method**: `GET`
- **Path**: `/devices`
- **Auth Required**: YES (`Authorization: Bearer <accessToken>`)

#### Response (200 OK)
Returns only devices belonging to the caller, ordered newest first (`createdAt desc`):
```json
{
  "devices": [
    {
      "id": "fa0363eb-72f2-486a-b3a2-d3c897542be3",
      "ownerId": "d9833c44-ec7a-40bb-99bd-7622c0e20f3f",
      "installId": "app-installation-uuid",
      "name": "My Pixel 8 Pro",
      "platform": "android",
      "model": "Pixel 8 Pro",
      "osVersion": "14",
      "appVersion": "1.0.0",
      "mode": "PROTECTED",
      "fcmToken": "fcm_token_sample",
      "batteryLevel": null,
      "isCharging": null,
      "lastSeenAt": null,
      "isOnline": false,
      "createdAt": "2026-10-06T02:52:24.407Z",
      "updatedAt": "2026-10-06T02:52:24.407Z"
    }
  ]
}
```

---

### 3. Get Device By ID
- **Method**: `GET`
- **Path**: `/devices/:id`
- **Auth Required**: YES (`Authorization: Bearer <accessToken>`)

#### Responses
- **200 OK**: Single device object.
- **404 Not Found**: `{"error":{"code":"DEVICE_NOT_FOUND","message":"Device not found"}}` (Returned if not found OR belongs to another user).

---

### 4. Update Device Details
- **Method**: `PATCH`
- **Path**: `/devices/:id`
- **Auth Required**: YES (`Authorization: Bearer <accessToken>`)

#### Request Body
```json
{
  "name": "Renamed Device Name",
  "fcmToken": "new_fcm_token_optional"
}
```

#### Responses
- **200 OK**: Updated device object.
- **404 Not Found**: `{"error":{"code":"DEVICE_NOT_FOUND","message":"Device not found"}}`

---

### 5. Unlink and Delete Device
- **Method**: `DELETE`
- **Path**: `/devices/:id`
- **Auth Required**: YES (`Authorization: Bearer <accessToken>`)

#### Responses
- **204 No Content**: Device removed, device token invalidated.
- **404 Not Found**: If device does not exist or belongs to another user.
