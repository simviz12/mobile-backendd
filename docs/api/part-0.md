# API Specification - Part 0: Foundation & Health Check

## Base URL
- Local: `http://localhost:3000`
- LAN / Mobile ADB reverse: `http://<LAN_IP>:3000` or `http://10.0.2.2:3000` (Android Emulator)

## Swagger UI Documentation
- Interactive Docs: `http://localhost:3000/docs`
- OpenAPI Specification: [`openapi.yaml`](../../openapi.yaml) (Root directory)

---

## Standard Error Format
All application and HTTP errors follow this strict JSON contract:
```json
{
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Human readable description in English",
    "details": ["Optional array with error or validation details"]
  }
}
```

---

## Endpoints

### 1. GET `/health`
Returns the status of the API service and the PostgreSQL database connection.

- **Method**: `GET`
- **Path**: `/health`
- **Authentication**: None
- **Request Body**: None

#### Success Response
- **HTTP Status**: `200 OK`
- **Response Body**:
```json
{
  "status": "ok",
  "service": "guardian-api",
  "version": "0.0.1",
  "time": "2026-10-06T00:19:58.366Z",
  "database": "up"
}
```
*Note: If the PostgreSQL database cannot be reached, the endpoint still returns HTTP 200 with `"database": "down"` so health monitors and load balancers can distinguish API liveness from database readiness.*

#### Error Cases
- **404 Not Found** (When calling wrong paths):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Cannot GET /non-existent-route"
  }
}
```
