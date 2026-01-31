# Requirements Document

## Introduction

SentinelFlow is a governance-first agentic workflow system designed for safety-critical incident response with human-in-the-loop controls. The system combines a governed orchestration backend (SentinelFlow) with a Mission Control UI (SRE Sidekick) to visualize agentic workflows and enforce mandatory human approval gates. This is a hackathon project prioritizing architecture clarity, workflow visualization, and governance over full production integrations.

The enhancement integrates the existing SentinelFlow backend with a new Mission Control UI (SRE Sidekick) to create a complete decision control plane for incident response workflows that demonstrates how agentic AI systems can be designed responsibly for safety-critical domains.

## Glossary

- **SentinelFlow**: The backend governed agentic workflow engine that orchestrates analysis, governance, and remediation proposals
- **SRE_Sidekick**: The Mission Control UI dashboard that visualizes workflows and enforces human approval gates
- **Orchestrator_Agent**: The central agent that controls workflow sequencing and enforces safety constraints
- **Specialist_Agent**: Domain-specific agents (SRE, Security, Governance) that perform bounded analysis
- **Governance_Gate**: Mandatory human approval checkpoint that blocks workflow progression until explicit decision
- **Mission_Control**: The 3-pane dashboard interface for real-time workflow visualization and human decision making
- **Workflow_State**: The current stage of incident processing (IDLE → INCIDENT_INGESTED → ANALYZING → etc.)
- **Agent_Skills**: Specific enterprise tools and capabilities that agents use for analysis (Datadog, Splunk, etc.)
- **Blast_Radius**: The scope of systems and services that could be affected by proposed remediation actions
- **Audit_Trail**: Immutable record of all workflow decisions, agent outputs, and human approvals

## Requirements

### Requirement 1: Deterministic Workflow State Management

**User Story:** As a system operator, I want deterministic workflow progression with predictable state transitions, so that incident response follows reliable stages with clear governance checkpoints.

#### Acceptance Criteria

1. THE System SHALL implement workflow states in strict order: IDLE → INCIDENT_INGESTED → ANALYZING → RCA_COMPLETE → GOVERNANCE_PENDING → ACTION_PROPOSED → VERIFIED → RESOLVED → TERMINATED
2. WHEN a state transition occurs, THE System SHALL validate the transition is allowed from the current state and reject invalid transitions
3. THE System SHALL persist workflow state to enable recovery after system restarts and maintain workflow integrity
4. WHEN workflow state changes, THE System SHALL notify all connected UI clients in real-time with structured state updates
5. THE System SHALL prevent state transitions that bypass mandatory governance checkpoints and maintain safety constraints

### Requirement 2: Agent Orchestration and Skills Enhancement

**User Story:** As an incident commander, I want to see which agents are working and what specific enterprise tools they're using, so that I can understand the analysis process and validate findings against real system capabilities.

#### Acceptance Criteria

1. THE Orchestrator_Agent SHALL coordinate specialist agents without performing domain-specific analysis, maintaining strict separation of concerns
2. WHEN analysis is required, THE System SHALL engage appropriate Specialist_Agents based on incident type and run them in parallel
3. THE SRE_Agent SHALL utilize and report usage of these skills: Datadog, CloudWatch, Prometheus, OpenTelemetry
4. THE Security_Agent SHALL utilize and report usage of these skills: Splunk SIEM, IAM Logs, CSPM
5. THE Governance_Agent SHALL utilize and report usage of these skills: Policy Engine, Change Management, Risk Register

### Requirement 3: Structured Agent Outputs and Deterministic Communication

**User Story:** As a governance reviewer, I want consistent, structured analysis from all agents with no conversational outputs, so that I can make informed approval decisions based on deterministic data.

#### Acceptance Criteria

1. WHEN an agent completes analysis, THE System SHALL produce structured output containing agent name, skills used, structured findings, and confidence level in JSON format
2. THE System SHALL validate all agent outputs against predefined schemas and reject any unstructured or conversational outputs
3. THE System SHALL use JSON for analysis, decisions, and verification results, and YAML for ordered remediation proposals only
4. WHEN multiple agents analyze the same incident, THE System SHALL correlate their findings into a coherent summary without free-form text
5. THE System SHALL maintain agent output history for audit purposes with immutable structured records

### Requirement 4: Mandatory Governance Gates and Human-in-the-Loop Controls

**User Story:** As a compliance officer, I want mandatory human approval for all remediation actions with explicit veto authority, so that no autonomous changes occur in production systems and governance is an architectural boundary.

#### Acceptance Criteria

