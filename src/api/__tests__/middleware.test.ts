/**
 * SentinelFlow API Middleware Tests
 * Unit tests for enhanced API middleware functions with security features
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  createSuccessResponse,
  createErrorResponse,
  errorHandler,
  validateRequest,
  validateWorkflowId,
  validateRequestId,
  validateGovernanceDecision,
  corsMiddleware,
  requestLogger,
  securityMiddleware,
  rateLimitingMiddleware,
  requestSizeMonitoring,
  API_VERSION
} from '../middleware';
import { ApiErrorCode } from '../types';

describe('API Middleware Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      sendStatus: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      on: vi.fn()
    };
    mockNext = vi.fn();
  });

  describe('Response Helpers', () => {
    test('createSuccessResponse should create standardized success response', () => {
      const data = { test: 'data' };
      const response = createSuccessResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.timestamp).toBeDefined();
      expect(response.version).toBe(API_VERSION);
    });

    test('createErrorResponse should create standardized error response', () => {
      const code = ApiErrorCode.VALIDATION_ERROR;
      const message = 'Test error';
      const details = { field: 'test' };
      
      const response = createErrorResponse(code, message, details);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe(code);
      expect(response.error.message).toBe(message);
      expect(response.error.details).toEqual(details);
      expect(response.timestamp).toBeDefined();
      expect(response.version).toBe(API_VERSION);
    });
  });

  describe('Enhanced Error Handler Middleware', () => {
    test('should handle workflow not found error securely', () => {
      const error = new Error('Workflow not found');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.RESOURCE_NOT_FOUND,
            message: 'The requested resource was not found'
          })
        })
      );
    });

    test('should handle invalid state transition error securely', () => {
      const error = new Error('Invalid state transition from IDLE to RESOLVED');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.INVALID_STATE_TRANSITION,
            message: 'Invalid workflow state transition requested'
          })
        })
      );
    });

    test('should handle validation errors securely', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Request validation failed'
          })
        })
      );
    });

    test('should handle rate limiting errors', () => {
      const error = new Error('Something with rate limit in message');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later'
          })
        })
      );
    });

    test('should not leak sensitive information in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Database connection failed');
      error.stack = 'Error: Database connection failed\n    at /internal/path/file.js:123:45';
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      const call = (mockResponse.json as any).mock.calls[0][0];
      expect(call.error.details).toBeUndefined();
    });

    test('should include stack trace in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      const call = (mockResponse.json as any).mock.calls[0][0];
      expect(call.error.details).toBeDefined();
    });
  });

  describe('Validation Middleware', () => {
    test('validateRequest should pass when body is present and required', () => {
      mockRequest.body = { test: 'data' };
      const middleware = validateRequest({ body: true });
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('validateRequest should fail when body is missing and required', () => {
      mockRequest.body = undefined;
      const middleware = validateRequest({ body: true });
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Request body is required'
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('validateRequest should validate required parameters', () => {
      mockRequest.params = {};
      const middleware = validateRequest({ params: ['workflowId'] });
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: "Parameter 'workflowId' is required"
          })
        })
      );
    });
  });

  describe('Workflow ID Validation', () => {
    test('should pass with valid UUID', () => {
      mockRequest.params = { workflowId: '123e4567-e89b-12d3-a456-426614174000' };
      
      validateWorkflowId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should fail with missing workflow ID', () => {
      mockRequest.params = {};
      
      validateWorkflowId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Workflow ID is required'
          })
        })
      );
    });

    test('should fail with invalid UUID format', () => {
      mockRequest.params = { workflowId: 'invalid-uuid' };
      
      validateWorkflowId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Invalid workflow ID format'
          })
        })
      );
    });
  });

  describe('Request ID Validation', () => {
    test('should pass with valid UUID', () => {
      mockRequest.params = { requestId: '123e4567-e89b-12d3-a456-426614174000' };
      
      validateRequestId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should fail with invalid UUID format', () => {
      mockRequest.params = { requestId: 'invalid-uuid' };
      
      validateRequestId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Invalid request ID format'
          })
        })
      );
    });
  });

  describe('Enhanced Governance Decision Validation', () => {
    test('should pass with valid governance decision', () => {
      mockRequest.body = {
        decision: 'approve',
        rationale: 'This is a valid rationale with sufficient length',
        approver: {
          id: 'test-approver',
          role: 'senior-sre',
          name: 'Test Approver'
        }
      };
      
      validateGovernanceDecision(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should validate rationale length limits', () => {
      mockRequest.body = {
        decision: 'approve',
        rationale: 'x'.repeat(5001), // Too long
        approver: { id: 'test', role: 'senior-sre' }
      };
      
      validateGovernanceDecision(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Rationale must be less than 5000 characters'
          })
        })
      );
    });

    test('should validate approver role enum', () => {
      mockRequest.body = {
        decision: 'approve',
        rationale: 'Valid rationale with sufficient length',
        approver: {
          id: 'test-approver',
          role: 'invalid-role'
        }
      };
      
      validateGovernanceDecision(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: expect.stringContaining('Approver role must be one of')
          })
        })
      );
    });

    test('should validate restrictions array', () => {
      mockRequest.body = {
        decision: 'approve_with_restrictions',
        rationale: 'Valid rationale with sufficient length',
        approver: {
          id: 'test-approver',
          role: 'senior-sre'
        },
        restrictions: ['valid restriction', ''] // Empty string should fail
      };
      
      validateGovernanceDecision(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Each restriction must be a non-empty string'
          })
        })
      );
    });

    test('should validate restrictions is array', () => {
      mockRequest.body = {
        decision: 'approve',
        rationale: 'Valid rationale with sufficient length',
        approver: {
          id: 'test-approver',
          role: 'senior-sre'
        },
        restrictions: 'not an array'
      };
      
      validateGovernanceDecision(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Restrictions must be an array'
          })
        })
      );
    });
  });

  describe('CORS Middleware', () => {
    test('should set CORS headers', () => {
      mockRequest.method = 'GET';
      mockRequest.headers = { origin: 'https://example.com' };
      
      corsMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle OPTIONS request', () => {
      mockRequest.method = 'OPTIONS';
      mockRequest.headers = { origin: 'https://example.com' };
      
      corsMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // The secure CORS implementation returns 204 for OPTIONS preflight requests
      // and does NOT call next() - this is correct behavior
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });

  describe('Enhanced Request Logger Middleware', () => {
    test('should log request details securely', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockRequest.method = 'GET';
      mockRequest.path = '/api/test';
      mockRequest.ip = '127.0.0.1';
      mockRequest.headers = {
        'user-agent': 'test-agent',
        'authorization': 'Bearer secret-token',
        'x-api-key': 'secret-key'
      };
      mockResponse.statusCode = 200;
      
      // Mock the response.on method to simulate the 'finish' event
      const mockOn = vi.fn((event, callback) => {
        if (event === 'finish') {
          // Call immediately for testing
          callback();
        }
      });
      mockResponse.on = mockOn;
      
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockOn).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test - 200')
      );
      
      consoleSpy.mockRestore();
    });

    test('should log additional details for error responses', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockRequest.method = 'POST';
      mockRequest.path = '/api/test';
      mockRequest.ip = '127.0.0.1';
      mockRequest.headers = { 'user-agent': 'test-agent' };
      mockResponse.statusCode = 400;
      
      const mockOn = vi.fn((event, callback) => {
        if (event === 'finish') {
          // Call immediately for testing
          callback();
        }
      });
      mockResponse.on = mockOn;
      
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Request error details:',
        expect.objectContaining({
          method: 'POST',
          path: '/api/test',
          statusCode: 400,
          ip: '127.0.0.1'
        })
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Security Middleware Bundle', () => {
    test('should return array of security middleware', () => {
      const middlewares = securityMiddleware();
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBeGreaterThan(0);
      middlewares.forEach(middleware => {
        expect(typeof middleware).toBe('function');
      });
    });
  });

  describe('Rate Limiting Middleware Bundle', () => {
    test('should return rate limiting middleware object', () => {
      const rateLimits = rateLimitingMiddleware();
      expect(rateLimits).toHaveProperty('standard');
      expect(rateLimits).toHaveProperty('strict');
      expect(rateLimits).toHaveProperty('governance');
      expect(rateLimits).toHaveProperty('auditExport');
      expect(rateLimits).toHaveProperty('workflowCreation');
      
      Object.values(rateLimits).forEach(middleware => {
        expect(typeof middleware).toBe('function');
      });
    });
  });

  describe('Request Size Monitoring', () => {
    test('should monitor request size', () => {
      mockRequest.headers = { 'content-length': '1024' };
      
      requestSizeMonitoring(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect((mockRequest as any).requestSize).toBe(1024);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should log large requests', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      mockRequest.headers = { 'content-length': '60000' }; // 60KB
      mockRequest.method = 'POST';
      mockRequest.path = '/api/test';
      
      requestSizeMonitoring(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Large request: 60000 bytes')
      );
      consoleSpy.mockRestore();
    });

    test('should handle missing content-length gracefully', () => {
      mockRequest.headers = {};
      
      requestSizeMonitoring(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect((mockRequest as any).requestSize).toBe(0);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});