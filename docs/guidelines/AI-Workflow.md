# AI Development Workflow

**A model-agnostic guide to using AI coding assistants effectively without burning your budget.**

---

## The Core Principle

> **Never jump to the most capable (most expensive) model first.**
>
> Most problems resolve at a lower tier. Save your high-capability quota for genuinely hard problems.

---

## The Escalation Ladder

Work bottom-up. Only escalate when the current tier fails:

```
Tier 1 — Free / fast models (autocomplete, small tasks)
    ↓  fails or wrong answer
Tier 2 — Mid-tier chat model (medium complexity, cross-file edits)
    ↓  still wrong, or decision is hard to reverse
Tier 3 — Most capable model (architecture, hard bugs, ambiguous design)
```

Never start at Tier 3. Tedious ≠ complex. Large ≠ complex.

---

## The Decision Gate

Run this before every task:

### Is it mechanical?
*(generate, scaffold, rename, format, document, convert)*
→ **Tier 1** — autocomplete or fast chat. Do not open an expensive session.

### Does it require reading a large codebase?
*(many files, orientation, blast radius analysis)*
→ **Tier 1** — use whichever model has the largest context window for orientation. Dump the whole codebase if needed.

### Is it ambiguous or complex with real tradeoffs?
- Hard to reverse → **Tier 3** (architecture, data model, security design)
- Reversible → Try **Tier 2** first. Escalate only if the answer feels wrong.

### Is it a hard bug with unclear root cause?
→ Try Tier 1 + Tier 2 first (give it ~30 min). Still stuck? → **Tier 3** with a scoped prompt.

---

## Before You Invoke a High-Capability Model

Check these before starting an expensive session:

- [ ] Have I tried a cheaper/faster model on this first?
- [ ] Is this decision hard to reverse? If easily rewritten in 10 min, it doesn't need the top tier.
- [ ] Is the problem genuinely ambiguous or complex? (Tedious ≠ complex)
- [ ] Have I written a tight, scoped prompt? "Given X with constraint Y, what's the right approach for Z?" — not "look at my code and tell me what's wrong."
- [ ] Will I keep the session lean? Start fresh for each distinct problem.

---

## Task Routing by Type

### Free / Fast — Tier 1
| Task | Notes |
|---|---|
| New project setup — structure, configs, CI, env | Any framework |
| CRUD, endpoints, forms, simple components | Mechanical output |
| Tab autocomplete while typing | Always on |
| Unit + integration test generation | Dispatch and forget |
| "What does this whole codebase do?" | Use largest context window |
| Code review — style, consistency, obvious bugs | Load full diff |
| Documentation, README, inline comments, changelogs | |
| Batch migrations — rename, restructure, update imports | Parallel if possible |

### Mid-Tier — Tier 2
| Task | When to escalate from Tier 1 |
|---|---|
| Medium refactors, API integration | Tier 1 gives wrong or incomplete answer |
| State management, data transforms | Needs more reasoning |
| Cross-file logic changes | More than ~5 files involved |

### High-Capability — Tier 3
| Task | Why |
|---|---|
| System architecture — services, data flow, tech choices | Hard to reverse, high stakes |
| Database schema, API contracts, auth strategy | Foundational decisions |
| Hard bug — unclear root cause | Multi-layer reasoning needed (after 30 min of Tier 1/2) |
| Ambiguous requirement — high-stakes design | Multiple valid designs, need tradeoff analysis |

---

## Parallel Agent Workflow

If your tooling supports multiple parallel agents, use them for background tasks while you work on something else:

**Dispatch and forget (check back in 20–30 min):**
- Generate test suite for a module you just finished
- Explore an unfamiliar library and summarise the API
- Migrate a naming pattern across all files in a directory
- Write docs for a module while you code the next one
- Orientation pass on a new codebase

**How to dispatch effectively:**
1. Give a clear, bounded task with a defined deliverable
2. Point it at specific files or directories — not "look at the whole project"
3. Specify the output format: "summarise as bullet points", "write as JSDoc", "output as a table"
4. Move on — don't babysit it

---

## Getting the Most from Your Context Window

Your context window is a constrained resource. Protect it:

**Before a session:**
- Scope tightly — one specific problem, not a broad investigation
- Use a cheaper model to orient first ("what files are involved in X?"), then bring the specific question to the top tier
- Prepare your prompt while context is fresh (ideally the night before)

**During a session:**
- Start a fresh session for each new problem — don't carry state from unrelated problems
- Use `/compact` (or equivalent) after distinct sub-problems if your tool supports it
- If the session wanders, stop and restart with a tighter prompt

**CLAUDE.md saves 30–50% of your context window:** Every session the AI re-discovers your project from scratch if you don't have one. A good CLAUDE.md means it starts with full context and spends the window reasoning, not orienting.

---

## Non-Negotiable Rules

1. **CLAUDE.md is mandatory** — every project, always. No exceptions.
2. **Never use Tier 3 for "generate", "write", "rename", "convert", or "document"** — those go to Tier 1.
3. **Escalation ladder always** — never skip tiers out of habit.
4. **Session discipline** — one session per problem, start fresh for each.
5. **Free background capacity** — any task that doesn't need your attention right now can run in the background. You're running a free second developer.

---

## Multi-Language / Multi-Context Projects

When switching between domains (languages, services, repos) mid-day:

1. **Don't cold-start Tier 3 on a new context.** Use a cheaper model first to re-orient — "here's the existing Python backend, I'm now adding a Go service that calls it. Explain how they currently communicate."
2. **Language boundary bugs → Tier 3.** When a bug lives at the interface between two systems (serialisation, type mismatches, protocol differences), it's often genuinely complex. Legitimate top-tier use case.
3. **Keep per-domain context in CLAUDE.md.** If your project spans multiple languages or services, add a section per domain with its own conventions and key files.
