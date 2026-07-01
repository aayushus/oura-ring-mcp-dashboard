# Architecture Guidelines

**Version 1.0** · Last updated 16 April 2026

This document is a reference architecture playbook. Local project rules, installed agent configs, and the project's actual stack take precedence over examples here. If you adopt one of these patterns and later need to deviate, record an ADR (see [§13 Decision log](#13-decision-log)) — don't drift silently.

**Example stack baseline** (translate these examples to the project's actual stack):

```
backend/          Node.js 20 + Express + TypeScript + Prisma
frontend/         React 18 + Vite + TailwindCSS
ai-service/       Python 3.12 + Pydantic AI + FastAPI
mcp-server/       External MCP server
containers/           containerfiles per service
             Requirement specs
.windsurf/        Windsurf IDE rules
```

Orchestration: `container orchestration` now. Future: the exit strategy is documented in [§2.4](#24-orchestration-exit-strategy).

Example target scale: **10k+ users, multi-tenant B2B, hygiene matters**. Adjust scale, tenancy, and compliance expectations to the installed project's context.

> **See also:** [Security Guidelines](Security.md) — authorization, tenant isolation enforcement, secrets management | [Performance Guidelines](Performance.md) — SLOs, caching strategy, query budgets | [Code Quality Guidelines](Code-Quality.md) — testing, error handling, naming | [Documentation Guidelines](Documentation.md) — ADRs, system diagrams, runbooks

---

## Table of contents

1. [Principles](#1-principles)
2. [Service topology](#2-service-topology)
3. [Multi-tenancy model](#3-multi-tenancy-model)
4. [Service communication](#4-service-communication)
5. [API design](#5-api-design)
6. [Database design](#6-database-design)
7. [Event-driven and async patterns](#7-event-driven-and-async-patterns)
8. [Failure modes and resilience](#8-failure-modes-and-resilience)
9. [Observability](#9-observability)
10. [Security defaults](#10-security-defaults)
11. [AI service integration](#11-ai-service-integration)
12. [Deployment and environments](#12-deployment-and-environments)
13. [Decision log](#13-decision-log)
14. [Anti-patterns](#14-anti-patterns)
15. [Review checklist](#15-review-checklist)

---

## 1. Principles

Five principles, in priority order. Earlier wins when they conflict.

**1.1 Boring technology.** Every choice in this doc is deliberately boring: Postgres, Redis, Express, FastAPI, HTTP, JSON. Boring technology has surprise-free operational behaviour. The novelty budget is spent on the product (AI agents, the core workflow workflows), not the plumbing. If you find yourself reaching for an exotic database, a cutting-edge framework, or a newly-announced pattern, the default answer is no — come back with a written justification (ADR) that names the specific problem a boring choice can't solve.

**1.2 Reversibility over elegance.** Prefer decisions that are cheap to reverse. A monolith that could become two services is better than two services that can't become one. JSON-over-HTTP between internal services is reversible; a proprietary RPC protocol is not. Postgres tables you can migrate with `ALTER TABLE` are reversible; a document store with thousands of varying shapes is not. Every irreversible decision (database engine, tenant model, ID format) requires an ADR.

**1.3 Explicit over implicit.** Tenant IDs are in every row, every log line, every trace. Versions are in every URL. Idempotency keys are required for every mutating webhook. Nothing important is ever "assumed from context" — because context evaporates at 3am when something is broken. If a value is load-bearing, it is explicit and it is logged.

**1.4 Failure is the default state.** Every network call will fail. Every database will disconnect. Every external API will return 500. Code is written assuming failure, not success. Retries, timeouts, circuit breakers, and dead-letter queues are not optional decorations — they are the design.

**1.5 Data is forever, code is disposable.** You can rewrite a service in a weekend. You cannot rewrite a database with ten million rows over the weekend. Schema decisions, ID formats, naming conventions, tenant boundaries — these get scrutinised harder than anything else. Wrong code is annoying; wrong data is existential.

---

## 2. Service topology

### 2.1 Start with a modular monolith

The `backend/` service is a modular monolith by default. All HTTP endpoints, business logic, and Prisma models live in one deployable. This is correct for the scale we're at — a 10k-user multi-tenant SaaS is not a microservices shape.

The monolith is organised by **domain module**, not by technical layer:

```
backend/src/
├── modules/
│   ├── auth/          # login, sessions, invites
│   ├── tenants/       # orgs, members, roles
│   ├── entities/      # resource profiles, onboarding
│   ├── requests/      # requests, matching, shortlists
│   ├── reviews/   # reviewer evaluations, decisions
│   ├── projects/      # contracts, deliverables
│   ├── messaging/     # inbox, threads
│   ├── notifications/ # email, in-app
│   └── billing/       # plans, invoices
├── shared/
│   ├── db/            # Prisma client, tx helpers
│   ├── queue/         # BullMQ clients
│   ├── http/          # Axios wrapper, retries
│   ├── auth/          # session guards, tenant guard
│   ├── errors/        # error classes, error middleware
│   ├── logger/        # pino, correlation IDs
│   └── telemetry/     # OTEL setup
└── server.ts          # entry point
```

**Rule:** modules may depend on `shared/`. Modules may NOT directly import from other modules except through a narrow, documented `public.ts` export surface per module. This gives you the seams to split services later if you need to, without doing it prematurely.

### 2.2 Services we keep separate from the start

Four services, because each has a real reason to be independent — not because "microservices are modern":

| Service | Runtime | Reason for separate deploy |
|---|---|---|
| `backend` | Node 20 | The system of record. Owns Postgres, runs business logic, serves authenticated HTTP. |
| `ai-service` | Python 3.12 | Python ecosystem (Pydantic AI, numpy, model SDKs). Different failure profile (slow, flaky). Different scaling curve (CPU/memory heavy, bursty). |
| `mcp-server` | Node 20 | Exposes resource data via MCP protocol to external AI agents. Different auth model (OAuth 2 for AI clients). Different trust boundary. |
| `frontend` | Static build | Separate deploy cadence, CDN-hosted, no server-side state. |

That's the whole topology until traffic forces a change. Do not add a fifth service without an ADR.

### 2.3 When to extract a new service

A module becomes its own service only when at least two of these are true:

1. **Different scaling curve.** The module is CPU-bound while the rest is IO-bound, or vice-versa. You're over-provisioning the monolith to serve it.
2. **Different reliability profile.** The module's failures are routinely taking the rest of the system down, or its retries are blocking hot paths.
3. **Different deploy cadence.** The module ships multiple times per day while the monolith ships weekly, and coupling is slowing both teams.
4. **Different runtime.** The module genuinely needs a different language or framework (not "would be nice in Go").

If only one is true, the fix is almost always inside the monolith — move it behind a queue, isolate it in a worker process, or put it behind a circuit breaker. Extraction is a last resort.

### Decision tree: when to extract a module into a service

Use this before proposing any service extraction. All three conditions must be true before extraction is justified.

```
Is the module deployed at a different cadence than the monolith?
  └─ No → Stay in monolith. Extraction adds operational cost with no benefit.
  └─ Yes → Continue ↓

Does the module have clearly owned data that no other module reads directly?
  └─ No → Stay in monolith. Shared data = distributed transactions = pain.
  └─ Yes → Continue ↓

Does the module have distinct scaling requirements (10× more/less traffic)?
  └─ No → Stay in monolith. Identical scaling = no infrastructure benefit.
  └─ Yes → ✓ Extraction is justified. Proceed with the extraction checklist below.
```

**Extraction checklist (when all three conditions are true):**
- [ ] Define the service API contract (OpenAPI spec) before writing a line of code
- [ ] Write contract tests against the spec, not the implementation
- [ ] Migrate data ownership: service owns its schema, exposes it only via API
- [ ] Deploy the service behind a feature flag — route traffic gradually
- [ ] Keep the monolith implementation live until the new service handles 100% of traffic for 2 weeks
- [ ] Delete the monolith code only after the flag is fully rolled out

**Current service topology:** See §2 for the four services that have already been extracted and why each met these criteria.

### 2.4 Orchestration exit strategy

`container orchestration` is fine up to maybe 1,000 users and one production host. Beyond that, you need a real orchestrator. The exit options in order of preference:

1. **Fly Machines** — closest thing to "container orchestration in the cloud", minimal learning curve. Good for up to ~50k users if you're disciplined.
2. **AWS ECS with Fargate** — boring, well-understood, Anthropic-friendly billing. Reasonable second choice.
3. **Kubernetes** — only if you have a dedicated SRE or a strong reason (existing team expertise, need for operator ecosystem). For a solo dev, k8s is the wrong answer in 2026.

**What you must not do** is port `compose.yaml` 1:1 to Kubernetes manifests. Compose models are colocated services sharing volumes; k8s models are replicated pods with ephemeral storage. The mental model is different. If you do migrate, treat it as a rewrite of the infrastructure layer, not a port.

Build containers so they're portable regardless of orchestrator: twelve-factor config (env vars), stateless, healthchecks, graceful shutdown on SIGTERM, no local filesystem writes outside `/tmp`.

---

## 3. Multi-tenancy model

This is the single highest-stakes architecture decision in the system. Get it wrong and you will either (a) accidentally leak one customer's data to another, or (b) find yourself unable to onboard enterprise customers who demand data isolation. Both are terminal.

### 3.1 The decision: shared database, shared schema, tenant_id column

Every table that holds tenant data has a non-nullable `tenant_id` column. Every query filters by `tenant_id`. This is the correct default for 10k users.

**Why not "schema per tenant" or "database per tenant":**
- Migrations at 10k tenants require running the migration 10,000 times. Each migration becomes a weekend project.
- Cross-tenant analytics require UNIONs across thousands of schemas.
- Connection pools fragment — 10,000 pools × 10 connections each = bankruptcy.
- Managed Postgres providers cap databases or schemas per instance.

**When this model breaks down:**
- Enterprise contracts that mandate physical isolation (rare, usually government).
- A single tenant that is >20% of total traffic (noisy neighbour).

Either scenario is a migration *from* the shared-schema model, not a reason to avoid it up front. The shared-schema model can always be split into per-tenant databases later; the reverse is much harder.

### 3.2 Enforcement — make leakage impossible, not just unlikely

**Rule: no raw queries.** All database access goes through Prisma. Raw SQL (`$queryRaw`, `$executeRaw`) requires a code review comment justifying why Prisma couldn't express it and a ticket to replace it.

**Rule: every Prisma query MUST filter by `tenant_id`.** Enforce this at the middleware layer, not by convention. Example:

```ts
// backend/src/shared/db/tenant-middleware.ts
import { Prisma } from '@prisma/client';
import { getCurrentTenantId } from '../auth/context';

const TENANT_SCOPED_MODELS = new Set([
  'Entity', 'Request', 'Evaluation', 'Project', 'Message',
  'AuditLog', 'Notification', 'ApiKey',
]);

export const tenantMiddleware: Prisma.Middleware = async (params, next) => {
  if (!TENANT_SCOPED_MODELS.has(params.model ?? '')) return next(params);

  const tenantId = getCurrentTenantId(); // reads from AsyncLocalStorage
  if (!tenantId) throw new Error(`Tenant context missing for ${params.model}.${params.action}`);

  // READS — inject into where clause
  if (['findFirst', 'findMany', 'count', 'aggregate'].includes(params.action)) {
    params.args.where = { ...params.args.where, tenantId };
  }
  // WRITES — inject into data
  if (['create'].includes(params.action)) {
    params.args.data = { ...params.args.data, tenantId };
  }
  if (['createMany'].includes(params.action)) {
    params.args.data = params.args.data.map((d: any) => ({ ...d, tenantId }));
  }
  // UPDATES / DELETES — always scoped to tenant
  if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
    params.args.where = { ...params.args.where, tenantId };
  }

  return next(params);
};
```

Combine this with `AsyncLocalStorage` per-request, populated by the auth middleware from the validated session. Never accept `tenant_id` as a URL parameter or body field.

**Rule: no cross-tenant queries outside `jobs/` or `admin/`.** Background jobs that need to iterate across tenants (e.g., nightly aggregations) do so in an explicit `escalateToSystem()` scope that logs the fact loudly. Admin endpoints do the same. Everything else is tenant-locked.

**Rule: foreign keys cross tenant_id boundaries must be checked.** An Entity in tenant A should not be reachable from a Request in tenant B. Prisma doesn't enforce this natively — add Postgres check constraints:

```sql
ALTER TABLE request_entity_invites
  ADD CONSTRAINT same_tenant_check
  CHECK (
    tenant_id = (SELECT tenant_id FROM entities WHERE id = resource_id)
    AND tenant_id = (SELECT tenant_id FROM requests WHERE id = request_id)
  );
```

That's expensive in pure correctness terms but cheap compared to a tenant-leakage postmortem.

### 3.3 Tenant context propagation

- **HTTP requests:** tenant resolved from the authenticated session (never from the request body or URL). Stored in `AsyncLocalStorage` for the duration of the request.
- **Background jobs:** tenant ID included in the job payload. Worker reads it, installs it into `AsyncLocalStorage` before running the job.
- **Cross-service calls (backend → ai-service):** tenant ID sent as a dedicated header `X-Tenant-Id`. The receiving service validates it against the caller's credentials.
- **Logs and traces:** every log line and every span has `tenant_id` as a required field. See [§9 Observability](#9-observability).

### 3.4 Roles vs tenants

Users belong to tenants via a `Membership` join table. A single user can be a member of multiple tenants (entity employees who also act as requesters for their own company, agencies, consultants). The current active tenant is part of the session, not the user record.

```
User ─┬─ Membership(tenantId, userId, role, status) ─ Tenant
      └─ Membership ─ Tenant
```

Roles are enum-valued, scoped to the tenant: `owner`, `admin`, `member`, `viewer`. Never store role as a string.

> **Cross-reference:** Security Guidelines §3 covers the authorization layer that enforces these tenant boundaries at the request level.

---

## 4. Service communication

### 4.1 Default: synchronous HTTP + JSON

Internal services talk to each other over HTTP with JSON bodies, protected by mTLS or a shared secret header, and inside the container network. No gRPC, no Thrift, no ProtoBuf until you have a measured reason. The reason will probably never come.

Why HTTP+JSON:
- Debuggable with `curl`
- Works across Node and Python without codegen
- Tracing tools all understand it
- Client libraries are standard library, not special

### 4.2 When to go async (queue instead of HTTP)

Use a queue (not HTTP) when **any** of these are true:

1. The operation can take >1 second.
2. The caller doesn't need the result right now.
3. The operation is retryable on failure (most things are).
4. The caller shouldn't fail if the callee is temporarily down.

Concretely for a typical app: every AI call, every email send, every webhook delivery, every PDF generation, every external API sync goes through a queue. The user-facing HTTP path never waits for any of them.

Queue: **BullMQ on Redis**. See [§7](#7-event-driven-and-async-patterns).

### 4.3 HTTP client rules

All outbound HTTP (backend → ai-service, backend → third party, etc.) goes through a shared wrapper with these defaults:

```ts
// shared/http/client.ts
import axios from 'axios';
import axiosRetry from 'axios-retry';

export function createClient(baseURL: string, opts: ClientOpts = {}) {
  const c = axios.create({
    baseURL,
    timeout: opts.timeoutMs ?? 10_000,  // hard default 10s
    headers: { 'User-Agent': `app-backend/${VERSION}` },
  });

  axiosRetry(c, {
    retries: opts.retries ?? 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      // Retry only on network errors and 5xx — NEVER on 4xx
      return axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error);
    },
  });

  c.interceptors.request.use(injectTraceHeaders);
  c.interceptors.request.use(injectTenantHeader);
  c.interceptors.response.use(null, normaliseError);

  return c;
}
```

**Rules:**
- **Timeouts are mandatory.** Default 10s; shorter for hot paths (3s), longer for known-slow calls (AI inference up to 60s but only via queue, never inline).
- **Retries only on 5xx and network errors.** Never retry 4xx — those are caller errors, retrying won't help and may cause duplicate writes if the server processed the first request.
- **Idempotency keys on mutations.** Every POST/PUT/PATCH that isn't read-only sends an `Idempotency-Key` header. See [§5.9](#59-idempotency).
- **Circuit breakers on every external dependency.** If a downstream returns 5xx 5 times in a row, open the circuit for 30s. Use `opossum` or equivalent.

### 4.4 Service-to-service auth

Internal service calls authenticate via a shared secret in `X-Service-Token` (rotated quarterly) + mTLS at the container network level when we move off compose.

Do not use the user's session token to make service-to-service calls. That collapses the trust boundary and leaks user identity across services that shouldn't see it. Instead, forward an attenuated claim: `X-Tenant-Id`, `X-User-Id`, `X-User-Roles` — the receiving service trusts these because it trusts the `X-Service-Token` that accompanied them.

---

## 5. API design

### 5.1 REST first, GraphQL never (yet)

All external APIs are REST over HTTP with JSON bodies. GraphQL is not a default option — it introduces N+1 query risks, versioning is hard, authorization is hard, and for a system like this it's more rope than reach.

Reconsider GraphQL only if:
- You have multiple first-party clients (web + mobile + third-party apps) that need wildly different shapes of the same data, AND
- You have someone who has shipped production GraphQL before.

If you eventually do add GraphQL, it's a *facade* over the REST API, not a replacement.

### 5.2 URL structure

Pattern: `/api/v{N}/{resource}[/{id}][/{subresource}]`

Examples:
```
GET    /api/v1/entities
POST   /api/v1/entities
GET    /api/v1/entities/{resourceId}
PATCH  /api/v1/entities/{resourceId}
GET    /api/v1/entities/{resourceId}/credentials
POST   /api/v1/requests/{requestId}/invites
POST   /api/v1/requests/{requestId}/actions/publish   # verb for non-CRUD actions
```

**Rules:**
- Resources are plural nouns: `entities`, not `entity`.
- Lowercase with hyphens if multi-word: `purchase-orders`, not `purchaseOrders` or `purchase_orders`.
- IDs are ULIDs in path (see [§6.3](#63-ids)).
- Non-CRUD actions go under `/actions/{verb}`. Never invent clever REST verbs like `POST /entities/{id}` meaning "verify".

### 5.3 Versioning

**URL-prefix versioning.** `/api/v1/`, `/api/v2/`. No header-based, no content-type-based, no query-string-based versioning. URL-prefix is ugly but universally understood by humans, logs, CDNs, and debuggers.

**Rules:**
- Breaking changes require a new version. No exceptions.
- Non-breaking changes (adding optional fields, adding endpoints) go into the existing version.
- Support the previous major version for **at least 12 months** after a new major ships. Announce deprecation in `Deprecation` and `Sunset` response headers.
- Internal APIs between our own services can break more freely (they deploy together), but still use `/v1/` for clarity.

**What counts as breaking:**
- Removing a field from a response
- Changing a field's type
- Renaming a field
- Adding a new required request field
- Changing authentication or authorization rules
- Changing the shape of an error
- Changing default pagination behaviour

**What does NOT count as breaking:**
- Adding new optional request fields
- Adding new response fields
- Adding new endpoints
- Adding new enum values, IF clients are specified to ignore unknown enum values

### 5.4 HTTP methods and status codes

| Method | Use | Idempotent | Typical success |
|---|---|---|---|
| `GET` | Read | ✓ | 200 |
| `POST` | Create, non-idempotent action | ✗ | 201 Created, 200 if returning body only |
| `PUT` | Replace (full resource) | ✓ | 200, 204 |
| `PATCH` | Partial update | depends | 200, 204 |
| `DELETE` | Soft-delete | ✓ | 204 |

Status code discipline:
- `200` — OK, response has a body
- `201` — Created (new resource); `Location` header points to it
- `202` — Accepted (async job enqueued); response body contains a job URL to poll
- `204` — No Content (successful mutation, no body)
- `400` — Bad request (validation error); body contains the error envelope
- `401` — Not authenticated (no valid session)
- `403` — Authenticated but not authorised for this action
- `404` — Resource not found, OR resource exists but caller has no access (prefer 404 over 403 for unauthorised reads, to avoid leaking existence)
- `409` — Conflict (optimistic lock failure, duplicate key)
- `410` — Gone (resource existed, now permanently deleted — rare, we soft-delete)
- `422` — Unprocessable (valid JSON, but semantically invalid business rule)
- `429` — Rate limited; `Retry-After` header included
- `500` — Server error; correlation ID in body
- `502/503/504` — Upstream failure; caller should retry with backoff

**Do not invent statuses.** `499`, `520`, `999` are not things our API returns.

### 5.5 Error envelope

Every error response has this exact shape. No exceptions.

```json
{
  "error": {
    "code": "ENTITY_NOT_FOUND",
    "message": "Entity 01HXYZ...ABC was not found.",
    "correlationId": "01HQKR0E7C8K3TD9S2FP6NB4VA",
    "details": {
      "resourceId": "01HXYZ...ABC"
    }
  }
}
```

**Rules:**
- `code` is a stable, UPPER_SNAKE_CASE string. Clients branch on `code`, never on `message`.
- `message` is human-readable, English, actionable. Do not return stack traces, SQL, or system internals.
- `correlationId` is the request trace ID. Log it server-side. Users paste it when filing bugs.
- `details` is optional and typed per-code. Document what fields each code carries.

Maintain a canonical error code registry in `backend/src/shared/errors/codes.ts`. New codes go there, not inline.

### 5.6 Pagination

**Cursor-based pagination, never offset-based.** Offset pagination breaks at scale (duplicates/missing rows when data changes mid-scroll) and is O(N) on the database.

Request:
```
GET /api/v1/entities?cursor=eyJ...&limit=50
```

Response:
```json
{
  "data": [ /* resources */ ],
  "pagination": {
    "nextCursor": "eyJ...",   // null when no more
    "hasMore": true
  }
}
```

**Rules:**
- Default `limit` is 25. Maximum is 100. Requests for more return `400 BAD_LIMIT`.
- Cursors are opaque, base64-encoded JSON containing `{lastId, sortField}`. Clients do not parse them.
- Cursors expire after 24h (signed with TTL). Stale cursors return `410 CURSOR_EXPIRED`.
- Sorting: one default sort per collection, documented; alternate sorts via `?sort=field,-direction` (e.g., `-createdAt`). Always secondary-sort by ID to break ties.

### 5.7 Filtering

Filters as query params, typed:

```
GET /api/v1/entities?status=verified&country=GB&minTurnover=1000000
GET /api/v1/requests?createdAt[gte]=2026-01-01&createdAt[lt]=2026-04-01
```

**Rules:**
- Every filterable field is explicitly documented. Unknown filter params return `400 UNKNOWN_FILTER`.
- Range operators use bracket syntax: `[gte]`, `[lte]`, `[gt]`, `[lt]`.
- Array filters use comma: `?status=verified,pending`. Max 50 values per array filter.
- Free-text search is a separate `q=` parameter, not a field filter. It uses Postgres FTS (see [§6.7](#67-search)), not `LIKE`.

### 5.8 Naming

| Element | Convention | Example |
|---|---|---|
| URL path | kebab-case | `/purchase-orders` |
| Query param | camelCase | `?sortBy=createdAt` |
| JSON field | camelCase | `"resourceId": "..."` |
| DB column | snake_case | `resource_id` |
| Enum value | lowerCamel or UPPER_SNAKE (pick one and stick to it — we use `lowerCamel` in JSON, `UPPER_SNAKE` in code) | `"status": "awaitingReview"` |
| Timestamp field | camelCase + `At` suffix | `createdAt`, `publishedAt`, `deletedAt` |
| Boolean field | `is` or `has` prefix | `isVerified`, `hasCredentials` |
| Count field | `Count` suffix | `entityCount`, `invitationCount` |

Timestamps are **always ISO 8601 UTC with milliseconds and the `Z` suffix**: `"2026-04-16T14:30:00.000Z"`. Never Unix timestamps, never local time, never date-only strings unless the field is semantically a calendar date (`"startDate": "2026-04-16"`).

Money is always **string-encoded decimal with currency**:
```json
"price": { "amount": "1234.56", "currency": "GBP" }
```
Never floats. Never cents-as-integer (ambiguous across currencies with different exponents).

### 5.9 Idempotency

Every mutating endpoint (`POST`, `PUT`, `PATCH`, `DELETE`) accepts an optional `Idempotency-Key` header from the client. Server stores `(tenant_id, idempotency_key, request_hash, response)` in an `idempotency_records` table with a 24h TTL.

On duplicate key:
- Same request hash → return the stored response verbatim (same status, same body)
- Different request hash → return `409 IDEMPOTENCY_KEY_CONFLICT`

This is mandatory for endpoints that create money-adjacent records (projects, invoices), send external side effects (emails, webhooks), or are frequently called from retry-prone paths (mobile, AI agents). For simple reads and trivial mutations it's optional.

### 5.10 Rate limiting

All endpoints are rate-limited by `(tenant_id, user_id, route)`. Default: 100 requests per 60 seconds per user per route. Login and password-reset endpoints are stricter: 5 per 60 seconds per IP.

Rate limit state in Redis (`ratelimit:{scope}:{window}`). On hit:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1745678901
```

The MCP server has its own rate-limit rules because external AI agents behave differently from humans (see [§11.4](#114-mcp-auth-and-rate-limits)).

### 5.11 Breaking-change protocol

When you need to ship a breaking change:

1. Create `/api/v{N+1}/` routes alongside the current version.
2. Dual-publish: the old version still works.
3. Add `Deprecation: true` and `Sunset: Thu, 16 Apr 2027 00:00:00 UTC` response headers to the old version.
4. Log every request to the old version with the client ID so you can notify them.
5. Wait at least 12 months. For enterprise clients, wait 18.
6. Return `410 Gone` after sunset with a link to the migration guide.

Never do the "we'll just update everyone's code" manoeuvre. Outside your own frontend, someone always depends on your API in ways you don't know.

---

## 6. Database design

### 6.1 One Postgres, multiple schemas by domain

All tenant data lives in one Postgres database. Inside that database, split into schemas by domain module:

```
public/            # shared reference data (countries, currencies, industry codes)
auth/              # users, sessions, memberships, api_keys
tenants/           # tenants, settings, subscriptions
entities/          # entity profiles, credentials
requests/          # requests, invitations, shortlists
reviews/       # evaluations, criteria, findings
projects/          # contracts, deliverables
messaging/         # threads, messages
audit/             # audit_log (append-only, partitioned)
jobs/              # idempotency_records, outbox, dead_letters
```

**Why separate schemas, not separate databases:** Postgres schemas are free; separate databases require separate connection pools, separate backups, and block cross-domain foreign keys. Schemas give you namespacing and clean `\dn` output in psql without any of the cost.

**Rule:** modules only read/write their own schema + `public`. Cross-module reads happen via the module's public API (function call in the monolith, HTTP when split). Enforce with Postgres roles that grant per-schema access if you want to be serious about it at scale.

### 6.2 Table naming

- Plural snake_case: `entities`, `purchase_orders`, `request_invitations`.
- Join tables: `{a}_{b}` alphabetical: `entity_tags`, not `tag_entities`.
- Columns: snake_case. Foreign keys: `{table_singular}_id`: `resource_id`, `request_id`.
- Booleans: `is_` or `has_` prefix: `is_verified`, `has_required_credential`.
- Timestamps: `_at` suffix: `created_at`, `published_at`, `deleted_at`.
- Enum columns: the column name describes the state, not the enum type: `status`, not `entity_status_enum`.

### 6.3 IDs

**Use ULIDs for all primary keys.** Not auto-increment integers, not UUIDs.

Why ULIDs:
- Lexicographically sortable by creation time (useful in logs, debugging, cursor pagination)
- 26 chars, URL-safe, case-insensitive
- Globally unique (128 bits)
- No hot-spot indexing problem (unlike sequential integers in a sharded world)

Implementation: Prisma `id String @id @default(ulid())` — needs the `ulid` generator extension, or generated in application code via `ulid` package.

**Never expose auto-increment integers as primary keys.** They leak business information (row counts, growth rates) and make enumeration attacks trivial.

For user-facing short codes (project numbers, request numbers), generate separately: `REQ-2026-000042`. Store the ULID as the true PK, display the code.

### 6.4 Required columns on every tenant-scoped table

```sql
CREATE TABLE entities.entities (
  id            TEXT PRIMARY KEY,          -- ULID
  tenant_id     TEXT NOT NULL,             -- multi-tenancy key
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ NULL,          -- soft delete
  version       INTEGER NOT NULL DEFAULT 1, -- optimistic lock
  -- domain columns below
  name          TEXT NOT NULL,
  status        TEXT NOT NULL,
  ...
);

CREATE INDEX idx_entities_tenant ON entities.entities (tenant_id, deleted_at, created_at DESC);
```

Every tenant-scoped table has:
- `id` (ULID, PK)
- `tenant_id` (indexed, FK to `tenants.tenants(id)`)
- `created_at`, `updated_at` (timestamptz, not timestamp)
- `deleted_at` (nullable, for soft delete — see [§6.8](#68-soft-deletes))
- `version` (integer, optimistic locking — see [§6.9](#69-optimistic-locking))

### 6.5 Foreign keys

Always declare them. FKs catch bugs that application-layer referential integrity misses.

```sql
ALTER TABLE requests.request_invitations
  ADD CONSTRAINT fk_request_invitations_request
    FOREIGN KEY (request_id) REFERENCES requests.requests(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT fk_request_invitations_entity
    FOREIGN KEY (resource_id) REFERENCES entities.entities(id)
    ON DELETE RESTRICT;
```

**Never `ON DELETE CASCADE`** on tenant-scoped tables. Cascades delete silently, which at scale becomes "we lost 50,000 rows because someone hit a button". Use `RESTRICT` and require explicit cleanup in application code. The one exception: join-only tables that have no identity of their own (e.g., `entity_tags`).

### 6.6 Indexing

Every query in production hits an index. No exceptions.

**Rules:**
1. Every FK has an index. Postgres does not create them automatically.
2. Every `WHERE` clause in a query-plan-hot path has an index that covers it.
3. Composite indexes order columns by **selectivity first, then range**. `(tenant_id, status, created_at DESC)` not `(created_at, tenant_id, status)`.
4. `tenant_id` is the leading column of almost every index on tenant-scoped tables.
5. Partial indexes for common filtered queries: `CREATE INDEX ... ON entities WHERE deleted_at IS NULL;`
6. Use `EXPLAIN (ANALYZE, BUFFERS)` before shipping any new query that could run on large tables.
7. Add indexes in a separate migration, `CREATE INDEX CONCURRENTLY`, and never in a migration that also alters the table.

### 6.7 Search

Free-text search uses Postgres full-text search with a `tsvector` column, not `LIKE '%foo%'`.

```sql
ALTER TABLE entities.entities
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(about, '')), 'B')
    ) STORED;

CREATE INDEX idx_entities_search
  ON entities.entities
  USING GIN (search_vector)
  WHERE deleted_at IS NULL;
```

Query:
```sql
SELECT * FROM entities.entities
WHERE tenant_id = $1
  AND deleted_at IS NULL
  AND search_vector @@ plainto_tsquery('english', $2);
```

If search requirements outgrow Postgres FTS (fuzzy, faceted, vector similarity beyond what pg_vector can handle), migrate to OpenSearch or Typesense — but only when FTS is demonstrably the bottleneck. For 10k users, FTS is correct.

### 6.8 Soft deletes

Never hard-delete tenant data. Every `DELETE` is a `UPDATE ... SET deleted_at = NOW()`.

The tenant middleware automatically filters `deleted_at IS NULL` from all reads. An explicit `{ withDeleted: true }` flag can opt into including soft-deleted rows (for admin views, audit). Purging soft-deleted data is a separate, scheduled job that runs after a retention period (default 90 days).

**Exceptions:** ephemeral data (sessions, idempotency records, rate-limit counters) can hard-delete. Anything a user could ask "what happened to my X?" gets soft-deleted.

### 6.9 Optimistic locking

Every mutable entity has a `version INTEGER NOT NULL DEFAULT 1`. Every update increments it and checks the previous value:

```sql
UPDATE entities.entities
  SET name = $1, version = version + 1, updated_at = NOW()
  WHERE id = $2 AND tenant_id = $3 AND version = $4;
```

If affected rows = 0, return `409 VERSION_CONFLICT`. Client refetches and retries with the user.

This catches the classic "two tabs open, one stale" bug without requiring pessimistic row locks.

### 6.10 Migrations

Prisma migrations, always. Handwritten SQL for things Prisma can't express goes in a `migrations/{date}_{name}/migration.sql` with a `prisma migrate resolve`.

**Rules for migrations that matter at 10k+ users:**

1. **Never combine schema change + data change in the same migration.** Ship the column as nullable first (migration A). Backfill data (migration B, possibly a job). Make NOT NULL (migration C). Three deploys.
2. **Never drop columns immediately.** Rename to `{column}_deprecated_{yyyymmdd}`, let it sit for one release cycle, then drop. This protects you from "rolled back deploy that still had the old column".
3. **Create indexes `CONCURRENTLY`.** Non-concurrent index creation locks the table.
4. **Run migrations before the deploy, not during.** The application has to be able to run against both the old and new schema during the cutover window. This is sometimes called "expand / contract" or "parallel change".
5. **Test on a production-size database.** `EXPLAIN` on 100 rows lies. Keep an anonymised copy of prod data for migration rehearsal.
6. **Every migration has a rollback plan.** "Re-add the column" and "restore from backup" both count, but you need to know which.
7. **`CREATE TABLE` only in the schema the module owns.** No module reaches across schemas to create tables in another module's schema.

### 6.11 Connection pooling

The backend holds a **single** Prisma client with a pool of 10-20 connections. Don't create clients per-request. The AI service has its own pool (Python side, via `asyncpg`).

At scale, place **PgBouncer in transaction mode** in front of Postgres. This lets you have a small pool to Postgres (say 100) and thousands of in-flight application connections. Prisma needs a small setup dance for pgbouncer transaction mode (disable prepared statements, see Prisma docs) — do this before you need it, not after.

---

## 7. Event-driven and async patterns

### 7.1 One queue system: BullMQ on Redis

All async work — email, webhooks, AI calls, PDF rendering, webhooks delivery, sync jobs — goes through BullMQ. One Redis cluster for queues + rate limits + session storage (separate logical databases within Redis, not separate instances until that's proven necessary).

Why BullMQ:
- Production-ready, well-maintained
- Dead-letter queues, retries with backoff, rate-limiting built in
- Observable (`bull-board` for ops UI)
- Node-native; Python workers can consume via `arq` or by calling into Node workers via HTTP for cases that need Python-side execution

**Do not add Kafka, RabbitMQ, SQS, or "event bus" frameworks until there's a concrete capability BullMQ cannot provide.** At 10k users, there is none.

### 7.2 Job design

Every job is a small TypeScript function with typed input:

```ts
// backend/src/modules/notifications/jobs/send-email.ts
export const sendEmailJob = defineJob({
  name: 'notifications.send-email',
  schema: z.object({
    tenantId: z.string().ulid(),
    to: z.string().email(),
    templateId: z.string(),
    variables: z.record(z.unknown()),
    idempotencyKey: z.string(),
  }),
  timeout: 30_000,
  attempts: 5,
  backoff: { type: 'exponential', delay: 2_000 }, // 2s, 4s, 8s, 16s, 32s
  handler: async (data) => {
    await withTenant(data.tenantId, async () => {
      await emailProvider.send({
        to: data.to,
        template: data.templateId,
        variables: data.variables,
        idempotencyKey: data.idempotencyKey,
      });
    });
  },
});
```

**Rules:**
- Every job is validated with Zod/Pydantic on dequeue. Malformed payloads go straight to DLQ.
- Every job has a timeout, attempts count, and backoff policy.
- Every job runs within a tenant context (set before handler invokes).
- Every job is idempotent (see [§7.4](#74-idempotency)).

### 7.3 The outbox pattern (events from the database)

When a business action (entity verified, request published, project created) should trigger async work, **do not publish to the queue from inside the HTTP handler**. The handler commits the DB transaction, then publishes — but if the process crashes between commit and publish, the event is lost.

Instead: write the event to an `outbox` table inside the same transaction:

```sql
CREATE TABLE jobs.outbox (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  aggregate_type  TEXT NOT NULL,
  aggregate_id    TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at    TIMESTAMPTZ NULL,
  attempts        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_outbox_unpublished
  ON jobs.outbox (created_at)
  WHERE published_at IS NULL;
```

A separate poller ("outbox worker") reads `WHERE published_at IS NULL`, publishes to BullMQ, marks as published. Retries on failure, alerts if the backlog grows.

This guarantees at-least-once delivery. Combined with idempotent consumers ([§7.4](#74-idempotency)), it becomes effectively exactly-once from the consumer's perspective.

### 7.4 Idempotency

Every queue consumer MUST be idempotent. Duplicates will happen — BullMQ retries on timeout even if the original succeeded; the outbox worker can publish twice if its own tracking fails; network partitions happen.

Pattern: every job carries an `idempotencyKey` in its payload. The handler checks `jobs.processed_jobs(key)` before doing the work:

```ts
const already = await db.processedJob.findUnique({ where: { key: data.idempotencyKey } });
if (already) {
  logger.info({ key: data.idempotencyKey }, 'job already processed, skipping');
  return already.result;
}

const result = await doTheWork(data);

await db.processedJob.create({
  data: { key: data.idempotencyKey, result, processedAt: new Date() },
});
return result;
```

`processed_jobs` has a 7-day TTL cleaned up by a nightly job. Long-lived idempotency is expensive; 7 days covers every realistic retry window.

### 7.5 Retries and backoff

| Scenario | Attempts | Backoff |
|---|---|---|
| Transient network error (DNS, connection refused) | 5 | exponential, 2s base |
| 5xx from upstream | 5 | exponential, 2s base |
| 429 rate-limited | 10 | use `Retry-After` if present, else exponential |
| 4xx (not 429) | 0 | DO NOT retry — caller error |
| Timeout | 3 | exponential, 5s base |
| AI model error | 3 | exponential, 5s base; fall back to smaller model |

After max attempts, the job goes to a **dead-letter queue** with its original payload and error history. DLQ is monitored (alerts on entries >10 per hour per queue) and manually replay-able from an admin panel.

### 7.6 Pub/sub within the monolith

Inside the monolith, modules communicate via an in-process event bus for fire-and-forget notifications:

```ts
// module A emits
eventBus.emit('entity.verified', { resourceId, tenantId, verifiedAt });

// module B listens
eventBus.on('entity.verified', async (event) => {
  await notificationsService.sendEmail({ ... });
});
```

**Rules:**
- Event names: `{domain}.{past-tense-verb}`: `entity.verified`, `request.published`, `project.cancelled`.
- Events are typed (TypeScript interfaces per event).
- Handlers that do I/O MUST be enqueued to BullMQ, not run inline. The event bus is only for "tell module B something happened"; the actual work is a queued job.
- Events describe what happened (past tense). They do not command what should happen.

When a module extracts into its own service, these events become queue messages across services. The naming survives.

### 7.7 Scheduled jobs

Use BullMQ's repeatable jobs, not cron. Cron containers drift with deploys and don't scale. Repeatable jobs live in Redis state, survive deploys, and can be paused/resumed from the admin UI.

```ts
await queue.add(
  'nightly-entity-scoring',
  {},
  { repeat: { pattern: '0 2 * * *' } } // 02:00 UTC daily
);
```

Scheduled jobs that iterate over tenants use the outbox pattern: emit one event per tenant into the outbox, process each tenant independently. Do not loop over all tenants in one giant job — one slow tenant blocks everyone.

---

## 8. Failure modes and resilience

### 8.1 Timeouts on everything

Every network call has an explicit timeout. There are no infinite waits anywhere. The defaults:

| Call type | Timeout |
|---|---|
| Internal HTTP (backend ↔ ai-service) | 10s |
| Outbound HTTP to known-fast APIs (Stripe, auth providers) | 5s |
| Outbound HTTP to known-slow APIs (public registry, registrar checks) | 30s |
| Database query (Prisma) | 15s |
| AI inference (inside a job) | 60s |
| Job total runtime | varies, always set |

Defaults are in the shared HTTP client; overrides are per-call-site and require a comment justifying why.

### 8.2 Circuit breakers

Every dependency on a separately-deployed thing (ai-service, third-party APIs, email provider) has a circuit breaker. After N consecutive failures within M seconds, the breaker opens for T seconds — subsequent calls fail immediately rather than waiting for timeouts.

Defaults: N=5 failures, M=10s window, T=30s open. Tune per-dependency based on observed behaviour.

This protects both the caller (not wasting threads on a known-dead service) and the callee (not being retry-stormed when it comes back up).

### 8.3 Bulkheads

Don't let one slow dependency drown the service. Isolate:

- AI calls go through a queue — they never hold an HTTP handler open.
- External API calls run in separate worker pools from user-facing request handling.
- Long-running jobs run on separate worker processes from the HTTP server, with a separate DB connection pool.

At scale, this means a separate deployment tier for workers vs API. At the current scale (container orchestration), it means `workers/` is its own service with its own containers, even if the code is shared.

### 8.4 Graceful degradation

User-facing paths must have a working answer even if downstream systems are down. Examples:

- AI service down → show a banner, let users fall back to manual forms; read-only routes still work.
- Email provider down → enqueue the email with extra retries, return success to the user; they find out when they check their inbox, not when they click "send".
- Search index stale → return with a warning, let users sort/filter instead.

The pattern: separate "this action succeeded" from "this action had all its side-effects happen synchronously". The user-facing path returns success as soon as the durable record is committed to Postgres. Side effects are async.

### 8.5 Backpressure

When a queue backlog grows, the upstream producer must slow down or shed load. Either:

- **Rate limit at the producer** — e.g., cap new request creations at 100/min if the scoring backlog exceeds 10,000.
- **Fail fast at the producer** — return `503 BACKPRESSURE` to the client and a `Retry-After` header.

Never let a queue grow unbounded. Monitor queue depth; alert at 1,000 / 10,000 / 100,000 thresholds per queue. Unbounded growth is how you find out your Redis is out of memory at 3am.

### 8.6 Correlation IDs

Every request has a correlation ID (`X-Correlation-Id` header; generate one if not provided). It propagates through:

- All outbound HTTP calls (add header)
- All log lines (required field)
- All queue jobs (include in job payload)
- All DB audit log entries (include in row)

This is how you debug "what happened on that one request last Tuesday". Without correlation IDs, distributed debugging is guesswork.

---

## 9. Observability

Observability is not optional at 10k users. You will not remember what the system was doing yesterday. Logs, metrics, and traces are the product.

### 9.1 Structured logs (pino for Node, structlog for Python)

Every log line is JSON with fixed required fields:

```json
{
  "timestamp": "2026-04-16T14:30:00.000Z",
  "level": "info",
  "service": "backend",
  "correlationId": "01HQKR...",
  "tenantId": "01HXYZ...",
  "userId": "01HWVU...",
  "message": "Entity verified",
  "resourceId": "01HABC..."
}
```

**Rules:**
- Never log PII (emails, phone numbers, addresses) in clear text. Hash if needed for correlation.
- Never log secrets or tokens.
- Never log entire request bodies; log the fields you care about explicitly.
- Log levels: `fatal` (process will exit), `error` (request failed, investigate), `warn` (degraded), `info` (business event), `debug` (dev only, off in prod).

Aggregate logs with a hosted service (Axiom, BetterStack, monitoring tool) — never "look at files on the server". At 10k users you'll have millions of lines per day.

### 9.2 Metrics

Export Prometheus-style metrics. Minimum set:

- `http_requests_total{route, method, status, tenant}` — counter
- `http_request_duration_seconds{route, method}` — histogram
- `db_query_duration_seconds{query_name}` — histogram
- `queue_jobs_total{queue, status}` — counter
- `queue_depth{queue}` — gauge
- `ai_requests_total{model, status}` — counter
- `ai_tokens_used{model, tenant}` — counter
- `tenants_active` — gauge

Every metric has `tenant_id` when it's tenant-scoped so you can answer "is tenant X seeing elevated errors?" without grepping logs.

### 9.3 Distributed tracing

OpenTelemetry across all services. A single request through `frontend → backend → ai-service` produces one trace with spans for each service and each DB call. Export to Tempo, Honeycomb, or equivalent.

Spans are tagged with: `correlationId`, `tenantId`, `userId`, `route`, `module`, `operation`. Slow spans (>p95) are automatically flagged.

### 9.4 Alerting

Alerts fire on:
- Error rate >1% of requests for 5 minutes
- p95 latency on any HTTP route >1s for 5 minutes
- Queue backlog above threshold for 10 minutes
- Dead-letter queue entries >10 in an hour
- Postgres connection pool utilisation >80%
- Any `fatal`-level log line

Alert channels: email + team chat (low severity), SMS + phone (high severity). Use fewer, better alerts — alert fatigue is worse than no alerts. Every alert must be actionable; if nobody would do anything about it, it's a metric, not an alert.

### 9.5 Audit log

Every mutating action writes an audit entry. Non-negotiable at 10k users — you will be asked who did what, when, and you need an answer.

```sql
CREATE TABLE audit.audit_log (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  actor_user_id   TEXT NULL,       -- null if system
  actor_type      TEXT NOT NULL,   -- 'user' | 'system' | 'ai' | 'api_key'
  action          TEXT NOT NULL,   -- 'entity.verify', 'request.publish'
  resource_type   TEXT NOT NULL,   -- 'Entity', 'Request'
  resource_id     TEXT NOT NULL,
  delta           JSONB NULL,      -- {before, after} for updates
  correlation_id  TEXT NOT NULL,
  ip_address      INET NULL,
  user_agent      TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);
```

Partition monthly. Retain for 7 years (legal, contractual). Never delete. Audit entries are append-only — no UPDATE, no DELETE. Revoke those rights at the DB-role level.

---

## Disaster recovery

### RTO and RPO targets

| Target | Value | Meaning |
|---|---|---|
| **RTO** (Recovery Time Objective) | **4 hours** | Maximum acceptable downtime before service is restored |
| **RPO** (Recovery Point Objective) | **1 hour** | Maximum acceptable data loss window |

These targets apply to the primary application database and job queue. Static assets served from CDN have an effective RTO of minutes (CDN failover is automatic).

**What gets backed up and how:**

| Asset | Method | Frequency | Retention |
|---|---|---|---|
| Primary database | Automated snapshots (provider) | Continuous (PITR) | 7 days |
| Database | Weekly full backup to cold storage | Weekly | 90 days |
| Job queue state | Redis RDB snapshots | Every 15 min | 24 hours |
| Secrets | Managed by Doppler/provider — no separate backup needed | — | — |
| Application code | Git + container registry | Every deploy | Indefinite |

### Runbook: database restore

1. Confirm incident scope — is this data corruption, deletion, or hardware failure?
2. Identify the restore point: for accidental deletion, use PITR to 5 minutes before the incident. For hardware failure, use the most recent snapshot.
3. Restore to a staging instance first, verify data integrity with a query of the affected tables.
4. Promote the restored instance to primary (connection string swap via environment variable).
5. Run smoke tests. Check the application error rate in your observability platform.
6. Write a post-mortem within 48 hours and update this runbook if the process was incorrect.

### Declaring a disaster

A disaster is declared when:
- Primary database is unavailable for > 30 minutes with no ETA
- Data loss is confirmed or suspected
- The incident cannot be resolved by the on-call engineer without specialist escalation

When declared: notify stakeholders within 15 minutes, begin the restore runbook, open a dedicated incident channel.

---

## Scaling timeline

Current architecture is sized for **≤ 50k monthly active users** on a single-region deployment. Here is what changes at each scale threshold — use this as a planning horizon, not a to-do list.

### At 10k MAU (current target)
- Monolith + 4 extracted services ✓
- Single Postgres instance with read replica ✓
- BullMQ on Redis for async jobs ✓
- Single region deployment ✓
- Vertical scaling is sufficient for all services

**Watch for:** Slow query warnings (> 500ms), queue depth growing without draining, p95 API latency climbing above 800ms.

### At 50k MAU
No structural changes needed. Tune before you scale:
- Add Postgres connection pooling (PgBouncer) if connection count > 80% of `max_connections`
- Move large file storage out of the database if blob columns appear in query plans
- Review caching hit rates — anything below 80% is leaving performance on the table
- Add a second read replica if read queries are saturating the first

**Likely first bottleneck:** Database connection pool exhaustion or a hot query without an index.

### At 100k MAU
Begin planning these changes (6–12 month horizon):

| What | Why | How |
|---|---|---|
| **Extract the notification service** | High write volume, independent scaling, separate failure domain | Meets all three extraction criteria; move to dedicated service + queue |
| **Introduce a dedicated search index** | Full-text search at this scale overwhelms Postgres | Add Typesense or Meilisearch; sync via outbox events |
| **Evaluate multi-region** | Latency SLOs become harder to meet from a single region | Route read traffic to nearest region; writes stay primary |
| **Formalise on-call rotation** | 1 person can no longer cover all incidents | Two-person on-call with documented escalation |
| **SOC 2 Type II audit** | Enterprise customers will require it | 6-month observation period; engage a readiness firm |

**Likely first bottleneck:** Search latency, or a single large tenant monopolising database I/O (review tenant resource quotas).

### At 500k MAU+
Major architectural evolution required — this is Series B+ territory:
- Database sharding or move to a distributed DB (CockroachDB, PlanetScale)
- Multi-region active-active with conflict resolution strategy
- Dedicated data warehouse (Snowflake, BigQuery) — OLAP queries off primary DB
- API gateway with per-tenant rate limits enforced at the edge
- CQRS for the most read-heavy entities (projects, reviews)

**At this scale, revisit every architectural decision in this document with a fresh set of eyes.** The tradeoffs change significantly.

---

## 10. Security defaults

### 10.1 Authentication

- Users authenticate with email + password (bcrypt, cost 12) or OAuth (Google, Microsoft).
- Sessions are opaque server-side tokens (random 256 bits, stored in Redis with TTL). Not JWTs.
- JWTs are fine for service-to-service, not for user sessions. Session revocation is too important to hand to "wait for expiry".
- MFA via TOTP. Required for `owner` and `admin` roles, optional for others.
- Session TTL: 30 days, refreshed on activity. Hard cap 90 days, then reauth.

### 10.2 Authorization

Every authenticated endpoint explicitly states required role:

```ts
router.post(
  '/api/v1/entities/:id/actions/verify',
  requireAuth,
  requireRole('owner', 'admin'),
  async (req, res) => { ... }
);
```

**Rules:**
- Default-deny. Endpoints without an explicit role decorator return 403.
- Never check roles inside the handler — it's too easy to forget. Always via middleware.
- Authorisation logic is in one place (`shared/auth/guards.ts`), tested, and audited. No "just this one time I'll check inline".

### 10.3 API keys

External integrations use scoped API keys, not user sessions:

```
sk_live_{32-char-suffix}
sk_test_{32-char-suffix}
```

API keys:
- Are tenant-scoped, role-scoped, and optionally resource-scoped.
- Are hashed with Argon2 before storage. Shown to the user once at creation.
- Have a last-used-at, rotation reminder, and optional expiry.
- Can be revoked instantly (entry removed from DB, subsequent requests 401).

### 10.4 Secrets

Secrets live in environment variables at runtime, sourced from the platform's secret store (Doppler, AWS Secrets Manager, Fly Secrets). Never in code. Never in container images. Never in logs. Never in error messages.

A `.env.example` file in the repo documents what secrets are needed, without values.

### 10.5 Input validation

Every request body is validated with Zod (Node) or Pydantic (Python) at the route boundary. Unvalidated input never reaches business logic.

```ts
const CreateEntityInput = z.object({
  name: z.string().min(1).max(200),
  countryCode: z.string().length(2),
  registrationNumber: z.string().regex(/^[A-Z0-9]{6,20}$/),
  aboutText: z.string().max(2000).optional(),
});

router.post('/api/v1/entities',
  requireAuth, requireRole('owner', 'admin'),
  validate(CreateEntityInput),
  async (req, res) => { /* req.body is typed and valid */ }
);
```

### 10.6 Output encoding and content security

- JSON responses never include unescaped user content in error messages.
- HTML never renders user content without escaping (React handles this by default; `dangerouslySetInnerHTML` requires code review).
- CSP headers: `default-src 'self'`, `img-src 'self' https:`, `script-src 'self'`. Tighten further once you know every asset source.
- CORS: explicit allowlist of origins, not `*`. Credentialed requests only from the configured frontend origin.

### 10.7 Rate limits — belt and braces

Already covered in [§5.10](#510-rate-limiting). Re-listed here because it's a security control, not just a UX control. Rate limits defend against brute force, credential stuffing, and runaway scripts.

### 10.8 SQL injection, XSS, CSRF

- SQL injection: impossible via Prisma's parameterised queries. Raw SQL requires explicit `$1, $2` placeholders — never string concat.
- XSS: React escapes by default. CSP caps the blast radius of any slip.
- CSRF: double-submit cookie pattern for session-authenticated state-changing requests. API key requests are immune (keys are in `Authorization` header, not cookies).

---

## 11. AI service integration

The `ai-service` is architecturally distinct because it has different failure and scaling properties. This section covers the rules for how it integrates with the rest of the system.

### 11.1 The backend is the system of record, always

`ai-service` is **stateless**. It does not own any Postgres tables. All state lives in the backend's Postgres. The AI service calls back into the backend via HTTP for anything it needs to know about tenants, entities, requests.

Why: AI workloads are bursty and flaky. You do not want a service with volatile uptime to hold data. The AI service restarting or going down should not affect what a user sees in their profile.

### 11.2 All AI work is async

No HTTP handler ever awaits an AI call inline. Pattern:

1. User triggers an AI action (e.g., "score this entity").
2. Backend creates a `JobRecord` in Postgres with status `pending`, returns job URL to the client.
3. Backend enqueues a job in BullMQ.
4. Worker pops the job, calls `ai-service` over HTTP with a 60s timeout.
5. Worker receives result, writes to Postgres, updates `JobRecord` to `completed`, emits event.
6. Client polls `/jobs/{id}` or subscribes to a WebSocket for the completion event.

This gives you: retry logic for free, no frontend timeouts, observability of AI cost per tenant, backpressure when AI service is slow.

### 11.3 Model and provider abstraction

All calls to LLM APIs (Anthropic, OpenAI, etc.) go through a shared client in `ai-service/llm/client.py` that:
- Adds correlation ID and tenant ID to every call.
- Logs token usage per call, per tenant.
- Implements fallback (primary model fails → smaller model → cached response → graceful error).
- Enforces per-tenant rate limits on token spend.

Never call provider SDKs directly from route handlers. Always go through the abstraction. This is how you change providers without rewriting 40 endpoints.

### 11.4 MCP auth and rate limits

The `mcp-server` exposes resource data to external AI agents via Model Context Protocol. Its trust model is different from the backend's:

- **Auth**: OAuth 2 access tokens with explicit scopes (`entity.read`, `request.read`). Never a user session.
- **Rate limits**: stricter than human-facing routes. 30 req/min default, 10 req/min for heavy operations. AI agents retry aggressively if not rate-limited.
- **Data exposure**: only explicitly-flagged public-or-shared fields. Everything else returns 404 to MCP clients.
- **Logging**: every MCP request is audit-logged with the agent's OAuth app ID, not just the tenant.

The MCP server is effectively an external-facing public API with extra stringency. Treat any data reachable via MCP as published to the internet by the tenant, because functionally it is.

### 11.5 AI output validation

Treat AI output like untrusted user input. Specifically:

- **Validate shape**: run every AI response through Pydantic/Zod before persisting. If the model "almost" returned valid JSON, reject and retry — don't heroics-parse.
- **Validate content**: if the AI is supposed to return a score 0-100, clamp and validate. If it's supposed to categorise into 5 enum values, reject anything else.
- **Cap length**: every AI-generated string has a max length enforced server-side, even if the prompt said "max 500 chars".
- **Never trust AI output for authorization decisions**: AI can recommend "grant access" but a human or a deterministic rule makes the call.

### 11.6 Cost accounting

Every AI call records:
- Model used
- Input tokens, output tokens, cached tokens (if applicable)
- Cost in USD (computed from provider pricing table, which is versioned in the repo)
- Tenant ID, user ID, job ID

Roll up daily per tenant. Expose in admin. This is how you find the single tenant burning 80% of your AI budget before accounting does.

---

## 12. Deployment and environments

### 12.1 Environments

Three, no more:

| Env | Purpose | Data |
|---|---|---|
| `dev` | Local development via container orchestration | Seed data, throwaway |
| `staging` | Pre-production verification | Anonymised prod snapshot |
| `prod` | Production | Real data |

No `qa`, `uat`, `demo`, `preprod` — they become stale and nobody trusts them. If you need a sandbox for enterprise clients, it's a tenant *inside* prod with feature flags.

### 12.2 Configuration via environment variables

Every difference between environments is an environment variable. The code in `prod` is bit-identical to the code in `staging`. Never `if (env === 'prod')` in code — that's how you ship bugs that only show up in prod.

Twelve-factor. Read from `process.env` in one place (`shared/config.ts`), validate schema on boot (Zod), fail fast if missing. Exporting a typed `config` object from there; nothing else reads `process.env`.

### 12.3 Migrations at deploy time

Migrations run as a pre-deploy step, not inside the application startup. Sequence:

1. Run `prisma migrate deploy` against the target environment's DB.
2. Deploy the new application image.
3. Old instances drain, new instances start.

The application must be compatible with **both** the old and new schema during the overlap window. This is why [§6.10](#610-migrations) requires expand/contract: any schema change has to be additive first.

### 12.4 Zero-downtime deploys

- Healthchecks on every service (`/healthz` for liveness, `/readyz` for readiness).
- Graceful shutdown: on SIGTERM, stop accepting new requests, drain in-flight requests (up to 30s), close DB connections, exit.
- Rolling deploy: replace instances one at a time, not all at once.
- Session state in Redis so a user's session survives an instance being replaced.
- No long-running requests in the HTTP path (enforced by the 10s timeout default).

### 12.5 Rollback plan

Every deploy has a rollback. The rollback for the app is:
1. Re-deploy the previous container image tag.
2. If the deploy included a schema migration that cannot be reversed, do **not** roll back — roll forward with a fix.

This is why [§6.10](#610-migrations) rule 2 ("never drop columns immediately") matters — it keeps rollback available for a release window.

### 12.6 Feature flags

Use a flag service (analytics tool, Flagsmith, LaunchDarkly, or a simple home-grown table) for:
- Rolling out features to specific tenants first
- Disabling features quickly when something breaks
- A/B testing where relevant
- Kill switches for expensive operations (e.g., "disable all AI reranking")

Rule: every risky change ships behind a flag. "Risky" means: touches money, touches PII, touches the hot path, or is the first deploy of a new pattern.

---

## 13. Decision log

All architecturally significant decisions are recorded as ADRs (Architecture Decision Records) at the project root with the `DECISION-` prefix. Each is a short markdown file.

Template:

```markdown
# [Short Title]

Date: 2026-04-16
Status: Accepted

## Context
What problem are we solving? What constraints apply?

## Decision
What are we doing?
```

## Alternatives considered
What did we rule out, and why?

## Consequences
What becomes easier? What becomes harder?
What will we have to change about this later?
```

**When to write an ADR:**
- Introducing a new framework, language, database, or third-party service
- Changing the tenant isolation model
- Changing the ID format, timestamp format, or money representation
- Adding a new service to the topology
- Changing the versioning scheme
- Anything else future-you will ask "why did we do it this way?" about

ADRs are immutable once accepted. Superseded ADRs get a new ADR that references and supersedes them. Never edit old decisions — the history is the point.

---

## 14. Anti-patterns

Things that look smart at month 1 and bite hard at month 12. Named explicitly so you recognise the temptation.

### 14.1 The "we'll extract it later" module

Symptom: one module is weirdly important, and you're "mostly ready" to extract it into a service because it "just feels like it should be separate".

Reality: If there's no measured reason ([§2.3](#23-when-to-extract-a-new-service)), extracting it creates network overhead, deploy complexity, and a distributed transaction problem — in exchange for no benefit. Leave it in the monolith.

### 14.2 Premature event-driven everything

Symptom: every business action becomes an event, every event has three listeners, and debugging "what happened when the user clicked Save" requires reading 8 different log streams.

Reality: Events are great for fan-out. They're terrible for "module A should do X and then module B should do Y as a logical continuation". If the work is logically synchronous (user waits, error must be surfaced), keep it synchronous. Use events for things that are genuinely async and fire-and-forget.

### 14.3 Stringly-typed statuses

Symptom: `entity.status = 'verified'` in one place, `'VERIFIED'` in another, `'Verified'` in a third. Enum-typed config that expands with every PR.

Reality: Use Postgres enums or Prisma enums. Enforce at the type level. Fuzzy strings leak casing bugs and become impossible to rename.

### 14.4 Cache-first reads

Symptom: someone added Redis caching on a path and now there's a bug where stale entity data shows up for 5 minutes.

Reality: Add caching **only** when profiling shows the DB is the bottleneck, and only behind an explicit invalidation strategy. Default to no cache. Postgres is faster than you think.

### 14.5 "Just one more field" JSONB columns

Symptom: `settings JSONB` on every table, loaded with 50 keys nobody documents.

Reality: JSONB is correct for genuinely variable, per-row-custom data (tenant-specific field extensions, AI-generated metadata). It's wrong for "we didn't want to do a migration this sprint". If a field applies to all rows and is ever queried, it's a column.

### 14.6 Mega-migrations

Symptom: one PR that adds 3 tables, renames 5 columns, drops an index, and backfills a column "because they're related".

Reality: each schema change is its own migration. Each one is reversible. Each one is reviewable. Mega-migrations are how you end up at 11pm on a Saturday restoring from backup.

### 14.7 Distributed monoliths

Symptom: three services, but deploying any of them requires deploying the others. They share a database. They call each other synchronously for every request.

Reality: you have a monolith with network overhead. Either merge them back into one deployable, or do the work to make them actually independent (own database, async communication, independent deploy).

### 14.8 "Temporary" scripts in production

Symptom: a one-off Node script that backfills data, kept around "in case we need it again".

Reality: every one-off script is either a migration (run once, checked in, tracked) or a job (repeatable, tested, monitored). There is no third category. Scripts in `/scripts` that nobody maintains are time bombs.

### 14.9 Hardcoded tenant IDs in config

Symptom: "the demo tenant" has a hardcoded ULID in the codebase. Someone seeded it once.

Reality: there is no such thing as a hardcoded tenant in a multi-tenant system. The demo tenant is created by a seed script. The script is idempotent. Everything references it by slug (`demo`), never by ID.

### 14.10 Auth in the route handler

Symptom: `if (req.user.role !== 'admin') return res.status(403).end();` inside a handler.

Reality: authorisation belongs in middleware, tested in isolation, applied uniformly. Handlers that check auth inline are handlers where someone will forget to check auth.

### 14.11 Offset pagination on large tables

Already covered in [§5.6](#56-pagination). Listed again because it's the single most common scaling failure in B2B SaaS.

### 14.12 Swallowed exceptions

Symptom: `try { ... } catch (e) { /* ignore */ }` or `catch (e) { logger.info('something went wrong'); }`.

Reality: errors are information. Either handle them meaningfully (retry, degrade, surface to user) or let them propagate. Silent catches are how you discover bugs 6 weeks later from user complaints.

### 14.13 "Let's use the same DB in ai-service for speed"

Symptom: the Python service gains direct DB access "because HTTP is slow".

Reality: now you have two sources of truth for schema, two places where migrations happen, two places to enforce tenant isolation, and no clear contract between services. Keep the backend as the DB owner. HTTP is not slow at internal-network latency.

### 14.14 Logs as the only observability

Symptom: when something breaks, the answer is always "let me grep the logs".

Reality: logs are for debugging specific requests. Metrics are for knowing the system's health. Traces are for understanding cross-service behaviour. You need all three. Grepping logs at 10k users is a time sink.

### 14.15 Scheduled jobs as cron containers

Symptom: a container whose entrypoint is `cron` and a crontab. It sometimes runs jobs. Sometimes it doesn't. Nobody is sure why.

Reality: use the queue ([§7.7](#77-scheduled-jobs)). Cron containers don't survive deploys, don't have retry semantics, don't have observability, and don't scale horizontally.

---

## 15. Review checklist

Before merging any PR that touches architecturally significant code — APIs, schemas, services, queues — run this checklist.

### Data model

- [ ] Every new table has `id` (ULID), `tenant_id`, `created_at`, `updated_at`, `deleted_at`, `version`
- [ ] Every foreign key has an index
- [ ] Every query hit path has an index that covers the WHERE clause
- [ ] Migration is additive (expand); destructive changes deferred to a later migration (contract)
- [ ] Migration creates indexes `CONCURRENTLY`
- [ ] No `ON DELETE CASCADE` on tenant-scoped tables
- [ ] Tenant isolation enforced at middleware level, not just in handlers

### API

- [ ] URL is `/api/v{N}/{resources}/{id}` with plural kebab-case
- [ ] New endpoints documented in OpenAPI/docs
- [ ] Request body validated with Zod/Pydantic at the boundary
- [ ] Errors use the standard envelope with a registered `code`
- [ ] Mutating endpoints accept `Idempotency-Key` header (when applicable)
- [ ] Pagination uses cursor, not offset
- [ ] Breaking changes ship as `/v{N+1}/`, not edits to `/v{N}/`
- [ ] Rate-limit rules set appropriately for the endpoint

### Security

- [ ] Authentication middleware applied
- [ ] Authorisation middleware with explicit required role
- [ ] No user-controlled `tenant_id` anywhere
- [ ] No secrets in code, logs, or error messages
- [ ] All inputs validated, all outputs escaped where rendered

### Async / jobs

- [ ] Handlers don't await slow operations inline (AI, email, external APIs)
- [ ] New jobs are idempotent (check processed-jobs table)
- [ ] Timeouts, attempts, and backoff set explicitly
- [ ] Events follow `domain.past-tense-verb` naming
- [ ] Cross-tenant iteration uses per-tenant jobs, not one mega-job

### Observability

- [ ] Every log line has `correlationId`, `tenantId`, `userId` (or is explicitly system-scoped)
- [ ] New routes emit `http_requests_total` and `http_request_duration_seconds` metrics
- [ ] Significant new operations have their own span or metric
- [ ] Mutations write audit log entries
- [ ] No PII in logs

### Failure modes

- [ ] Every network call has a timeout
- [ ] Retries only on 5xx and network errors, never 4xx
- [ ] External dependency has a circuit breaker
- [ ] Graceful degradation considered — what happens if this dependency is down?
- [ ] Dead-letter queue behaviour defined

### Deployment

- [ ] Migration + code can run side-by-side (expand/contract respected)
- [ ] Rollback plan documented (even if "roll forward with a fix")
- [ ] Feature flag on risky paths
- [ ] `/healthz` and `/readyz` still work

### Documentation

- [ ] ADR written for architecturally significant decisions
- [ ] README updated for new services, env vars, or setup steps
- [ ] API changes reflected in external docs

If every box is ticked: ship it. If any are unticked: fix before merging, not "in a follow-up".

---

*End of document. Changes require a version bump in the header and a paragraph in the changelog.*
