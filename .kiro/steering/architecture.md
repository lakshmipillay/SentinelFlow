# Architecture – SentinelFlow

## Agent-Centric Architecture

**Core Principle**: Organize by *workflow responsibility*, not by technical layers.  
Each agent and prompt has a clearly bounded role, enabling safety, testability, and explainability.

SentinelFlow is designed as a governed agentic system where **orchestration, analysis, and approval are explicitly separated**.

---

## Core Architectural Principles

These principles define non-negotiable constraints that apply across all workflows
and SDLC phases.

### Orchestration Over Autonomy
- A dedicated Orchestrator Agent controls flow.
- Individual agents do not self-direct.

### Parallel Analysis, Central Authority
- Specialist agents analyze in parallel.
- Decisions are centralized and explicit.

### Governance Before Action
- No remediation proceeds without approval.
- Governance has veto authority.

### Separation of Concerns
- Analysis, approval, and action are isolated roles.
- This reduces risk and improves explainability.

### Workflow Over Conversation
- SentinelFlow models processes, not chats.
- Deterministic workflows replace open-ended dialogue.

### Audit as a First-Class Output
- Audit artifacts are mandatory, not optional.

These principles apply across all SDLC phases.

---

## High-Level Structure

```
.kiro/
├── agents/                    # Explicit agent roles
│   ├── orchestrator-agent.yaml
│   ├── sre-agent.yaml
│   ├── security-agent.yaml
│   └── governance-agent.yaml
│
├── prompts/                   # Deterministic workflow steps
│   ├── ingest-event.md
│   ├── analyze-incident.md
│   ├── run-rca.md
│   ├── policy-check.md
│   ├── propose-remediation.md
│   ├── verify-recovery.md
│   └── update-devlog.md
│
└── steering/                  # Global system constraints
    ├── rules.md
    ├── architecture.md
    ├── governance.md
    └── technical-approach.md
```

**Rule**: If removing an agent or prompt changes system safety guarantees,
it is a first-class architectural component.

---

## Orchestrator / Specialist Pattern

SentinelFlow follows a strict **Orchestrator / Specialist** separation,
analogous to the `handler.rs` / `operations.rs` pattern in traditional systems.

### Orchestrator Agent (Workflow Control)

**Responsibilities**
- Owns workflow sequencing
- Spawns specialist agents in parallel
- Enforces governance gates
- Terminates unsafe or incomplete workflows
- Produces audit artifacts

**Constraints**
- Performs no analysis
- Performs no remediation
- Holds no domain expertise

The Orchestrator is intentionally limited to prevent hidden reasoning or unsafe autonomy.

---

### Specialist Agents (Pure Analysis)

Each specialist agent is responsible for **one domain only**.

| Agent | Responsibility |
|-----|---------------|
| `sre-agent` | Reliability and operational analysis |
| `security-agent` | Security and risk analysis |
| `governance-agent` | Policy evaluation and approval |

**Rules**
- Analysis-only
- Deterministic outputs
- No cross-agent coordination
- No workflow control

This makes each agent:
- Independently testable
- Easily replaceable
- Safe to run in parallel

---

## Workflow Slice Architecture

Each SentinelFlow workflow is modeled as a **vertical slice**, with clear phase boundaries.

### Example: Incident Response Workflow

```
Incident Response
├── ingest-event
├── parallel-analysis
│   ├── sre-agent
│   ├── security-agent
│   └── governance-agent (analysis-only)
├── run-rca
├── policy-check
├── propose-remediation
├── verify-recovery
└── update-devlog
```

**Rule**:  
A workflow step becomes a reusable prompt only when it is used by multiple workflows.

This avoids premature abstraction and keeps workflows understandable.

---

## Deterministic Output Strategy

All inter-agent communication uses **strict schemas**.

### Output Formats
- **JSON**: analysis, decisions, validation
- **YAML**: ordered plans and remediation proposals

**No free-form text is allowed in workflow outputs.**

This ensures:
- Predictable execution
- Easy evaluation by judges
- Machine-readable audit trails

---

## Audit & Logging Model

SentinelFlow replaces traditional logging with **process-level auditing**.

### Mandatory Audit Artifacts
- Structured prompt outputs
- Governance decisions with rationale
- DEVLOG entries per workflow execution

The `DEVLOG.md` acts as the system’s canonical audit trail.

---

## Governance as Architecture

Governance is not a feature — it is an architectural boundary.

**Enforced guarantees**
- No remediation without approval
- Governance has veto authority
- All actions must be reversible
- Blocked workflows must terminate explicitly

This design intentionally favors **safety over liveness**.

---

## Testing & Validation Strategy

### Agent-Level Validation
- Specialists are validated independently using fixed inputs
- Deterministic schemas enable snapshot testing

### Workflow-Level Validation
- Orchestrator control flow is validated step-by-step
- Governance decisions are replayable

---

## Extensibility Across SDLC Phases

SentinelFlow is designed to extend beyond incident response without architectural changes.

### Example Extensions
- Testing Gate workflow
- Release Approval workflow
- Compliance Validation workflow

These reuse:
- The same Orchestrator Agent
- The same governance model
- The same deterministic prompt pattern

Only new workflow slices are added.

---

## Architectural Guarantees

SentinelFlow guarantees:
- Explicit control over agent behavior
- Clear separation of responsibilities
- Deterministic, auditable workflows
- Safe extensibility across the SDLC

These guarantees are enforced by design, not convention.
