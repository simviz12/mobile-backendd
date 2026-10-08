# Guardian Mobile - Backend API

Legitimate remote anti-theft system for Android phones.

---

## 🏗 Architecture & Design
- **Framework**: NestJS (TypeScript, Strict Mode)
- **Database**: PostgreSQL 16 + Prisma ORM
- **Clean Architecture Pattern**:
  - `src/modules/<feature>/domain`: Pure business entities and port interfaces (zero framework dependencies).
  - `src/modules/<feature>/application`: Use cases orchestrating domain rules.
  - `src/modules/<feature>/infrastructure`: Adapters, Prisma database repositories, external integrations.
  - `src/modules/<feature>/presentation`: Controllers and DTOs with validation and Swagger documentation.
  - `src/shared`: Global exception filters, environment validation, logging interceptors, Prisma service.

---

## 🚀 How to Run From Zero (PowerShell)

### 1. Prerequisites
- Docker Desktop running on Windows
- Node.js 20+ (Node 22 recommended)
- Git

### 2. Setup Environment
```powershell
# Copy environment template
Copy-Item .env.example .env

# Install project dependencies
npm install
```

### 3. Start Database (PostgreSQL 16)
```powershell
docker compose up -d
```

### 4. Run Migrations & Generate Prisma Client
```powershell
npm run db:migrate
```

### 5. Start Server
```powershell
# Development watch mode
npm run start:dev

# Production build & run
npm run build
npm run start:prod
```

The API will listen on `0.0.0.0:3000` (allowing mobile connection via LAN or `adb reverse tcp:3000 tcp:3000`).

---

## 🧪 Testing & Quality Assurance

```powershell
# Linting
npm run lint

# Unit tests
npm test

# End-to-End (E2E) tests
npm run test:e2e
```

---

## 📖 API Documentation & Swagger
- Interactive Swagger UI: `http://localhost:3000/docs`
- Exported OpenAPI Specification: `openapi.yaml` in the repository root
- Endpoint Documentation:
  - `docs/api/part-0.md` (Health)
  - `docs/api/part-1.md` (Authentication & Sessions)
  - `docs/api/part-2.md` (Devices Management)
  - `docs/api/part-3.md` (Commands Pipeline & FCM Delivery)
  - `docs/api/part-4.md` (VIBRATE & MESSAGE Commands, Command History)
  - `docs/api/part-5.md` (LOCK Command & Capabilities)
  - `docs/api/part-6.md` (Locations & LOCATE Command)
  - `docs/api/part-7.md` (Device Connectivity & Diagnostics)

---

## 🔐 Authentication & Session Security (Part 1)
- **Password Hashing**: `argon2id`
- **Access Tokens**: Short-lived JWTs (default `15m`)
- **Refresh Tokens**: Rotating opaque high-entropy tokens with SHA-256 storage and reuse detection.
- **Rate Limiting**: 10 requests / minute per IP on sensitive authentication routes (`@nestjs/throttler`).
- **Endpoints**:
  - `POST /auth/register`: User sign-up (email, password, displayName)
  - `POST /auth/login`: User sign-in
  - `POST /auth/refresh`: Session refresh & token rotation
  - `POST /auth/logout`: Revoke session
  - `GET /auth/me`: Authenticated user profile

---

## 📱 Devices Management (Part 2)
- **Device Token**: 256-bit high-entropy token generated on link, hashed with SHA-256 (`deviceTokenHash`). Returned only once to the client.
- **Independent Device Auth**: Header `Authorization: Device <deviceToken>` for decoupled device-originated operations.
- **Strict Ownership**: Requests to resources belonging to another user strictly return `404 DEVICE_NOT_FOUND` without leaking existence.
- **Presence Tracking**: `isOnline` dynamically evaluated based on `(now - lastSeenAt) <= HEARTBEAT_TIMEOUT_SECONDS` (default 300s).
- **Computed Last Location**: Every device response (`GET /devices`, `GET /devices/:id`) includes computed `lastLocation` `{ latitude, longitude, accuracyMeters, recordedAt }`.
- **Endpoints**:
  - `POST /devices`: Link or re-link a mobile device (idempotent for same installId, rotates token)
  - `GET /devices`: List caller's devices (newest first)
  - `GET /devices/:id`: Get device details
  - `PATCH /devices/:id`: Rename or update FCM token
  - `DELETE /devices/:id`: Unlink device and invalidate device token

---

## ⚡ Commands Pipeline & FCM Delivery (Part 3, Part 4 & Part 5)
- **Supported Command Types**:
  - `RING`: Payload `{ durationSeconds: 5..60 }` (default 30).
  - `VIBRATE`: Payload `{ durationSeconds: 1..30 }` (default 5).
  - `MESSAGE`: Payload `{ text: 1..200 chars (trimmed, plain text), contactPhone?: string (5..20 digits and optional '+') }`.
  - `LOCK`: No payload allowed. Requires target device to have `adminEnabled === true` (otherwise `409 CAPABILITY_NOT_AVAILABLE`). Uses shorter TTL (`LOCK_COMMAND_TTL_SECONDS`, default 60s). Logs immutable `AuditEvent`.
  - `LOCATE`: No payload allowed. 60-second TTL. Prompts device to acquire GPS and respond with `LOCATE_COMMAND` source location report and command acknowledgment. Logs immutable `AuditEvent` (`COMMAND_LOCATE_ISSUED`).
