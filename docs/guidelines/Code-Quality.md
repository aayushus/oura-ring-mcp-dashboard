# Code Quality & Review Guidelines

**Version 1.0** · Last updated 16 April 2026

This document is a reference contract for how code is written and reviewed. Local project rules, installed agent configs, and the actual language/toolchain take precedence over examples here. The rules are language-agnostic where they can be, language-specific where they have to be (TypeScript and Python are the worked examples — translate the spirit to other languages as you adopt them).

This is a **companion** to `Architecture.md` and `Security.md`. Architecture covers system shape; security covers attack defences; this doc covers everything in between — the daily craft of writing code that won't make you wince in six months.

**Core stance:** code is read 100x more than it's written. Optimise for the reader, not the writer. The reader is usually you, three months from now, with no memory of what you were thinking.

> **See also:** [Architecture Guidelines](Architecture.md) — service boundaries, error handling patterns at the system level | [Security Guidelines](Security.md) — input validation, dependency scanning, pre-PR security checklist | [Performance Guidelines](Performance.md) — query optimisation, profiling approach | [Documentation Guidelines](Documentation.md) — inline documentation standards, ADR process

---

## Table of contents

1. [Principles](#1-principles)
2. [Project structure](#2-project-structure)
3. [Naming](#3-naming)
4. [TypeScript conventions](#4-typescript-conventions)
5. [Python conventions](#5-python-conventions)
6. [Comments and documentation](#6-comments-and-documentation)
7. [Error handling](#7-error-handling)
8. [Logging](#8-logging)
9. [Functions and modules](#9-functions-and-modules)
10. [Git and commits](#10-git-and-commits)
11. [Code review](#11-code-review)
12. [Refactoring patterns](#12-refactoring-patterns)
13. [Testing strategy](#13-testing-strategy)
14. [Performance](#14-performance)
15. [Anti-patterns](#15-anti-patterns)
16. [Pre-commit checklist](#16-pre-commit-checklist)
17. [Pre-PR checklist](#17-pre-pr-checklist)

---

## 1. Principles

Six principles, in priority order. Earlier wins when they conflict.

**1.1 Clarity beats cleverness.** A function any junior can read in 30 seconds is better than a "elegant" one-liner that takes 10 minutes to understand. The clever solution often saves three lines and costs three days. If you have to explain it in a comment to make it work, write it the boring way instead.

**1.2 Consistency beats personal preference.** When the codebase does X, do X — even if you'd prefer Y in a green field. Mixed styles cost more cognitive overhead than any single style choice. If the codebase consistency is wrong, fix it everywhere or change nothing; never half-migrate.

**1.3 Make the wrong thing hard.** Wrong code should look wrong. Type the parameter so the wrong call won't compile. Make the function private so it can't be called from where it shouldn't. Throw on invalid input rather than continuing silently. Code that allows mistakes invites them.

**1.4 Delete more than you add.** The best PR is the one that removes 200 lines while adding 50. Code is a liability — every line is a line to maintain, test, secure, and understand. When you touch a file, leave it cleaner than you found it. Deleted code can never break.

**1.5 Optimise for change, not the current shape.** Code is rarely written once and never touched. Architect for the next change you can predict, not the perfect form of the current shape. Premature abstractions cost; premature flexibility also costs. Add structure when there's a second use case, not a hypothetical third.

**1.6 Trust the linter, the type checker, the test suite.** When tooling tells you something is wrong, fix the code, not the tool. Disabling a lint rule should require the same scrutiny as disabling a security check. The tools exist because the team agreed on something — overriding silently breaks the agreement.

---

## 2. Project structure

### 2.1 Organise by domain, not by technical layer

Wrong:
```
src/
├── controllers/    # all HTTP handlers from every domain
├── services/       # all business logic from every domain
├── models/         # all DB models from every domain
├── utils/          # the dumping ground
```

Right:
```
src/
├── modules/
│   ├── auth/
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── types.ts
│   │   └── public.ts        # explicit cross-module export
│   ├── projects/
│   ├── tasks/
│   └── ...
└── shared/
    ├── db/
    ├── http/
    ├── auth/
    └── errors/
```

Why: when you change "how projects work", every change is in one folder. When you organise by layer, a single feature touches 5 folders and PR diffs become impossible to review.

**Rule: modules import from `shared/` freely, but only from another module's `public.ts`.** This gives you the seams to refactor or extract later without ripping internals apart.

### 2.2 The `utils/` folder is a smell

A `utils/` (or `helpers/`, `misc/`, `common/`) folder is where well-intentioned code goes to die. Every general-purpose function added there outlives its purpose, accretes dependencies, and eventually nobody knows what's safe to delete.

If a function is genuinely shared:
- Belongs to a domain → put it in that domain module's internal helpers
- Belongs to a technical concern (HTTP, DB, dates) → put it in `shared/{concern}/`
- Belongs nowhere → it's probably specific to one caller; inline it

The few exceptions: a project's `shared/types/` for genuinely-cross-cutting types, and language-level extensions (a date wrapper, a strongly-typed environment loader).

### 2.3 File size limits

- Source files: aim for ≤ 300 lines, hard cap 500. Past that, the file has more than one job.
- Functions: aim for ≤ 30 lines, hard cap 80. Past that, the function has more than one job.
- Classes: aim for ≤ 7 public methods. Past that, the class is two classes pretending to be one.

These are not arbitrary — they correlate with how much a human can hold in working memory. Files past 500 lines almost always shrink to 200 + 200 + 100 once split, with no functionality lost.

### 2.4 Public API surface per module

Every module has a `public.ts` (or `__init__.py`) that explicitly exports what other modules can use. Everything not exported is private.

```ts
// modules/projects/public.ts
export { ProjectsService } from './service';
export type { Project, ProjectStatus, CreateProjectInput } from './types';
// Nothing else is reachable from outside the module.
```

Other modules import from `modules/projects/public` (or `modules/projects` if your module bundler resolves `index.ts`). They never reach into `modules/projects/repository.ts` directly. ESLint rules enforce this:

```json
// .eslintrc — restricted-imports rule
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["**/modules/*/!(public)", "**/modules/*/!(public)/**"],
        "message": "Import from the module's public.ts only"
      }]
    }]
  }
}
```

Python equivalent: `__all__` in each module's `__init__.py` plus mypy strict-imports config.

---

## 3. Naming

Names are the densest documentation a codebase has. Most code-quality battles are naming battles in disguise.

### 3.1 Universal rules

- **Names describe purpose, not implementation.** `cachedUsers` is wrong (the cache is incidental); `recentlyActiveUsers` is right.
- **Length scales with scope.** Loop variable: `i`, `x` is fine. Function parameter: `userId`. Module-level export: `findActiveProjectsForUser`. The bigger the scope, the more descriptive the name.
- **Avoid abbreviations** unless they're universally understood (`url`, `id`, `db`, `http`). `usr`, `cfg`, `mgr`, `ctx` (when not React context) are noise.
- **Boolean names are questions.** `isVerified`, `hasPaid`, `canEdit`, `shouldRetry`. Never `verified`, `paid`, `edit` for booleans.
- **Avoid negatives in names.** `isActive` not `isNotInactive`. `isHidden` not `isNotShown`. Double negatives in conditionals are bug factories.
- **Numbers in names are a smell.** `processData2`, `userServiceV3` mean something more should have been renamed. The exception: API versions (`v1`, `v2`) and migration timestamps.

### 3.2 Naming patterns by what the thing is

| Thing | Pattern | Example |
|---|---|---|
| Variable holding a value | noun | `currentUser`, `totalAmount` |
| Variable holding a collection | plural noun | `projects`, `validInvoices` |
| Boolean | `is` / `has` / `can` / `should` prefix | `isActive`, `hasMfa`, `canDelete` |
| Function that does | verb phrase | `sendInvoice`, `verifyProject` |
| Function that returns | noun phrase | `currentUser()`, `nextCursor()` |
| Function returning boolean | `is` / `has` / `can` prefix | `isExpired()`, `hasAccess()` |
| Class / type | PascalCase noun | `ProjectService`, `TaskStatus` |
| Constant | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_PAGE_SIZE` |
| Event | past tense | `project.verified`, `OrderShipped` |
| Type representing a state machine state | PascalCase + adjective | `Pending`, `Verified`, `Rejected` |

### 3.3 Specific traps

**`data` and `info`** — meaningless. Never name a variable `data` or `info`. If the variable holds projects, it's `projects`. If it holds a parsed JSON response, it's `response` (or better: the actual shape, like `apiResponse`).

**`handle*` and `process*`** — vague. `handleClick` is the React idiom and accepted, but `handleProject` is unclear (handle in what way?). Prefer the specific verb: `verifyProject`, `formatProject`, `displayProject`.

**Manager / Helper / Service** — overused suffixes. A `ProjectManager` that has 30 methods is a god object. Split it: `ProjectRepository` (DB access), `ProjectVerifier` (verification logic), `ProjectNotifier` (sends emails). `Service` is acceptable for the top-level coordinator that fans out to repository / verifier / notifier.

**`get*` for expensive operations** — by convention, `get*` is cheap (hash lookup, property access). Use `fetch*` (network), `load*` (disk/DB), `compute*` (CPU work) for operations with cost. Reading `getUserById` you expect O(1); finding it's a 200ms DB query is a bug pretending to be a function name.

### 3.4 Casing by language

| Language | Variables / functions | Types | Constants | Files |
|---|---|---|---|---|
| TypeScript | camelCase | PascalCase | UPPER_SNAKE_CASE | kebab-case (`project-service.ts`) or camelCase (pick one project-wide) |
| Python | snake_case | PascalCase | UPPER_SNAKE_CASE | snake_case (`project_service.py`) |
| SQL | snake_case (per architecture doc) | snake_case | UPPER_CASE keywords | snake_case |
| URL paths | kebab-case | — | — | kebab-case |
| JSON keys | camelCase | — | — | — |

Pick a file-naming convention per project and stick to it. Mixing `projectService.ts` and `project-service.ts` is a code smell that points to deeper inconsistency.

---

## 4. TypeScript conventions

### 4.1 Strict mode, always

`tsconfig.json` baseline:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "skipLibCheck": true
  }
}
```

`noUncheckedIndexedAccess` is the unsung hero — it forces you to handle `array[i]` returning `undefined`, which catches a huge class of off-by-one bugs.

### 4.2 Types vs interfaces

- Use `type` by default.
- Use `interface` only when you need declaration merging (rare) or extending classes from external libraries.
- Never have both — pick one and apply it consistently to a project.

```ts
// ✓
type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
};

// ✓ — discriminated union
type ProjectEvent =
  | { type: 'created'; projectId: string; createdBy: string }
  | { type: 'verified'; projectId: string; verifiedBy: string; verifiedAt: Date }
  | { type: 'deleted'; projectId: string; deletedBy: string };
```

### 4.3 Avoid `any`, prefer `unknown`

`any` disables the type checker for a value. Once `any` is in, it spreads through every call site. `unknown` forces explicit narrowing before use:

```ts
// ✗ wrong
function parse(input: any) {
  return input.foo.bar;  // no error, but explodes at runtime
}

// ✓ right
function parse(input: unknown): { foo: { bar: string } } {
  if (typeof input !== 'object' || input === null) throw new Error('invalid');
  // ... narrow further
  return input as { foo: { bar: string } };
}
```

Validate at the boundary with Zod (see security doc §6) — inside the validated boundary, you have proper types. Outside (third-party API responses, JSON.parse output), it's `unknown` until proven otherwise.

`as` casts and `!` non-null assertions are escape hatches. Each one is a runtime risk the type checker won't catch. Use sparingly, comment when used:

```ts
// We validated the URL above with z.string().url(), so the URL constructor cannot throw.
const parsed = new URL(input.url);

// findFirst returns null per Prisma; we just inserted the row in a transaction above.
const created = await tx.project.findUnique({ where: { id } })!;
```

### 4.4 Prefer composition over inheritance

Class hierarchies in TypeScript almost always become a regret. Use functions and types:

```ts
// ✗ over-OO
abstract class BaseService<T> {
  abstract validate(input: unknown): T;
  protected log(msg: string) { /* ... */ }
}
class ProjectService extends BaseService<Project> { /* ... */ }

// ✓ functions and shared modules
import { logger } from '@/shared/logger';

export const ProjectSchema = z.object({ /* ... */ });
export function createProject(input: unknown): Promise<Project> {
  const parsed = ProjectSchema.parse(input);
  logger.info({ name: parsed.name }, 'creating project');
  // ...
}
```

The only places classes still earn their keep:
- Long-lived objects with internal state (a connection pool, a cache, a circuit breaker)
- Library-imposed shapes (an Express middleware class, a NestJS controller)
- Domain entities where method-on-object reads more naturally than function-with-data

### 4.5 Async / await, never raw promises

Always `async / await`. Never `.then().then().then()`. Never callbacks for new code.

```ts
// ✗ wrong
fetchUser(id).then(user =>
  fetchOrders(user.id).then(orders => /* ... */)
);

// ✓ right
const user = await fetchUser(id);
const orders = await fetchOrders(user.id);
```

`Promise.all` for parallelism:

```ts
const [user, settings, permissions] = await Promise.all([
  fetchUser(id),
  fetchSettings(id),
  fetchPermissions(id),
]);
```

`Promise.allSettled` when partial failure is acceptable:

```ts
const results = await Promise.allSettled([
  notifyEmail(user),
  notifyteam chat(user),
  notifyWebhook(user),
]);
const failures = results.filter(r => r.status === 'rejected');
if (failures.length) logger.warn({ failures }, 'some notifications failed');
```

### 4.6 Use `readonly` everywhere it fits

```ts
type Project = {
  readonly id: string;
  readonly tenantId: string;
  name: string;  // mutable through service layer only
  // ...
};

function totalRevenue(invoices: ReadonlyArray<Invoice>): number {
  return invoices.reduce((sum, i) => sum + i.amount, 0);
}
```

`readonly` doesn't change runtime behaviour but it stops accidental mutation. The cost is one keyword; the benefit is a class of bugs that can't happen.

### 4.7 Enums

TypeScript `enum` has runtime quirks (numeric enums leak both ways, string enums are fine but not tree-shakeable). Use string literal unions or `as const` objects:

```ts
// ✓ literal union — preferred
type ProjectStatus = 'pending' | 'verified' | 'rejected' | 'archived';

// ✓ as const — when you need a runtime value too
const ProjectStatus = {
  Pending: 'pending',
  Verified: 'verified',
  Rejected: 'rejected',
  Archived: 'archived',
} as const;
type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];
```

Avoid `enum ProjectStatus { Pending, Verified }` (numeric) and `const enum` (problematic with isolatedModules).

### 4.8 Linting

ESLint with `@typescript-eslint/strict` + `eslint-plugin-import` + a project-specific ruleset. Mandatory rules:

- `no-floating-promises` — every promise is awaited or explicitly handled
- `no-misused-promises` — no `if (asyncFn())`-shaped bugs
- `no-explicit-any` — error level
- `prefer-const` — always
- `no-restricted-imports` — enforce module boundaries (§2.4)
- `no-restricted-syntax` — ban `eval`, `with`, etc.

Format with **Prettier**, default config. Don't fight Prettier; the time you spend on style debates is time not spent shipping. Single quotes, 2-space indent, trailing commas, semicolons on. (Pick once; never re-litigate.)

---

## 5. Python conventions

### 5.1 Python version and tooling

- **Python 3.12+** — never older for new code. Old type-hint syntax (`List[str]`) is fine in legacy; new code uses `list[str]`.
- **Type hints everywhere** — public function signatures, class attributes, complex local variables. mypy in `strict` mode.
- **Ruff** for lint + format (replaces black, isort, flake8, autoflake; faster and unified).
- **Pyright** alongside mypy if you want stricter inference; otherwise mypy alone is fine.

### 5.2 Type hints

```python
# ✓ all public signatures typed
def find_project(tenant_id: str, project_id: str) -> Project | None:
    ...

# ✓ use built-in generics in 3.12+
def active_projects(tenant_id: str) -> list[Project]:
    ...

# ✓ TypedDict / dataclass for structured data
@dataclass(frozen=True)
class ProjectSummary:
    id: str
    name: str
    score: int
    is_verified: bool
```

**Rules:**
- Public API of every module is fully typed.
- Internal helpers can skip types if the inference is obvious (rare).
- `Any` is banned outside boundaries (parsing third-party JSON, dynamic dispatch). Validate with Pydantic at the boundary; inside, types are real.
- Use `Literal`, `TypedDict`, `Protocol`, `TypeGuard` aggressively. Modern Python's type system is genuinely powerful.

### 5.3 Pydantic for data validation

For any external input (HTTP request body, queue message payload, third-party API response, AI output), validate with Pydantic v2:

```python
from pydantic import BaseModel, Field, EmailStr

class CreateProjectInput(BaseModel):
    model_config = {"extra": "forbid"}  # equivalent to Zod's .strict()

    name: str = Field(min_length=1, max_length=200)
    country_code: str = Field(pattern=r"^[A-Z]{2}$")
    contact_email: EmailStr
    about_text: str | None = Field(default=None, max_length=2000)
```

Always `extra="forbid"` (rejects unknown fields — defends against mass assignment, see security doc §6.2). Always explicit max lengths.

### 5.4 Dataclasses vs Pydantic

| Use | When |
|---|---|
| `@dataclass(frozen=True)` | Internal value objects with no validation needed |
| `pydantic.BaseModel` | Anything crossing a trust boundary, anything serialised to / from JSON |
| `NamedTuple` | Simple immutable tuples; iteration matters |
| Plain `class` | Long-lived objects with behaviour |
| `dict` | Genuinely-dynamic key-value data; rare |

Default to `@dataclass(frozen=True)` for internal data. Reach for Pydantic when validation matters.

### 5.5 Async, but only where it earns its keep

FastAPI is async-first; HTTP handlers are usually `async def`. Inside, `await` on async I/O.

But: don't make everything `async def` reflexively. Pure-CPU functions (parsing, sorting, computing scores) should be plain `def`. They run faster and are easier to test. Wrap them in `async def` only if the caller is async and you're calling other async things.

```python
# ✓ pure compute, sync
def calculate_score(criteria: list[Criterion]) -> int:
    return sum(c.weight for c in criteria if c.met)

# ✓ I/O, async
async def fetch_project(tenant_id: str, project_id: str) -> Project:
    return await db.projects.get(tenant_id=tenant_id, id=project_id)
```

For genuinely-CPU-bound work that needs to not block (image processing, large parsing), use `asyncio.to_thread` or a process pool. Never run heavy CPU work directly in an async handler — it blocks the event loop and freezes other requests.

### 5.6 Error handling — narrow exceptions

```python
# ✗ catches everything, including KeyboardInterrupt
try:
    result = do_thing()
except Exception:
    logger.error("something went wrong")

# ✓ catches what you expect, propagates the rest
try:
    result = do_thing()
except (TimeoutError, ConnectionError) as e:
    logger.warn("transient error, retrying", exc_info=e)
    raise
```

Never bare `except:` (catches `SystemExit` and `KeyboardInterrupt`). Almost never bare `except Exception:` — the only place that's defensible is the absolute outermost layer of a worker process where you log and re-raise to fail the job.

### 5.7 Idioms to prefer

```python
# ✓ enumerate when you need an index
for i, project in enumerate(projects):
    ...

# ✓ list comprehension for transformation
verified = [p for p in projects if p.is_verified]

# ✓ generator expression for memory efficiency
total = sum(p.revenue for p in projects)

# ✓ dict / set comprehension
projects_by_id = {p.id: p for p in projects}

# ✓ unpacking
first, *rest = projects

# ✓ context managers for resources
async with db.transaction() as tx:
    ...

# ✗ don't use map / filter when comprehensions read better
verified = list(filter(lambda p: p.is_verified, projects))  # don't
verified = [p for p in projects if p.is_verified]  # do
```

### 5.8 Avoid mutable default arguments

```python
# ✗ classic bug
def add_tag(project_id: str, tags: list[str] = []) -> None:
    tags.append(get_tag())   # mutates the SAME list every call

# ✓ correct
def add_tag(project_id: str, tags: list[str] | None = None) -> None:
    tags = tags or []
    tags.append(get_tag())
```

Linter catches this; never disable that rule.

### 5.9 Linting and formatting

`pyproject.toml`:

```toml
[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = [
    "E", "F", "W",          # pycodestyle, pyflakes
    "I",                    # isort
    "B",                    # bugbear
    "UP",                   # pyupgrade
    "N",                    # naming
    "S",                    # security (bandit)
    "ASYNC",                # async best practices
    "RUF",                  # ruff-specific
]

[tool.mypy]
strict = true
python_version = "3.12"
warn_return_any = true
warn_unused_ignores = true
disallow_untyped_defs = true
```

Ruff replaces black + isort + flake8 + most plugins; one tool, faster, simpler config.

---

## 6. Comments and documentation

### 6.1 The two valid reasons to comment

1. **Why** — the reasoning behind a non-obvious choice. The code shows what; the comment shows why.
2. **External constraint** — this code looks weird because the API requires it / the browser bugs out / the regulator demands it.

```ts
// ✓ explains why
// Stripe webhooks can arrive out of order. Use the event timestamp,
// not arrival time, as the canonical sequence.
const ts = event.created;

// ✓ explains constraint
// Safari < 16 chokes on the standard date format here, so we send ISO with a Z suffix.
res.setHeader('X-Updated-At', date.toISOString());

// ✗ restates what the code does
// loop through projects
for (const p of projects) { ... }

// ✗ obviously redundant
const tenantId = req.tenantId;  // get the tenant id
```

### 6.2 Comments rot — be ready

Comments that describe what the code does will be wrong six months from now because the code changed and the comment didn't. Comments that describe **why** rarely rot, because the reasoning changes less often than the implementation.

When you change code, scan for comments above and around. If they're now misleading, update or delete. A wrong comment is worse than no comment.

### 6.3 TODOs and FIXMEs

```ts
// TODO(@you, 2026-04-16): replace with batch-aware version once tenants > 1000
// FIXME(SEC-142): rate-limit this endpoint before exposing publicly
```

Format:
- `TODO` for nice-to-have improvements
- `FIXME` for known broken behaviour that must be fixed before the next release
- Always include author or ticket reference and date — anonymous TODOs accumulate forever

CI counts FIXMEs and fails the build past a threshold (per project, e.g. > 20). Forces them to be addressed instead of accumulating.

### 6.4 Function / class doc comments

For public exported functions, write a one-line summary. For complex ones, expand.

```ts
/**
 * Verify a project against the trust registry.
 *
 * Calls out to the registry API; may take 1-5s. Throws RegistryUnavailableError
 * if the registry returns 5xx; the caller should retry via the queue.
 */
export async function verifyProject(
  tenantId: string,
  projectId: string,
): Promise<VerificationResult> {
  ...
}
```

Python equivalent:

```python
def verify_project(tenant_id: str, project_id: str) -> VerificationResult:
    """
    Verify a project against the trust registry.

    Calls out to the registry API; may take 1-5s. Raises RegistryUnavailableError
    if the registry returns 5xx; the caller should retry via the queue.
    """
    ...
```

For internal / private functions: a docstring isn't required if the name and signature make the purpose obvious. They usually do.

### 6.5 README per module

Every top-level module / service has a `README.md` covering:

- What it does (one paragraph)
- How to run it locally (commands, env vars needed)
- How to test it (commands)
- Where the entry points are
- Known gotchas

Not a comprehensive doc — a quickstart. Comprehensive docs go in ``.

### 6.6 ADRs for irreversible decisions

Already covered in architecture doc §13. For code-quality decisions specifically: when you adopt a tool (Ruff over flake8, Vitest over Jest, Prisma over TypeORM), write an ADR. Future-you will ask why; the ADR is the answer.

---

## 7. Error handling

### 7.1 Errors are values, not control flow

Errors should propagate explicitly. They shouldn't:
- Be silently swallowed
- Be caught and re-thrown as a generic "something went wrong"
- Be handled in the wrong layer (HTTP handler trying to retry a DB error)

The pattern: catch errors at the **boundary** where you have enough context to act on them. Inside business logic, let them propagate.

### 7.2 Typed error classes

Create a small set of error classes representing categories of failure:

```ts
// shared/errors/index.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_FAILED', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} ${id} not found`, 404, { resource, id });
  }
}

export class AuthorizationError extends AppError {
  constructor(action: string) {
    super('UNAUTHORIZED', `Not authorized to ${action}`, 403, { action });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, cause: unknown) {
    super('EXTERNAL_SERVICE_ERROR', `${service} unavailable`, 503, { service, cause });
  }
}
```

Throw these from business logic. Catch and translate at the HTTP boundary:

```ts
// shared/http/error-middleware.ts
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        correlationId: req.correlationId,
        details: err.details,
      },
    });
  }
  // Unknown error — log full details, return generic
  logger.error({ err, correlationId: req.correlationId }, 'unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      correlationId: req.correlationId,
    },
  });
}
```

### 7.3 Result types vs exceptions

Some teams prefer `Result<T, E>` over throwing. The argument: it forces handling at every call site. The counter-argument: it pollutes every signature with `Result` wrappers.

The pragmatic middle ground used here: **throw for genuinely exceptional conditions; return `Result` for recoverable expected failures**.

```ts
// throw — caller didn't expect this and likely can't recover
async function chargeCard(amount: Money): Promise<ChargeId> {
  if (amount.value <= 0) throw new ValidationError('Amount must be positive');
  // ...
}

// return Result — caller might recover (retry with different input)
type EmailResult = { sent: true; messageId: string } | { sent: false; reason: 'bounced' | 'rate_limited' | 'invalid' };

async function sendEmail(to: string, body: string): Promise<EmailResult> { ... }
```

Don't dogmatically pick one. The signal is: would a sensible caller want to handle this failure differently from "log and surface to user"? If yes → return result. If no → throw.

### Decision tree: Result type vs exception

```
Is this error something the caller can reasonably handle and recover from?
  └─ No (programming error, unexpected system state, corrupted data) → Throw an exception. These are bugs, not expected states.
  └─ Yes (validation failure, not-found, rate limit, external API down) → Use a Result type. The caller needs to handle this.

Is this on the boundary between your code and external input (HTTP request, form, file upload)?
  └─ Yes → Always use Result/union type. External input is always untrusted.
  └─ No (internal function, known type) → Throw if it's a programming error; Result if it's an expected failure.
```

**Rule of thumb:** If you find yourself writing `try/catch` around a business logic call (not I/O), that function should return a Result type instead.

### 7.4 Never silence errors

```ts
// ✗ wrong, will haunt you
try {
  await sendNotification(user);
} catch (e) {
  // ignore
}

// ✗ also wrong
try {
  await sendNotification(user);
} catch (e) {
  console.log('something went wrong');
}

// ✓ right
try {
  await sendNotification(user);
} catch (e) {
  logger.warn({ err: e, userId: user.id }, 'notification failed; will retry via queue');
  await queue.add('notification.retry', { userId: user.id });
}
```

Every catch block does one of: handle the error meaningfully, retry, log + re-throw, or convert to a typed error and throw. "Log and continue" is only valid when the operation is genuinely fire-and-forget (and even then, the log line records *what* failed, not just that something did).

### 7.5 Wrap external errors

When calling an external service, wrap whatever they throw in your own error type. Don't let `axios` errors or `pg` errors leak into business logic — they couple you to that library forever.

```ts
async function callRegistry(payload: RegistryRequest) {
  try {
    return await registryClient.post('/verify', payload);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      throw new NotFoundError('Registry record', payload.id);
    }
    if (axios.isAxiosError(err) && err.response?.status >= 500) {
      throw new ExternalServiceError('registry', err);
    }
    throw err;  // unexpected — let it bubble
  }
}
```

---

## 8. Logging

Detailed logging conventions are in security guidelines §15 and architecture §9.1 — this section covers the code-craft side.

### 8.1 Use a structured logger, never `console.log`

```ts
// ✗
console.log('user logged in', user);

// ✓
logger.info({ userId: user.id, tenantId: user.tenantId }, 'user logged in');
```

Pino (Node) and structlog (Python) produce JSON, support log levels, redact secrets, and integrate with log aggregators. `console.log` does none of that.

### 8.2 Log at the right level

| Level | When |
|---|---|
| `fatal` | Unrecoverable; process will exit. Almost never. |
| `error` | A request failed unexpectedly; user-visible degradation; investigate now. |
| `warn` | Degraded behaviour; expected-rare condition occurred; investigate later. |
| `info` | Business event (login, verification, order placed). Auditable trail of what the system did. |
| `debug` | Verbose trace; off in production. Useful when reproducing locally. |

Production runs at `info` and above. `debug` is for development and ad-hoc enablement during incidents.

### 8.3 Log shape

Every log line is JSON with these fields (enforced by the logger config):

- `timestamp` (ISO 8601)
- `level`
- `service`
- `correlationId`
- `tenantId` (when applicable)
- `userId` (when applicable)
- `message` (short, one-line description)
- Additional structured fields specific to the event

Never put structured data in the message string:

```ts
// ✗
logger.info(`Verified project ${projectId} in ${duration}ms`);

// ✓
logger.info({ projectId, durationMs: duration }, 'verified project');
```

The structured form is queryable in your log aggregator. The string form is grep-only.

### 8.4 Don't log inside loops

```ts
// ✗ floods logs with thousands of lines per request
for (const project of projects) {
  logger.info({ projectId: project.id }, 'processing project');
  await process(project);
}

// ✓ log start, end, summary
logger.info({ count: projects.length }, 'processing projects');
const results = await Promise.allSettled(projects.map(process));
const failures = results.filter(r => r.status === 'rejected').length;
logger.info({ count: projects.length, failures }, 'processed projects');
```

If you genuinely need per-iteration visibility, log at `debug` level so it's off in production.

---

## 9. Functions and modules

### 9.1 Function size

Aim for ≤ 30 lines. Hard cap 80. Past 80, the function does more than one thing — extract.

This isn't dogma; it's a heuristic for working memory. Long functions hide the bugs in their middle because the reader can't see the whole thing at once.

### 9.2 Single responsibility, real version

The textbook "single responsibility principle" is vague. The useful version: a function has a single responsibility if it can be **named** with one verb phrase and no `and`.

- `verifyProject` — single
- `verifyProjectAndSendEmail` — two responsibilities; split into `verifyProject` and a downstream event handler that sends the email
- `processOrder` — what does "process" mean? Probably 4 things hiding behind a vague verb

If you struggle to name the function, the function is doing too much.

### 9.3 Argument count

- 0–2 arguments: fine.
- 3 arguments: starting to smell.
- 4+ arguments: definitely smells. Use an options object.

```ts
// ✗ what's true here? what's the order?
async function createProject(name: string, country: string, true, false, true) { ... }

// ✓ self-documenting at the call site
async function createProject(input: {
  name: string;
  country: string;
  isVerified: boolean;
  hasPremiumTier: boolean;
  sendWelcomeEmail: boolean;
}) { ... }
```

The exception: 2-3 arguments where order is universal and obvious (`distance(from, to)`, `clamp(value, min, max)`).

### 9.4 Return types should be honest

A function that returns `Promise<Project | null>` tells the caller "this might not find anything — handle that." A function that returns `Promise<Project>` and throws `NotFoundError` tells the caller "this is supposed to find one; failure is exceptional."

Both are valid. Pick based on whether absence is a normal outcome (return null/undefined) or an error (throw).

```ts
// ✓ absence is normal — finding a draft that may not exist
async function findDraft(userId: string): Promise<Draft | null>;

// ✓ absence is exceptional — fetching a known project ID
async function getProject(id: string): Promise<Project>;  // throws NotFoundError
```

### 9.5 Pure functions where possible

Pure functions (deterministic output for a given input, no side effects) are:
- Trivially testable
- Composable
- Cacheable
- Parallelisable

Push purity to the edges: business logic that can be pure should be. I/O and mutation belong at the boundary, not interleaved with computation.

```ts
// ✗ logic interleaved with I/O
async function scoreAndSaveProject(id: string) {
  const project = await db.project.findUnique({ where: { id } });
  let score = 0;
  if (project.isVerified) score += 30;
  if (project.hasPremiumTier) score += 40;
  // ... 50 more lines
  await db.project.update({ where: { id }, data: { score } });
}

// ✓ pure logic, I/O at edges
function calculateScore(project: Project): number {
  let score = 0;
  if (project.isVerified) score += 30;
  if (project.hasPremiumTier) score += 40;
  // ...
  return score;
}

async function scoreAndSaveProject(id: string) {
  const project = await db.project.findUnique({ where: { id } });
  const score = calculateScore(project);
  await db.project.update({ where: { id }, data: { score } });
}
```

Now `calculateScore` has 50 trivial unit tests; the I/O wrapper has one integration test.

### 9.6 Module imports

- Imports at the top of the file, never inline (except for genuinely-lazy loading, rare).
- Group: std lib / framework first, third-party next, project last. One blank line between groups.
- Sort within each group alphabetically (let the linter do this).
- No deep imports into other modules' internals (§2.4).
- No circular imports — if you have one, the modules are wrong-shaped; refactor.

```ts
// ✓
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';
import express from 'express';

import { config } from '@/shared/config';
import { logger } from '@/shared/logger';
import { ProjectsService } from '@/modules/projects/public';
```

---

## 10. Git and commits

### 10.1 Branch model

- `main` is always deployable. Direct pushes blocked by branch protection.
- Feature branches: `feat/<scope>-<short-desc>`. Short-lived (≤ 1 week).
- Fix branches: `fix/<scope>-<short-desc>`.
- Chore branches: `chore/<scope>-<short-desc>`.

No long-lived feature branches. If a feature is too big for a week, ship it behind a feature flag in pieces.

### 10.2 Commit messages

Use Conventional Commits format:

```
<type>(<scope>): <subject>

<body, wrapped at 72 chars>

<footer with breaking changes, issue refs>
```

Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `style`, `build`, `ci`, `revert`.

```
feat(projects): add attachment verification

Calls the registry API to verify uploaded attachments against
the issuer's database. Falls back to manual review on registry
timeout.

Closes #142
```

**Rules:**
- Subject in imperative mood ("add", not "added" or "adds")
- Subject lowercase, no period
- Subject ≤ 72 chars
- Body explains *why* (the diff explains *what*)
- Body wrapped at 72 chars per line

### 10.3 Atomic commits

One logical change per commit. A commit that adds a feature, fixes an unrelated bug, and renames three files is unreviewable and unrevertable.

When you find yourself fixing things while building, stash the fixes, finish the feature, then make the fix its own commit. `git commit -p` (patch mode) lets you stage hunks selectively when you've already made a mess.

### 10.4 Squash on merge

Configure the repo to **squash and merge** PRs into `main`. The PR becomes one commit on `main`; the granular history lives on the branch.

This keeps `main`'s history readable (one commit per feature) while preserving the work-in-progress detail elsewhere. Bisecting `main` is then meaningful — every commit was a working state.

### 10.5 Don't rewrite shared history

Force-push (`git push --force`) is fine on **your own branch** before review.
Force-push to `main` (or any branch others have pulled) is **never** fine. It silently destroys their work.

Use `git push --force-with-lease` instead of `--force`. It refuses to push if someone else has updated the remote since you fetched. One safer keystroke.

### 10.6 .gitignore hygiene

A messy `.gitignore` is the entry point for committed secrets, large binaries, IDE config. Per-project `.gitignore` covers project-specific things; a global `~/.gitignore` covers OS / IDE files (`.DS_Store`, `.idea/`, `.vscode/`).

Never `git add -A` in a directory you don't fully understand. `git add` specific files or paths.

---

## 11. Code review

### 11.1 What review is for

Code review serves four purposes, in priority order:

1. **Catching defects** — bugs, security issues, broken tests
2. **Knowledge sharing** — every reviewer learns the codebase a bit more
3. **Maintaining standards** — naming, structure, patterns stay consistent
4. **Mentoring** — explaining *why* something is better, not just demanding changes

Review is **not** for: rewriting in your preferred style, debating settled decisions, blocking on personal preference, or scoring points.

### 11.2 Reviewer's job

Read the PR description first. Then read the test changes. Then read the production code with the tests as a guide. Then run it locally if it's non-trivial.

Comment on:
- Bugs (this will not work)
- Risks (this might not work in case X)
- Security or data-correctness concerns
- Significant design choices that warrant discussion
- Naming / clarity improvements
- Missing tests
- Documentation gaps for non-obvious behaviour

Do not comment on:
- Things the linter / formatter handles
- Personal style preferences not in the guidelines
- Hypothetical "what if we ever need to..."
- Old code in the same file that wasn't touched

### 11.3 Author's job

Write a PR description that explains:
- **What** — one-line summary
- **Why** — context, link to issue / ticket
- **How** — significant design choices, trade-offs
- **Tested** — what tests were added, how it was manually verified
- **Risk** — what could go wrong, what to watch in production
- **Screenshots** — for UI changes, before / after

Keep PRs small. Aim for ≤ 400 lines changed. PRs over 1000 lines should be split unless they're a generated change (lockfile, migration).

Respond to every reviewer comment, even just to acknowledge. Don't merge with unresolved comments — either fix the issue or explain why you're not.

### 11.4 Review etiquette

| Phrase | Use |
|---|---|
| "I think..." / "Could we..." | Soft suggestion |
| "What about..." | Question to consider |
| "This needs..." / "Please change..." | Required change |
| "blocking:" prefix | Required to merge |
| "nit:" prefix | Style / minor; not blocking |
| "praise:" or "👍" | Yes, give positive feedback too |

Be direct about what's required vs optional. Vague comments waste time; clear comments get acted on.

### 11.5 Approving and merging

- Approve only if you would be comfortable supporting the code at 3am.
- One approval is the minimum for non-trivial changes; for risky areas (auth, billing, migrations), require two.
- Authors don't merge their own PRs unless the team is solo. Reviewers merge after approval to confirm the change ships.
- After merge: monitor logs / metrics for the affected area for at least an hour. If it breaks something, revert first, debug second.

### 11.6 Handling disagreement

Reviewer thinks X, author thinks Y, both have reasons. Resolution:

1. Author and reviewer briefly discuss in PR comments
2. If unresolved, sync (call, video) for 15 minutes
3. If still unresolved, escalate to a third opinion (another senior, the team lead)
4. Decision is recorded in the PR; the loser commits to the choice and writes up an ADR if the decision is consequential

Don't let PRs die in disagreement. Resolution > consensus > silence.

---

## 12. Refactoring patterns

Refactoring is changing the shape of code without changing its behaviour. Done routinely, it keeps the codebase young. Done rarely, it requires heroics later.

### 12.1 The rule of three

The first time you write something, write it. The second time, copy-paste with edits. The third time, extract it.

Premature abstraction is more expensive than duplication. Two similar functions are easier to maintain than one over-flexible abstraction with three boolean flags. Wait until the shape is clear.

### 12.2 Refactor before adding to messy code

Before adding a feature to a confusing module, refactor the module to make the change easy. Then make the easy change.

> "Make the change easy, then make the easy change." — Kent Beck

If the refactor and the feature are mixed in one PR, neither is reviewable. Two PRs:
1. Refactor (no behaviour change, all tests still pass)
2. Add feature on top of clean structure

### 12.3 Common refactorings

**Extract function** — when a code block has its own purpose:

```ts
// before
async function processOrder(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  // 30 lines computing tax, shipping, discounts
  const total = subtotal + tax + shipping - discount;
  await db.order.update({ where: { id: orderId }, data: { total } });
}

// after
async function processOrder(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  const total = calculateOrderTotal(order);
  await db.order.update({ where: { id: orderId }, data: { total } });
}

function calculateOrderTotal(order: Order): Money {
  // pure, testable
}
```

**Extract module** — when a domain emerges:

When `modules/projects/` accumulates 800 lines of attachment-related code, that's a sign there's an `attachments/` sub-module struggling to be born. Extract it. Update the public surface. Run tests.

**Inline function** — the opposite of extract. When a wrapper function adds nothing:

```ts
// ✗ unnecessary indirection
function getProject(id: string) {
  return db.project.findUnique({ where: { id } });
}

// just call db.project.findUnique directly
```

**Replace conditional with polymorphism** — when a switch statement keeps growing:

```ts
// ✗ scattered logic
function notify(channel: 'email' | 'team chat' | 'sms', message: string) {
  if (channel === 'email') { /* ... */ }
  else if (channel === 'team chat') { /* ... */ }
  else if (channel === 'sms') { /* ... */ }
}

// ✓ extensible
type Notifier = { send(message: string): Promise<void> };
const notifiers: Record<string, Notifier> = {
  email: emailNotifier,
  team chat: team chatNotifier,
  sms: smsNotifier,
};
async function notify(channel: string, message: string) {
  await notifiers[channel].send(message);
}
```

This pays off when there's a real likelihood of more channels. For 2-3 stable cases, the switch is fine.

**Rename for clarity** — the cheapest refactoring with the highest return. Modern IDEs make this safe (rename across all references). When a name is wrong, fix it. Don't leave wrong names "for compatibility" — that's how confusion compounds.

### 12.4 When NOT to refactor

- The code is touched once a year and works fine. Leave it.
- You're refactoring to a pattern you read about last week. Wait until the second use case.
- The "improvement" is mostly aesthetic and breaks `git blame` for the rest of the team.
- You don't have tests yet. Add tests first; refactor under test cover.

### 12.5 Refactoring under test cover

Before any non-trivial refactor:

1. Are there tests for the behaviour you're about to change? If not, add them. They'll fail in interesting ways during the refactor, which is a feature, not a bug.
2. Run the tests. They must pass before you start.
3. Make small, atomic changes. Run tests after each.
4. If tests fail, revert the last change and try smaller.

Big-bang refactors land broken. Small refactors land working.

### 12.6 The strangler fig pattern

For replacing a large legacy area without a stop-the-world rewrite:

1. Build the new system alongside the old.
2. Route a small fraction of traffic to the new.
3. Compare outputs (shadow mode) for a period.
4. Cut over fully when confident.
5. Delete the old system.

Slow, boring, low-risk. Beats the heroic rewrite that ships with twelve regressions.

## When to refactor

Refactoring has a cost (time, merge conflicts, test churn). Only do it when the benefit is measurable. Use this decision tree before proposing a refactor.

```
Is the code in the path of a feature you're building right now?
  └─ No → Leave it. File a tech-debt ticket if it genuinely bothers you.
  └─ Yes → Continue ↓

Has this code caused a bug or a misunderstanding in the last 3 months?
  └─ No, it's just aesthetically messy → Fix the immediate area you're touching. Don't expand scope.
  └─ Yes (caused actual bugs or slowed multiple engineers down) → Continue ↓

Does the code have adequate test coverage (≥ 70% of the logic path)?
  └─ No → Write tests first. Refactoring untested code replaces one risk with another.
  └─ Yes → ✓ Refactor. Keep the PR focused — refactor in one PR, feature in another.
```

### Refactoring rules

1. **One concern per PR.** Refactoring and feature work never go in the same PR. Reviewers can't evaluate both at once.
2. **Tests pass before and after** — run the test suite before starting, not just before merging. If tests were already failing, fix them first.
3. **No behaviour changes.** A refactor changes structure, not observable behaviour. If you need to change behaviour, that's a feature, not a refactor.
4. **Scope to what you touched.** "While I'm in here" is how a 1-hour refactor becomes a 3-day PR. Fix what you came to fix.
5. **Document why, not what.** If the refactored code is significantly different from before, add a comment explaining why the old structure was changed (not describing what the new code does — the code does that).

### Signs that refactoring is overdue (escalate these)

These patterns indicate accumulated debt that will compound. Raise them in the next team sync:

| Pattern | Why it matters |
|---|---|
| Function > 50 lines with no clear sections | Cognitive load makes bugs invisible |
| Module with > 5 direct dependencies on other modules | High coupling; one change ripples everywhere |
| Test file > 3× the size of the source file | Tests are probably over-specified to implementation, not behaviour |
| Same logic exists in 3+ places | One fix needs to land in 3 places — inevitably drifts |
| `any` type appears in a public function signature | Breaks the type contract the whole codebase relies on |
| TODO comment > 6 months old | It will never be done; make a decision and act |

---

## 13. Testing strategy

Pragmatic stance: **70% line coverage as a guideline, not a target.** Coverage is a smell detector — code below 50% likely has bugs you don't know about; code above 90% is often over-tested or testing the wrong things.

The real metric is: **when this code breaks in production, will the test that should have caught it exist?**

### 13.1 The testing pyramid

```
              /\
             /  \
            / e2e \         <- few (5-15 critical user paths)
           /------\
          /        \
         /integration\      <- some (every API endpoint, every job)
        /------------\
       /              \
      /     unit       \    <- many (pure functions, complex logic)
     /------------------\
```

The shape matters. Inverted pyramids (lots of e2e, few unit) are slow, brittle, and hard to debug. The pyramid is the cheapest defect-detection-per-second.

### Contract testing (for multiple services)

If your codebase has 2+ independent services that communicate over HTTP or a message queue, consider contract tests using **Pact** or a similar consumer-driven contract testing tool.

**What contract tests catch:** Breaking changes in the API that unit tests miss because the producer and consumer are tested in isolation.

**When to add them:**
- Two or more services have been extracted from the monolith
- A change to Service A's API requires coordinating a deploy with Service B
- Integration tests are flaky because they depend on a real running service

**At the current scale (monolith + 4 services):** Contract tests are valuable for the services that have the most frequent API changes. Don't add them everywhere at once — start with the highest-churn service pair.

> **See also:** Architecture Guidelines §2 (service extraction criteria) — contract tests should be added as part of the extraction checklist, not retrofitted later.

### 13.2 Unit tests

**What to unit test:**
- Pure functions with non-trivial logic
- Data transformations
- Business rules (scoring, pricing, validation)
- Edge cases of utility functions
- Error paths

**What NOT to unit test:**
- Trivial getters / setters
- Wiring code (calling A then B then C with no logic)
- Generated code
- Third-party library behaviour
- Config loading (test once at boot, not per scenario)

**Style:** Arrange-Act-Assert.

```ts
describe('calculateScore', () => {
  it('gives 30 points for verified status', () => {
    const project = makeProject({ isVerified: true });
    const score = calculateScore(project);
    expect(score).toBe(30);
  });

  it('caps at 100 even with all bonuses', () => {
    const project = makeProject({
      isVerified: true,
      hasPremiumTier: true,
      hasExtendedSupport: true,
      yearsActive: 50,
    });
    expect(calculateScore(project)).toBe(100);
  });
});
```

**Rules:**
- One assertion per test ideally; multiple if they're the same logical check (object equality counts as one).
- Test names describe behaviour: `it('returns null when project not found')`, not `it('test1')`.
- No shared mutable state between tests. Each test stands alone.
- Fast: every unit test runs in <50ms. Slow tests are integration tests in disguise.

### 13.3 Integration tests

**What to integration test:**
- Every API endpoint (one happy path, one auth failure, one validation failure, one business-rule failure)
- Every queue consumer (success, retry, dead-letter)
- Database queries with non-trivial joins, filters, or transactions
- External service interactions, against a recorded fixture or mock

**Setup:**
- Fresh database per test file (or fresh transaction rolled back per test if speed matters).
- Real Postgres in a Docker container, not SQLite. SQLite "works" for most queries but lies on edge cases (collation, types, constraints).
- Real Redis / Bullmq for queue tests.
- Mock external HTTP calls with `nock` (Node) or `respx` (Python) — never call real third-party services.

```ts
describe('POST /api/v1/entities', () => {
  let app: Express;
  let session: TestSession;

  beforeEach(async () => {
    await resetDb();
    app = createTestApp();
    session = await createTestSession({ role: 'admin' });
  });

  it('creates an entity with valid input', async () => {
    const res = await request(app)
      .post('/api/v1/entities')
      .set('Authorization', `Bearer ${session.token}`)
      .send({ name: 'Acme', countryCode: 'GB', registrationNumber: 'AB123456', contactEmail: 'c@v.com' });

    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const inDb = await db.entity.findUnique({ where: { id: res.body.id } });
    expect(inDb?.name).toBe('Acme');
    expect(inDb?.tenantId).toBe(session.tenantId);
  });

  it('returns 403 for member role', async () => {
    const memberSession = await createTestSession({ role: 'member' });
    const res = await request(app)
      .post('/api/v1/entities')
      .set('Authorization', `Bearer ${memberSession.token}`)
      .send({ name: 'Acme', /* ... */ });
    expect(res.status).toBe(403);
  });
});
```

**Rules:**
- Test through the actual HTTP layer, not by calling the handler directly. Catches middleware ordering bugs.
- Verify side effects, not just response (check the DB, check the queue, check the audit log).
- Negative cases (auth failure, validation failure, tenant isolation) are mandatory, not optional.

### 13.4 End-to-end tests

**What to e2e test:**
- The 5-15 user paths that matter most. Key user journeys: signup → onboarding → publish profile → submit request → respond.
- Critical regressions that have happened before and you want to catch if they recur.

**What NOT to e2e test:**
- Every form variation
- Every error message
- Things integration tests can cover

**Tools:** Playwright (preferred) or Cypress. Run on CI against a deployed staging environment, not localhost.

E2e tests are slow, flaky, and expensive to maintain. They earn their place by catching the cross-system bugs that no other test type can find. Keep them few and high-leverage.

### 13.5 What NOT to test

- **Implementation details.** Testing that "function A calls function B" is brittle and has no value. Test the observable behaviour, not the implementation.
- **Generated code.** Prisma client, OpenAPI clients — they're tested upstream.
- **Third-party libraries.** You don't need to test that `date-fns` formats dates correctly.
- **The framework.** Testing that Express routes match URLs is testing Express, not your code.
- **Configuration.** Test that config loading throws on missing required vars (one test). Don't test every config combination.

### 13.6 Test data

- **Factories**, not fixtures. A `makeEntity({ name: 'X' })` factory is more flexible than a static fixture file.
- **Realistic data, not lorem ipsum.** An entity called "Acme Corp Ltd" surfaces bugs that "lorem ipsum" hides (length, special chars, sorting).
- **Deterministic IDs only when needed.** Most tests want random ULIDs. Tests asserting specific IDs are brittle.
- **Faker library** for generating realistic emails, names, phone numbers.

### 13.7 Mocks vs fakes vs stubs

- **Stub** — returns canned responses; "when called, return this".
- **Mock** — verifies it was called correctly; "expect this method called twice with these args".
- **Fake** — a working implementation, simpler than the real (in-memory DB, in-process queue).

**Prefer fakes over mocks.** Mocks couple tests to implementation; fakes test through the same shape as production. An in-memory queue fake catches more real bugs than a mocked queue with hardcoded responses.

Use mocks sparingly and only for things truly external (third-party APIs).

### 13.8 Snapshot tests

Useful for: rendered output (HTML, JSON shape), AI prompts, generated code.
Dangerous when: snapshots are huge, change frequently, and reviewers thumbs-up "looks right" without reading.

Rules:
- Snapshots ≤ 50 lines. Bigger ones are unreviewable.
- Update snapshots intentionally (`--update-snapshots`), never automatically in CI.
- Snapshot diffs in PRs require explicit review.

### 13.9 Test naming

```
describe('<unit under test>', () => {
  describe('<scenario or method>', () => {
    it('<expected behaviour>', () => { ... });
  });
});
```

Examples:
- `describe('EntityService') → describe('verify') → it('marks entity as verified on success')`
- `describe('POST /api/v1/entities') → it('returns 400 when email is missing')`
- `describe('calculateScore') → it('returns 0 for empty criteria list')`

The test name + the failing assertion should explain the bug without needing to read the test body.

### 13.10 Coverage

70% line coverage as a target across the codebase. Some modules will be 95% (pure logic), some will be 30% (config wiring). Don't chase coverage on code that doesn't need it.

Branches matter more than lines: 80% line coverage with 30% branch coverage means error paths are untested.

CI reports coverage; PRs that drop coverage by >2% need a comment explaining why.

### 13.11 Flaky tests

A flaky test is a broken test. Treat it as a P1.

- Quarantine flaky tests (skip with a tag, log to a dashboard).
- Triage within a week: fix or delete. Don't let them sit indefinitely.
- "Tests fail sometimes" is the start of teams losing trust in their suite. Once trust is gone, nobody runs the tests, and the suite stops catching bugs.

---

## 14. Performance

This is not a performance optimisation guide — it's the rules for not creating performance problems in normal code.

### 14.1 Measure, don't guess

Performance intuition is wrong more often than right. Profile before optimising. The bottleneck is rarely where you think.

Tools:
- Node: `clinic`, `0x`, the built-in `--inspect` profiler
- Python: `py-spy`, `cProfile`
- Database: `EXPLAIN ANALYZE`, slow query log
- Frontend: Lighthouse, browser perf tab

### 14.2 The N+1 query trap

The single most common backend perf bug. Loading a list, then making one DB call per item:

```ts
// ✗ N+1: 1 query for entities + N queries for each one's credentials
const entities = await db.entity.findMany({ where: { tenantId } });
for (const s of entities) {
  s.creds = await db.credential.findMany({ where: { entityId: s.id } });
}

// ✓ 2 queries total
const entities = await db.entity.findMany({
  where: { tenantId },
  include: { credentials: true },
});
```

Or in Prisma's case, use `include` / `select` to fetch related data in one query. Watch your DB query log in development; when one HTTP request fires 50 queries, you have an N+1.

### 14.3 Don't optimise prematurely

Premature optimisation usually means:
- Caching things that aren't measurably slow
- Choosing exotic data structures for tiny datasets
- Writing unreadable code to save microseconds

Boring code that's slightly slower beats clever code that's slightly faster, every time. Optimise when the profiler tells you to.

### 14.4 Measure cost in tokens, not just time, for AI

For AI calls, latency and tokens both cost money. Track both. A 4-second call using 50k tokens is more expensive than a 6-second call using 5k tokens.

### 14.5 Don't load everything into memory

For collections that could be large (logs, all users, all orders), use streaming or pagination. A query that's fine at 100 rows can crash the process at 100,000.

```ts
// ✗ loads all into memory
const users = await db.user.findMany({});
for (const u of users) { /* ... */ }

// ✓ paginate
let cursor: string | undefined;
do {
  const batch = await db.user.findMany({
    take: 1000,
    ...(cursor && { skip: 1, cursor: { id: cursor } }),
    orderBy: { id: 'asc' },
  });
  for (const u of batch) { /* ... */ }
  cursor = batch[batch.length - 1]?.id;
} while (cursor);
```

---

## 15. Anti-patterns

Things that look like good ideas at first and reliably bite later. Named so you recognise the temptation.

### 15.1 The premature interface

Symptom: every class has an `IFoo` interface "in case we want to mock it later".

Reality: interfaces with one implementation are dead weight. Add the interface when there's a second implementation, not before.

### 15.2 The "smart" comment

Symptom: a 10-line comment explaining a 3-line clever expression.

Reality: rewrite the 3 lines as 5 boring lines. Delete the comment. The boring code is now self-documenting.

### 15.3 The catch-all wrapper

Symptom: every external call wrapped in `try { ... } catch (e) { logger.error(e); throw new InternalError(); }`.

Reality: lossy wrapping destroys the caller's ability to handle specific errors (was it a 404? a 500? a network error?). Wrap selectively, preserve the original error chain.

### 15.4 Boolean parameters

Symptom: `function processOrder(orderId, true, false, true)`.

Reality: at the call site, nobody knows what `true, false, true` means. Use named options or, if it's two enum-like states, two functions (`processDraftOrder` vs `processFinalOrder`).

### 15.5 The big switch

Symptom: a 200-line switch on `event.type`, with each case calling a different module.

Reality: the dispatch is fine in principle; the size is the problem. Each case calling a small handler function is readable. Inline 30-line cases are not.

### 15.6 Stringly-typed APIs

Symptom: `processStatus("pending_approval")` where the string could be anything.

Reality: enums or literal unions. Make the type system catch typos.

### 15.7 Magic numbers and strings

Symptom: `if (response.status === 7) { ... }`.

Reality: named constant. `if (response.status === STATUS_AWAITING_APPROVAL) { ... }`. The constant is documentation.

### 15.8 Massive PRs

Symptom: a PR titled "various improvements" with 2000 lines changed across 50 files.

Reality: unreviewable. Bugs sail through. Split into focused PRs. If it's already huge, ask the author to split (don't approve out of fatigue).

### 15.9 Mixing levels of abstraction

Symptom: a function that orchestrates business logic also fiddles with HTTP headers and parses JSON.

Reality: each layer at its own level. Business logic doesn't know about HTTP. HTTP doesn't know about DB queries. Each layer has one job.

### 15.10 Test-driven debugging

Symptom: test passes, code is broken; turns out the test asserted the wrong thing.

Reality: write the test first (or pair-write), watch it fail for the right reason, then make it pass. Tests written after the code often validate the bug.

### 15.11 Disabled / skipped tests

Symptom: 47 tests in `.skip()` from various PRs over the months.

Reality: a skipped test is a deleted test that pretends not to be. Delete or fix within 7 days. Never accumulate skips.

### 15.12 Dead code

Symptom: functions, files, modules that nobody calls. "Might need it later."

Reality: delete it. Git remembers. If you need it later, you'll find it. Dead code costs in maintenance, mental load, and security surface.

### 15.13 The shared state singleton

Symptom: a global object that everything reads and writes (`appState`, `currentUser` outside React, request-context-as-global).

Reality: dependencies become invisible, tests become impossible, race conditions arrive. Pass dependencies explicitly. Use `AsyncLocalStorage` for request context, not a global.

### 15.14 Reinventing standard library

Symptom: `function arrayUnique(arr) { ... }`, `function isEmpty(obj) { ... }`.

Reality: the standard library or a well-maintained dependency does this better. `[...new Set(arr)]` for unique. Lodash if you really need a kitchen sink. Don't write your own.

---

## 16. Pre-commit checklist

Before `git commit`:

- [ ] Code compiles / type-checks (`tsc --noEmit`, `mypy`)
- [ ] Linter passes (`eslint`, `ruff`)
- [ ] Formatter applied (`prettier`, `ruff format`)
- [ ] Tests for changed code pass locally
- [ ] No `console.log`, `print`, `pdb.set_trace()` left in
- [ ] No commented-out code blocks
- [ ] No new TODO without an author and date
- [ ] Commit message follows Conventional Commits format
- [ ] Commit is atomic — one logical change

A pre-commit hook (Husky for Node, pre-commit for Python) automates the first four. Set it up once per project; don't bypass it.

---

## 17. Pre-PR checklist

Before opening or merging a PR:

### Implementation

- [ ] PR is focused on one change (≤ 400 lines ideally)
- [ ] Branch is up to date with `main`
- [ ] CI passes (build, type check, lint, tests)
- [ ] No skipped tests added
- [ ] Coverage hasn't dropped > 2%

### Tests

- [ ] Unit tests for new pure logic
- [ ] Integration tests for new endpoints / handlers / consumers
- [ ] Negative tests for auth, validation, tenant isolation
- [ ] No flaky test introduced (run suite 3x locally if uncertain)

### Documentation

- [ ] PR description includes what / why / how / tested / risk
- [ ] Public function changes have updated doc comments
- [ ] README updated if setup / config changes
- [ ] ADR written for significant decisions

### Cross-cutting

- [ ] Architecture guidelines respected (module boundaries, tenant isolation, error envelope)
- [ ] Security guidelines respected (input validation, authz, secret handling)
- [ ] Logging includes correlation ID and tenant ID where applicable
- [ ] Migrations follow expand/contract (additive first)
- [ ] No hardcoded secrets, URLs, IDs

### Quality

- [ ] No new `any`, `as`, non-null `!`
- [ ] No new files > 500 lines
- [ ] No new functions > 80 lines
- [ ] Naming follows the conventions (§3)
- [ ] Comments explain *why*, not *what*

If every box is ticked: open the PR. If any are unticked: fix before requesting review.

---

*End of document. Changes require a version bump in the header. Code-quality changes that affect the entire codebase (e.g., switching tooling, changing naming conventions) require an ADR and a coordinated migration plan.*
