# Design Document

## Overview

This design document specifies the unified SentinelFlow + SRE Sidekick architecture that enhances the existing governed agentic workflow system with a Mission Control UI. The system maintains SentinelFlow's core architectural principles of governance-first design, explicit role separation, and deterministic workflows while adding comprehensive visualization and human-in-the-loop controls.

The unified architecture consists of two primary components:
- **SentinelFlow Backend**: Enhanced governed orchestration engine with workflow state management and structured agent outputs
- **SRE Sidekick Frontend**: Mission Control dashboard with 3-pane war room layout for real-time workflow visualization and governance enforcement

This design prioritizes safety over autonomy, governance before action, and audit artifacts as first-class outputs, making it suitable for safety-critical incident response environments.

## Architecture

### System Architecture Overview

The unified architecture follows SentinelFlow's established Orchestrator/Specialist pattern with enhanced state management and UI integration:

```
┌─────────────────────────────────────────────────────────────┐
│                    SRE Sidekick (Frontend)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Left Panel  │  │Center Panel │  │    Right Panel      │  │
│  │ Incoming    │  │ Agent Brain │  │ Human Handoff &     │  │
│  │ Signal      │  │ & Workflow  │  │ Governance Gate     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   API Gateway     │
                    │ (WebSocket/REST)  │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────┴─────────────────────────────────┐
│                SentinelFlow Backend                           │
│  ┌─────────────────┐    ┌─────────────────────────────────┐   │
│  │ Orchestrator    │    │     Specialist Agents          │   │
│  │ Agent           │◄──►│  ┌─────────┐ ┌─────────────┐   │   │
│  │                 │    │  │   SRE   │ │  Security   │   │   │
│  │ - State Mgmt    │    │  │ Agent   │ │   Agent     │   │   │
│  │ - Workflow      │    │  └─────────┘ └─────────────┘   │   │
│  │   Control       │    │  ┌─────────────────────────┐   │   │
│  │ - Governance    │    │  │    Governance Agent     │   │   │
│  │   Gates         │    │  │   (Analysis Only)       │   │   │
│  │ - Audit Trail   │    │  └─────────────────────────┘   │   │
│  └─────────────────┘    └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Enhanced Workflow State Machine

The backend implements a deterministic state machine with explicit transitions:

```
IDLE
  │
  ▼
INCIDENT_INGESTED ──────────────────┐
  │                                 │
  ▼                                 │
ANALYZING (Parallel Agents)         │
  │                                 │
  ▼                                 │
RCA_COMPLETE                        │
  │                                 │
  ▼                                 │
GOVERNANCE_PENDING ◄────────────────┘
  │           │
  ▼           ▼ (Block Decision)
ACTION_PROPOSED  TERMINATED
  │
  ▼
VERIFIED
  │
  ▼
RESOLVED
  │
  ▼
