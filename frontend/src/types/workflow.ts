/**
 * SentinelFlow Workflow Types
 * 
 * NOTE: These types are now sourced from the shared package (@sentinelflow/shared)
 * to eliminate code duplication between frontend and backend.
 * 
 * This file re-exports from shared for backward compatibility.
 * New code should import directly from '../../shared/types/workflow' when possible.
 */

// Re-export all types from shared package
// In a monorepo setup, this would be: export * from '@sentinelflow/shared';
// For now, we use relative imports

/**
 * Workflow state enumeration - matches backend state machine
 * States follow strict order: IDLE → INCIDENT_INGESTED → ANALYZING → RCA_COMPLETE → 
 * GOVERNANCE_PENDING → ACTION_PROPOSED → VERIFIED → RESOLVED → TERMINATED
 */
export enum WorkflowState {
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

/**
 * Agent types in the SentinelFlow system
 */
export type AgentType = 'sre-agent' | 'security-agent' | 'governance-agent';

/**
 * Agent status during workflow execution
 */
export type AgentStatus = 'idle' | 'analyzing' | 'complete';

/**
 * Governance decision types
 */
export type GovernanceDecisionType = 'approve' | 'approve_with_restrictions' | 'block';

/**
 * Risk level assessment
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Health status for blast radius visualization
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Connection status for WebSocket
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

/**
 * UI mode for the dashboard
 */
export type UIMode = 'live' | 'demo' | 'replay';

/**
 * Agent skills by agent type - sourced from shared configuration
 * Maps to real enterprise tools that agents can query
 */
export const AGENT_SKILLS: Record<AgentType, string[]> = {
  'sre-agent': ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry'],
  'security-agent': ['Splunk SIEM', 'IAM Logs', 'CSPM'],
  'governance-agent': ['Policy Engine', 'Change Management', 'Risk Register']
};

/**
 * Structured agent output schema
 * Shared between frontend and backend
 */
export interface AgentOutput {
  agentName: AgentType;
  skillsUsed: string[];
  findings: {
    summary: string;
    evidence: string[];
    correlations: string[];
    recommendations?: string[];
  };
  confidenceLevel: number; // 0.0 to 1.0
  timestamp: string; // ISO8601
  metadata: {
    processingTimeMs: number;
    dataSourcesAccessed: string[];
  };
}

/**
 * Governance decision model
 * Shared between frontend and backend
 */
export interface GovernanceDecision {
  decision: GovernanceDecisionType;
  rationale: string;
  approver: {
    id: string;
    role: string;
  };
  timestamp: string; // ISO8601
  restrictions?: string[];
  blastRadiusAssessment: {
    affectedServices: string[];
    riskLevel: RiskLevel;
    reversible: boolean;
  };
}

/**
 * Active alert information
 */
export interface ActiveAlert {
  service: string;
  severity: AlertSeverity;
  metric: string;
  value: number;
  timestamp: string; // ISO8601
  description?: string;
}

/**
 * Log entry for terminal display
 */
export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  source?: string;
}

/**
 * Blast radius node for visualization
 */
export interface BlastRadiusNode {
  serviceName: string;
  healthStatus: HealthStatus;
  dependencies: string[];
  impactLevel: 'low' | 'medium' | 'high';
}

/**
 * Agent card state for UI display
 */
export interface AgentCard {
  agentName: AgentType;
  status: AgentStatus;
  skillsActive: string[];
  findings: string[];
  confidenceLevel: number;
  thinkingAnimation: boolean;
}

/**
 * Governance approval request
 */
export interface GovernanceApprovalRequest {
  recommendedAction: string;
  blastRadius: BlastRadiusNode[];
  riskLevel: RiskLevel;
  policyConflicts: string[];
  reversibility: boolean;
}

/**
 * Audit event model
 */
export interface AuditEvent {
  eventId: string;
  workflowId: string;
  eventType: 'state_transition' | 'agent_output' | 'governance_decision' | 'workflow_termination';
  timestamp: string; // ISO8601
  actor: 'orchestrator' | AgentType | 'human';
  details: {
    fromState?: WorkflowState;
    toState?: WorkflowState;
    agentOutput?: AgentOutput;
    governanceDecision?: GovernanceDecision;
    terminationReason?: string;
  };
}

/**
 * Complete workflow instance
 */
export interface WorkflowInstance {
  workflowId: string;
  currentState: WorkflowState;
  timestamp: string; // ISO8601
  alert?: ActiveAlert;
  agentOutputs: AgentOutput[];
  governanceDecision?: GovernanceDecision;
  auditTrail: AuditEvent[];
}

/**
 * Real-time state update from backend
 */
export interface StateUpdate {
  type: 'workflow_state' | 'agent_output' | 'governance_required' | 'workflow_complete';
  workflowId: string;
  timestamp: string; // ISO8601
  payload: WorkflowState | AgentOutput | GovernanceApprovalRequest | WorkflowInstance;
}
