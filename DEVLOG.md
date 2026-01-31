# Development Log – SentinelFlow

**Project**: SentinelFlow – Governed Agentic Workflow System with SRE Sidekick UI  
**Duration**: 6 focused working days (weekends + weekdays) - Jan 24-30, 2026
**Total Time**: ~22 hours  
**Development Mode**: Kiro IDE (not CLI)

---

## Overview

SentinelFlow is a governance-first agentic workflow system designed for safety‑critical incident response and SDLC decision-making. The project demonstrates how AI agents can assist engineering teams through **structured analysis and recommendations** while preserving **human authority, policy compliance, and auditability**.

Development was intentionally time‑boxed and iterative, with emphasis on:

- Clear architectural boundaries
- Deterministic, judge‑readable workflows
- Explicit governance and human‑in‑the‑loop controls
- Visual workflow communication (SRE Sidekick UI)

Rather than maximizing feature count, the goal was to **maximize correctness, safety, and explainability**, aligning closely with the hackathon judging rubric.

---

## Day 1 (Saturday) – Problem Framing & Core Architecture [4.5h]

### Work Completed
- Defined the core problem: unsafe autonomy in AI-driven incident response
- Positioned SentinelFlow as a **governed workflow system**, not an AI responder
- Designed the Orchestrator / Specialist agent model
- Established governance as a first-class architectural boundary

### Key Decisions
- Centralized workflow control in a single Orchestrator Agent
- Explicit separation of analysis, governance, and action
- Rejected conversational or autonomous agent patterns in favor of deterministic workflows

### Kiro IDE Usage
- Used steering documents to encode architecture and global rules
- Iteratively refined agent responsibilities directly in the IDE

---

## Day 2 (Sunday) – Governance Model & Workflow Design [5h]

### Work Completed
- Designed governance model with veto authority and mandatory approval gates
- Defined governance outcomes: APPROVED / APPROVED_WITH_RESTRICTIONS / BLOCKED
- Modeled full incident response workflow from ingest to audit
- Treated DEVLOG updates as mandatory workflow outputs

### Challenges
- Preventing overlap between governance analysis and approval
- Avoiding implicit autonomy hidden in agent behavior

### Solutions
- Split governance into:
  - Governance analysis (parallel, read‑only)
  - Explicit governance gate (human decision)

### Kiro IDE Usage
- Iterated on `governance.md`, `rules.md`, and `workflow.md`
- Used IDE-based prompt refinement to enforce role boundaries

---

## Day 3 (Weekday) – Agent Definitions & Skills [2.5h]

### Work Completed
- Implemented Orchestrator, SRE, Security, and Governance agents
- Normalized agent YAMLs for clarity and intent
- Introduced **agent skills** as first-class concepts

### Skills Mapped
- **SRE**: Datadog, CloudWatch, Prometheus, OpenTelemetry  
- **Security**: SIEM (Splunk), IAM logs, CSPM  
- **Governance**: Policy engines, change management, risk registers  

### Rationale
Explicit skills make agent outputs explainable and grounded in real enterprise systems, strengthening trust and auditability.

---

## Day 4 (Weekday) – Prompt Engineering & Determinism [2.5h]

### Work Completed
- Implemented all workflow prompts:
  - ingest-event
  - analyze-incident
  - run-rca
  - policy-check
  - propose-remediation
  - verify-recovery
  - update-devlog
- Enforced structured outputs (JSON/YAML) across all prompts

### Key Decisions
- No free‑form text in workflow outputs
- Explicit confidence and uncertainty handling
- Prefer blocking over unsafe approval

### Kiro IDE Usage
- Iteratively refined prompts to remove ambiguity
- Ensured each prompt was single‑purpose and deterministic

---

## Day 5 (Weekday) – UI Concept: SRE Sidekick [3h]

### Work Completed
- Designed **SRE Sidekick**, a Mission Control UI for SentinelFlow
- Defined a 3‑pane “War Room” layout:
  - Incoming signals
  - Agent brain + workflow visualization
  - Human handoff + governance gate
- Added agent lanes, skills badges, and blast radius visualization

### Key Decisions
- UI must **enforce governance**, not bypass it
- Human‑in‑the‑loop must be visually explicit
- Workflow state should drive animations and transitions

---

## Day 6 (Weekday) – Documentation, Validation & Review [4.5h]

### Work Completed
- Finalized README (backend + UI architecture)
- Refined architecture, governance, and technical approach docs
- Aligned project structure with official hackathon template
- Validated end‑to‑end workflow consistency
- Prepared demo narrative and positioning

### Focus
- Judge readability
- Architectural consistency
- Clear differentiation from autonomous AI SRE tools

---

## Kiro IDE Usage Statistics (Mirroring Top‑Scoring Examples)

Although development was done using the **Kiro IDE rather than CLI**, the same core concepts applied.

