/**
 * SentinelFlow Demo API Integration Tests
 * Tests for demo mode API endpoints with safety validation
 * Implements Requirements 9.1, 9.3 - Demo API testing
 */

import request from 'supertest';
import express from 'express';
import { DemoModeManager } from '../../demo/DemoModeManager';
import { createDemoRoutes } from '../routes/demo';
import { createSuccessResponse, createErrorResponse } from '../middleware';

describe('Demo API Integration Tests', () => {
  let app: express.Application;
  let demoManager: DemoModeManager;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    demoManager = new DemoModeManager();
    app.use('/api/demo', createDemoRoutes(demoManager));
  });

  afterEach(async () => {
    if (demoManager.isDemo()) {
      await demoManager.deactivateDemoMode();
    }
  });

  describe('GET /api/demo/status', () => {
    test('should return demo status when inactive', async () => {
      const response = await request(app)
        .get('/api/demo/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isActive).toBe(false);
      expect(response.body.data.session).toBeNull();
      expect(response.body.data.config).toBeDefined();
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.demoMode).toBe(true);
    });

    test('should return demo status when active', async () => {
      await demoManager.activateDemoMode();

      const response = await request(app)
        .get('/api/demo/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isActive).toBe(true);
      expect(response.body.data.session).toBeDefined();
      expect(response.body.data.metrics.activeWorkflows).toBe(0);
    });
  });

  describe('POST /api/demo/activate', () => {
    test('should activate demo mode with default scenario', async () => {
      const response = await request(app)
        .post('/api/demo/activate')
        .send({})
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session.sessionId).toBeDefined();
      expect(response.body.data.session.scenarioType).toBe('database-outage');
      expect(response.body.data.session.isActive).toBe(true);
      expect(response.body.data.session.safetyStatus.isolated).toBe(true);
      expect(response.body.data.session.safetyStatus.noExternalActions).toBe(true);
      expect(response.body.data.demoMode).toBe(true);
    });

    test('should activate demo mode with specific scenario', async () => {
      const response = await request(app)
        .post('/api/demo/activate')
        .send({
          scenarioType: 'api-failure',
          enableAutoProgression: true
        })
        .expect(201);

      expect(response.body.data.session.scenarioType).toBe('api-failure');
    });

    test('should activate demo mode with custom scenario', async () => {
      const customScenario = {
        type: 'custom-test',
        name: 'Custom Test Scenario',
        description: 'Test scenario for API validation',
        complexity: 'simple',
        estimatedDuration: '5-10 minutes'
      };

      const response = await request(app)
        .post('/api/demo/activate')
        .send({ customScenario })
        .expect(201);

      expect(response.body.data.session.scenarioName).toBe('Custom Test Scenario');
    });

    test('should prevent activation when already active', async () => {
      await demoManager.activateDemoMode();

      const response = await request(app)
        .post('/api/demo/activate')
        .send({})
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('already active');
    });

    test('should reject production references in scenario', async () => {
      const response = await request(app)
        .post('/api/demo/activate')
        .send({
          scenarioType: 'prod-database-outage'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('production systems');
    });

    test('should validate request body', async () => {
      const response = await request(app)
        .post('/api/demo/activate')
        .send({
          scenarioType: 'invalid-scenario'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/demo/deactivate', () => {
    test('should deactivate active demo mode', async () => {
      await demoManager.activateDemoMode();

      const response = await request(app)
        .post('/api/demo/deactivate')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('deactivated successfully');
    });

    test('should handle deactivation when not active', async () => {
      const response = await request(app)
        .post('/api/demo/deactivate')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/demo/reset', () => {
    test('should reset active demo mode', async () => {
      await demoManager.activateDemoMode({ scenarioType: 'api-failure' });

      const response = await request(app)
        .post('/api/demo/reset')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session.scenarioType).toBe('api-failure');
      expect(response.body.data.demoMode).toBe(true);
    });

    test('should return error when no active session', async () => {
      const response = await request(app)
        .post('/api/demo/reset')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('No active demo session');
    });
  });

  describe('POST /api/demo/simulate-incident', () => {
    beforeEach(async () => {
      await demoManager.activateDemoMode();
    });

    test('should simulate incident successfully', async () => {
      const response = await request(app)
        .post('/api/demo/simulate-incident')
        .send({})
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workflowId).toBeDefined();
      expect(response.body.data.incident).toBeDefined();
      expect(response.body.data.incident.incidentId).toBeDefined();
      expect(response.body.data.incident.type).toBe('database-outage');
      expect(response.body.data.expectedProgression).toBeInstanceOf(Array);
      expect(response.body.data.demoMode).toBe(true);
    });

    test('should prevent simulation when demo mode inactive', async () => {
      await demoManager.deactivateDemoMode();

      const response = await request(app)
        .post('/api/demo/simulate-incident')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not active');
    });

    test('should enforce maximum concurrent workflows', async () => {
      // Update config to limit workflows
      demoManager.updateConfig({ maxConcurrentWorkflows: 1 });

      // First incident should succeed
      await request(app)
        .post('/api/demo/simulate-incident')
        .send({})
        .expect(201);

      // Second incident should fail
      const response = await request(app)
        .post('/api/demo/simulate-incident')
        .send({})
        .expect(429);

      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('POST /api/demo/workflows/:workflowId/simulate-agent-analysis', () => {
    let workflowId: string;

    beforeEach(async () => {
      await demoManager.activateDemoMode();
      const result = await demoManager.simulateIncident();
      workflowId = result.workflowId;
    });

    test('should simulate SRE agent analysis', async () => {
      const response = await request(app)
        .post(`/api/demo/workflows/${workflowId}/simulate-agent-analysis`)
        .send({ agentName: 'sre-agent' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workflowId).toBe(workflowId);
      expect(response.body.data.agentOutput.agentName).toBe('sre-agent');
      expect(response.body.data.agentOutput.skillsUsed).toContain('Datadog');
      expect(response.body.data.demoMode).toBe(true);
    });

    test('should simulate Security agent analysis', async () => {
      const response = await request(app)
        .post(`/api/demo/workflows/${workflowId}/simulate-agent-analysis`)
        .send({ agentName: 'security-agent' })
        .expect(201);

      expect(response.body.data.agentOutput.agentName).toBe('security-agent');
      expect(response.body.data.agentOutput.skillsUsed).toContain('Splunk SIEM');
    });

    test('should simulate Governance agent analysis', async () => {
      const response = await request(app)
        .post(`/api/demo/workflows/${workflowId}/simulate-agent-analysis`)
        .send({ agentName: 'governance-agent' })
        .expect(201);

      expect(response.body.data.agentOutput.agentName).toBe('governance-agent');
      expect(response.body.data.agentOutput.skillsUsed).toContain('Policy Engine');
    });

    test('should reject invalid agent names', async () => {
      const response = await request(app)
        .post(`/api/demo/workflows/${workflowId}/simulate-agent-analysis`)
        .send({ agentName: 'invalid-agent' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid agent name');
    });

    test('should prevent simulation when demo mode inactive', async () => {
      await demoManager.deactivateDemoMode();

      const response = await request(app)
        .post(`/api/demo/workflows/${workflowId}/simulate-agent-analysis`)
        .send({ agentName: 'sre-agent' })
        .expect(400);

      expect(response.body.error.message).toContain('not active');
    });

    test('should handle non-existent workflow', async () => {
      const response = await request(app)
        .post('/api/demo/workflows/non-existent/simulate-agent-analysis')
        .send({ agentName: 'sre-agent' })
        .expect(404);

      expect(response.body.error.code).toBe('WORKFLOW_NOT_FOUND');
    });

    test('should validate request body', async () => {
      const response = await request(app)
        .post(`/api/demo/workflows/${workflowId}/simulate-agent-analysis`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/demo/workflows/:workflowId/simulate-governance', () => {
    let workflowId: string;

    beforeEach(async () => {
      await demoManager.activateDemoMode();
      const result = await demoManager.simulateIncident();
      workflowId = result.workflowId;
    });

    test('should simulate realistic governance scenario', async () => {
      const response = await request(app)
        .post(`/api/demo/workflows/${workflowId}/simulate-governance`)
        .send({ scenarioType: 'realistic' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.governanceScenario.blastRadiusAssessment).toBeDefined();
      expect(response.body.data.governanceScenario.policyConflicts).toBeInstanceOf(Array);
      expect(response.body.data.governanceScenario.recommendedDecision).toMatch(
        /^(approve|approve_with_restrictions|block)$/
      );
      expect(response.body.data.demoMode).toBe(true);
    });

    test('should simulate forced approval scenario', async () => {
      const response = await request(app)
        .post(`/api/demo/workflows/${workflowId}/simulate-governance`)
        .send({ scenarioType: 'approve' })
        .expect(201);

      expect(response.body.data.governanceScenario.recommendedDecision).toBe('approve');
    });

    test('should simulate forced block scenario', async () => {
      const response = await request(app)
        .post(`/api/demo/workflows/${workflowId}/simulate-governance`)
        .send({ scenarioType: 'block' })
        .expect(201);

      expect(response.body.data.governanceScenario.recommendedDecision).toBe('block');
    });

    test('should default to realistic scenario', async () => {
      const response = await request(app)
        .post(`/api/demo/workflows/${workflowId}/simulate-governance`)
        .send({})
        .expect(201);

      expect(response.body.data.governanceScenario.recommendedDecision).toBeDefined();
    });

    test('should reject invalid scenario types', async () => {
      const response = await request(app)
        .post(`/api/demo/workflows/${workflowId}/simulate-governance`)
        .send({ scenarioType: 'invalid' })
        .expect(400);

      expect(response.body.error.message).toContain('Invalid scenario type');
    });
  });

  describe('GET /api/demo/scenarios', () => {
    test('should return available scenarios', async () => {
      const response = await request(app)
        .get('/api/demo/scenarios')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.scenarios).toBeInstanceOf(Array);
      expect(response.body.data.scenarios.length).toBeGreaterThan(0);
      expect(response.body.data.totalCount).toBeGreaterThan(0);
      expect(response.body.data.demoMode).toBe(true);

      const scenario = response.body.data.scenarios[0];
      expect(scenario.type).toBeDefined();
      expect(scenario.name).toBeDefined();
      expect(scenario.description).toBeDefined();
      expect(scenario.complexity).toMatch(/^(simple|moderate|complex)$/);
      expect(scenario.estimatedDuration).toBeDefined();
    });
  });

  describe('GET /api/demo/state-snapshot', () => {
    test('should create state snapshot when active', async () => {
      await demoManager.activateDemoMode();
      await demoManager.simulateIncident();

      const response = await request(app)
        .get('/api/demo/state-snapshot')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.snapshot.sessionId).toBeDefined();
      expect(response.body.data.snapshot.scenario).toBeDefined();
      expect(response.body.data.snapshot.workflows).toBeInstanceOf(Array);
      expect(response.body.data.snapshot.workflows.length).toBe(1);
      expect(response.body.data.demoMode).toBe(true);
    });

    test('should return error when no active session', async () => {
      const response = await request(app)
        .get('/api/demo/state-snapshot')
        .expect(400);

      expect(response.body.error.message).toContain('No active demo session');
    });
  });

  describe('POST /api/demo/restore-snapshot', () => {
    test('should restore from valid snapshot', async () => {
      // Create snapshot
      await demoManager.activateDemoMode();
      await demoManager.simulateIncident();
      const snapshot = demoManager.createStateSnapshot();
      await demoManager.deactivateDemoMode();

      const response = await request(app)
        .post('/api/demo/restore-snapshot')
        .send({ snapshot })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe(snapshot!.sessionId);
      expect(response.body.data.workflowsRestored).toBe(1);
      expect(response.body.data.demoMode).toBe(true);
    });

    test('should reject invalid snapshot structure', async () => {
      const invalidSnapshot = {
        sessionId: 'test'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/demo/restore-snapshot')
        .send({ snapshot: invalidSnapshot })
        .expect(400);

      expect(response.body.error.message).toContain('Invalid snapshot structure');
    });

    test('should validate request body', async () => {
      const response = await request(app)
        .post('/api/demo/restore-snapshot')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/demo/simulation-button', () => {
    test('should return simulation button configuration', async () => {
      const response = await request(app)
        .get('/api/demo/simulation-button')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('demo-simulate-incident');
      expect(response.body.data.label).toBe('Simulate Incident');
      expect(response.body.data.isHidden).toBe(true);
      expect(response.body.data.requiresConfirmation).toBe(true);
      expect(response.body.data.safetyWarning).toContain('simulated incident');
      expect(response.body.data.demoMode).toBe(true);
    });
  });

  describe('POST /api/demo/update-config', () => {
    test('should update demo configuration', async () => {
      const newConfig = {
        maxConcurrentWorkflows: 5,
        enableRealisticTiming: false,
        timingConfig: {
          agentProcessingDelayMs: 1000
        }
      };

      const response = await request(app)
        .post('/api/demo/update-config')
        .send({ config: newConfig })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updatedFields).toContain('maxConcurrentWorkflows');
      expect(response.body.data.demoMode).toBe(true);
    });

    test('should prevent disabling safety constraints', async () => {
      const unsafeConfig = {
        safetyConstraints: {
          noExternalActions: false
        }
      };

      const response = await request(app)
        .post('/api/demo/update-config')
        .send({ config: unsafeConfig })
        .expect(400);

      expect(response.body.error.message).toContain('cannot be disabled');
    });

    test('should validate configuration values', async () => {
      const invalidConfig = {
        maxConcurrentWorkflows: -1
      };

      const response = await request(app)
        .post('/api/demo/update-config')
        .send({ config: invalidConfig })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Safety and Security Validation', () => {
    test('should always include demo mode indicators in responses', async () => {
      await demoManager.activateDemoMode();

      const endpoints = [
        { method: 'get', path: '/api/demo/status' },
        { method: 'get', path: '/api/demo/scenarios' },
        { method: 'get', path: '/api/demo/simulation-button' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method as keyof typeof request](endpoint.path);
        expect(response.body.data.demoMode).toBe(true);
      }
    });

    test('should prevent production references in all inputs', async () => {
      const productionInputs = [
        { scenarioType: 'production-outage' },
        { customScenario: { name: 'Production Test' } }
      ];

      for (const input of productionInputs) {
        const response = await request(app)
          .post('/api/demo/activate')
          .send(input);

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('production');
      }
    });

    test('should enforce safety constraints in all operations', async () => {
      await demoManager.activateDemoMode();
      const result = await demoManager.simulateIncident();

      // Verify incident has no external references
      expect(result.incident.description).not.toMatch(/prod|production|live/i);
      expect(result.incident.affectedServices.every(service => 
        !service.includes('prod') && !service.includes('live')
      )).toBe(true);
    });

    test('should maintain audit trail for all operations', async () => {
      const auditEvents: any[] = [];
      demoManager.on('demoAuditEvent', (event) => auditEvents.push(event));

      await request(app)
        .post('/api/demo/activate')
        .send({})
        .expect(201);

      await request(app)
        .post('/api/demo/simulate-incident')
        .send({})
        .expect(201);

      expect(auditEvents.length).toBeGreaterThan(0);
      auditEvents.forEach(event => {
        expect(event.demoMode).toBe(true);
        expect(event.immutable).toBe(true);
        expect(event.timestamp).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle internal errors gracefully', async () => {
      // Mock an internal error
      jest.spyOn(demoManager, 'activateDemoMode').mockRejectedValueOnce(
        new Error('Internal error')
      );

      const response = await request(app)
        .post('/api/demo/activate')
        .send({})
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    test('should validate all request bodies', async () => {
      const invalidRequests = [
        { endpoint: '/api/demo/activate', body: { scenarioType: 123 } },
        { endpoint: '/api/demo/update-config', body: { config: 'invalid' } },
        { endpoint: '/api/demo/restore-snapshot', body: { snapshot: null } }
      ];

      for (const req of invalidRequests) {
        const response = await request(app)
          .post(req.endpoint)
          .send(req.body);

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.success).toBe(false);
      }
    });

    test('should handle missing route parameters', async () => {
      const response = await request(app)
        .post('/api/demo/workflows//simulate-agent-analysis')
        .send({ agentName: 'sre-agent' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});