/**
 * SentinelFlow API Middleware
 * Enhanced request validation, security, error handling, and response formatting
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ApiErrorResponse, ApiErrorCode } from './types';
import { createValidationMiddleware, ValidationHelpers } from './validation/validator';
import { securityHeaders, enforceHTTPS, secureCors, validateContentType, validateOrigin } from './security/headers';
import { createRateLimit, RateLimitPresets, enhancedKeyGenerator, skipSystemEndpoints } from './security/rate-limiting';
import { createRequestSizeLimit, RequestSizeLimits, createDynamicRequestSizeLimit } from './security/request-size';

/**
 * API version constant
 */
export const API_VERSION = 'v1.0.0';

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    version: API_VERSION
  };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: ApiErrorCode | string,
  message: string,
  details?: any
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString(),
    version: API_VERSION
  };
}

/**
 * Enhanced error handler middleware with security considerations
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error securely (without sensitive data)
  const sanitizedError = {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  };
  console.error('API Error:', sanitizedError);

  // Handle specific error types with secure responses
  if (error.message.includes('not found')) {
    res.status(404).json(createErrorResponse(
      ApiErrorCode.RESOURCE_NOT_FOUND,
      'The requested resource was not found'
    ));
    return;
  }

  if (error.message.includes('Invalid state transition')) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.INVALID_STATE_TRANSITION,
      'Invalid workflow state transition requested'
    ));
    return;
  }

  if (error.message.includes('Invalid agent output')) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.INVALID_AGENT_OUTPUT,
      'Agent output validation failed'
    ));
    return;
  }

  if (error.message.includes('governance decision')) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.INVALID_GOVERNANCE_DECISION,
      'Governance decision validation failed'
    ));
    return;
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      'Request validation failed',
      process.env.NODE_ENV === 'development' ? error.message : undefined
    ));
    return;
  }

  // Handle rate limiting errors
  if (error.message.includes('rate limit')) {
    res.status(429).json(createErrorResponse(
      'RATE_LIMIT_EXCEEDED',
      'Too many requests, please try again later'
    ));
    return;
  }

  // Default internal server error (no sensitive information leaked)
  res.status(500).json(createErrorResponse(
    ApiErrorCode.INTERNAL_ERROR,
    'An internal server error occurred',
    process.env.NODE_ENV === 'development' ? error.stack : undefined
  ));
}

/**
 * Request validation middleware
 */
export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Basic validation - in production would use a proper validation library like Joi or Zod
    if (schema.body && !req.body) {
      res.status(400).json(createErrorResponse(
        ApiErrorCode.VALIDATION_ERROR,
        'Request body is required'
      ));
      return;
    }

    if (schema.params) {
      for (const param of schema.params) {
        if (!req.params[param]) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            `Parameter '${param}' is required`
          ));
          return;
        }
      }
    }

    next();
  };
}

/**
 * Workflow ID validation middleware
 */
export function validateWorkflowId(req: Request, res: Response, next: NextFunction): void {
  const { workflowId } = req.params;
  
  if (!workflowId) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      'Workflow ID is required'
    ));
    return;
  }

  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // Demo workflow ID format validation (e.g., demo-1769789588000-73wolzmj6)
  const demoIdRegex = /^demo-\d+-[a-z0-9]+$/i;
  
  if (!uuidRegex.test(workflowId) && !demoIdRegex.test(workflowId)) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      'Invalid workflow ID format'
    ));
    return;
  }

  next();
}

/**
 * Request ID validation middleware
 */
export function validateRequestId(req: Request, res: Response, next: NextFunction): void {
  const { requestId } = req.params;
  
  if (!requestId) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      'Request ID is required'
    ));
    return;
  }

  // Basic UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(requestId)) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      'Invalid request ID format'
    ));
    return;
  }

  next();
}

/**
 * Enhanced governance decision validation middleware
 */
