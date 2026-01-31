# Technical Architecture – SentinelFlow

## Overview

SentinelFlow is implemented as a governed agentic system using
Kiro’s agent orchestration model.

The system consists of:
- A single **Orchestrator Agent** that owns workflow control
- Multiple **Specialist Agents** that perform bounded analysis
- Deterministic, prompt-defined workflow steps
- Steering documents that encode global technical constraints

The architecture prioritizes safety, explainability, and auditability
over autonomy and speed.

---

## Execution Model

SentinelFlow executes workflows as deterministic control loops.

- The Orchestrator sequences workflow steps explicitly
- Specialist agents are invoked in parallel for analysis
- Governance gates are enforced before any action is proposed
- Workflows terminate explicitly on failure, uncertainty, or veto

At no point does the system engage in open-ended conversation or
self-directed behavior.

---

## Agent Model

Agents are configured declaratively using YAML.

- Each agent has a single responsibility
- Authority and constraints are explicitly declared
- No agent can analyze, approve, and act within the same workflow

Agent behavior is constrained by:
1. Agent YAML configuration
2. Prompt-level instructions
3. Global steering rules

This layered approach reduces risk and improves predictability.

---

## Prompt-Driven Determinism

All workflow steps are implemented as deterministic prompts.

- Inputs and outputs are explicitly defined
- Outputs are structured as JSON or YAML
- Free-form text is prohibited in inter-agent communication

This enables:
- Repeatable execution
- Machine-readable audit trails
- Clear evaluation by judges

---

## Data & Output Strategy

SentinelFlow uses structured outputs exclusively:

- **JSON** for analysis, decisions, and verification
- **YAML** for ordered remediation proposals

Markdown is used only for human-readable artifacts
(e.g. README, DEVLOG).

---

## Safety Constraints

The MVP enforces the following technical constraints:

- No direct infrastructure mutation
- No credential or secret handling
- No external side effects
- No autonomous remediation execution

All remediation actions are proposed only and documented.

---

## Extensibility

The architecture is designed to support additional SDLC workflows
without architectural changes.

Examples:
- Testing gate workflows
- Release approval workflows
- Compliance validation workflows

New workflows reuse:
- The same Orchestrator Agent
- The same governance model
- The same prompt structure

Only new workflow slices are added.

---

## Rationale

This technical approach mirrors real-world operational systems where:
- Analysis is parallelized
- Authority is centralized
- Governance is mandatory
- Auditability is non-negotiable

The goal is to demonstrate how agentic AI systems can be built
responsibly for safety-critical domains.
