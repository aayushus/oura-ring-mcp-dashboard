# Container Guidelines

**Version 1.0** · Last updated 2 May 2026

This document defines the standards for containerized development and deployment. We use container orchestration to ensure that every environment—from local development to production—is consistent, reproducible, and isolated.

---

## 1. Principles

**1.1 Parity is Paramount.** The environment on your laptop should mirror production as closely as possible.

**1.2 Explicit over Implicit.** Define every dependency, port, and volume explicitly. No "magic" host configurations.

**1.3 Fast Feedback.** Optimize container builds and startup times to keep the development loop tight.

**1.4 Security by Isolation.** Use networks and resource limits to contain the blast radius of any single service.

---

## 2. Compose Configuration

We use the modern Compose specification for orchestration.

- **Filenames:** Use `compose.yaml` (the modern canonical filename) over the legacy `docker-compose.yml`.
- **Startup Ordering:** Define a `healthcheck` for every service. Use `depends_on` with `condition: service_healthy` to ensure services start in the correct order.
- **Resource Limits:** Set resource limits (`deploy.resources.limits`) even in development to catch memory leaks early.

---

## 3. Storage & Volumes

- **Persistence:** Use bind mounts (`./volumes/...`) for persistent data in development to keep data visible and manageable.
- **Hot-Reloading:** Use bind mounts for source code to enable instant feedback during development.
- **Named Volumes:** Avoid named volumes for development data unless there is a specific performance reason.

---

## 4. Environment & Secrets

- **Substitution:** Use a `.env` file for Compose variable substitution.
- **Explicitness:** Do **NOT** use `env_file`; instead, explicitly define container environment variables under `environment:` using `${VAR}` syntax. This makes the container's contract visible in the YAML.
- **Secrets:** Never bake secrets into images. Use environment variables (via a password manager or secret service) at runtime.

---

## 5. Networking

- **Isolation:** Use custom networks to isolate service groups (e.g., a `frontend` network for the app + proxy, and a `backend` network for the app + database).
- **No Host Networking:** Avoid `network_mode: host`. It breaks isolation and creates port conflicts.

---

## 6. Build & Images

- **Versioning:** Pin image versions in `compose.yaml`. Avoid `:latest` tags; they lead to non-deterministic environments.
- **Multi-stage Builds:** Use `build.target` to target specific stages (e.g., `dev`, `test`, `prod`) from a single Dockerfile.
- **Caching:** Use `build.cache_from` to speed up CI builds by pulling previous image layers.

---

## 7. Operational Standards

- **Restart Policies:** 
    - `restart: unless-stopped` for long-running services.
    - `restart: "no"` for one-off migration or setup tasks.
- **Logging:** Define explicit logging configurations (`driver` and `options`) to control log size and rotation, preventing disk exhaustion.
- **Dry/Reuse:** Use YAML anchors or `extends` to reduce duplication across similar service definitions.

---

*End of document. Container standards are audited annually.*
