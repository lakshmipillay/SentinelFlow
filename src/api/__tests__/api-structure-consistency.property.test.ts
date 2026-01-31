/**
 * Property-Based Tests for API Structure Consistency
 * **Property 32: API Structure Consistency**
 * **Validates: Requirements 13.1, 13.5**
 * 
 * Tests that all API responses follow consistent structure patterns
 * regardless of endpoint, data content, or success/failure status.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import request from 'supertest';
import express, { Router } from 'express';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { GovernanceGateService } from '../../services/GovernanceGateService';
import { WorkflowState } from '../../types/workflow';
import { ApiErrorCode } from '../types';
import { createSuccessResponse, createErrorResponse } from '../middleware';
import { createWorkflowRoutes } from '../routes/workflows';
import { createGovernanceRoutes } from '../routes/governance';

/**
 * Create a minimal API router without rate limiting for testing
 */
function createTestApiRouter(stateManager: WorkflowStateManager, governanceGate: GovernanceGateService): Router {
  const router = Router();
  
  // Mount routes without rate limiting
  router.use('/workflows', createWorkflowRoutes(stateManager));
  router.use('/governance', createGovernanceRoutes(governanceGate));
  
  // 404 handler
  router.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: ApiErrorCode.ENDPOINT_NOT_FOUND,
        message: `API endpoint ${req.method} ${req.originalUrl} not found`
      },
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });
  
  return router;
}

describe('Property 32: API Structure Consistency', () => {
  let app: express.Application;
  let stateManager: WorkflowStateManager;
  let governanceGate: GovernanceGateService;

  beforeEach(() => {
    stateManager = new WorkflowStateManager();
    governanceGate = new GovernanceGateService(stateManager);
    
    app = express();
    app.use(express.json());
    // Use test router without rate limiting
    app.use('/api', createTestApiRouter(stateManager, governanceGate));
  });

  /**
   * Validate that a response has the expected API structure
   */
  const validateApiResponseStructure = (response: any): void => {
    expect(response.body).toBeDefined();
    expect(typeof response.body).toBe('object');
    expect(response.body).toHaveProperty('success');
    expect(typeof response.body.success).toBe('boolean');
    
    // Success responses should have data
    if (response.body.success === true) {
      expect(response.body).toHaveProperty('data');
    }
    
    // Error responses should have error object
    if (response.body.success === false) {
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    }
  };

  /**
   * Validate HTTP status code consistency with response body
   */
  const validateStatusConsistency = (response: any): void => {
    const { status, body } = response;
    
    if (status >= 200 && status < 300) {
      expect(body.success).toBe(true);
    } else if (status >= 400 && status < 600) {
      expect(body.success).toBe(false);
    }
  };

  test('GET endpoints return consistent response structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/api/workflows',
          '/api/governance/requests/pending',
          '/api/governance/stats'
        ),
        async (path) => {
          const response = await request(app).get(path);
          
          // Validate structure
          validateApiResponseStructure(response);
          validateStatusConsistency(response);
          
          // These endpoints should succeed
          expect(response.body.success).toBe(true);
          expect(response.body).toHaveProperty('data');
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Error responses follow consistent structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/api/workflows/non-existent-id',
          '/api/non-existent-endpoint',
          '/api/governance/requests/invalid-id'
        ),
        async (path) => {
          const response = await request(app).get(path);
          
          // Validate structure
          validateApiResponseStructure(response);
          validateStatusConsistency(response);
          
          // These endpoints should fail
          expect(response.body.success).toBe(false);
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toHaveProperty('code');
          expect(response.body.error).toHaveProperty('message');
        }
      ),
      { numRuns: 20 }
    );
  });

  test('HTTP status codes match success flag', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          { path: '/api/workflows', expectSuccess: true },
          { path: '/api/governance/stats', expectSuccess: true },
          { path: '/api/workflows/invalid-id', expectSuccess: false },
          { path: '/api/non-existent', expectSuccess: false }
        ),
        async (endpoint) => {
          const response = await request(app).get(endpoint.path);
          
          // Validate status code matches success flag
          if (endpoint.expectSuccess) {
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(300);
            expect(response.body.success).toBe(true);
          } else {
            expect(response.status).toBeGreaterThanOrEqual(400);
            expect(response.body.success).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Error codes are from valid ApiErrorCode enum', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/api/workflows/invalid-uuid',
          '/api/non-existent-endpoint',
          '/api/governance/requests/bad-id'
        ),
        async (path) => {
          const response = await request(app).get(path);
          
          // Should be an error
          expect(response.body.success).toBe(false);
          expect(response.body.error).toBeDefined();
          
          // Error code should be a valid enum value
          const validErrorCodes = Object.values(ApiErrorCode);
          expect(validErrorCodes).toContain(response.body.error.code);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Workflow list response has consistent data types', async () => {
    // First create some workflows
    await stateManager.createWorkflow();
    await stateManager.createWorkflow();
    
    await fc.assert(
      fc.asyncProperty(
        fc.constant('/api/workflows'),
        async (path) => {
          const response = await request(app).get(path);
          
          validateApiResponseStructure(response);
          expect(response.body.success).toBe(true);
          
          const data = response.body.data;
          expect(data).toHaveProperty('workflows');
          expect(data).toHaveProperty('totalCount');
          expect(Array.isArray(data.workflows)).toBe(true);
          expect(typeof data.totalCount).toBe('number');
          
          // Each workflow should have consistent structure
          data.workflows.forEach((workflow: any) => {
            expect(typeof workflow.workflowId).toBe('string');
            expect(Object.values(WorkflowState)).toContain(workflow.currentState);
          });
        }
      ),
      { numRuns: 10 }
    );
  });
});