1. WHEN remediation is proposed, THE System SHALL block workflow progression until explicit human approval and prevent any backend component from auto-executing fixes
2. THE Governance_Gate SHALL surface blast radius assessment, risk level, policy conflicts, and reversibility assessment to the approver
3. THE System SHALL support three approval decisions with rationale: Approve (Green), Approve with Restrictions (Yellow), Block (Red)
4. WHEN Block is selected, THE System SHALL terminate the workflow explicitly and record the blocking rationale as a mandatory audit artifact
5. THE System SHALL enforce that governance has veto authority and blocked workflows must terminate with complete audit trail

### Requirement 5: Mission Control Dashboard with Fixed 3-Pane Layout

**User Story:** As an incident responder, I want a real-time Mission Control dashboard with a fixed 3-pane layout showing agent activity and workflow progress, so that I can monitor incident response and intervene when needed.

#### Acceptance Criteria

1. THE System SHALL provide a fixed 3-pane Mission Control dashboard layout that maps directly to backend workflow stages
2. THE Left Panel SHALL display active alert information in JSON-style format and live streaming terminal logs with auto-scrolling
3. THE Center Panel SHALL show animated workflow progress, parallel agent cards with skills badges, and blast radius visualization
4. THE Right Panel SHALL provide agent summaries in plain-English and governance approval interface with mandatory human decision points
5. THE Dashboard SHALL update in real-time as workflow state changes with sub-second response times for user interactions

### Requirement 6: Agent Visualization and Skills Display with Real-time Animation

**User Story:** As a stakeholder, I want to see which agents are active, what tools they're using, and animated workflow progression, so that I understand the technical analysis being performed and can build confidence in recommendations.

#### Acceptance Criteria

1. WHEN agents are analyzing, THE System SHALL display agent cards showing current activity with skills badges that highlight when specific tools are being used
2. THE System SHALL use Framer Motion animations for smooth visual feedback including "AI thinking" indicators during agent processing
3. THE System SHALL provide visual indicators for agent confidence levels in their findings and animate transitions between workflow stages
4. WHEN agents complete analysis, THE System SHALL display structured findings in the UI and show visual connecting lines for agent correlations
5. WHEN multiple agents work in parallel, THE System SHALL show concurrent analysis activities simultaneously with animated step tracker

### Requirement 7: Blast Radius Visualization and Impact Assessment

**User Story:** As a decision maker, I want to see the potential impact of proposed actions through visual blast radius graphs, so that I can assess risk before approving changes and understand system component relationships.

#### Acceptance Criteria

1. THE System SHALL generate blast radius graphs showing affected system components with relationships (Database → API Gateway → Frontend)
2. WHEN displaying blast radius, THE System SHALL color-code component health status (Healthy, Warning, Critical) and show dependency chains
3. THE System SHALL update blast radius visualization based on proposed remediation actions and include assessment in governance approval requests
4. WHEN blast radius analysis is available, THE System SHALL visualize affected services and their dependency relationships in the Center Panel
5. THE System SHALL surface blast radius assessment and risk level to approvers as part of mandatory governance gate information

### Requirement 8: Human Approval Interface and Decision Capture

**User Story:** As an approver, I want a clear interface for reviewing and approving proposed actions with complete context, so that I can make informed decisions quickly and all decisions are properly recorded.

#### Acceptance Criteria

1. WHEN governance approval is required, THE System SHALL display a governance approval card showing recommended action, blast radius, risk level, and policy conflicts
2. THE Approval Interface SHALL provide three approval buttons with color coding: Approve (Green), Approve with Restrictions (Yellow), Block (Red)
3. WHEN making approval decisions, THE System SHALL require rationale input from the human approver and record decision maker, timestamp, and decision type
4. WHEN agents complete analysis, THE System SHALL display plain-English summary of findings including RCA summary, correlation explanation, and risk assessment
5. WHEN the workflow completes, THE System SHALL provide final decision summary, audit confirmation, and resolution status display

### Requirement 9: Demo and Simulation Capabilities with Realistic Scenarios

**User Story:** As a hackathon demonstrator, I want to simulate realistic incidents with controlled scenarios, so that I can showcase the system's governance capabilities without requiring live infrastructure integrations.

#### Acceptance Criteria

1. THE System SHALL provide a hidden "Simulate Incident" button for demo purposes that generates realistic incident scenarios with mocked data
2. WHEN demo mode is activated, THE System SHALL simulate agent processing delays and realistic response times while maintaining all safety constraints
3. THE System SHALL use mocked data only without requiring external system integrations and allow demonstration reset to return to initial state
4. WHEN simulating agent analysis, THE System SHALL use realistic timing delays and progressive disclosure of findings with proper skills attribution
5. WHEN demonstrating governance gates, THE System SHALL show realistic policy conflicts and blast radius assessments that demonstrate mandatory human approval

