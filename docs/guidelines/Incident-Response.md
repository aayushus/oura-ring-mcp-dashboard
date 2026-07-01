# Incident Response Guidelines

**Version 1.0** · Last updated 2 May 2026

This document is the operational contract for when things go wrong. It defines how we detect, triage, and resolve incidents—whether they are security breaches, performance degradations, or total outages. The goal is to move from "chaos" to "coordinated response" as fast as possible to minimize impact on our B2B customers.

This is a **companion** to `Security.md` (threat models) and `Performance.md` (SLOs/SLIs). When an SLO is breached or a threat is realized, this document takes over.

---

## Table of contents

1. [Principles](#1-principles)
2. [Severity levels](#2-severity-levels)
3. [Response roles](#3-response-roles)
4. [Incident lifecycle](#4-incident-lifecycle)
5. [Communication protocols](#5-communication-protocols)
6. [Security incidents](#6-security-incidents)
7. [Post-mortem process](#7-post-mortem-process)
8. [Runbooks (Quick links)](#8-runbooks-quick-links)

---

## 1. Principles

**1.1 Resolution over blame.** During an incident, the only thing that matters is restoring service. We don't ask "who did this?" until the post-mortem. 

**1.2 One commander, many workers.** Every incident has exactly one Incident Commander (IC). The IC does not write code; they coordinate. If you are told to do something by the IC, it is your top priority.

**1.3 Over-communicate internally, calibrate externally.** Keep the team updated in the incident channel every 10–15 minutes. Keep customers updated according to the SLA, with vetted, calm language.

**1.4 Evidence preservation.** Especially for security incidents, don't just "wipe and restart." Capture logs, memory snapshots, and disk state before remediation if possible.

---

## 2. Severity levels

| Level | Impact | Target Response | Target Resolution |
|---|---|---|---|
| **SEV-1 (Critical)** | Production down, data loss, or major security breach affecting multiple tenants. | < 15 mins | < 4 hours |
| **SEV-2 (High)** | Major feature broken, significant performance degradation, or single-tenant breach. | < 30 mins | < 12 hours |
| **SEV-3 (Normal)** | Minor feature broken, intermittent errors, or low-risk security finding. | < 4 hours | < 3 days |
| **SEV-4 (Low)** | UI bugs, documentation errors, or non-functional issues. | < 24 hours | Next release |

---

## 3. Response roles

For SEV-1 and SEV-2 incidents, roles must be explicitly assigned:

*   **Incident Commander (IC):** The single point of decision-making. Responsible for the strategy, assigning tasks, and declaring the incident resolved.
*   **Scribe:** Records the timeline in real-time (in team chat or a shared doc). Key for the post-mortem.
*   **Communications Lead (Comms):** Manages the status page and coordinates with Customer Success. Prevents engineers from being interrupted by stakeholders.
*   **Operations/Security Lead:** The "boots on the ground" leading the technical investigation or remediation.

---

## 4. Incident lifecycle

### 4.1 Detection & Declaration
Anyone can flag a potential incident. If it looks like a SEV-1 or SEV-2, declare it in the `#incidents` channel:
`@here SEV-1 Incident Declared: Database connection pool exhausted. IC is [Name].`

### 4.2 Triage & Containment
Identify the blast radius. Can we stop the bleeding? (e.g., disable a buggy feature flag, roll back a deploy, block an attacking IP).

### 4.3 Investigation & Eradication
Find the root cause. Once contained, remove the cause (e.g., fix the code, patch the vuln, scale the DB).

### 4.4 Recovery
Restore service gradually. Monitor metrics for "false recovery" (where the system looks fine but is failing silently).

---

## 5. Communication protocols

### 5.1 Internal
*   All talk happens in the specific `#incident-[date]-[brief-desc]` channel.
*   IC provides a "Current State" summary every 20 mins:
    *   **Status:** (Investigating / Containing / Recovering)
    *   **Impact:** (Which tenants? Which features?)
    *   **Next Steps:** (What are we doing right now?)

### 5.2 External
*   **Status Page:** Update within 15 mins for SEV-1. "We are investigating reports of [Issue]. We will provide an update in 30 mins."
*   **Direct Outreach:** For SEV-1 security breaches, the IC and Legal coordinate direct notification to affected B2B partners within the contractually mandated window (usually 24–72h).

---

## 6. Security incidents

Special rules for security (see `Security.md` §15.4):
*   **Silence is key:** Do not discuss the vulnerability in public channels or commit messages.
*   **Isolation:** If a tenant is breached, isolate that tenant's resources immediately.
*   **Legal:** IC must involve the legal lead if PII is confirmed to be exfiltrated.

---

## 7. Post-mortem process

**Mandatory for SEV-1 and SEV-2.** Held within 48h of resolution.
*   **Format:** Blame-free. Focus on "How did the system allow this?" not "Why did the person do this?".
*   **Output:** A document containing:
    1.  Timeline
    2.  Root Cause (The "5 Whys")
    3.  Successes (What went well?)
    4.  Action Items (P0/P1 tasks to prevent recurrence)
*   **Review:** All action items are entered into the issue tracker and tracked.

---

## 8. Runbooks (Quick links)

*   Database recovery runbook — add one if this project owns persistent data.
*   Rollback procedure — add one if this project has deployable services.
*   DDoS mitigation runbook — add one if this project exposes public endpoints.
*   Secret rotation runbook — add one if this project stores credentials or API keys.

---

*End of document. This is a living contract; update after every major post-mortem.*
