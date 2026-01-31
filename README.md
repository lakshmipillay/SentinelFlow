# SentinelFlow

SentinelFlow is a **governed, deterministic agentic workflow system** built using Kiro.
It demonstrates how AI agents can be orchestrated safely for **incident response and SDLC decision-making** by prioritizing governance, auditability, and clear separation of responsibilities.

Unlike conversational AI tools, SentinelFlow treats AI as an **operational system**, not a chatbot.

---

## Problem Statement

Modern teams increasingly rely on AI assistance in safety‑critical workflows (incident response, release approvals, compliance checks).
Most agentic systems optimize for autonomy and speed, but lack:

- Clear governance and veto points
- Deterministic, auditable behavior
- Explicit separation between analysis, approval, and action

SentinelFlow addresses this gap by modeling decision‑making as a **governed workflow**, not a single AI response.

---

## What SentinelFlow Does

SentinelFlow implements a **governed incident response workflow** that:

1. **Ingests** an operational incident with structured alert data
2. **Runs parallel specialist analysis** (SRE, Security, Governance agents)
3. **Synthesizes** a root cause assessment with confidence scoring
4. **Applies a governance approval gate** with mandatory human decision
5. **Proposes reversible remediation** (no execution)
6. **Verifies** expected recovery outcomes
7. **Produces mandatory audit artifacts** for compliance

All steps are deterministic, auditable, and visualized in real-time.

---

## Key Design Principles

- **Workflow over conversation** — Deterministic processes, not chat
- **Governance before action** — No remediation without approval
- **Separation of responsibilities** — Analysis, approval, and action are isolated
- **Deterministic outputs** — JSON for analysis, YAML for proposals
- **Safety over liveness** — Prefer blocking over speculative action
- **Audit as first-class output** — Every decision is logged and traceable

---

## Architecture Overview

SentinelFlow follows an **Orchestrator / Specialist** pattern with a unified frontend-backend architecture.

### Backend (Control Plane)
- **Orchestrator Agent** — Controls workflow sequencing and enforces governance gates
- **Specialist Agents** — SRE, Security, and Governance agents perform parallel analysis
- **Agent Configuration Service** — Loads agent YAML configs at runtime for dynamic behavior
- **WebSocket Server** — Real-time state synchronization with the frontend
- **REST API** — Governance decision submission and workflow management

### Frontend (Mission Control UI)
- **3-Pane Dashboard** — Incoming Signal, Agent Brain, Human Handoff
- **Real-time Visualization** — Workflow progress, agent activity, blast radius
- **Governance Gate UI** — Mandatory human approval with decision capture

---

## Project Structure

```
SentinelFlow/
├── .kiro/
│   ├── agents/           # Agent YAML configurations (loaded at runtime)
│   ├── prompts/          # Deterministic workflow prompts
│   ├── specs/            # Feature specifications
│   └── steering/         # Global system constraints
├── frontend/             # Next.js Mission Control dashboard
│   ├── src/
│   │   ├── app/          # Main page and layout
│   │   ├── components/   # UI components (AgentCard, BlastRadius, etc.)
│   │   ├── context/      # WorkflowContext for state management
│   │   ├── hooks/        # WebSocket and custom hooks
│   │   └── services/     # API client
│   └── package.json
├── src/                  # Backend TypeScript source
│   ├── api/              # REST API routes and middleware
│   ├── communication/    # WebSocket server
│   ├── core/             # WorkflowStateManager
│   ├── demo/             # Demo mode simulation
│   └── services/         # Orchestrator, Governance, Audit services
├── shared/               # Shared types between frontend and backend
│   └── types/            # Workflow, Agent type definitions
├── DEVLOG.md             # Development audit trail
└── README.md
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install
```

### Running the Application

```bash
# Terminal 1: Start backend (port 3001)
npm run dev

# Terminal 2: Start frontend (port 3000)
cd frontend && npm run dev
```

### Access the Dashboard
Open http://localhost:3000 in your browser.

### Running a Demo

1. Click the **scenario dropdown** in the header to select an incident type
2. Click **Simulate** to start the workflow
3. Watch agents analyze in parallel with real-time updates
4. Review the **Blast Radius** visualization showing affected services
5. Make a **governance decision** (Approve, Restrict, or Block)
6. View the **completion summary** and audit trail

