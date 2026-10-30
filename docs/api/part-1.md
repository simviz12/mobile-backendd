# API Specification - Part 1: Authentication & Session Management

## Base URL
- Local: `http://localhost:3000`
- Android Emulator: `http://10.0.2.2:3000` or `http://localhost:3000` via `adb reverse tcp:3000 tcp:3000`
- Swagger UI Documentation: `http://localhost:3000/docs`
- OpenAPI Specification: [`openapi.yaml`](../../openapi.yaml)

---

## Security Model
- **Passwords**: Hashed with **argon2id** (`timeCost: 3`, `memoryCost: 65536`).
- **Access Tokens**: Short-lived JWTs (default `15m`). Stored in memory or SecureStorage.
- **Refresh Tokens**: Rotating opaque high-entropy tokens (default `30d`). In the database, only the **SHA-256 hash** (`tokenHash`) is persisted.
- **Refresh Token Rotation & Reuse Detection**: Every time `/auth/refresh` is called, the used refresh token is revoked and linked to the new token (`replacedById`). If an already-revoked refresh token is re-submitted, the server immediately revokes all sessions belonging to that user and returns `401 REFRESH_TOKEN_REUSED`.
- **Rate Limiting**: Rate limited with `@nestjs/throttler` (default 10 req/min for auth endpoints, returns `429 TOO_MANY_REQUESTS`).
- **Privacy & Defense**: Unknown email vs invalid password always returns identical error code `INVALID_CREDENTIALS` (status 401).

---

## Error Response Format
All errors strictly return:
```json
{
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Human readable English description",
    "details": ["Optional list of validation errors"]
  }
}
```

---

## Endpoints

### 1. Register User
- **Method**: `POST`
- **Path**: `/auth/register`
- **Auth Required**: NO
- **Rate Limit**: 10 req / minute

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "displayName": "Alex Developer"
}
```
*Password rule: minimum 8 characters, at least 1 letter and 1 number.*

#### Responses
- **201 Created**:
```json
{
  "user": {
    "id": "aa0909b5-1786-4421-a4b6-7e4aa8a1d4f9",
    "email": "user@example.com",
    "displayName": "Alex Developer"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "refreshToken": "9a6bae4310e4ac0df19503b...",
  "expiresIn": 900
}
```
- **409 Conflict**: `{"error":{"code":"EMAIL_ALREADY_REGISTERED","message":"An account with this email already exists"}}`
- **400 Bad Request**: `{"error":{"code":"VALIDATION_ERROR","message":"Validation failed","details":["password must contain at least one letter and one number"]}}`

---

### 2. Login User
- **Method**: `POST`
- **Path**: `/auth/login`
- **Auth Required**: NO
- **Rate Limit**: 10 req / minute

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

#### Responses
- **200 OK**: Same shape as Register response (`user`, `accessToken`, `refreshToken`, `expiresIn`).
- **401 Unauthorized**: `{"error":{"code":"INVALID_CREDENTIALS","message":"Invalid email or password"}}`

---

### 3. Refresh Session (Rotate)
- **Method**: `POST`
- **Path**: `/auth/refresh`
- **Auth Required**: NO (Uses Refresh Token body)

#### Request Body
```json
{
  "refreshToken": "9a6bae4310e4ac0df19503b..."
}
```

#### Responses
- **200 OK**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "refreshToken": "33b1b24c17b902e8819a979...",
  "expiresIn": 900
}
```
- **401 Unauthorized** (Expired): `{"error":{"code":"REFRESH_TOKEN_EXPIRED","message":"Refresh token has expired"}}`
- **401 Unauthorized** (Invalid): `{"error":{"code":"REFRESH_TOKEN_INVALID","message":"Invalid refresh token"}}`
- **401 Unauthorized** (Reuse of revoked token): `{"error":{"code":"REFRESH_TOKEN_REUSED","message":"Revoked refresh token reuse detected. All user sessions have been invalidated."}}`

---

### 4. Logout User
- **Method**: `POST`
- **Path**: `/auth/logout`
- **Auth Required**: YES (`Authorization: Bearer <accessToken>`)

#### Request Body
```json
{
  "refreshToken": "33b1b24c17b902e8819a979..."
}
```

#### Responses
- **204 No Content**: (Session revoked successfully, empty body)
- **401 Unauthorized**: If missing or invalid access token.

---

### 5. Get Current User Profile
- **Method**: `GET`
- **Path**: `/auth/me`
- **Auth Required**: YES (`Authorization: Bearer <accessToken>`)

#### Responses
- **200 OK**:
```json
{
  "id": "aa0909b5-1786-4421-a4b6-7e4aa8a1d4f9",
  "email": "user@example.com",
  "displayName": "Alex Developer",
  "createdAt": "2026-10-06T01:26:25.776Z"
}
```
- **401 Unauthorized** (Token missing or invalid): `{"error":{"code":"UNAUTHORIZED","message":"Authentication required or invalid token"}}`
- **401 Unauthorized** (Token expired): `{"error":{"code":"ACCESS_TOKEN_EXPIRED","message":"Access token has expired"}}`
