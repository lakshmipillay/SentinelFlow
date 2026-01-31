/**
 * SentinelFlow API Client Service
 * 
 * Provides a typed interface for connecting the frontend to backend REST endpoints.
 * Handles workflow state, agent outputs, and governance decisions.
 * 
 * Requirements: 13.1 - Structured API endpoints for workflow state, agent outputs, and governance decisions
 * Requirements: 13.3 - Governance decision submission with proper error handling
 * 
 * Task 16.1: Connect backend and frontend systems
 */

import {
  WorkflowInstance,
  WorkflowState,
  AgentOutput,
  GovernanceDecision,
  GovernanceDecisionType,
  AuditEvent
} from '@/types/workflow';

/**
 * API Configuration
 */
export interface ApiConfig {
  /** Base URL for the API (default: http://localhost:3001/api) */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom headers to include in all requests */
  headers?: Record<string, string>;
}

/**
 * Default API configuration
 */
const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
};

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  version?: string;
}

/**
 * Create workflow response
 */
export interface CreateWorkflowResponse {
  workflowId: string;
  currentState: WorkflowState;
  timestamp: string;
  createdAt: string;
}

/**
 * Get workflows response
 */
export interface GetWorkflowsResponse {
  workflows: WorkflowInstance[];
  totalCount: number;
}

/**
 * Update workflow state request
 */
export interface UpdateWorkflowStateRequest {
  newState: WorkflowState;
  reason?: string;
}

/**
 * Update workflow state response
 */
export interface UpdateWorkflowStateResponse {
  success: boolean;
  workflow: WorkflowInstance;
  previousState: WorkflowState;
}

/**
 * Submit governance decision request
 */
export interface SubmitGovernanceDecisionRequest {
  decision: GovernanceDecisionType;
  rationale: string;
  approver: {
    id: string;
    role: string;
  };
  restrictions?: string[];
}

/**
 * Submit governance decision response
 */
export interface SubmitGovernanceDecisionResponse {
  success: boolean;
  governanceDecision: GovernanceDecision;
  workflowTerminated: boolean;
  message: string;
}

/**
 * Governance request from backend
 */
export interface GovernanceRequest {
  requestId: string;
  workflowId: string;
  timestamp: string;
  recommendedAction: string;
  blastRadiusAssessment: {
    affectedServices: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reversible: boolean;
    impactDescription: string;
  };
  policyConflicts: string[];
  contextData: {
    incidentSummary: string;
    agentFindings: string[];
    correlationSummary: string;
    confidenceLevel: number;
  };
  status: 'pending' | 'approved' | 'approved_with_restrictions' | 'blocked';
  createdAt: string;
  decidedAt?: string;
  decision?: GovernanceDecision;
}

/**
 * Pending governance requests response
 */
export interface PendingGovernanceRequestsResponse {
  totalPending: number;
  requests: GovernanceRequest[];
}

/**
 * Governance status response
 */
export interface GovernanceStatusResponse {
  workflowId: string;
  hasGovernanceDecision: boolean;
  governanceRequired: boolean;
  governanceDecision?: GovernanceDecision;
}

/**
 * Audit trail response
 */
export interface AuditTrailResponse {
  workflowId: string;
  auditTrail: AuditEvent[];
  totalEvents: number;
}

/**
 * API Error class for typed error handling
 */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * SentinelFlow API Client
 * 
 * Provides methods for interacting with the SentinelFlow backend API.
 */
export class SentinelFlowApiClient {
  private config: ApiConfig;
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Make an HTTP request to the API
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    requestId?: string
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // Create abort controller for this request
    const abortController = new AbortController();
    if (requestId) {
      // Cancel any existing request with the same ID
      this.abortControllers.get(requestId)?.abort();
      this.abortControllers.set(requestId, abortController);
    }

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.config.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

      // Parse response
      const data: ApiResponse<T> = await response.json();

      // Handle error responses
      if (!response.ok || !data.success) {
        throw new ApiError(
          data.error?.code || 'UNKNOWN_ERROR',
          data.error?.message || 'An unknown error occurred',
          response.status,
          data.error?.details
        );
      }