- **Device Capabilities**:
  - `adminEnabled` boolean reported by hardware daemon via `PATCH /devices/:id/capabilities` (`Authorization: Device <token>`).
  - `adminEnabled` exposed in all device responses.
- **Domain Validation**: Per-type payload validation strictly enforced in domain/application layer (`CommandPayloadValidator`).
- **Push Notification Architecture**:
  - Clean Architecture `PushNotificationPort` decoupled from Firebase Admin SDK.
  - Data-only high-priority FCM messages (`android.priority: "high"`, TTL matching command expiration).
  - Invalid FCM tokens automatically cleared on delivery failure (`DEVICE_NOT_REACHABLE`).
- **Command State Machine**:
  - States: `PENDING` -> `SENT` -> `DELIVERED` -> `EXECUTED`. Failures transition to `FAILED`.
  - Non-final commands expire automatically via background cron job (`@Cron('*/30 * * * * *')`) if `expiresAt < now`.
  - Device daemon acknowledges receipt and execution via `POST /commands/:id/ack` using `Authorization: Device <token>`.
- **Cursor Pagination & Filters**:
  - `GET /devices/:id/commands` supports cursor pagination (`?limit=1..50`, `?cursor=...`) and filtering by `?status=...` and `?type=...`.
  - Response structure: `{ items: [...], nextCursor: string | null }`.
- **Endpoints**:
  - `POST /devices/:id/commands`: Issue command (`RING`, `VIBRATE`, `MESSAGE`, `LOCK`, `LOCATE`)
  - `GET /devices/:id/commands`: List commands issued for a device with cursor pagination & filters
  - `GET /commands/:id`: Get status and timestamps of an individual command
  - `POST /commands/:id/ack`: Device acknowledgment (`DELIVERED`, `EXECUTED`, or `FAILED`)
  - `PATCH /devices/:id/capabilities`: Update device capabilities reported by device hardware daemon

---

## 📍 Locations & The LOCATE Command (Part 6)
- **Device Location Reporting**:
  - Single location or offline batch up to 50 items in one request (`POST /devices/:id/locations` with `Authorization: Device <token>`).
  - Range validation: `latitude` in `[-90, 90]`, `longitude` in `[-180, 180]`.
  - Rejection of timestamps > 5 minutes in future or > 24 hours old with `400 VALIDATION_ERROR`.
  - Extensible source enum: `LOCATE_COMMAND`, `PERIODIC`, `THEFT_MODE`.
- **Owner History & Latest Query**:
  - `GET /devices/:id/locations?from=&to=&limit=`: Newest first, limit up to 500. Owner-only.
  - `GET /devices/:id/locations/latest`: Immediate latest fix or `404 NO_LOCATION_YET`.
- **Automated Retention Pruning**:
  - Daily midnight cron (`LocationRetentionJob`) prunes records older than `LOCATION_RETENTION_DAYS` (default 30).
- **Endpoints**:
  - `POST /devices/:id/locations`: Post GPS location fix (single or batch)
  - `GET /devices/:id/locations`: Query historical locations with time window & limit
  - `GET /devices/:id/locations/latest`: Query latest location fix

---

## ⚡ Heartbeat, Online/Offline & Real-time WebSockets (Part 7)
- **Device Heartbeat & Telemetry**:
  - `POST /devices/:id/status` (`Authorization: Device <token>`): Report battery level (0..100), charging status, and network connection type (`wifi`, `mobile`, `none`, `unknown`). Returns `204 No Content`.
  - Every authenticated device endpoint (`/status`, `/locations`, `/ack`) automatically bumps `lastSeenAt`.
- **Online/Offline Transition Detection**:
  - `isOnline` is determined against `HEARTBEAT_TIMEOUT_SECONDS` (default: 300s).
  - Background scheduled job (`DeviceHeartbeatJob`, every 30s) detects devices crossing the timeout threshold and emits `device.status` (offline) **once** per transition.
- **WebSocket Gateway (`/realtime`)**:
  - Namespace: `/realtime` powered by Socket.IO.
  - Handshake authentication using User JWT (`handshake.auth.token` or `Authorization: Bearer <token>`).
  - Strict room isolation: Each authenticated user joins private room `user:<userId>`.
  - Clean Architecture event publishing via `EventPublisherPort`.
- **Real-time Event Catalog**:
  - `device.status`: `{ deviceId, isOnline, batteryLevel, isCharging, networkType, lastSeenAt }`
  - `device.linked` / `device.unlinked`: `{ deviceId, ownerId }`
  - `command.updated`: `{ commandId, deviceId, type, status, failureReason, updatedAt }`
  - `location.updated`: `{ deviceId, location }`
- **Interactive Acceptance Demo Script**:
  - Run `npx tsx scripts/demo-websocket-session.ts` to see live WebSocket event reception.

## 🌿 GitFlow Branching Model
- `main`: Production-ready releases.
- `develop`: Integration branch for active development.
- `feature/part-N-<name>`: Vertical slice feature branch branched from `develop`.
- Direct pushes to `main` and `develop` are strictly prohibited (except repository bootstrap). Merges require PR approval.

