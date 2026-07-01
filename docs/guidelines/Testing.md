# Testing Guidelines

**Version 1.0** · Last updated 2 May 2026

This document defines a reference testing strategy. Local project rules, installed test tools, and the actual stack take precedence over tool-specific examples here. We don't just "write tests"; we write the *right* tests to ensure that the system is stable, AI features remain accurate, and the UI never regresses.

---

## 1. The Testing Pyramid

We adhere to a 70/20/10 split:

1.  **Unit Tests (70%):** Fast, isolated tests for pure functions and business logic. No DB, no Network.
2.  **Integration Tests (20%):** Tests that hit a real (test) database or the AI service mock. Ensures modules work together.
3.  **E2E & Contract Tests (10%):** High-level tests that verify the full user flow and cross-service contracts.

---

## 2. Contract Testing (Pact)

To prevent the "I changed one service and broke another" problem, use **Consumer-Driven Contract Testing** when the project has multiple independently deployed or separately owned services.

*   **Default example tool:** Pact.io, or the project's existing contract-testing tool
*   **When to use:** 
    *   Between the Frontend and Backend.
    *   Between backend services, workers, AI services, or other separately deployed providers.
*   **Workflow:**
    1.  The Consumer (e.g., Frontend) writes a test defining the expected response.
    2.  Pact generates a "contract" JSON file.
    3.  The Provider (e.g., Backend) verifies its implementation against that contract in its own CI pipeline.

---

## 3. End-to-End (E2E) Testing

Use the project's existing E2E tool. If none is installed, **Playwright** is the default recommendation. These tests run against a staging-like environment.

*   **Priority:** Test the "Happy Path" for core business value (e.g., Signup, Creating an Evaluation, Uploading a Document).
*   **Stability:** Avoid testing minor UI details in E2E; focus on data flow and state transitions.
*   **Data Isolation:** Every test run should use a fresh tenant/user (see `Security.md` §18).

---

## 4. AI & RAG Testing

Specialized testing for our AI components:

*   **Evaluation Sets:** A golden set of 50+ inputs and "perfect" expected outputs.
*   **LLM-as-a-Judge:** Use a larger model (e.g., Claude 3.5 Sonnet) to grade the output of the production model (e.g., Haiku) on accuracy and tone.
*   **Regression Tests:** When a user reports a "bad" AI response, add that input to the golden set to prevent it from happening again.

---

## 5. Visual Regression

For the Frontend, we use **Storybook + Chromatic** (or Playwright Screenshots).
*   Any change to a component in the design system must be visually verified.
*   Tests for mobile vs. desktop viewport consistency.

---

## 6. Pre-Ship Checklist (Testing)

- [ ] Unit tests for all new business logic.
- [ ] Integration tests for new API endpoints (hitting a test DB).
- [ ] Contract tests updated if the API schema changed.
- [ ] Playwright "Smoke Test" passes in CI.
- [ ] 70% total code coverage (enforced in CI).

---

*End of document. Testing standards are audited quarterly.*
