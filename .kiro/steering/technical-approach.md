# Technical Approach – SentinelFlow

This document explains the key technical and architectural decisions
behind SentinelFlow and the trade-offs made during implementation.

---

## Agentic Design Rationale

SentinelFlow models real-world engineering organizations rather than
autonomous AI systems.

- Specialists analyze signals
- Governance evaluates risk and compliance
- Orchestration controls sequencing and authority
- Actions are gated and auditable

This mirrors established enterprise practices in SRE, security,
and compliance teams, where no single role has unilateral authority.

The alternative — autonomous, self-directing agents — was intentionally
rejected due to safety, explainability, and auditability concerns.

---

## Orchestrator-Centric Control

A dedicated Orchestrator Agent owns workflow control.

Its responsibilities include:
- Enforcing workflow order
- Managing parallel agent execution
- Routing decisions through governance gates
- Terminating workflows on veto or uncertainty

The Orchestrator performs no domain analysis and executes no actions.
This separation prevents hidden reasoning and reduces systemic risk.

---

## Deterministic, Prompt-Driven Workflows

All workflows are implemented using deterministic prompts with explicit
inputs and structured outputs.

- JSON is used for analysis, decisions, and verification
- YAML is used for ordered remediation proposals

Free-form conversational output is intentionally disallowed in workflows.

This design enables repeatability, machine-readable audit trails,
and fair evaluation during judging.

---

## Governance and Safety by Design

Governance is embedded directly into the workflow rather than added
as a post-processing step.

Key design decisions include:
- Mandatory governance gates before remediation
- Explicit veto authority
- Preference for blocking over speculative action
- Reversible, proposal-only remediation

These constraints reflect real-world operational safety requirements.

---

## Simulated Integrations

External systems (cloud providers, monitoring tools, CI/CD systems)
are simulated in this MVP.

This decision:
- Reduces setup and demo fragility
- Avoids credential and security risks
- Keeps focus on workflow and governance innovation

The architecture remains integration-ready without modification.

---

## Use of Kiro

Kiro is used as an agent orchestration layer due to its support for:
- Declarative agent configuration
- Reusable prompt workflows
- Global steering rules
- Clear separation between agents, prompts, and system constraints

All SentinelFlow behavior is defined in portable `.kiro` artifacts.
The use of Kiro IDE is a development convenience only and does not
change runtime behavior compared to CLI usage.

---

## Extensibility Across the SDLC

This technical approach is intentionally workflow-agnostic.

The same architecture supports:
- Incident response
- Testing gate validation
- Release approval
- Compliance checks

New SDLC workflows are added by defining new workflow slices,
without modifying the core agent model or governance rules.

---

## Summary

This approach prioritizes:
- Safety over autonomy
- Explicit control over implicit behavior
- Determinism over improvisation
- Auditability over speed

The goal is to demonstrate how agentic AI systems can be designed
responsibly for safety-critical software workflows.