TERMINATED
```

**State Transition Rules:**
- No state can be skipped
- GOVERNANCE_PENDING blocks until explicit human decision
- Block decisions immediately transition to TERMINATED
- All transitions generate audit artifacts

## Components and Interfaces

### Backend Components

#### Enhanced Orchestrator Agent

**Responsibilities:**
- Workflow state management and transition control
- Parallel specialist agent coordination
- Governance gate enforcement with blocking behavior
- Real-time state broadcasting to UI clients
- Audit artifact generation as first-class outputs

**Enhanced Capabilities:**
- Maintains workflow state persistence for recovery
- Validates state transitions against allowed paths
- Emits structured state updates via WebSocket/SSE
- Enforces mandatory governance checkpoints
- Generates immutable audit trails

**Interface:**
```typescript
interface OrchestratorState {
  workflowId: string;
  currentState: WorkflowState;
  timestamp: ISO8601String;
  agentOutputs: AgentOutput[];
  governanceDecision?: GovernanceDecision;
  auditTrail: AuditEvent[];
}
```

#### Enhanced Specialist Agents

Each specialist agent maintains its existing analysis-only role while providing enhanced structured outputs:

**SRE Agent:**
- Skills: Datadog, CloudWatch, Prometheus, OpenTelemetry
- Output: Operational analysis with confidence scoring
- Focus: System reliability and performance metrics

**Security Agent:**
- Skills: Splunk SIEM, IAM Logs, CSPM
- Output: Security risk assessment with threat analysis
- Focus: Access patterns and security implications

**Governance Agent (Analysis Phase):**
- Skills: Policy Engine, Change Management, Risk Register
- Output: Policy compliance analysis and risk assessment
- Focus: Blast radius evaluation and compliance checking

**Enhanced Agent Output Schema:**
```json
{
  "agentName": "sre-agent",
  "skillsUsed": ["Datadog", "CloudWatch"],
  "findings": {
    "rootCause": "Database connection pool exhaustion",
    "evidence": ["CPU spike at 14:32", "Connection timeout errors"],
    "correlations": ["Recent deployment at 14:30"]
  },
  "confidenceLevel": 0.85,
  "timestamp": "2024-01-15T14:35:00Z"
}
```

#### Workflow State Manager

**Purpose:** Centralized state management with persistence and validation

**Capabilities:**
- State transition validation and enforcement
- Workflow recovery after system restart
- Real-time state broadcasting to connected clients
- Audit event generation for all state changes

**Interface:**
```typescript
interface WorkflowStateManager {
  transitionTo(newState: WorkflowState): Promise<boolean>;
  getCurrentState(): WorkflowState;
  validateTransition(from: WorkflowState, to: WorkflowState): boolean;
  persistState(): Promise<void>;
  broadcastStateUpdate(): void;
}
```

### Frontend Components

#### Mission Control Dashboard

**Architecture:** Single-page Next.js 14 application with fixed 3-pane layout

**State Management:** React Context + Hooks for workflow state and real-time updates

**Real-time Communication:** WebSocket connection for live state updates

#### Left Panel: Incoming Signal

**Components:**
- `ActiveAlertCard`: JSON-style alert display with red border emphasis
- `LiveTerminalLogs`: Auto-scrolling log stream with syntax highlighting
- `SignalMetrics`: Key incident metrics and timestamps

**Data Flow:**
```typescript
interface IncomingSignal {
  alert: {
    service: string;
    severity: 'critical' | 'warning' | 'info';
    metric: string;
    value: number;
    timestamp: ISO8601String;
  };
  logs: LogEntry[];
  isStreaming: boolean;
}
```

#### Center Panel: Agent Brain & Workflow

**Components:**
- `WorkflowStepTracker`: Animated horizontal progress indicator
- `ParallelAgentCards`: Three agent cards showing concurrent analysis
- `BlastRadiusVisualization`: Interactive service dependency graph
- `SkillsBadges`: Dynamic badges showing active tool usage

**Agent Card Schema:**
```typescript
interface AgentCard {
  agentName: string;
  status: 'idle' | 'analyzing' | 'complete';
  skillsActive: string[];
  findings: string[];
  confidenceLevel: number;
  thinkingAnimation: boolean;
}
```

**Blast Radius Visualization:**
```typescript
interface BlastRadiusNode {
  serviceName: string;
  healthStatus: 'healthy' | 'warning' | 'critical';
  dependencies: string[];
  impactLevel: 'low' | 'medium' | 'high';
}
```

#### Right Panel: Human Handoff & Governance

**Components:**
- `AgentSummaryChat`: Plain-English findings in message bubble format
- `GovernanceApprovalCard`: Mandatory human decision interface
- `AuditConfirmation`: Final decision summary and audit trail

**Governance Approval Interface:**
```typescript
interface GovernanceApproval {
  recommendedAction: string;
  blastRadius: BlastRadiusAssessment;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  policyConflicts: string[];
  reversibility: boolean;
  approvalOptions: {
    approve: boolean;
    approveWithRestrictions: boolean;
    block: boolean;
  };
  rationale: string; // Required input
}
```

## Data Models

### Core Workflow Models

#### WorkflowState Enumeration
```typescript
enum WorkflowState {
  IDLE = 'IDLE',
  INCIDENT_INGESTED = 'INCIDENT_INGESTED',
  ANALYZING = 'ANALYZING',
  RCA_COMPLETE = 'RCA_COMPLETE',
  GOVERNANCE_PENDING = 'GOVERNANCE_PENDING',
  ACTION_PROPOSED = 'ACTION_PROPOSED',
  VERIFIED = 'VERIFIED',
  RESOLVED = 'RESOLVED',
  TERMINATED = 'TERMINATED'
}
```

#### Agent Output Model
```typescript
interface AgentOutput {
  agentName: 'sre-agent' | 'security-agent' | 'governance-agent';
  skillsUsed: string[];
  findings: {
    summary: string;
    evidence: string[];
    correlations: string[];
    recommendations?: string[];
  };
  confidenceLevel: number; // 0.0 to 1.0
  timestamp: ISO8601String;
  metadata: {
    processingTimeMs: number;
    dataSourcesAccessed: string[];
  };
}
```

#### Governance Decision Model
```typescript
interface GovernanceDecision {
  decision: 'approve' | 'approve_with_restrictions' | 'block';
  rationale: string;
  approver: {
    id: string;
    role: string;
  };
  timestamp: ISO8601String;
  restrictions?: string[];
  blastRadiusAssessment: {
    affectedServices: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reversible: boolean;
  };
}
```

#### Audit Event Model
```typescript
interface AuditEvent {
  eventId: string;
  workflowId: string;
  eventType: 'state_transition' | 'agent_output' | 'governance_decision' | 'workflow_termination';
  timestamp: ISO8601String;
  actor: 'orchestrator' | 'sre-agent' | 'security-agent' | 'governance-agent' | 'human';
  details: {
    fromState?: WorkflowState;
    toState?: WorkflowState;
    agentOutput?: AgentOutput;
    governanceDecision?: GovernanceDecision;
    terminationReason?: string;
  };
  immutable: true;
}
```

### UI State Models

#### Dashboard State
```typescript
interface DashboardState {
  currentWorkflow: WorkflowInstance | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  uiMode: 'live' | 'demo' | 'replay';
  panels: {
    left: IncomingSignalState;
    center: AgentBrainState;
    right: GovernanceState;
  };
}
```

#### Real-time Update Model
```typescript
interface StateUpdate {
  type: 'workflow_state' | 'agent_output' | 'governance_required' | 'workflow_complete';
  workflowId: string;
  timestamp: ISO8601String;
  payload: WorkflowState | AgentOutput | GovernanceRequest | WorkflowResult;
}
```

## Error Handling

### Backend Error Handling

**State Transition Errors:**
- Invalid state transitions are rejected with detailed error messages
- System maintains previous valid state on transition failures
- All errors are logged as audit events with full context

**Agent Communication Errors:**
- Agent failures do not crash the orchestrator
- Partial agent outputs are handled gracefully
- Confidence levels reflect data quality and completeness

**Governance Gate Errors:**
- Malformed governance decisions are rejected with validation errors
- Timeout handling for human approval with escalation procedures
- Block decisions immediately terminate workflow with audit trail

### Frontend Error Handling

**Connection Errors:**
- WebSocket reconnection with exponential backoff
- Offline state indication with cached data display
- Graceful degradation when real-time updates are unavailable

**UI State Errors:**
- Component error boundaries prevent full application crashes
- Invalid state updates are logged and ignored
- User feedback for all error conditions with recovery suggestions

**Governance Interface Errors:**
- Form validation for required rationale input
- Prevention of accidental approval submissions
- Clear error messages for invalid governance decisions

## Testing Strategy

### Backend Testing

**Unit Testing:**
- Individual agent output validation
- State transition logic verification
- Audit event generation correctness
- API endpoint response validation

**Integration Testing:**
- End-to-end workflow execution
- WebSocket communication reliability
- Database persistence and recovery
- Governance gate enforcement

**Property-Based Testing:**
- Workflow state machine invariants
- Agent output schema compliance
- Audit trail completeness and immutability
- Governance decision validation

### Frontend Testing

**Component Testing:**
- Individual panel component rendering
- Agent card state transitions
- Governance approval form validation
- Real-time update handling

**Integration Testing:**
- WebSocket connection management
- State synchronization between panels
- User interaction flows
- Error boundary behavior

**End-to-End Testing:**
- Complete workflow visualization
- Human approval process
- Demo mode functionality
- Audit trail display

### Demo and Simulation Testing

**Scenario Testing:**
- Realistic incident simulation
- Agent processing delays and animations
- Governance decision workflows
- Error and edge case handling

**Performance Testing:**
- Real-time update responsiveness
- Large log stream handling
- Multiple concurrent workflow support
- UI animation smoothness

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Workflow State Machine Determinism
*For any* workflow instance, state transitions must follow the exact sequence IDLE → INCIDENT_INGESTED → ANALYZING → RCA_COMPLETE → GOVERNANCE_PENDING → ACTION_PROPOSED → VERIFIED → RESOLVED → TERMINATED, and invalid transitions must be rejected
**Validates: Requirements 1.1, 1.2**

### Property 2: Workflow State Persistence Round Trip
*For any* workflow state, persisting and then loading the state should produce an equivalent workflow instance with identical state, agent outputs, and audit trail
**Validates: Requirements 1.3**

### Property 3: Real-time State Notification Completeness
*For any* workflow state change, all connected UI clients must receive structured state update notifications containing the new state, timestamp, and relevant payload data
**Validates: Requirements 1.4**

### Property 4: Governance Gate Enforcement Invariant
*For any* workflow instance, no workflow can transition to ACTION_PROPOSED state without first passing through GOVERNANCE_PENDING state and receiving explicit human approval
**Validates: Requirements 1.5, 4.1**

### Property 5: Agent Role Separation Invariant
*For any* orchestrator output, the content must never contain domain-specific analysis (SRE, Security, or Governance analysis) and must only contain workflow control and coordination information
**Validates: Requirements 2.1**

### Property 6: Parallel Agent Coordination
*For any* incident requiring analysis, the system must engage all appropriate specialist agents (SRE, Security, Governance) and execute their analysis concurrently without sequential dependencies
**Validates: Requirements 2.2**

### Property 7: Agent Skills Validation
*For any* agent output, the skills reported must only include those declared for that agent type: SRE (Datadog, CloudWatch, Prometheus, OpenTelemetry), Security (Splunk SIEM, IAM Logs, CSPM), or Governance (Policy Engine, Change Management, Risk Register)
**Validates: Requirements 2.3, 2.4, 2.5**

### Property 8: Structured Output Schema Compliance
*For any* agent output, the data must conform to the predefined JSON schema containing agent name, skills used, structured findings, confidence level, and timestamp, with no conversational or free-form text
**Validates: Requirements 3.1, 3.2**

### Property 9: Output Format Consistency
*For any* system output, analysis and decisions must use JSON format, remediation proposals must use YAML format, and no mixed or ambiguous formats are allowed
**Validates: Requirements 3.3**

### Property 10: Agent Correlation Structure
*For any* multi-agent analysis, the correlation output must be structured data without free-form text and must reference specific findings from each contributing agent
**Validates: Requirements 3.4**

### Property 11: Audit Trail Immutability
*For any* recorded audit event, the event data must remain unchanged after initial creation, and all workflow decisions and state changes must generate corresponding audit artifacts
**Validates: Requirements 3.5, 10.1**

### Property 12: Governance Decision Validation
*For any* governance decision, it must be one of exactly three types (Approve, Approve with Restrictions, Block) and must include human rationale, with Block decisions immediately transitioning workflow to TERMINATED state
**Validates: Requirements 4.3, 4.4**

### Property 13: Governance Information Completeness
*For any* governance approval request, it must contain blast radius assessment, risk level, policy conflicts, and reversibility assessment to enable informed human decision-making
**Validates: Requirements 4.2**

### Property 14: Governance Veto Authority
*For any* blocked workflow, the workflow must terminate immediately with complete audit trail and cannot be overridden by any system component
**Validates: Requirements 4.5**

### Property 15: Mission Control Layout Consistency
*For any* dashboard rendering, it must display exactly three panels (Left: Incoming Signal, Center: Agent Brain & Workflow, Right: Human Handoff & Governance) with each panel containing its required components
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 16: Agent Visualization Accuracy
*For any* active agent analysis, the UI must display agent cards showing current activity status, active skills badges, and confidence levels within valid ranges (0.0 to 1.0)
**Validates: Requirements 6.1, 6.3**

### Property 17: Structured Findings Display
*For any* completed agent analysis, the UI must display findings in structured format and show visual correlations between related agent outputs
**Validates: Requirements 6.4**

### Property 18: Parallel Activity Visualization
*For any* concurrent agent analysis, the UI must simultaneously display all active agents' activities without sequential presentation
**Validates: Requirements 6.5**

### Property 19: Blast Radius Graph Completeness
*For any* blast radius visualization, it must show affected system components with their relationships, health status color-coding (Healthy, Warning, Critical), and dependency chains
**Validates: Requirements 7.1, 7.2**

### Property 20: Dynamic Blast Radius Updates
*For any* proposed remediation action, the blast radius visualization must update to reflect the potential impact and include the assessment in governance approval requests
**Validates: Requirements 7.3, 7.5**

### Property 21: Governance Approval Interface Completeness
*For any* governance approval requirement, the UI must display an approval card containing recommended action, blast radius, risk level, policy conflicts, and exactly three color-coded approval options
**Validates: Requirements 8.1, 8.2**

### Property 22: Human Decision Validation
*For any* approval decision submission, the system must require rationale input and record the decision maker, timestamp, and decision type, rejecting submissions without rationale
**Validates: Requirements 8.3**

### Property 23: Workflow Completion Summary
*For any* completed workflow, the system must provide final decision summary, audit confirmation, and resolution status display with all required completion information
**Validates: Requirements 8.4, 8.5**

### Property 24: Demo Mode Safety Invariant
*For any* demo mode operation, the system must use only mocked data, prevent all external system interactions, maintain all safety constraints, and allow reset to initial state
**Validates: Requirements 9.1, 9.2, 9.3**

### Property 25: Demo Simulation Realism
*For any* simulated agent analysis, it must use realistic timing delays, progressive disclosure of findings, and proper skills attribution while requiring human approval for governance decisions
**Validates: Requirements 9.4, 9.5**

### Property 26: Comprehensive Audit Trail Generation
*For any* workflow execution, every decision, state change, agent analysis, and governance action must generate structured audit artifacts with complete context including skills used, confidence levels, and human rationale
**Validates: Requirements 10.2, 10.3, 10.4**

### Property 27: Audit Trail Machine Readability
*For any* audit trail entry, it must be structured, machine-readable, and suitable for compliance review with DEVLOG.md serving as the canonical audit trail
**Validates: Requirements 10.5**

### Property 28: Infrastructure Mutation Prevention
*For any* system component operation, it must never perform direct infrastructure mutations, external actions, or auto-execute fixes, ensuring all remediation actions remain proposals only
**Validates: Requirements 11.1, 11.2, 11.5**

### Property 29: API Security and Validation
*For any* API communication, it must use secure protocols, validate all inputs, implement access controls, and return structured error responses with appropriate HTTP status codes
**Validates: Requirements 11.3, 13.4**

### Property 30: Demo Mode Isolation
*For any* demo mode activation, it must clearly indicate simulation status, prevent real system interactions, and maintain the same safety constraints as production mode
**Validates: Requirements 11.4**

### Property 31: Workflow Independence
*For any* multiple concurrent workflows, each must maintain independent processing without cross-workflow interference while preserving core governance functionality during system degradation
**Validates: Requirements 12.4, 12.5**

### Property 32: API Structure Consistency
*For any* API endpoint response, it must return structured data in the correct format for workflow state, agent outputs, and governance decisions, with historical data requests returning complete and accurate information
**Validates: Requirements 13.1, 13.5**

### Property 33: Real-time Communication Reliability
*For any* workflow state change, the backend must provide real-time updates to UI clients through WebSocket or Server-Sent Events, and governance decision submissions must be validated and update workflow state correctly
**Validates: Requirements 13.2, 13.3**

### Property 34: Alert Display Format Compliance
*For any* incident ingestion, the UI must display the active alert in JSON-style format containing service, severity, metric, and timestamp information with proper formatting
**Validates: Requirements 14.1**

### Property 35: Log Stream Visualization
*For any* available system logs, the UI must stream them with auto-scrolling, syntax highlighting, monospace formatting, and red highlighting for error lines with timestamps
**Validates: Requirements 14.2, 14.3**

### Property 36: Activity-Responsive Log Behavior
*For any* agent investigation activity, log scrolling speed must increase during active analysis and slow down with error cessation when incidents are resolved
**Validates: Requirements 14.4, 14.5**
## Error Handling

### Backend Error Handling Strategy

**State Machine Error Handling:**
- Invalid state transitions are rejected with detailed validation errors
- System maintains previous valid state when transitions fail
- All state transition errors generate audit events with full context
- Workflow recovery mechanisms restore valid state after system restart

**Agent Communication Error Handling:**
- Individual agent failures do not crash the orchestrator
- Partial agent outputs are handled gracefully with confidence level adjustments
- Agent timeout handling with configurable retry mechanisms
- Missing agent outputs are clearly marked in correlation summaries

**Governance Gate Error Handling:**
- Malformed governance decisions are rejected with specific validation messages
- Human approval timeout handling with escalation procedures
- Block decisions immediately terminate workflow with complete audit trail
- Governance interface errors prevent accidental approval submissions

**API and Communication Error Handling:**
- WebSocket connection failures trigger automatic reconnection with exponential backoff
- API endpoint errors return structured error responses with appropriate HTTP status codes
- Real-time update failures are logged and clients are notified of connection issues
- Database persistence errors trigger workflow state recovery procedures

### Frontend Error Handling Strategy

**Connection and Communication Errors:**
- WebSocket disconnection handling with visual connection status indicators
- Automatic reconnection attempts with user notification of connection state
- Graceful degradation when real-time updates are unavailable
- Cached data display during offline periods with clear offline indicators

**UI State and Component Errors:**
- React error boundaries prevent full application crashes from component failures
- Invalid state updates are validated, logged, and ignored to maintain UI stability
- Component rendering errors display fallback UI with error recovery options
- Form validation errors provide clear user feedback with correction guidance

**User Interaction Error Handling:**
- Governance form validation prevents submission without required rationale
- Invalid approval decisions are rejected with clear error messages
- User action confirmation dialogs prevent accidental critical decisions
- Loading states and error feedback for all user-initiated actions

**Data Validation and Display Errors:**
- Invalid workflow data is sanitized and displayed with error indicators
- Missing or corrupted agent outputs are clearly marked in the UI
- Blast radius visualization errors display fallback representations
- Audit trail display errors show partial data with error notifications

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit testing and property-based testing as complementary approaches:

**Unit Testing Focus:**
- Specific examples and edge cases for individual components
- Integration points between backend and frontend systems
- Error conditions and boundary cases
- User interface component behavior and interactions

**Property-Based Testing Focus:**
- Universal properties that hold across all valid inputs
- Comprehensive input coverage through randomization
- Workflow state machine invariants and safety properties
- Agent output schema compliance and governance enforcement

### Backend Testing Strategy

**Unit Testing:**
- Individual agent output validation with specific test cases
- State transition logic verification with edge cases
- API endpoint response validation with various input scenarios
- Database persistence and recovery with failure simulation
- Governance gate enforcement with specific approval scenarios

**Property-Based Testing:**
- Workflow state machine invariants (minimum 100 iterations per test)
- Agent output schema compliance across all possible inputs
- Audit trail completeness and immutability verification
- Governance decision validation with random decision scenarios
- API security and input validation with fuzz testing

**Integration Testing:**
- End-to-end workflow execution with realistic scenarios
- WebSocket communication reliability under various network conditions
- Multi-agent parallel analysis coordination
- Governance gate enforcement across different workflow paths

**Property Test Configuration:**
Each property-based test runs minimum 100 iterations and includes tags referencing design properties:
- **Feature: sentinelflow-unified-architecture, Property 1: Workflow State Machine Determinism**
- **Feature: sentinelflow-unified-architecture, Property 4: Governance Gate Enforcement Invariant**
- **Feature: sentinelflow-unified-architecture, Property 28: Infrastructure Mutation Prevention**

### Frontend Testing Strategy

**Unit Testing:**
- Individual panel component rendering with various state scenarios
- Agent card state transitions and animation triggers
- Governance approval form validation with edge cases
- Real-time update handling with mock WebSocket data
- Error boundary behavior with simulated component failures

**Property-Based Testing:**
- UI layout consistency across different screen sizes and data states
- Agent visualization accuracy with random agent output data
- Governance interface completeness with various approval scenarios
- Real-time update synchronization with random state changes

**Integration Testing:**
- WebSocket connection management with network interruptions
- State synchronization between all three panels
- Complete user interaction flows from incident to resolution
- Error recovery and graceful degradation scenarios

**End-to-End Testing:**
- Complete workflow visualization from incident ingestion to resolution
- Human approval process with various governance decisions
- Demo mode functionality with realistic simulation scenarios
- Audit trail display and historical data access

### Demo and Simulation Testing

**Scenario Testing:**
- Realistic incident simulation with various severity levels
- Agent processing delays and progressive disclosure timing
- Governance decision workflows with different approval outcomes
- Error and edge case handling in demo environment

**Performance Testing:**
- Real-time update responsiveness under high message volume
- Large log stream handling without UI performance degradation
- Multiple concurrent workflow support with resource monitoring
- UI animation smoothness during intensive agent activity

**Compliance and Audit Testing:**
- Complete audit trail generation for all demo scenarios
- Governance decision recording with proper rationale capture
- DEVLOG.md generation with machine-readable format validation
- Historical data access and compliance report generation

### Testing Technology Stack

**Backend Testing:**
- Jest for unit testing with TypeScript support
- Property-based testing library (fast-check for TypeScript/Node.js)
- Supertest for API endpoint testing
- WebSocket testing with mock client connections

**Frontend Testing:**
- React Testing Library for component testing
- Jest for unit testing with React support
- Cypress for end-to-end testing
- Mock Service Worker (MSW) for API mocking
- WebSocket mocking for real-time update testing

**Property-Based Testing Libraries:**
- fast-check for TypeScript/JavaScript property-based testing
- Minimum 100 iterations per property test
- Custom generators for workflow states, agent outputs, and governance decisions
- Shrinking capabilities for minimal failing examples

This comprehensive testing strategy ensures that both specific behaviors and universal properties are validated, providing confidence in the system's correctness, safety, and governance enforcement capabilities.