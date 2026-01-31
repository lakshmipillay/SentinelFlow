# Workflow – SentinelFlow

This document defines the end-to-end, **deterministic workflow** implemented by SentinelFlow.
It combines a clear **Orchestrator control loop** with detailed, judge-readable explanations of roles, stages, and safety guarantees.

SentinelFlow treats workflows as **governed processes**, not conversational exchanges.

---

## 1. Workflow Philosophy

SentinelFlow models incident response as a **multi-stage operational process** with:

- Parallel specialist analysis
- Centralized orchestration
- Explicit governance gates
- Safe, reversible action proposals
- Mandatory verification and audit

No stage is skipped. No decision is implicit.

---

## 2. Orchestrator Control Loop

For each workflow instance, the **Orchestrator Agent** executes the following control loop:

1. Ingest
2. Analyze (parallel)
3. Synthesize
4. Govern
5. Propose (no execution)
6. Verify
7. Audit
8. Terminate

“Synthesize” refers to structured root cause analysis performed via @run-rca.

At any step, the Orchestrator may **halt the workflow** if safety, confidence, or policy constraints are not met.

This loop is deterministic and repeatable.

---

## 3. Roles and Responsibilities

### Orchestrator Agent
- Owns the workflow lifecycle
- Invokes specialist agents in parallel
- Enforces governance gates
- Terminates unsafe or incomplete workflows
- Produces audit artifacts

**Constraints**
- Performs no domain analysis
- Performs no remediation
- Cannot bypass governance decisions

---

### Specialist Analysis Agents

| Agent | Responsibility |
|------|---------------|
| `sre-agent` | Reliability, availability, and operational analysis |
| `security-agent` | Security, access, and risk analysis |
| `governance-agent` | Policy and compliance analysis (no approval here) |

**Rules**
- Analysis-only
- Deterministic outputs
- No cross-agent communication
- No workflow control

---

## 4. Incident Response Workflow (Detailed)

### 4.1 ingest-event
**Purpose**  
Normalize and validate incoming incident signals.

**Inputs**
- Incident description
- Simulated logs and metrics

**Output**
- Structured incident context (JSON)

**Command**
- `@ingest-event`

If required fields are missing, the workflow terminates.

---

### 4.2 parallel-analysis
The Orchestrator spawns specialist agents concurrently.

Each agent:
- Receives scoped context only
- Performs domain-specific analysis
- Returns structured JSON output

**Agents**
- `sre-agent`
- `security-agent`
- `governance-agent` (analysis-only)

**Command**
- `@analyze-incident`

No agent can see another agent’s output.

---

### 4.3 run-rca
**Purpose**  
Synthesize analysis outputs into a root cause assessment.

**Responsibilities**
- Correlate findings
- Identify likely root causes
- Assign confidence scores
- Highlight open questions

**Output**
- Root cause assessment (JSON)

**Command**
- `@run-rca`

If confidence falls below a defined threshold, the workflow halts.

---

### 4.4 policy-check (Governance Gate)
**Purpose**  
Apply governance and safety constraints before any action is proposed.
The governance-agent provides structured input to this step;
the Orchestrator enforces the decision.

**Evaluates**
- Policy compliance
- Blast radius
- Security impact
- Reversibility

**Decisions**
- APPROVED
- APPROVED_WITH_RESTRICTIONS
- BLOCKED

**Command**
- `@policy-check`

If BLOCKED, the workflow terminates and is fully audited.

---

### 4.5 propose-remediation
**Purpose**  
Generate a **reversible remediation proposal**.

**Rules**
- Executed only if governance approves
- No direct infrastructure mutation
- Actions are proposals only

**Output**
- YAML remediation plan

**Command**
- `@propose-remediation`

---

### 4.6 verify-recovery
**Purpose**  
Validate expected recovery outcomes.

**Evaluates**
- Logical consistency
- Expected signal improvement

**Outcomes**
- SUCCESS
- PARTIAL
- FAILED

**Command**
- `@verify-recovery`

FAILED terminates the workflow and records residual risk.

---

### 4.7 update-devlog
**Purpose**  
Persist audit and development artifacts.

**Records**
- Incident summary
- Decisions made
- Governance outcomes
- Challenges encountered
- Improvements to prompts or steering

**Command**
- `@update-devlog`

---

## 5. Safety Guarantees

SentinelFlow enforces the following guarantees:

- Governance gates cannot be skipped
- No agent executes changes
- Orchestrator may halt execution at any step
- All outputs are deterministic and auditable

The system explicitly favors **safety over liveness**.

---

## 6. MVP Constraints

This MVP:
- Uses simulated data sources
- Performs no live infrastructure changes
- Focuses on orchestration, governance, and auditability

These constraints are intentional and documented.

---

## 7. Workflow Innovation Summary

SentinelFlow’s workflow innovation lies in:

- Treating agentic AI as an **operational system**, not a chatbot
- Parallelizing analysis while centralizing control
- Making governance an explicit workflow stage
- Treating audit and documentation as mandatory outputs

The result is a workflow that is **predictable, explainable, and extensible** across future SDLC phases.
