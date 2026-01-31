# Coding & Prompt Standards – SentinelFlow

These standards apply to all agents, prompts, and workflows
in SentinelFlow.

They are intended to enforce clarity, safety, determinism,
and auditability across the system.

---

## Core Principles

- Deterministic outputs only
- Structured, machine-readable formats
- No external side effects
- Clear, explicit naming
- Predictability over cleverness

These principles override default model behavior.

---

## Prompt Design Standards

- Each prompt must be single-purpose.
- Each prompt must explicitly define:
  - Purpose
  - Inputs
  - Steps
  - Outputs
  - Constraints
- Prompts must not rely on implicit context or hidden state.
- Prompts must not assume success or infer missing data.

---

## Output Formats

- Use **JSON** for:
  - Analysis
  - Decisions
  - Verification results
- Use **YAML** for:
  - Plans
  - Ordered remediation proposals
- Mixed or ambiguous formats are not allowed.
- Free-form or conversational output is prohibited in workflows.

---

## Naming Conventions

- Use clear, descriptive names for agents, prompts, and outputs.
- Avoid abbreviations unless they are industry-standard.
- Names should reflect responsibility, not implementation detail.

---

## Complexity & Readability

- Prefer simple, explicit workflows over clever logic.
- Explicit steps are preferred over implicit reasoning.
- Safety and explainability take precedence over brevity.

---

## Side Effects & Execution

- No prompt may perform external actions.
- No prompt may mutate infrastructure or systems.
- No prompt may rely on credentials, secrets, or external state.
- All remediation actions are proposals only.

---

## Rationale

These standards exist to ensure that SentinelFlow remains:
- Predictable
- Explainable
- Auditable
- Safe for safety-critical workflows

They are enforced through steering documents, prompt design,
and agent configuration.
