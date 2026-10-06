# API Specification - Part 4: VIBRATE, MESSAGE & Command History with Cursor Pagination

## Base URL
- Local: `http://localhost:3000`
- Android Emulator: `http://10.0.2.2:3000` or `http://localhost:3000` via `adb reverse tcp:3000 tcp:3000`
- Swagger UI Documentation: `http://localhost:3000/docs`
- OpenAPI Specification: [`openapi.yaml`](../../openapi.yaml)

---

## Overview

Part 4 extends the command execution pipeline introduced in Part 3 by:
1. Adding two new command types to the `CommandType` enum: `VIBRATE` and `MESSAGE`.
2. Applying strict domain/application-level validation per command type (rejecting invalid payloads with `400 VALIDATION_ERROR`).
3. Enforcing plain text sanitization on message bodies (never interpreted as HTML).
4. Providing cursor-based pagination and optional filtering (`?limit`, `?cursor`, `?status`, `?type`) on device command history (`GET /devices/:id/commands`).
5. Guaranteeing full privacy and audit history: command responses include the full payload (including `contactPhone` since it was issued by the verified device owner).

---

## Command Types & Payload Rules

All command payloads are validated strictly in the domain/application layer (`CommandPayloadValidator`):

### 1. `RING`
- **Payload Schema**: `{ durationSeconds?: number }`
- **Validation**: Integer between `5` and `60` (default: `30`).
- **Example**:
  ```json
  {
    "type": "RING",
    "payload": {
      "durationSeconds": 30
    }
  }
  ```

### 2. `VIBRATE`
- **Payload Schema**: `{ durationSeconds?: number }`
- **Validation**: Integer between `1` and `30` (default: `5`).
- **Example**:
  ```json
  {
    "type": "VIBRATE",
    "payload": {
      "durationSeconds": 10
    }
  }
  ```

### 3. `MESSAGE`
- **Payload Schema**:
  ```json
  {
    "text": "string (1..200 characters, required, trimmed)",
    "contactPhone": "string (5..20 characters, optional, digits and '+' only)"
  }
  ```
- **Validation & Sanitization**:
  - `text`: Trimmed string, length between 1 and 200 characters. Plain text only.
  - `contactPhone`: Regex `/^\+?[0-9]+$/`, length between 5 and 20 characters.
  - Returns `400 VALIDATION_ERROR` with specific field details if validation fails.
- **Example**:
  ```json
  {
    "type": "MESSAGE",
    "payload": {
      "text": "This phone is in lost mode. Please call owner.",
      "contactPhone": "+18005550199"
    }
  }
  ```

---

## FCM Delivery Payload Structure

The FCM push delivery maintains full wire compatibility with Part 3. The `payload` object is serialized into a JSON string within the data payload:

```json
{
  "commandId": "c351c8e0-d995-4b52-87e8-bf4a8466fa58",
  "type": "MESSAGE",
  "payload": "{\"text\":\"This phone is in lost mode.\",\"contactPhone\":\"+18005550199\"}",
  "expiresAt": "2026-10-06T16:05:32.507Z"
}
```

---

## Endpoints

### 1. Issue Command (`RING`, `VIBRATE`, `MESSAGE`)
- **Method**: `POST`
- **Path**: `/devices/:id/commands`
- **Auth Required**: YES (`Authorization: Bearer <accessToken>`)
- **Response**: `201 Created`

#### Example Request (MESSAGE)
```http
POST /devices/ccad003b-45b7-425a-acd7-20b75f8e30d1/commands HTTP/1.1
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "type": "MESSAGE",
  "payload": {
    "text": "Phone is lost. Please call.",
    "contactPhone": "+18005550199"
  }
}
```

#### Example Response (`201 Created`)
```json
{
  "id": "c351c8e0-d995-4b52-87e8-bf4a8466fa58",
  "deviceId": "ccad003b-45b7-425a-acd7-20b75f8e30d1",
  "issuedById": "a68afa9e-13da-44cc-8974-89420b78481b",
  "type": "MESSAGE",
  "payload": {
    "text": "Phone is lost. Please call.",
    "contactPhone": "+18005550199"
  },
  "status": "SENT",
  "failureReason": null,
  "createdAt": "2026-10-06T16:03:32.507Z",
  "sentAt": "2026-10-06T16:03:32.610Z",
  "deliveredAt": null,
  "executedAt": null,
  "expiresAt": "2026-10-06T16:05:32.507Z"
}
```

#### Validation Error (`400 Bad Request`)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      "durationSeconds must be between 1 and 30"
    ]
  }
}
```

---

### 2. List Device Commands History (Cursor Paginated)
- **Method**: `GET`
- **Path**: `/devices/:id/commands`
- **Auth Required**: YES (`Authorization: Bearer <accessToken>`)
- **Query Parameters**:
  - `limit`: Integer (1..50, default 20)
  - `cursor`: Opaque base64 string cursor
  - `status`: Optional filter by `CommandStatus` (`PENDING`, `SENT`, `DELIVERED`, `EXECUTED`, `FAILED`, `EXPIRED`)
  - `type`: Optional filter by `CommandType` (`RING`, `VIBRATE`, `MESSAGE`)

#### Example Response (`200 OK`)
```json
{
  "items": [
    {
      "id": "c351c8e0-d995-4b52-87e8-bf4a8466fa58",
      "deviceId": "ccad003b-45b7-425a-acd7-20b75f8e30d1",
      "issuedById": "a68afa9e-13da-44cc-8974-89420b78481b",
      "type": "MESSAGE",
      "payload": {
        "text": "Phone is lost. Please call.",
        "contactPhone": "+18005550199"
      },
      "status": "EXECUTED",
      "failureReason": null,
      "createdAt": "2026-10-06T16:03:32.507Z",
      "sentAt": "2026-10-06T16:03:32.610Z",
      "deliveredAt": "2026-10-06T16:03:33.100Z",
      "executedAt": "2026-10-06T16:03:33.400Z",
      "expiresAt": "2026-10-06T16:05:32.507Z"
    }
  ],
  "nextCursor": "YzM1MWM4ZTAtZDk5NS00YjUyLTg3ZTgtYmY0YTg0NjZmYTU4"
}
```
If there are no subsequent pages, `nextCursor` is `null`.