      return data.data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('REQUEST_TIMEOUT', 'Request timed out', 408);
        }
        throw new ApiError('NETWORK_ERROR', error.message, 0);
      }

      throw new ApiError('UNKNOWN_ERROR', 'An unknown error occurred', 0);
    } finally {
      if (requestId) {
        this.abortControllers.delete(requestId);
      }
    }
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(requestId: string): void {
    this.abortControllers.get(requestId)?.abort();
    this.abortControllers.delete(requestId);
  }

  // ============================================
  // Workflow Management Endpoints
  // ============================================

  /**
   * Get all workflows
   */
  async getWorkflows(): Promise<GetWorkflowsResponse> {
    return this.request<GetWorkflowsResponse>('GET', '/workflows');
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(): Promise<CreateWorkflowResponse> {
    return this.request<CreateWorkflowResponse>('POST', '/workflows');
  }

  /**
   * Get a specific workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<{ workflow: WorkflowInstance }> {
    return this.request<{ workflow: WorkflowInstance }>('GET', `/workflows/${workflowId}`);
  }

  /**
   * Get current workflow state
   */
  async getWorkflowState(workflowId: string): Promise<{
    workflowId: string;
    currentState: WorkflowState;
    timestamp: string;
  }> {
    return this.request('GET', `/workflows/${workflowId}/state`);
  }

  /**
   * Update workflow state (transition)
   */
  async updateWorkflowState(
    workflowId: string,
    newState: WorkflowState,
    reason?: string
  ): Promise<UpdateWorkflowStateResponse> {
    return this.request<UpdateWorkflowStateResponse>(
      'PUT',
      `/workflows/${workflowId}/state`,
      { newState, reason }
    );
  }

  /**
   * Terminate a workflow
   */
  async terminateWorkflow(
    workflowId: string,
    reason: string
  ): Promise<{ success: boolean; workflow: WorkflowInstance; message: string }> {
    return this.request('POST', `/workflows/${workflowId}/terminate`, { reason });
  }

  // ============================================
  // Agent Output Endpoints
  // ============================================

  /**
   * Get agent outputs for a workflow
   */
  async getAgentOutputs(workflowId: string): Promise<{
    workflowId: string;
    agentOutputs: AgentOutput[];
    totalOutputs: number;
  }> {
    return this.request('GET', `/workflows/${workflowId}/agent-outputs`);
  }

  /**
   * Get agent output by agent name
   */
  async getAgentOutputByName(
    workflowId: string,
    agentName: string
  ): Promise<{ agentOutput: AgentOutput }> {
    return this.request('GET', `/workflows/${workflowId}/agent-outputs/${agentName}`);
  }

  /**
   * Get analysis summary for a workflow
   */
  async getAnalysisSummary(workflowId: string): Promise<{
    workflowId: string;
    summary: {
      totalAgents: number;
      completedAgents: number;
      averageConfidence: number;
      findings: string[];
    };
  }> {
    return this.request('GET', `/workflows/${workflowId}/analysis-summary`);
  }

  // ============================================
  // Governance Endpoints
  // ============================================

  /**
   * Submit governance decision for a workflow
   * Implements Requirements 13.3 - Governance decision submission
   */
  async submitGovernanceDecision(
    workflowId: string,
    decision: GovernanceDecisionType,
    rationale: string,
    approver: { id: string; role: string },
    restrictions?: string[]
  ): Promise<SubmitGovernanceDecisionResponse> {
    const request: SubmitGovernanceDecisionRequest = {
      decision,
      rationale,
      approver,
      restrictions
    };

    return this.request<SubmitGovernanceDecisionResponse>(
      'POST',
      `/workflows/${workflowId}/governance-decision`,
      request,
      `governance-${workflowId}` // Request ID for cancellation
    );
  }

  /**
   * Get governance decision for a workflow
   */
  async getGovernanceDecision(workflowId: string): Promise<{
    workflowId: string;
    governanceRequest: GovernanceRequest;
    hasDecision: boolean;
    decision?: GovernanceDecision;
  }> {
    return this.request('GET', `/workflows/${workflowId}/governance-decision`);
  }

  /**
   * Get governance status for a workflow
   */
  async getGovernanceStatus(workflowId: string): Promise<GovernanceStatusResponse> {
    return this.request<GovernanceStatusResponse>(
      'GET',
      `/workflows/${workflowId}/governance-status`
    );
  }

  /**
   * Get pending governance requests
   */
  async getPendingGovernanceRequests(): Promise<PendingGovernanceRequestsResponse> {
    return this.request<PendingGovernanceRequestsResponse>(
      'GET',
      '/governance/requests/pending'
    );
  }

  /**
   * Get governance request by ID
   */
  async getGovernanceRequest(requestId: string): Promise<GovernanceRequest> {
    return this.request<GovernanceRequest>('GET', `/governance/requests/${requestId}`);
  }

  /**
   * Submit governance decision by request ID
   */
  async submitGovernanceDecisionByRequestId(
    requestId: string,
    decision: GovernanceDecisionType,
    rationale: string,
    approver: { id: string; role: string },
    restrictions?: string[]
  ): Promise<SubmitGovernanceDecisionResponse> {
    const request: SubmitGovernanceDecisionRequest = {
      decision,
      rationale,
      approver,
      restrictions
    };

    return this.request<SubmitGovernanceDecisionResponse>(
      'POST',
      `/governance/requests/${requestId}/decision`,
      request,
      `governance-request-${requestId}`
    );
  }

  // ============================================
  // Audit Trail Endpoints
  // ============================================

  /**
   * Get audit trail for a workflow
   */
  async getAuditTrail(workflowId: string): Promise<AuditTrailResponse> {
    return this.request<AuditTrailResponse>('GET', `/workflows/${workflowId}/audit-trail`);
  }

  /**
   * Export audit artifacts for a workflow
   */
  async exportAuditArtifacts(workflowId: string): Promise<{
    success: boolean;
    exportPath: string;
    artifacts: string[];
  }> {
    return this.request('POST', `/workflows/${workflowId}/export-audit`);
  }

  // ============================================
  // Historical Data Endpoints
  // ============================================

  /**
   * Get historical workflows with optional filters
   */
  async getHistoricalWorkflows(params?: {
    state?: WorkflowState;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    workflows: WorkflowInstance[];
    totalCount: number;
    hasMore: boolean;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.state) queryParams.set('state', params.state);
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request('GET', `/historical/workflows${query ? `?${query}` : ''}`);
  }

  // ============================================
  // System Endpoints
  // ============================================

  /**
   * Check API health
   */
  async checkHealth(): Promise<{
    status: string;
    timestamp: string;
    version: string;
    services: Record<string, string>;
  }> {
    return this.request('GET', '/health');
  }

  /**
   * Get API version info
   */
  async getVersion(): Promise<{
    version: string;
    apiVersion: string;
    buildDate: string;
    features: string[];
  }> {
    return this.request('GET', '/version');
  }

  // ============================================
  // Demo Audit Logging
  // ============================================

  /**
   * Log a demo audit event to AUDIT.md
   * Used by frontend during local demo simulation to persist audit trail
   */
  async logDemoAudit(
    workflowId: string,
    eventType: string,
    actor: string,
    details: Record<string, unknown>
  ): Promise<{ message: string; workflowId: string; eventType: string }> {
    return this.request('POST', '/demo/log-audit', {
      workflowId,
      eventType,
      actor,
      details
    });
  }
}

/**
 * Create a singleton API client instance
 */
let apiClientInstance: SentinelFlowApiClient | null = null;

/**
 * Get the API client singleton
 */
export function getApiClient(config?: Partial<ApiConfig>): SentinelFlowApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new SentinelFlowApiClient(config);
  }
  return apiClientInstance;
}

/**
 * Reset the API client singleton (useful for testing)
 */
export function resetApiClient(): void {
  apiClientInstance = null;
}

/**
 * Default export - the API client class
 */
export default SentinelFlowApiClient;