---

## Demo Scenarios

| Scenario | Description | Risk Level |
|----------|-------------|------------|
| Database Connection Pool Exhaustion | Primary database connection pool exhausted | High |
| API Gateway Rate Limiting Cascade | Rate limiting causing downstream failures | High |
| Unauthorized Access Attempt | Suspicious authentication patterns | Critical |
| Container Orchestration Resource Exhaustion | Kubernetes pod scheduling failures | Medium |
| Failed Deployment Rollback Required | Recent deployment causing errors | Low |

---

## Workflow States

```
IDLE
→ INCIDENT_INGESTED
→ ANALYZING (parallel agents)
→ RCA_COMPLETE
→ GOVERNANCE_PENDING (human decision required)
→ ACTION_PROPOSED
→ VERIFIED
→ RESOLVED / TERMINATED
```

---

## Agent Skills (Grounded in Real Tools)

Each agent's analysis is grounded in enterprise observability and security tools:

| Agent | Skills |
|-------|--------|
| **SRE Agent** | Datadog, CloudWatch, Prometheus, OpenTelemetry |
| **Security Agent** | Splunk SIEM, IAM Logs, CSPM |
| **Governance Agent** | Policy Engine, Change Management, Risk Register |

This ensures SentinelFlow acts as a **control plane over tools**, not a replacement for them.

---

## UI Layout (Mission Control)

### Left Panel — Incoming Signal (25%)
- Active alert in JSON format
- Live streaming terminal logs
- Raw signals and metrics

### Center Panel — Agent Brain & Workflow (50%)
- Animated workflow progress tracker
- Parallel agent cards with skills and findings
- Confidence level indicators
- Blast radius visualization with service dependencies

### Right Panel — Human Handoff & Governance (25%)
- Plain-English agent summary
- Governance approval card with risk assessment
- Policy conflicts display
- Decision buttons: Approve, Restrict, Block
- Audit trail preview

---

## Governance Gate

The governance gate is an **architectural boundary**, not a feature:

- **Mandatory** — No remediation proceeds without approval
- **Veto Authority** — Governance can block any action
- **Reversibility Check** — All proposed actions must be reversible
- **Blast Radius Assessment** — Shows affected services and impact levels
- **Audit Capture** — Every decision is logged with rationale and approver

---

## Testing

```bash
# Run backend tests
npm test

# Run frontend tests
cd frontend && npm test

# Run specific test file
npm test -- src/services/__tests__/OrchestratorService.test.ts
```

The project includes:
- Unit tests for all services
- Property-based tests for critical invariants
- Integration tests for API endpoints

---

## MVP Constraints

- **Simulated data only** — No live infrastructure connections
- **No infrastructure mutation** — All actions are proposals only
- **No credentials** — No secrets or external authentication
- **No side effects** — Safe for demonstration and evaluation

---

## Architectural Differentiation

Unlike autonomous AI SRE platforms, SentinelFlow:

| Feature | SentinelFlow | Autonomous AI |
|---------|--------------|---------------|
| Auto-executes fixes | ❌ Never | ✅ Yes |
| Human approval | ✅ Mandatory | ❌ Optional |
| Governance boundary | ✅ Architectural | ❌ Feature flag |
| Agent skills visible | ✅ Always | ❌ Hidden |
| Audit artifacts | ✅ First-class | ❌ Afterthought |

This makes SentinelFlow suitable for **regulated and safety-critical environments**.

---

## Hackathon Context

This project was built for the **Dynamous Kiro Hackathon** to demonstrate:

1. **Governed agentic workflows** — AI as operational system, not chatbot
2. **Kiro IDE integration** — Agents, prompts, and steering files
3. **Human-in-the-loop design** — Mandatory governance gates
4. **Real-time visualization** — WebSocket-powered dashboard
5. **Audit-first architecture** — Every decision is traceable

---

## Summary

SentinelFlow demonstrates how agentic AI can be **safe, auditable, and production-oriented**.

**Governance is not optional. It is the system.**