export function validateGovernanceDecision(req: Request, res: Response, next: NextFunction): void {
  const { decision, rationale, approver, restrictions } = req.body;

  // Validate decision
  if (!decision) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      'Decision is required'
    ));
    return;
  }

  const validDecisions = ['approve', 'approve_with_restrictions', 'block'];
  if (!validDecisions.includes(decision)) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      `Decision must be one of: ${validDecisions.join(', ')}`
    ));
    return;
  }

  // Validate rationale
  if (!rationale || typeof rationale !== 'string' || rationale.trim().length < 10) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      'Rationale is required and must be at least 10 characters'
    ));
    return;
  }

  if (rationale.length > 5000) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      'Rationale must be less than 5000 characters'
    ));
    return;
  }

  // Validate approver
  if (!approver || typeof approver !== 'object') {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      'Approver information is required'
    ));
    return;
  }

  if (!approver.id || typeof approver.id !== 'string' || approver.id.trim().length === 0) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      'Approver ID is required'
    ));
    return;
  }

  const validRoles = ['senior-sre', 'security-lead', 'compliance-officer', 'engineering-manager'];
  if (!approver.role || !validRoles.includes(approver.role)) {
    res.status(400).json(createErrorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      `Approver role must be one of: ${validRoles.join(', ')}`
    ));
    return;
  }

  // Validate restrictions if present
  if (restrictions !== undefined) {
    if (!Array.isArray(restrictions)) {
      res.status(400).json(createErrorResponse(
        ApiErrorCode.VALIDATION_ERROR,
        'Restrictions must be an array'
      ));
      return;
    }

    for (const restriction of restrictions) {
      if (typeof restriction !== 'string' || restriction.trim().length === 0) {
        res.status(400).json(createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          'Each restriction must be a non-empty string'
        ));
        return;
      }
    }
  }

  next();
}

/**
 * Security middleware bundle - applies all security measures
 */
export function securityMiddleware() {
  return [
    securityHeaders(),
    enforceHTTPS({ trustProxy: true }),
    validateContentType(['application/json']),
    createDynamicRequestSizeLimit()
  ];
}

/**
 * Rate limiting middleware bundle
 */
export function rateLimitingMiddleware() {
  return {
    standard: RateLimitPresets.standard(),
    strict: RateLimitPresets.strict(),
    governance: RateLimitPresets.governance(),
    auditExport: RateLimitPresets.auditExport(),
    workflowCreation: RateLimitPresets.workflowCreation()
  };
}

/**
 * Input sanitization middleware
 */
export function inputSanitization(req: Request, res: Response, next: NextFunction): void {
  // This is handled by the validation middleware with sanitization options
  // This function exists for explicit application where needed
  next();
}

/**
 * Request size monitoring middleware
 */
export function requestSizeMonitoring(req: Request, res: Response, next: NextFunction): void {
  try {
    const contentLength = req.headers['content-length'];
    const requestSize = contentLength ? parseInt(contentLength, 10) : 0;
    
    // Add size info to request
    (req as any).requestSize = requestSize;
    
    // Log large requests
    if (requestSize > 50 * 1024) {
      console.info(`Large request: ${requestSize} bytes for ${req.method} ${req.path}`);
    }
    
    next();
  } catch (error) {
    console.error('Request size monitoring error:', error);
    next();
  }
}

// Export security utilities
export {
  securityHeaders,
  enforceHTTPS,
  secureCors,
  validateContentType,
  validateOrigin,
  createRateLimit,
  RateLimitPresets,
  enhancedKeyGenerator,
  skipSystemEndpoints,
  createRequestSizeLimit,
  RequestSizeLimits,
  createDynamicRequestSizeLimit,
  createValidationMiddleware,
  ValidationHelpers
};

/**
 * Enhanced CORS middleware with security features
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use secure CORS implementation
  const corsHandler = secureCors({
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.ALLOWED_ORIGINS?.split(',') || false
      : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key'
    ],
    credentials: false,
    maxAge: 86400
  });
  
  corsHandler(req, res, next);
}

/**
 * Enhanced request logging middleware with security considerations
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  // Sanitize sensitive headers for logging
  const sanitizedHeaders = { ...req.headers };
  delete sanitizedHeaders.authorization;
  delete sanitizedHeaders['x-api-key'];
  delete sanitizedHeaders.cookie;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const requestSize = (req as any).requestSize || 0;
    
    // Log request details securely
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestSize: requestSize > 0 ? `${requestSize}b` : undefined,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100) // Truncate user agent
    };
    
    console.log(`${logData.method} ${logData.path} - ${logData.statusCode} (${logData.duration})`);
    
    // Log additional details for errors
    if (res.statusCode >= 400) {
      console.warn('Request error details:', logData);
    }
  });
  
  next();
}