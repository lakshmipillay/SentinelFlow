# SentinelFlow – Governance & Safety Model

This document defines the governance, safety, and control principles enforced by SentinelFlow during all agentic workflows.

Governance is treated as a first-class system concern, not a post-processing step.

---

## 1. Governance Objectives

SentinelFlow enforces governance to ensure that:
- AI agents do not act beyond their authority
- Risky or non-compliant actions are blocked
- All decisions are explainable and auditable
- Proposed actions are safe and reversible

The system prioritizes correctness and safety over speed.

---

## 2. Separation of Responsibilities

SentinelFlow enforces strict role separation across agents and workflow phases.

### Specialist Analysis Agents (e.g. SRE, Security)
- Observe and analyze signals only
- Cannot approve, propose, or execute actions
- Produce deterministic, auditable outputs

### Orchestrator Agent
- Sequences workflow steps
- Coordinates parallel analysis
- Enforces governance gates
- Terminates unsafe or incomplete workflows

**Constraints**
- Performs no domain analysis
- Does not approve actions
- Cannot bypass governance decisions

### Governance Agent
- Evaluates policy, compliance, and blast radius
- Assesses risk and reversibility
- Has explicit veto authority over remediation proposals

### Remediation Phase
- Generates proposed corrective actions only
- Executes no changes
- Proceeds only after governance approval

No single agent or phase can analyze, approve, and act independently.

---

## 3. Governance Gate

Before any remediation is proposed, the governance gate is applied.

The governance gate evaluates:
- Policy compliance
- Potential blast radius
- Security impact
- Reversibility of the proposed action

Possible outcomes:
- **APPROVED**
- **APPROVED_WITH_RESTRICTIONS**
- **BLOCKED**

If blocked, the workflow terminates immediately and is fully audited.

---

## 4. Policy Principles

SentinelFlow follows these core policy principles:

- **Least Authority**  
  Agents operate with the minimum scope required.

- **No Silent Actions**  
  All decisions, outcomes, and terminations must be logged.

- **Explicit Assumptions**  
  Any missing data, uncertainty, or inference must be declared.

- **Reversibility**  
  All proposed actions must be reversible by design.

- **Fail Safe**  
  In ambiguous situations, the system prefers no action.

---

## 5. Safety Constraints (MVP Scope)

The following constraints are enforced in this MVP:

- No direct infrastructure mutation
- No credential usage
- No external side effects
- No speculative remediation

All remediation actions are **proposed, simulated, and documented only**.

---

## 6. Auditability

Every workflow execution produces the following audit artifacts:
- Incident summary
- Root cause analysis
- Governance decision record
- Remediation proposal
- Verification outcome

Audit artifacts are written to structured outputs and DEVLOG.md,
which serves as the canonical audit trail.

---

## 7. Rationale

This governance model mirrors real-world operational practices used in enterprise SRE, security, and compliance teams.

The goal is to demonstrate how agentic AI systems can be:
- Useful
- Safe
- Predictable
- Trustworthy

Governance is not optional. It is the system.
