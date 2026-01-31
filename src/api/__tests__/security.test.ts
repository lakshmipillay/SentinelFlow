/**
 * SentinelFlow API Security Tests
 * Comprehensive security validation tests for all security features
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  securityHeaders,
  enforceHTTPS,
  secureCors,
  validateContentType,
  validateOrigin
} from '../security/headers';
import {
  createRateLimit,
  RateLimitPresets,
  MemoryRateLimitStore,
  enhancedKeyGenerator,
  skipSystemEndpoints
} from '../security/rate-limiting';
import {
  createRequestSizeLimit,
  RequestSizeLimits,
  createDynamicRequestSizeLimit
} from '../security/request-size';
import { createValidationMiddleware } from '../validation/validator';
import { WorkflowSchemas, GovernanceSchemas } from '../validation/schemas';

describe('API Security Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      ip: '127.0.0.1',
      method: 'GET',
      path: '/api/test',
      headers: {},
      secure: false,
      connection: { remoteAddress: '127.0.0.1' } as any
    };
    mockResponse = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      redirect: vi.fn(),
      end: vi.fn(),
      statusCode: 200
    };
    mockNext = vi.fn();
  });

  describe('Security Headers', () => {
    test('should set all security headers with default config', () => {
      const middleware = securityHeaders();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining("default-src 'self'"));
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Powered-By', 'SentinelFlow');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should set HSTS header only for HTTPS requests', () => {
      mockRequest.secure = true;
      const middleware = securityHeaders();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    });

    test('should not set HSTS header for HTTP requests', () => {
      mockRequest.secure = false;
      const middleware = securityHeaders();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });
  });

  describe('HTTPS Enforcement', () => {
    test('should skip HTTPS enforcement in development', () => {
      process.env.NODE_ENV = 'development';
      const middleware = enforceHTTPS();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.redirect).not.toHaveBeenCalled();
    });

    test('should redirect HTTP to HTTPS in production', () => {
      process.env.NODE_ENV = 'production';
      mockRequest.secure = false;
      mockRequest.headers = { host: 'example.com' };
      mockRequest.originalUrl = '/api/test';

      const middleware = enforceHTTPS();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith(301, 'https://example.com/api/test');
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should allow HTTPS requests in production', () => {
      process.env.NODE_ENV = 'production';
      mockRequest.secure = true;

      const middleware = enforceHTTPS();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.redirect).not.toHaveBeenCalled();
    });
  });

  describe('Content-Type Validation', () => {
    test('should allow GET requests without content-type', () => {
      mockRequest.method = 'GET';
      const middleware = validateContentType();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should require content-type for POST requests', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {};

      const middleware = validateContentType();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'MISSING_CONTENT_TYPE'
          })
        })
      );
    });

    test('should validate content-type for POST requests', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = { 'content-type': 'application/json' };

      const middleware = validateContentType(['application/json']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject invalid content-type', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = { 'content-type': 'text/plain' };

      const middleware = validateContentType(['application/json']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(415);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNSUPPORTED_CONTENT_TYPE'
          })
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      const store = new MemoryRateLimitStore();
      const middleware = createRateLimit({
        windowMs: 60000,
        max: 5
      }, store);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.setHeader).toHaveBeenCalledWith('RateLimit-Limit', 5);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 4);

      store.destroy();
    });

    test('should block requests exceeding rate limit', async () => {
      const store = new MemoryRateLimitStore();
      const middleware = createRateLimit({
        windowMs: 60000,
        max: 1
      }, store);

      // First request should pass
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Reset mocks
      vi.clearAllMocks();

      // Second request should be blocked
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();

      store.destroy();
    });

    test('should use enhanced key generator', () => {
      mockRequest.headers = { 'user-agent': 'test-agent' };
      const key = enhancedKeyGenerator(mockRequest as Request);
      
      expect(key).toContain('127.0.0.1:');
      expect(key).toMatch(/127\.0\.0\.1:-?\d+/);
    });

    test('should skip system endpoints', () => {
      mockRequest.path = '/health';
      expect(skipSystemEndpoints(mockRequest as Request)).toBe(true);

      mockRequest.path = '/version';
      expect(skipSystemEndpoints(mockRequest as Request)).toBe(true);

      mockRequest.path = '/api/workflows';
      expect(skipSystemEndpoints(mockRequest as Request)).toBe(false);
    });
  });

  describe('Request Size Limiting', () => {
    test('should allow small requests', () => {
      mockRequest.body = { test: 'data' };
      const middleware = createRequestSizeLimit({ maxSize: 1024 });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should block oversized requests', () => {
      // Create a large request body
      mockRequest.body = { data: 'x'.repeat(2000) };
      const middleware = createRequestSizeLimit({ 
        maxSize: 1024,
        message: 'Request too large'
      });
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(413);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'REQUEST_TOO_LARGE'
          })
        })
      );
    });

    test('should apply dynamic size limits based on endpoint', () => {
      mockRequest.path = '/api/workflows/123/agent-outputs';
      const middleware = createDynamicRequestSizeLimit();
      
      // This should not throw and should call next for reasonable sized requests
      mockRequest.body = { agentName: 'test', content: {} };
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Input Validation', () => {
    test('should validate workflow creation request', () => {
      mockRequest.body = {
        description: 'Test workflow',
        priority: 'high'
      };

      const middleware = createValidationMiddleware(WorkflowSchemas.createWorkflow);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject invalid workflow state', () => {
      mockRequest.params = { workflowId: '123e4567-e89b-12d3-a456-426614174000' };
      mockRequest.body = { newState: 'INVALID_STATE' };

      const middleware = createValidationMiddleware(WorkflowSchemas.updateWorkflowState);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR'
          })
        })
      );
    });

    test('should validate governance decision', () => {
      mockRequest.params = { workflowId: '123e4567-e89b-12d3-a456-426614174000' };
      mockRequest.body = {
        decision: 'approve',
        rationale: 'This is a valid rationale with sufficient length',
        approver: {
          id: 'test-approver',
          role: 'senior-sre'
        }
      };

      const middleware = createValidationMiddleware(GovernanceSchemas.submitDecision);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject governance decision with invalid role', () => {
      mockRequest.params = { workflowId: '123e4567-e89b-12d3-a456-426614174000' };
      mockRequest.body = {
        decision: 'approve',
        rationale: 'Valid rationale',
        approver: {
          id: 'test-approver',
          role: 'invalid-role'
        }
      };

      const middleware = createValidationMiddleware(GovernanceSchemas.submitDecision);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR'
          })
        })
      );
    });

    test('should sanitize string inputs', () => {
      mockRequest.body = {
        decision: 'approve',
        rationale: '  <script>alert("xss")</script>This is a test rationale  ',
        approver: {
          id: 'test-approver',
          role: 'senior-sre'
        }
      };

      const middleware = createValidationMiddleware(GovernanceSchemas.submitDecision);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should sanitize the rationale
      expect(mockRequest.body.rationale).not.toContain('<script>');
      expect(mockRequest.body.rationale).toContain('This is a test rationale');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('CORS Security', () => {
    test('should handle CORS with security considerations', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';
      mockRequest.headers = { origin: 'https://example.com' };

      const middleware = secureCors();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject unauthorized origins in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://example.com';
      mockRequest.headers = { origin: 'https://malicious.com' };

      const middleware = secureCors();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://malicious.com');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle preflight requests', () => {
      mockRequest.method = 'OPTIONS';
      const middleware = secureCors();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });

  describe('Origin Validation', () => {
    test('should allow requests from allowed origins', () => {
      mockRequest.headers = { origin: 'https://example.com' };
      const middleware = validateOrigin(['https://example.com']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should block requests from unauthorized origins', () => {
      process.env.NODE_ENV = 'production';
      mockRequest.headers = { origin: 'https://malicious.com' };
      const middleware = validateOrigin(['https://example.com']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN_ORIGIN'
          })
        })
      );
    });

    test('should allow requests without origin', () => {
      process.env.NODE_ENV = 'production';
      mockRequest.headers = {};
      const middleware = validateOrigin(['https://example.com']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});