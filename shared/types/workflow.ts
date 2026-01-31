/**
 * SentinelFlow Shared Workflow Types
 * 
 * SHARED TYPES PACKAGE
 * These types are the single source of truth for both backend and frontend.
 * Import from '@sentinelflow/shared' or use relative imports.
 * 
 * This eliminates code duplication between frontend and backend.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Workflow state enumeration - deterministic state machine
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

// ============================================================================
// TYPE ALIASES
// ============================================================================

/** Agent types in the SentinelFlow system */
export type AgentType = 'sre-agent' | 'security-agent' | 'governance-agent';

/** Agent status during workflow execution */
export type AgentStatus = 'idle' | 'analyzing' | 'complete';

/** Governance decision types */
export type GovernanceDecisionType = 'approve' | 'approve_with_restrictions' | 'block';

/** Risk level assessment */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Health status for blast radius visualization */
export type HealthStatus = 'healthy' | 'warning' | 'critical';

/** Alert severity levels */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/** Connection status for WebSocket */
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

/** UI mode for the dashboard */
export type UIMode = 'live' | 'demo' | 'replay';

/** Actor types for audit events */
export type AuditActor = 'orchestrator' | AgentType | 'human';

/** Audit event types */
export type AuditEventType = 'state_transition' | 'agent_output' | 'governance_decision' | 'workflow_termination';

// ============================================================================
// AGENT SKILLS CONFIGURATION
// ============================================================================

/** Agent skills by agent type - maps to real enterprise tools */
export const AGENT_SKILLS: Record<AgentType, string[]> = {
  'sre-agent': ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry'],
  'security-agent': ['Splunk SIEM', 'IAM Logs', 'CSPM'],
  'governance-agent': ['Policy Engine', 'Change Management', 'Risk Register']
};

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Structured agent output schema
 * Validates: Requirements 2.3, 2.4, 2.5, 3.1
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
    skillsMetadata?: AgentSkillsMetadata;
  };
  validation?: {
    skillsValid: boolean;
    confidenceLevelValid: boolean;
    schemaCompliant: boolean;
  };
}

/** Agent skills metadata for validation */
export interface AgentSkillsMetadata {
  validSkills: string[];
  invalidSkills: string[];
  skillValidationPassed: boolean;
}

/**
 * Governance decision model
 * Implements Requirements 4.1, 4.3, 4.4
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
  blastRadiusAssessment: BlastRadiusAssessment;
}

/** Blast radius assessment for governance decisions */
export interface BlastRadiusAssessment {
  affectedServices: string[];
  riskLevel: RiskLevel;
  reversible: boolean;
  impactDescription?: string;
  dependencyAnalysis?: {
    directDependencies: string[];
    cascadeRisk: RiskLevel;
    criticalPath: boolean;
    totalPotentialImpact: number;
  };
  riskFactors?: {
    confidenceLevel: number;
    serviceCount: number;
    actionType: string;
    businessHoursImpact: boolean;
    criticalServicesAffected: string[];
  };
}

/** Active alert information */
export interface ActiveAlert {
  service: string;
  severity: AlertSeverity;
  metric: string;
  value: number;
  timestamp: string; // ISO8601
  description?: string;
}

/** Log entry for terminal display */
export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  source?: string;
}

/** Blast radius node for visualization */
export interface BlastRadiusNode {
  serviceName: string;
  healthStatus: HealthStatus;
  dependencies: string[];
  impactLevel: 'low' | 'medium' | 'high';
}

/** Agent card state for UI display */
export interface AgentCard {
  agentName: AgentType;
  status: AgentStatus;
  skillsActive: string[];
  findings: string[];
  confidenceLevel: number;
  thinkingAnimation: boolean;
}

/** Governance approval request */
export interface GovernanceApprovalRequest {
  requestId?: string;
  workflowId?: string;
  recommendedAction: string;
  blastRadius: BlastRadiusNode[];
  riskLevel: RiskLevel;
  policyConflicts: string[];
  reversibility: boolean;
}

/**
 * Audit event model
 * Implements immutable audit trail requirement
 */
export interface AuditEvent {
  eventId: string;
  workflowId: string;
  eventType: AuditEventType;
  timestamp: string; // ISO8601
  actor: AuditActor;
  details: {
    fromState?: WorkflowState;
    toState?: WorkflowState;
    agentOutput?: AgentOutput;
    governanceDecision?: GovernanceDecision;
    terminationReason?: string;
    analysisInitiated?: boolean;
    agentTasksCreated?: number;
    incidentContext?: unknown;
  };
  immutable?: true;
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
  createdAt?: string; // ISO8601
  updatedAt?: string; // ISO8601
}

/**
 * Real-time state update from backend
 */
export interface StateUpdate {
  type: 'workflow_state' | 'agent_output' | 'governance_required' | 'governance_decision' | 'workflow_complete';
  workflowId: string;
  timestamp: string; // ISO8601
  payload: WorkflowState | AgentOutput | GovernanceDecision | GovernanceApprovalRequest | WorkflowInstance;
}
