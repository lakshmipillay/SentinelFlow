/**
 * SentinelFlow API Integration Tests
 * Comprehensive tests for all structured API endpoints
 */

import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { GovernanceGateService } from '../../services/GovernanceGateService';
import { createApiRouter } from '../index';
import { WorkflowState } from '../../types/workflow';
import { AgentName } from '../../types/agent-skills';

describe('SentinelFlow API Integration Tests', () => {
  let app: express.Application;
  let stateManager: WorkflowStateManager;
  let governanceGate: GovernanceGateService;

  beforeEach(() => {
    stateManager = new WorkflowStateManager();
    governanceGate = new GovernanceGateService(stateManager);
    
    app = express();
    app.use(express.json());
    app.use('/api', createApiRouter({ stateManager, governanceGate }));
  });

  describe('System Endpoints', () => {
    test('GET /api/health should return system health', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services).toEqual({
        stateManager: 'operational',
        governanceGate: 'operational',
        auditService: 'operational'
      });
    });

    test('GET /api/version should return version info', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.features).toContain('workflow-management');
    });
  });

  describe('Workflow Management Endpoints', () => {
    test('POST /api/workflows should create new workflow', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workflowId).toBeDefined();
      expect(response.body.data.currentState).toBe(WorkflowState.IDLE);
    });

    test('GET /api/workflows should list all workflows', async () => {
      // Create a workflow first
      const workflow = await stateManager.createWorkflow();

      const response = await request(app)
        .get('/api/workflows')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workflows).toHaveLength(1);
      expect(response.body.data.totalCount).toBe(1);
    });

    test('GET /api/workflows/:workflowId should return specific workflow', async () => {
      const workflow = await stateManager.createWorkflow();

      const response = await request(app)
        .get(`/api/workflows/${workflow.workflowId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workflow.workflowId).toBe(workflow.workflowId);
    });

    test('GET /api/workflows/:workflowId should return 404 for non-existent workflow', async () => {
      const response = await request(app)
        .get('/api/workflows/non-existent-id')
        .expect(400); // Invalid UUID format

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('PUT /api/workflows/:workflowId/state should transition workflow state', async () => {
      const workflow = await stateManager.createWorkflow();
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);

      const response = await request(app)
        .put(`/api/workflows/${workflow.workflowId}/state`)
        .send({ newState: WorkflowState.ANALYZING })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workflow.currentState).toBe(WorkflowState.ANALYZING);
      expect(response.body.data.previousState).toBe(WorkflowState.INCIDENT_INGESTED);
    });

    test('PUT /api/workflows/:workflowId/state should reject invalid state transition', async () => {
      const workflow = await stateManager.createWorkflow();

      const response = await request(app)
        .put(`/api/workflows/${workflow.workflowId}/state`)
        .send({ newState: WorkflowState.RESOLVED })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    test('POST /api/workflows/:workflowId/terminate should terminate workflow', async () => {
      const workflow = await stateManager.createWorkflow();

      const response = await request(app)
        .post(`/api/workflows/${workflow.workflowId}/terminate`)
        .send({ reason: 'Test termination' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workflow.currentState).toBe(WorkflowState.TERMINATED);
    });
  });

  describe('Agent Output Endpoints', () => {
    let workflowId: string;

    beforeEach(async () => {
      const workflow = await stateManager.createWorkflow();
      workflowId = workflow.workflowId;
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
    });

    test('POST /api/workflows/:workflowId/agent-outputs should add agent output', async () => {
      const agentOutput = {
        agentName: 'sre-agent' as AgentName,
        skillsUsed: ['Datadog'],
        findings: {
          summary: 'Database connection issues detected',
          evidence: ['High connection pool usage'],
          correlations: ['Increased response times']
        },
        confidenceLevel: 0.85,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 1500,
          dataSourcesAccessed: ['datadog-metrics'],
          skillsMetadata: {
            availableSkills: ['Datadog', 'CloudWatch'],
            skillsUsedCount: 1,
            skillsValidationPassed: true,
            primarySkillDomain: 'monitoring'
          }
        },
        validation: {
          skillsValid: true,
          confidenceLevelValid: true,
          schemaCompliant: true
        }
      };

      const response = await request(app)
        .post(`/api/workflows/${workflowId}/agent-outputs`)
        .send({ agentOutput })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.agentOutput.agentName).toBe('sre-agent');
    });

    test('GET /api/workflows/:workflowId/agent-outputs should return all agent outputs', async () => {
      // Add an agent output first
      const agentOutput = {
        agentName: 'sre-agent' as AgentName,
        skillsUsed: ['Datadog'],
        findings: {
          summary: 'Test finding',
          evidence: ['Test evidence'],
          correlations: []
        },
        confidenceLevel: 0.8,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 1000,
          dataSourcesAccessed: ['test'],
          skillsMetadata: {
            availableSkills: ['Datadog'],
            skillsUsedCount: 1,
            skillsValidationPassed: true,
            primarySkillDomain: 'monitoring'
          }
        },
        validation: {
          skillsValid: true,
          confidenceLevelValid: true,
          schemaCompliant: true
        }
      };

      await stateManager.addAgentOutput(workflowId, agentOutput);

      const response = await request(app)
        .get(`/api/workflows/${workflowId}/agent-outputs`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.agentOutputs).toHaveLength(1);
      expect(response.body.data.totalOutputs).toBe(1);
    });

    test('GET /api/workflows/:workflowId/agent-outputs/:agentName should return outputs from specific agent', async () => {
      // Add agent outputs
      const sreOutput = {
        agentName: 'sre-agent' as AgentName,
        skillsUsed: ['Datadog'],
        findings: { summary: 'SRE finding', evidence: [], correlations: [] },
        confidenceLevel: 0.8,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 1000,
          dataSourcesAccessed: ['test'],
          skillsMetadata: {
            availableSkills: ['Datadog'],
            skillsUsedCount: 1,
            skillsValidationPassed: true,
            primarySkillDomain: 'monitoring'
          }
        },
        validation: { skillsValid: true, confidenceLevelValid: true, schemaCompliant: true }
      };

      await stateManager.addAgentOutput(workflowId, sreOutput);

      const response = await request(app)
        .get(`/api/workflows/${workflowId}/agent-outputs/sre-agent`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.agentName).toBe('sre-agent');
      expect(response.body.data.agentOutputs).toHaveLength(1);
    });

    test('GET /api/workflows/:workflowId/analysis-summary should return analysis summary', async () => {
      const response = await request(app)
        .get(`/api/workflows/${workflowId}/analysis-summary`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.analysisComplete).toBe(false);
    });
  });

  describe('Governance Endpoints', () => {
    let workflowId: string;
    let requestId: string;

    beforeEach(async () => {
      const workflow = await stateManager.createWorkflow();
      workflowId = workflow.workflowId;
      
      // Set up workflow for governance
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      // Create governance request
      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Restart database service',
        {
          affectedServices: ['database'],
          riskLevel: 'medium' as const,
          reversible: true,
          impactDescription: 'Brief service interruption',
          dependencyAnalysis: {
            directDependencies: ['api-service'],
            cascadeRisk: 'low' as const,
            criticalPath: false,
            totalPotentialImpact: 2
          },
          riskFactors: {
            confidenceLevel: 0.8,
            serviceCount: 1,
            actionType: 'restart',
            businessHoursImpact: false,
            criticalServicesAffected: []
          }
        },
        [],
        {
          incidentSummary: 'Database connection issues',
          agentFindings: ['High connection pool usage'],
          correlationSummary: 'Multiple agents identified database issues',
          confidenceLevel: 0.85
        }
      );
      requestId = request.requestId;
    });

    test('GET /api/governance/requests/:requestId should return governance request', async () => {
      const response = await request(app)
        .get(`/api/governance/requests/${requestId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requestId).toBe(requestId);
      expect(response.body.data.workflowId).toBe(workflowId);
    });

    test('GET /api/governance/requests/:requestId/approval-interface should return approval interface', async () => {
      const response = await request(app)
        .get(`/api/governance/requests/${requestId}/approval-interface`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.approvalOptions).toBeDefined();
      expect(response.body.data.requiredFields).toBeDefined();
    });

    test('POST /api/governance/requests/:requestId/decision should submit governance decision', async () => {
      const decision = {
        decision: 'approve',
        rationale: 'Risk is acceptable and action is reversible',
        approver: {
          id: 'test-approver',
          role: 'senior-sre'
        }
      };

      const response = await request(app)
        .post(`/api/governance/requests/${requestId}/decision`)
        .send(decision)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.governanceDecision.decision).toBe('approve');
    });

    test('GET /api/governance/requests/pending should return pending requests', async () => {
      const response = await request(app)
        .get('/api/governance/requests/pending')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalPending).toBeGreaterThan(0);
      expect(response.body.data.requests).toBeInstanceOf(Array);
    });

    test('GET /api/governance/stats should return governance statistics', async () => {
      const response = await request(app)
        .get('/api/governance/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Audit Endpoints', () => {
    let workflowId: string;

    beforeEach(async () => {
      const workflow = await stateManager.createWorkflow();
      workflowId = workflow.workflowId;
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
    });

    test('GET /api/workflows/:workflowId/audit-trail should return audit trail', async () => {
      const response = await request(app)
        .get(`/api/workflows/${workflowId}/audit-trail`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.auditTrail).toBeInstanceOf(Array);
      expect(response.body.data.totalEvents).toBeGreaterThan(0);
    });

    test('GET /api/workflows/:workflowId/audit-chain should return audit chain with integrity', async () => {
      const response = await request(app)
        .get(`/api/workflows/${workflowId}/audit-chain`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.auditChain).toBeInstanceOf(Array);
      expect(response.body.data.chainIntegrity).toBeDefined();
      expect(response.body.data.chainIntegrity.valid).toBe(true);
    });

    test('GET /api/workflows/:workflowId/audit-metrics should return audit metrics', async () => {
      const response = await request(app)
        .get(`/api/workflows/${workflowId}/audit-metrics`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.metrics.totalEvents).toBeGreaterThan(0);
    });

    test('POST /api/workflows/:workflowId/export-audit should export audit artifacts', async () => {
      const response = await request(app)
        .post(`/api/workflows/${workflowId}/export-audit`)
        .send({ format: 'json', includeContext: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exportId).toBeDefined();
      expect(response.body.data.downloadUrl).toBeDefined();
    });
  });

  describe('Historical Data Endpoints', () => {
    beforeEach(async () => {
      // Create some historical workflows
      const workflow1 = await stateManager.createWorkflow();
      const workflow2 = await stateManager.createWorkflow();
      
      await stateManager.transitionTo(workflow1.workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflow2.workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflow2.workflowId, WorkflowState.ANALYZING);
    });

    test('GET /api/historical/workflows should return historical workflows', async () => {
      const response = await request(app)
        .get('/api/historical/workflows')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workflows).toBeInstanceOf(Array);
      expect(response.body.data.totalCount).toBeGreaterThan(0);
      expect(response.body.data.pagination).toBeDefined();
    });

    test('GET /api/historical/workflows with filtering should filter by state', async () => {
      const response = await request(app)
        .get('/api/historical/workflows?state=ANALYZING')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workflows.every((w: any) => w.currentState === 'ANALYZING')).toBe(true);
    });

    test('GET /api/historical/workflows/stats should return workflow statistics', async () => {
      const response = await request(app)
        .get('/api/historical/workflows/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalWorkflows).toBeGreaterThan(0);
      expect(response.body.data.workflowsByState).toBeDefined();
    });

    test('GET /api/historical/analytics/trends should return workflow trends', async () => {
      const response = await request(app)
        .get('/api/historical/analytics/trends?period=7d')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toBe('7d');
      expect(response.body.data.workflowVolume).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ENDPOINT_NOT_FOUND');
    });

    test('should validate request parameters', async () => {
      const response = await request(app)
        .get('/api/workflows/invalid-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/workflows/test-id/agent-outputs')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});