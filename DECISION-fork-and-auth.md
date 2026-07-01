# DECISION: Fork oura-ring-mcp and self-host via Docker

**Date:** 2026-07-01  
**Status:** Accepted  
**Author:** aayushus

---

## Context

We needed an MCP server to expose Oura Ring health data to Claude and other AI assistants. Two paths were available:

1. Use `mitchhankins01/oura-ring-mcp` directly via `npx`
2. Fork it, upgrade the OpenAPI spec, and self-host via Docker

Additionally, Oura deprecated Personal Access Tokens in December 2025, making OAuth2 the only supported authentication method.

---

## Decision

**Fork and self-host via Docker Compose.**

**Auth method: OAuth2 only.** PATs are no longer available.

---

## Rationale

### Fork over `npx` install

| Factor | `npx` (no fork) | Fork + Docker |
|---|---|---|
| OpenAPI spec version | Locked to upstream (v1.34) | Ours (v1.35 — 49KB larger) |
| New endpoints from v1.35 | Not available | Can implement |
| Control over auth flow | None | Full |
| Self-hostable for others | Partial (no Docker story) | Yes — `./start.sh` |
| Ability to contribute back | No | Yes via upstream remote |
| Open source under own name | No | Yes |

The upstream project (`mitchhankins01/oura-ring-mcp`) is high quality — it already has OAuth, typed API client, smart analysis tools, and tests. Forking preserves all of that while letting us upgrade the spec and add a proper Docker self-hosting story.

We added the upstream as a git remote (`upstream`) so we can pull future improvements:
```bash
git fetch upstream
git merge upstream/main
```

### OAuth2 over PAT

Oura's own documentation states:
> "Personal access tokens were deprecated in December 2025 and are no longer available for use."

OAuth2 is the only supported path. The fork already implements a full OAuth2 CLI flow with credential persistence and token refresh.

---

## Consequences

- **Positive:** Full control over the OpenAPI spec, ability to ship new endpoints as Oura releases them, clean Docker self-hosting story for open source users.
- **Positive:** Upstream remote lets us merge improvements from the original project.
- **Negative:** We own maintenance. If the upstream diverges significantly, merging becomes work.
- **Mitigated:** The upstream project is actively maintained and our changes are additive (new endpoints, Docker layer) — not conflicting rewrites.

---

## Alternatives considered

**Rebuild from scratch (Python):** Rejected. The TypeScript implementation is mature with full test coverage. Python would take weeks to reach feature parity with no benefit for this use case.

**Use upstream as-is via `npx`:** Rejected. No control over spec version, no clean Docker story for self-hosters, cannot add new endpoints.
