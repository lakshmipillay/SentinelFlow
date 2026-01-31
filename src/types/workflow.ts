/**
 * SentinelFlow Workflow State Machine Types
 * Implements deterministic state transitions for governed agentic workflows
 * 
 * NOTE: Core workflow types are also defined in shared/types/workflow.ts
 * for frontend/backend type sharing. This file contains the backend-specific
 * implementation with additional validation and agent-skills integration.
 * 
 * When updating types, consider if changes should also be reflected in
 * the shared types package for frontend consistency.
 */

import { AgentName, AgentSkill, AgentSkillsMetadata } from './agent-skills';

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
 * Enhanced agent output with structured skills validation and confidence tracking
 * Validates: Requirements 2.3, 2.4, 2.5, 3.1
 */
export interface AgentOutput {
  agentName: AgentName;
  skillsUsed: AgentSkill[];
  findings: {
    summary: string;
    evidence: string[];
    correlations: string[];
    recommendations?: string[];
  };
  confidenceLevel: number; // 0.0 to 1.0 - validated range
  timestamp: string; // ISO8601String
  metadata: {
    processingTimeMs: number;
    dataSourcesAccessed: string[];
    skillsMetadata: AgentSkillsMetadata;
  };
  // Validation flags for audit purposes
  validation: {
    skillsValid: boolean;
    confidenceLevelValid: boolean;
    schemaCompliant: boolean;
  };
}

export interface GovernanceDecision {
  decision: 'approve' | 'approve_with_restrictions' | 'block';
  rationale: string;
  approver: {
    id: string;
    role: string;
  };
  timestamp: string; // ISO8601String
  restrictions?: string[];
  blastRadiusAssessment: {
    affectedServices: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reversible: boolean;
    // Enhanced blast radius information for requirement 4.2
    dependencyAnalysis?: {
      directDependencies: string[];
      cascadeRisk: 'low' | 'medium' | 'high';
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
  };
}

export interface AuditEvent {
  eventId: string;
  workflowId: string;
  eventType: 'state_transition' | 'agent_output' | 'governance_decision' | 'workflow_termination';
  timestamp: string; // ISO8601String
  actor: 'orchestrator' | 'sre-agent' | 'security-agent' | 'governance-agent' | 'human';
  details: {
    fromState?: WorkflowState;
    toState?: WorkflowState;
    agentOutput?: AgentOutput;
    governanceDecision?: GovernanceDecision;
    terminationReason?: string;
    // Enhanced orchestrator coordination details
    analysisInitiated?: boolean;
    agentTasksCreated?: number;
    incidentContext?: any;
  };
  immutable: true;
}

export interface WorkflowInstance {
  workflowId: string;
  currentState: WorkflowState;
  timestamp: string; // ISO8601String
  agentOutputs: AgentOutput[];
  governanceDecision?: GovernanceDecision;
  auditTrail: AuditEvent[];
  createdAt: string; // ISO8601String
  updatedAt: string; // ISO8601String
}

export interface StateUpdate {
  type: 'workflow_state' | 'agent_output' | 'governance_required' | 'governance_decision' | 'workflow_complete';
  workflowId: string;
  timestamp: string; // ISO8601String
  payload: WorkflowState | AgentOutput | GovernanceDecision | WorkflowInstance;
}