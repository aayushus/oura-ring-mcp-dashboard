# GitHub Issues to Create

Copy each of these into GitHub Issues at:
https://github.com/aayushus/oura-ring-mcp-dashboard/issues/new

---

## Issue 1
**Title:** Diff OpenAPI v1.35 spec and implement missing endpoints
**Labels:** enhancement, priority:high
**Body:**
Our bundled `oura-openapi.json` is v1.35 (452KB) vs the upstream's v1.34 (403KB).

**Tasks:**
- [ ] Parse both specs and extract all paths
- [ ] Identify paths in v1.35 not present in v1.34
- [ ] For each new path: implement tool + resource + types
- [ ] Update tests/fixtures with new endpoint response shapes
- [ ] Update README Available Tools table

---

## Issue 2
**Title:** Add integration test layer
**Labels:** testing, priority:medium
**Body:**
Currently only unit tests exist. Per Testing.md, we need 20% integration tests.

**Tasks:**
- [ ] Set up a mock HTTP transport that intercepts Oura API calls
- [ ] Write integration tests for each tool that verify: auth header sent, correct endpoint called, response correctly formatted
- [ ] Add to CI pipeline

---

## Issue 3
**Title:** Add structured logging with pino
**Labels:** observability, priority:medium
**Body:**
Per Architecture.md §9, all services must have structured logging with correlation IDs.

**Tasks:**
- [ ] Add `pino` dependency
- [ ] Replace `console.log/error` calls with pino logger
- [ ] Add request-scoped correlation IDs to HTTP transport
- [ ] Ensure logs are JSON-formatted in production

---

## Issue 4
**Title:** Add ESLint config
**Labels:** code-quality, priority:low
**Body:**
No ESLint config exists. Per Code-Quality.md, the linter must be trusted and enforced.

**Tasks:**
- [ ] Add `eslint` + `@typescript-eslint` deps
- [ ] Create `.eslintrc.json` with TypeScript rules
- [ ] Add `pnpm lint` script
- [ ] Add lint step to Husky pre-commit hook
- [ ] Add lint step to CI

---

## Issue 5
**Title:** Set up CI pipeline (GitHub Actions)
**Labels:** devops, priority:medium
**Body:**
The existing `.github/workflows/ci.yml` points to upstream repo references. Needs updating for our fork.

**Tasks:**
- [ ] Update CI to run on our repo
- [ ] Add steps: install → build → lint → test with coverage
- [ ] Enforce 70%+ coverage gate in CI
- [ ] Add build status badge to README

---

## Issue 6
**Title:** Move Prism design skill to correct discovery path
**Labels:** tooling, priority:low
**Body:**
The Prism design skill is at `src/design/` but should be at `.agents/skills/prism-design/` for auto-discovery.

**Tasks:**
- [ ] Move `src/design/` → `.agents/skills/prism-design/`
- [ ] Verify skill is auto-discovered by Antigravity
- [ ] Remove old `src/design/` directory