- **Steering Documents Created/Refined**: 7  
- **Custom Workflow Prompts**: 7  
- **Agent Configurations (YAML)**: 4  
- **Prompt Iterations**: ~40 IDE refinements  
- **Architecture / Governance Revisions**: ~15 edits  
- **Estimated Time Saved via Kiro IDE**: ~8–10 hours  

Kiro’s steering and prompt model significantly reduced rework by enforcing consistency, determinism, and clear role boundaries early in the process.

---

## Technical Decisions & Rationale

- **Governance as Architecture**: Prevents unsafe autonomy
- **Orchestrator Pattern**: Predictable, testable control flow
- **No Execution**: Suitable for regulated and safety‑critical environments
- **Agent Skills**: Improves trust, explainability, and extensibility


### Architecture Choices

- **Governed Workflow over Autonomous Agents**: Chose deterministic, step-based workflows instead of autonomous agents to ensure predictability, safety, and auditability in safety-critical scenarios.

- **Orchestrator / Specialist Pattern**: Centralized workflow control in a single Orchestrator Agent while delegating analysis to specialist agents (SRE, Security, Governance). This mirrors real-world operational hierarchies and prevents hidden cross-agent reasoning.

- **No Direct Execution (Proposal-Only Model)**: Deliberately excluded automated remediation execution. All actions are proposed, gated by governance, and require explicit human approval—making the system suitable for regulated environments.

- **Simulation-First MVP**: Chose simulated signals and integrations to avoid brittle demos, reduce setup complexity, and keep focus on workflow design and governance rather than tooling integration.


### Agent & Skill Design

- **Explicit Agent Roles**: Each agent has a single, well-defined responsibility and cannot analyze, approve, and act in the same step.

- **Separation of Roles and Skills**: Agent logic is decoupled from data sources. Skills such as Datadog, CloudWatch, SIEMs, or policy engines can evolve independently without changing the core architecture.

- **Deterministic Outputs**: Enforced structured JSON/YAML outputs across all agents to eliminate ambiguity and enable replayability and audit.

### Kiro IDE Usage Highlights

- **Steering Documents as System Contracts**: Used Kiro steering documents to encode global rules, architecture, governance boundaries, and coding standards rather than relying on implicit conventions.

- **Custom Workflow Prompts**: Designed single-purpose prompts for each workflow stage (ingest, analyze, RCA, governance, remediation, verification, audit) to ensure deterministic execution.

- **IDE-Driven Iteration**: Iteratively refined prompts, agent YAMLs, and documentation using the Kiro IDE to validate consistency between architecture, workflow, and outputs.

** Process Transparency**: Used prompts to update and validate DEVLOG.md, ensuring that development decisions and iterations were explicitly recorded.

### Challenges & Solutions

- **Avoiding Over-Autonomy**: 
  Challenge: Preventing agents from implicitly proposing or executing actions.
  Solution: Hard constraints in agent YAMLs and prompt design enforcing analysis-only and proposal-only roles.

- **Consistency Across Artifacts**:
  Challenge: Keeping architecture, workflow, prompts, and documentation aligned.
  Solution: Treated documentation as first-class artifacts and validated them together using the Orchestrator-driven review process.

- **Balancing Clarity vs Verbosity**
  Challenge: Making the system judge-readable without overwhelming detail.
  Solution: Structured documentation with explicit sections, schemas, and diagrams while keeping workflows deterministic and bounded.

### Impact

- **Predictable Behavior**: Same inputs always produce the same outputs.
- **Audit-Ready**: Every decision is traceable and explainable.
- **Extensible by Design**: New SDLC workflows (testing, release approval, compliance) can be added without architectural changes.
- **Trust-Oriented AI**: Demonstrates how AI can assist engineers responsibly rather than replacing human judgment.

---

## Time Breakdown by Category

| Category | Hours | Percentage |
|--------|-------|------------|
| Architecture & Design | 8h | 36% |
| Prompt Engineering | 6h | 27% |
| UI Concept & Visualization | 3h | 14% |
| Documentation & Review | 5h | 23% |
| **Total** | **22h** | **100%** |

---

## What I Would Build Next

Given more time, the next steps would be:

1. **Demo Video & UI Prototype**
   - Animated walkthrough of an incident lifecycle
   - Governance gate interaction recording

2. **Workflow Extensions**
   - Testing gate workflows
   - Release approval workflows
   - Compliance validation workflows

3. **Pluggable Integrations**
   - Read‑only integrations with observability and security tools
   - Policy-as-code integration for governance rules

---

## Final Reflections

SentinelFlow was developed with intentional constraints to demonstrate that **responsible agentic AI design prioritizes governance, clarity, and human authority over automation**.

Using the Kiro IDE to encode workflows, rules, and prompts enabled rapid iteration while maintaining architectural discipline. The result is a demo‑ready system that clearly communicates how agentic AI can safely assist in safety‑critical SDLC workflows.
