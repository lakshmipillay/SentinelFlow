/**
 * SentinelFlow API Router
 * Main API entry point with enhanced security and validation
 */

import { Router } from 'express';
import { WorkflowStateManager } from '../core/WorkflowStateManager';
import { GovernanceGateService } from '../services/GovernanceGateService';
import { 
  corsMiddleware, 
  requestLogger, 
  errorHandler,
  createSuccessResponse,
  securityMiddleware,
  rateLimitingMiddleware,
  requestSizeMonitoring
} from './middleware';

// Import route modules
import { createWorkflowRoutes } from './routes/workflows';
import { createAgentOutputRoutes } from './routes/agent-outputs';
import { createGovernanceRoutes } from './routes/governance';
import { createAuditRoutes } from './routes/audit';
import { createHistoricalRoutes } from './routes/historical';
import { createDemoRoutes } from './routes/demo';
import { DemoModeManager } from '../demo/DemoModeManager';

export interface ApiDependencies {
  stateManager: WorkflowStateManager;
  governanceGate: GovernanceGateService;
  demoManager?: DemoModeManager;
}

/**
 * Create the main API router with enhanced security and validation
 */
export function createApiRouter(dependencies: ApiDependencies): Router {
  const { stateManager, governanceGate, demoManager } = dependencies;
  const router = Router();

  // Apply security middleware first
  router.use(...securityMiddleware());
  
  // Apply global middleware
  router.use(corsMiddleware);
  router.use(requestSizeMonitoring);
  router.use(requestLogger);

  // Apply standard rate limiting to all routes
  const rateLimits = rateLimitingMiddleware();
  router.use(rateLimits.standard);

  // API health check (with system endpoint rate limit exemption)
  router.get('/health', (req, res) => {
    res.json(createSuccessResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        stateManager: 'operational',
        governanceGate: 'operational',
        auditService: 'operational'
      },
      security: {
        httpsEnforced: process.env.NODE_ENV === 'production',
        rateLimitingActive: true,
        inputValidationActive: true,
        securityHeadersActive: true
      }
    }));
  });

  // API version info
  router.get('/version', (req, res) => {
    res.json(createSuccessResponse({
      version: '1.0.0',
      apiVersion: 'v1',
      buildDate: new Date().toISOString(),
      features: [
        'workflow-management',
        'agent-output-tracking',
        'governance-gate-enforcement',
        'audit-trail-generation',
        'historical-data-access',
        'enhanced-security',
        'input-validation',
        'rate-limiting',
        'request-size-limiting'
      ],
      security: {
        validationEnabled: true,
        rateLimitingEnabled: true,
        securityHeadersEnabled: true,
        httpsEnforcement: process.env.NODE_ENV === 'production'
      }
    }));
  });

  // Mount route modules with appropriate rate limiting
  router.use('/workflows', rateLimits.workflowCreation, createWorkflowRoutes(stateManager));
  router.use('/workflows', createAgentOutputRoutes(stateManager));
  router.use('/workflows', createAuditRoutes(stateManager));
  // Mount governance routes under both /governance and /workflows for compatibility
  router.use('/governance', rateLimits.governance, createGovernanceRoutes(governanceGate));
  router.use('/workflows', rateLimits.governance, createGovernanceRoutes(governanceGate));
  router.use('/historical', createHistoricalRoutes(stateManager));
  
  // Mount demo routes if demo manager is available
  if (demoManager) {
    router.use('/demo', createDemoRoutes(demoManager));
  }

  // 404 handler for API routes with security considerations
  router.use('*', (req, res) => {
    // Log potential scanning attempts
    if (req.path.includes('..') || req.path.includes('<script>') || req.path.includes('SELECT')) {
      console.warn(`Suspicious request detected: ${req.method} ${req.originalUrl} from ${req.ip}`);
    }
    
    res.status(404).json({
      success: false,
      error: {
        code: 'ENDPOINT_NOT_FOUND',
        message: `API endpoint ${req.method} ${req.originalUrl} not found`,
        availableEndpoints: [
          'GET /api/health',
          'GET /api/version',
          'GET /api/workflows',
          'POST /api/workflows',
          'GET /api/workflows/:id',
          'PUT /api/workflows/:id/state',
          'GET /api/workflows/:id/agent-outputs',
          'POST /api/workflows/:id/agent-outputs',
          'GET /api/workflows/:id/audit-trail',
          'POST /api/workflows/:id/export-audit',
          'GET /api/governance/requests/pending',
          'POST /api/governance/requests/:id/decision',
          'GET /api/historical/workflows',
          'GET /api/historical/analytics/trends'
        ]
      },
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // Apply error handling middleware last
  router.use(errorHandler);

  return router;
}

/**
 * API endpoint documentation for reference
 */
export const API_ENDPOINTS = {
  // Workflow Management
  workflows: {
    list: 'GET /api/workflows',
    create: 'POST /api/workflows',
    get: 'GET /api/workflows/:workflowId',
    getState: 'GET /api/workflows/:workflowId/state',
    updateState: 'PUT /api/workflows/:workflowId/state',
    terminate: 'POST /api/workflows/:workflowId/terminate'
  },

  // Agent Output Management
  agentOutputs: {
    list: 'GET /api/workflows/:workflowId/agent-outputs',
    getByAgent: 'GET /api/workflows/:workflowId/agent-outputs/:agentName',
    add: 'POST /api/workflows/:workflowId/agent-outputs',
    getSummary: 'GET /api/workflows/:workflowId/analysis-summary',
    correlate: 'GET /api/workflows/:workflowId/correlate-outputs',
    getStatus: 'GET /api/workflows/:workflowId/parallel-analysis-status'
  },

  // Governance Management
  governance: {
    submitDecision: 'POST /api/workflows/:workflowId/governance-decision',
    getDecision: 'GET /api/workflows/:workflowId/governance-decision',
    getStatus: 'GET /api/workflows/:workflowId/governance-status',
    getRequest: 'GET /api/governance/requests/:requestId',
    getApprovalInterface: 'GET /api/governance/requests/:requestId/approval-interface',
    submitDecisionByRequest: 'POST /api/governance/requests/:requestId/decision',
    getPendingRequests: 'GET /api/governance/requests/pending',
    getStats: 'GET /api/governance/stats'
  },

  // Audit Management
  audit: {
    getTrail: 'GET /api/workflows/:workflowId/audit-trail',
    getChain: 'GET /api/workflows/:workflowId/audit-chain',
    getMetrics: 'GET /api/workflows/:workflowId/audit-metrics',
    exportArtifacts: 'POST /api/workflows/:workflowId/export-audit',
    getSummary: 'GET /api/workflows/:workflowId/audit-summary'
  },

  // Historical Data Access
  historical: {
    getWorkflows: 'GET /api/historical/workflows',
    getStats: 'GET /api/historical/workflows/stats',
    getTimeline: 'GET /api/historical/workflows/:workflowId/timeline',
    getTrends: 'GET /api/historical/analytics/trends'
  },

  // System
  system: {
    health: 'GET /api/health',
    version: 'GET /api/version'
  }
} as const;