### Requirement 10: Audit Artifacts and Compliance with Process-Level Auditing

**User Story:** As a compliance auditor, I want complete, immutable audit artifacts as first-class outputs with structured records, so that I can verify proper governance processes were followed and maintain compliance trails.

#### Acceptance Criteria

1. THE System SHALL generate mandatory audit artifacts for all workflow decisions and state changes as first-class outputs, not optional logging
2. WHEN agents perform analysis, THE System SHALL record all skills used, data sources accessed, and confidence levels in structured audit artifacts
3. WHEN governance gates are processed, THE System SHALL record complete decision context including blast radius, risk assessment, policy evaluation, and human rationale
4. WHEN workflows are terminated, THE System SHALL capture termination reason, any residual risks, and complete timeline of workflow events with timestamps
5. THE System SHALL maintain DEVLOG.md as the canonical audit trail with structured, machine-readable audit trails suitable for compliance review

### Requirement 11: Safety and Security Constraints with No External Side Effects

**User Story:** As a security architect, I want the enhanced system to maintain all existing safety constraints with no external side effects, so that the system remains suitable for safety-critical environments and demonstrates responsible AI design.

#### Acceptance Criteria

1. WHEN any component processes workflows, THE System SHALL maintain the constraint of no direct infrastructure mutation and no external side effects
2. WHEN prompts execute, THE System SHALL ensure no prompt may perform external actions, mutate infrastructure, or rely on credentials or external state
3. WHEN API communications occur, THE System SHALL use secure protocols, validate all inputs, and implement appropriate access controls
4. WHEN demo mode is active, THE System SHALL clearly indicate simulation status and prevent any real system interactions while maintaining safety constraints
5. THE System SHALL ensure all remediation actions are proposals only and enforce that no backend component may auto-execute fixes without human approval

### Requirement 12: Technical Implementation Standards for Hackathon Demo

**User Story:** As a developer, I want clear technical standards using modern frameworks with mocked data, so that the system is maintainable, follows modern development practices, and is optimized for hackathon demonstration.

#### Acceptance Criteria

1. THE Frontend SHALL be implemented using Next.js 14 with App Router and prioritize mocked data over external API integrations for hackathon demo purposes
2. THE System SHALL use Tailwind CSS and Shadcn/UI for consistent styling with dark mode design using specified color tokens
3. THE System SHALL use React Hooks and Context for state management and implement efficient streaming and pagination for UI responsiveness
4. WHEN multiple workflows are active, THE System SHALL maintain independent processing without cross-workflow interference and provide sub-second response times
5. THE System SHALL implement graceful degradation of non-critical features while maintaining core governance functionality and efficient storage for historical data

### Requirement 13: Backend API Integration and Real-time Communication

**User Story:** As a frontend developer, I want well-defined API boundaries with real-time updates, so that the dashboard can reliably consume workflow state and agent outputs with immediate feedback.

#### Acceptance Criteria

1. WHEN the backend processes workflows, THE SentinelFlow_Backend SHALL expose structured API endpoints for workflow state, agent outputs, and governance decisions
2. WHEN workflow state changes, THE SentinelFlow_Backend SHALL provide real-time updates to UI clients through WebSocket or Server-Sent Events
3. WHEN the UI submits governance decisions, THE SentinelFlow_Backend SHALL validate decision format and update workflow state with proper error handling
4. WHEN API errors occur, THE SentinelFlow_Backend SHALL return structured error responses with appropriate HTTP status codes and maintain system stability
5. WHEN the UI requests historical data, THE SentinelFlow_Backend SHALL provide efficient access to audit trails and previous workflow executions

### Requirement 14: Incoming Signal Display and Log Streaming

**User Story:** As an incident responder, I want to see raw incoming alerts and live system logs, so that I can understand the original problem context and validate agent analysis against real system signals.

#### Acceptance Criteria

1. WHEN an incident is ingested, THE SRE_Sidekick SHALL display the active alert in JSON-style format with service, severity, metric, and timestamp information
2. WHEN system logs are available, THE SRE_Sidekick SHALL stream live terminal logs with auto-scrolling, syntax highlighting, and monospace formatting
3. WHEN errors occur in logs, THE SRE_Sidekick SHALL highlight error lines with red coloring, timestamps, and appropriate visual emphasis
4. WHEN agents are actively investigating, THE SRE_Sidekick SHALL increase log scrolling speed to visually indicate intensive analysis activity
5. WHEN the incident is resolved, THE SRE_Sidekick SHALL slow down log activity, stop showing new errors, and indicate resolution state