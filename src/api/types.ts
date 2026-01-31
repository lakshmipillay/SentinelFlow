/**
 * SentinelFlow API Types
 * Standardized request/response types for all API endpoints
 */

import { WorkflowState, WorkflowInstance, AgentOutput, GovernanceDecision } from '../types/workflow';
import { EnhancedAuditEvent } from '../services/AuditArtifactService';

/**
 * Standard API Response Format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  version: string;
}

/**
 * Standard API Error Response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  version: string;
}

/**
 * Workflow API Types
 */
export interface CreateWorkflowRequest {
  // No body required - workflow created with defaults
}

export interface CreateWorkflowResponse {
  workflowId: string;
  currentState: WorkflowState;
  timestamp: string;
  createdAt: string;
}

export interface GetWorkflowResponse {
  workflow: WorkflowInstance;
}

export interface GetWorkflowsResponse {
  workflows: WorkflowInstance[];
  totalCount: number;
}

export interface UpdateWorkflowStateRequest {
  newState: WorkflowState;
  reason?: string;
}

export interface UpdateWorkflowStateResponse {
  success: boolean;
  workflow: WorkflowInstance;
  previousState: WorkflowState;
}

/**
 * Agent Output API Types
 */
export interface GetAgentOutputsResponse {
  workflowId: string;
  agentOutputs: AgentOutput[];
  totalOutputs: number;
  agentName?: string;
}

export interface GetAgentOutputsByAgentResponse {
  workflowId: string;
  agentName: string;
  agentOutputs: AgentOutput[];
  totalOutputs: number;
}

/**
 * Governance API Types
 */
export interface SubmitGovernanceDecisionRequest {
  decision: 'approve' | 'approve_with_restrictions' | 'block';
  rationale: string;
  approver: {
    id: string;
    role: string;
  };
  restrictions?: string[];
}

export interface SubmitGovernanceDecisionResponse {
  success: boolean;
  governanceDecision: GovernanceDecision;
  workflowTerminated: boolean;
  message: string;
}

export interface GetGovernanceStatusResponse {
  workflowId: string;
  hasGovernanceDecision: boolean;
  governanceRequired: boolean;
  governanceDecision?: GovernanceDecision;
}

/**
 * Audit API Types
 */
export interface GetAuditTrailResponse {
  workflowId: string;
  auditTrail: EnhancedAuditEvent[];
  totalEvents: number;
}

export interface GetAuditChainResponse {
  workflowId: string;
  auditChain: EnhancedAuditEvent[];
  chainIntegrity: {
    valid: boolean;
    totalEvents: number;
    verifiedEvents: number;
    integrityScore: number;
  };
}

export interface GetAuditMetricsResponse {
  workflowId: string;
  metrics: {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByActor: Record<string, number>;
    averageProcessingTime: number;
    workflowDuration: number;
    auditCompleteness: number;
  };
}

export interface ExportAuditRequest {
  format?: 'json' | 'csv' | 'pdf';
  includeContext?: boolean;
}

export interface ExportAuditResponse {
  workflowId: string;
  exportId: string;
  format: string;
  downloadUrl: string;
  expiresAt: string;
}

/**
 * Historical Data API Types
 */
export interface GetHistoricalWorkflowsRequest {
  startDate?: string;
  endDate?: string;
  state?: WorkflowState;
  limit?: number;
  offset?: number;
}

export interface GetHistoricalWorkflowsResponse {
  workflows: WorkflowInstance[];
  totalCount: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * API Error Codes
 */
export enum ApiErrorCode {
  // General errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  
  // Security errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  REQUEST_TOO_LARGE = 'REQUEST_TOO_LARGE',
  FORBIDDEN_ORIGIN = 'FORBIDDEN_ORIGIN',
  INVALID_ORIGIN = 'INVALID_ORIGIN',
  MISSING_CONTENT_TYPE = 'MISSING_CONTENT_TYPE',
  UNSUPPORTED_CONTENT_TYPE = 'UNSUPPORTED_CONTENT_TYPE',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  
  // Workflow errors
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  WORKFLOW_TERMINATED = 'WORKFLOW_TERMINATED',
  
  // Agent output errors
  INVALID_AGENT_OUTPUT = 'INVALID_AGENT_OUTPUT',
  AGENT_OUTPUT_VALIDATION_FAILED = 'AGENT_OUTPUT_VALIDATION_FAILED',
  
  // Governance errors
  GOVERNANCE_DECISION_REQUIRED = 'GOVERNANCE_DECISION_REQUIRED',
  INVALID_GOVERNANCE_DECISION = 'INVALID_GOVERNANCE_DECISION',
  GOVERNANCE_REQUEST_NOT_FOUND = 'GOVERNANCE_REQUEST_NOT_FOUND',
  
  // Audit errors
  AUDIT_TRAIL_NOT_FOUND = 'AUDIT_TRAIL_NOT_FOUND',
  AUDIT_EXPORT_FAILED = 'AUDIT_EXPORT_FAILED'
}