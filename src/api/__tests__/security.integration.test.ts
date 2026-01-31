/**
 * SentinelFlow API Security Integration Tests
 * End-to-end security validation tests
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { GovernanceGateService } from '../../services/GovernanceGateService';
import { createApiRouter } from '../index';

describe('API Security Integration Tests', () => {
  let app: express.Application;
  let stateManager: WorkflowStateManager;
  let governanceGate: GovernanceGateService;

  beforeEach(() => {
    // Create test dependencies
    stateManager = new WorkflowStateManager();
    governanceGate = new GovernanceGateService();

    // Create Express app with API router
    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api', createApiRouter({ stateManager, governanceGate }));

    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Security Headers', () => {
    test('should include security headers in all responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['x-powered-by']).toBe('SentinelFlow');
    });

    test('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/workflows')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    test('should validate workflow creation with proper schema', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .send({
          description: 'Test workflow',
          priority: 'high'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.workflowId).toBeDefined();
    });

    test('should reject workflow creation with invalid priority', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .send({
          description: 'Test workflow',
          priority: 'invalid-priority'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.validationErrors).toBeDefined();
    });

    test('should validate UUID format in parameters', async () => {
      const response = await request(app)
        .get('/api/workflows/invalid-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should sanitize HTML in input', async () => {
      // First create a workflow
      const createResponse = await request(app)
        .post('/api/workflows')
        .send({})
        .expect(201);

      const workflowId = createResponse.body.data.workflowId;

      // Try to terminate with malicious input
      const response = await request(app)
        .post(`/api/workflows/${workflowId}/terminate`)
        .send({
          reason: '<script>alert("xss")</script>Security test termination reason'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // The reason should be sanitized (HTML tags removed)
      expect(response.body.data.workflow.terminationReason).not.toContain('<script>');
      expect(response.body.data.workflow.terminationReason).toContain('Security test termination reason');
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting to workflow creation', async () => {
      // Make multiple requests quickly
      const requests = Array.from({ length: 12 }, () =>
        request(app).post('/api/workflows').send({})
      );

      const responses = await Promise.all(requests);

      // Some requests should succeed, others should be rate limited
      const successCount = responses.filter(r => r.status === 201).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBeGreaterThan(0);
      expect(rateLimitedCount).toBeGreaterThan(0);
      expect(successCount + rateLimitedCount).toBe(12);
    });

    test('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/workflows')
        .expect(200);

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('Request Size Limiting', () => {
    test('should reject oversized requests', async () => {
      const largePayload = {
        description: 'x'.repeat(10000), // Very large description
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/workflows')
        .send(largePayload)
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REQUEST_TOO_LARGE');
    });

    test('should allow reasonably sized requests', async () => {
      const normalPayload = {
        description: 'Normal sized description',
        priority: 'medium'
      };

      const response = await request(app)
        .post('/api/workflows')
        .send(normalPayload)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Content-Type Validation', () => {
    test('should require application/json for POST requests', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .set('Content-Type', 'text/plain')
        .send('invalid content')
        .expect(415);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNSUPPORTED_CONTENT_TYPE');
    });

    test('should accept application/json for POST requests', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .set('Content-Type', 'application/json')
        .send('{}')
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling Security', () => {
    test('should not leak sensitive information in error messages', async () => {
      // Try to access non-existent workflow
      const response = await request(app)
        .get('/api/workflows/123e4567-e89b-12d3-a456-426614174000')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(response.body.error.message).toBe('The requested resource was not found');
      // Should not contain internal details
      expect(response.body.error.message).not.toContain('database');
      expect(response.body.error.message).not.toContain('internal');
    });

    test('should handle validation errors securely', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .send({
          priority: 'invalid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.validationErrors).toBeDefined();
      
      // Should provide helpful validation details without exposing internals
      const validationErrors = response.body.error.details.validationErrors;
      expect(Array.isArray(validationErrors)).toBe(true);
      expect(validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Governance Security', () => {
    test('should validate governance decision with enhanced security', async () => {
      // First create a workflow
      const createResponse = await request(app)
        .post('/api/workflows')
        .send({})
        .expect(201);

      const workflowId = createResponse.body.data.workflowId;

      // Submit governance decision with proper validation
      const response = await request(app)
        .post(`/api/workflows/${workflowId}/governance-decision`)
        .send({
          decision: 'approve',
          rationale: 'This is a valid rationale with sufficient length for security testing',
          approver: {
            id: 'test-approver',
            role: 'senior-sre',
            name: 'Test Approver'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject governance decision with invalid approver role', async () => {
      // First create a workflow
      const createResponse = await request(app)
        .post('/api/workflows')
        .send({})
        .expect(201);

      const workflowId = createResponse.body.data.workflowId;

      // Try to submit with invalid role
      const response = await request(app)
        .post(`/api/workflows/${workflowId}/governance-decision`)
        .send({
          decision: 'approve',
          rationale: 'Valid rationale with sufficient length',
          approver: {
            id: 'test-approver',
            role: 'invalid-role'
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should sanitize governance decision inputs', async () => {
      // First create a workflow
      const createResponse = await request(app)
        .post('/api/workflows')
        .send({})
        .expect(201);

      const workflowId = createResponse.body.data.workflowId;

      // Submit with potentially malicious input
      const response = await request(app)
        .post(`/api/workflows/${workflowId}/governance-decision`)
        .send({
          decision: 'approve',
          rationale: '<script>alert("xss")</script>This is a valid rationale with sufficient length',
          approver: {
            id: 'test-approver',
            role: 'senior-sre'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Rationale should be sanitized
      expect(response.body.data.governanceDecision.rationale).not.toContain('<script>');
      expect(response.body.data.governanceDecision.rationale).toContain('This is a valid rationale');
    });
  });

  describe('Audit Security', () => {
    test('should secure audit trail access', async () => {
      // First create a workflow
      const createResponse = await request(app)
        .post('/api/workflows')
        .send({})
        .expect(201);

      const workflowId = createResponse.body.data.workflowId;

      // Access audit trail
      const response = await request(app)
        .get(`/api/workflows/${workflowId}/audit-trail`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.auditTrail).toBeDefined();
      
      // Audit trail should not contain sensitive internal data
      const auditTrail = response.body.data.auditTrail;
      auditTrail.forEach((event: any) => {
        expect(event).not.toHaveProperty('internalId');
        expect(event).not.toHaveProperty('systemPassword');
        expect(event).not.toHaveProperty('secretKey');
      });
    });

    test('should validate audit export requests', async () => {
      // First create a workflow
      const createResponse = await request(app)
        .post('/api/workflows')
        .send({})
        .expect(201);

      const workflowId = createResponse.body.data.workflowId;

      // Valid export request
      const response = await request(app)
        .post(`/api/workflows/${workflowId}/export-audit`)
        .send({
          format: 'json',
          includeContext: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject invalid audit export format', async () => {
      // First create a workflow
      const createResponse = await request(app)
        .post('/api/workflows')
        .send({})
        .expect(201);

      const workflowId = createResponse.body.data.workflowId;

      // Invalid export request
      const response = await request(app)
        .post(`/api/workflows/${workflowId}/export-audit`)
        .send({
          format: 'invalid-format',
          includeContext: true
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('System Endpoint Security', () => {
    test('should provide secure health check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.security).toBeDefined();
      expect(response.body.data.security.rateLimitingActive).toBe(true);
      expect(response.body.data.security.inputValidationActive).toBe(true);
      expect(response.body.data.security.securityHeadersActive).toBe(true);
    });

    test('should provide secure version information', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.features).toContain('enhanced-security');
      expect(response.body.data.features).toContain('input-validation');
      expect(response.body.data.features).toContain('rate-limiting');
      expect(response.body.data.security).toBeDefined();
    });
  });

  describe('Attack Prevention', () => {
    test('should detect and log suspicious requests', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Try path traversal attack
      await request(app)
        .get('/api/../../../etc/passwd')
        .expect(404);

      // Try XSS in URL
      await request(app)
        .get('/api/workflows/<script>alert("xss")</script>')
        .expect(404);

      // Try SQL injection pattern
      await request(app)
        .get('/api/workflows/SELECT * FROM users')
        .expect(404);

      // Should have logged suspicious activity
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Suspicious request detected')
      );

      consoleSpy.mockRestore();
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      // Should not expose internal JSON parsing errors
      expect(response.body.error.message).not.toContain('SyntaxError');
      expect(response.body.error.message).not.toContain('JSON.parse');
    });
  });
});