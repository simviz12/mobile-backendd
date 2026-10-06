# Part 6 API Documentation — Locations & LOCATE Command

## Overview
Part 6 adds location tracking and the `LOCATE` remote command to the Guardian Mobile API. Protected devices report GPS locations (single or batch for offline synchronization), owners can view location history and immediate latest fixes, and `LOCATE` commands trigger on-demand fixes with an audit trail.

---

## Data Models

### Location
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `deviceId` | UUID | Foreign key referencing `devices(id)` |
| `latitude` | Float | GPS latitude in degrees `[-90, 90]` |
| `longitude` | Float | GPS longitude in degrees `[-180, 180]` |
| `accuracyMeters` | Float? | GPS accuracy radius in meters |
| `speedMps` | Float? | Device speed in meters per second |
| `recordedAt` | Timestamp | Timestamp captured by device GPS |
| `receivedAt` | Timestamp | Timestamp received by server |
| `source` | Enum | `LOCATE_COMMAND`, `PERIODIC`, `THEFT_MODE` |

Index: `(deviceId, recordedAt DESC)` and `(recordedAt)` for retention cleanup.

---

## Endpoints

### 1. Record Device Location(s)
`POST /devices/:id/locations`

**Authentication**: Device Bearer Token (`Authorization: Device <token>`)

**Constraints**:
- Validates coordinates: `latitude` in `[-90, 90]`, `longitude` in `[-180, 180]`.
- Rejects timestamps in the future (> 5 min) and older than 24h with `400 VALIDATION_ERROR`.
- Supports single entry or offline batch up to 50 items.

#### Single Location Request
```http
POST /devices/f7ba6e3d-8e10-42b1-9093-178398a4239b/locations HTTP/1.1
Authorization: Device <device-token>
Content-Type: application/json

{
  "latitude": 4.60971,
  "longitude": -74.08175,
  "accuracyMeters": 5.2,
  "speedMps": 0.8,
  "recordedAt": "2026-10-06T17:26:15.780Z",
  "source": "LOCATE_COMMAND"
}
```

**Response (`201 Created`)**:
```json
{
  "id": "a8f6ab96-5d9a-4313-9375-150d1fd4dfcd",
  "deviceId": "f7ba6e3d-8e10-42b1-9093-178398a4239b",
  "latitude": 4.60971,
  "longitude": -74.08175,
  "accuracyMeters": 5.2,
  "speedMps": 0.8,
  "recordedAt": "2026-10-06T17:26:15.780Z",
  "receivedAt": "2026-10-06T17:26:15.794Z",
  "source": "LOCATE_COMMAND"
}
```

#### Batch Request (Offline sync up to 50 items)
```http
POST /devices/f7ba6e3d-8e10-42b1-9093-178398a4239b/locations HTTP/1.1
Authorization: Device <device-token>
Content-Type: application/json

{
  "locations": [
    {
      "latitude": 4.61100,
      "longitude": -74.08200,
      "accuracyMeters": 10.0,
      "recordedAt": "2026-10-06T17:24:15.803Z",
      "source": "PERIODIC"
    },
    {
      "latitude": 4.61200,
      "longitude": -74.08300,
      "accuracyMeters": 8.0,
      "recordedAt": "2026-10-06T17:25:15.803Z",
      "source": "PERIODIC"
    }
  ]
}
```

---

### 2. Get Location History
`GET /devices/:id/locations?from=...&to=...&limit=...`

**Authentication**: User JWT (`Authorization: Bearer <jwt>`)  
**Authorization**: Device owner only. Other users receive `404 DEVICE_NOT_FOUND`.

**Query Parameters**:
- `from` *(optional ISO 8601 string)*
- `to` *(optional ISO 8601 string)*
- `limit` *(optional integer 1..500, default 50)*

**Response (`200 OK`)**:
```json
[
  {
    "id": "a8f6ab96-5d9a-4313-9375-150d1fd4dfcd",
    "deviceId": "f7ba6e3d-8e10-42b1-9093-178398a4239b",
    "latitude": 4.60971,
    "longitude": -74.08175,
    "accuracyMeters": 5.2,
    "speedMps": 0.8,
    "recordedAt": "2026-10-06T17:26:15.780Z",
    "receivedAt": "2026-10-06T17:26:15.794Z",
    "source": "LOCATE_COMMAND"
  }
]
```

---

### 3. Get Latest Location
`GET /devices/:id/locations/latest`

**Authentication**: User JWT (`Authorization: Bearer <jwt>`)  
**Response (`200 OK`)**: Returns the single newest location. If no locations exist, returns `404 NO_LOCATION_YET`.

---

### 4. Computed Device `lastLocation`
All device responses (`GET /devices`, `GET /devices/:id`) now include `lastLocation`:
```json
{
  "id": "f7ba6e3d-8e10-42b1-9093-178398a4239b",
  "name": "Pixel 8 GPS",
  "adminEnabled": true,
  "lastLocation": {
    "latitude": 4.60971,
    "longitude": -74.08175,
    "accuracyMeters": 5.2,
    "recordedAt": "2026-10-06T17:26:15.780Z"
  }
}
```

---

### 5. Issue LOCATE Command
`POST /devices/:id/commands`

**Request Body**:
```json
{
  "type": "LOCATE"
}
```
- Rejects any non-empty payload with `400 VALIDATION_ERROR`.
- Uses a 60-second TTL.
- Creates an `AuditEvent` with action `COMMAND_LOCATE_ISSUED`.
- The device responds by posting GPS location with source `LOCATE_COMMAND` and calling `POST /commands/:id/ack` with `status: EXECUTED`.
