# API Design Guidelines

**Version 1.0** · Last updated 2 May 2026

This document is a reference contract for how a project can build and consume APIs. Local project rules and the actual installed stack take precedence; examples using Express, FastAPI, or React should be translated to the project's API framework. Consistent APIs reduce integration bugs and make the system easier for third-party developers to use.

---

## 1. Principles

**1.1 Pragmatic REST.** We follow RESTful principles where they make sense (resource-based URLs, standard HTTP methods) but prioritize developer experience over academic purity.

**1.2 Versioning is mandatory.** No API is ever "final." We version from day one to allow for breaking changes without breaking clients.

**1.3 Fail predictably.** Errors must follow a strict schema so the Frontend and AI Service can handle them gracefully.

**1.4 Idempotency by default.** Every mutating operation should be safe to retry.

---

## 2. Versioning Strategy

We use **URL-based versioning** for public and internal APIs.

*   **Format:** `/api/v{major}/[resource]`
*   **Example:** `/api/v1/entities`, `/api/v1/evaluations`

**Rules:**
- **Minor changes** (new fields, new optional params) do NOT bump the version.
- **Breaking changes** (renaming fields, deleting endpoints, changing type of a field) require a new version (e.g., `/v2/`).
- **Sunset policy:** We support the previous major version for 6 months after a new version is released.

---

## 3. Request & Response Standards

### 3.1 Standard Error Envelope
All error responses (4xx and 5xx) must follow this JSON structure:

```json
{
  "error": {
    "code": "ENTITY_NOT_FOUND",
    "message": "The entity with ID '01H...' was not found.",
    "correlationId": "01HQKR...",
    "details": {
      "field": "entityId",
      "reason": "Invalid ULID format"
    }
  }
}
```

### 3.2 Success Envelope (Lists)
List responses must be wrapped to allow for metadata/pagination:

```json
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJ...",
    "hasMore": true,
    "totalCount": 1250
  }
}
```

---

## 4. Webhooks (Inbound & Outbound)

### 4.1 Idempotency
All mutating webhooks must support the `Idempotency-Key` header.
- If a request is received with a key that has been processed in the last 24h, return the original response without re-processing.

### 4.2 Retries
- We use **exponential backoff with jitter** for outbound webhooks.
- Max 8 retries over 48 hours.
- If all retries fail, move to the Dead Letter Queue (DLQ) and alert the tenant.

### 4.3 Signing
All outbound webhooks must be signed as per `Security.md` §5.7.

---

## 5. Cross-Service Communication (Express ↔ FastAPI)

When the Backend calls the AI Service (or vice-versa):
- **Authentication:** Use Service-to-Service JWTs (short-lived, scoped).
- **Timeouts:** 30s max for AI calls; 5s for everything else.
- **Circuit Breakers:** If a service fails 5 times in 1 minute, open the circuit for 30s.

---

*End of document. Changes require an ADR.*
