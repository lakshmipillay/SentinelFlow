/**
 * SentinelFlow API Request Size Limiting
 * Middleware to prevent DoS attacks through large request payloads
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Request size limit configuration
 */
export interface RequestSizeLimitConfig {
  maxSize: number;           // Maximum size in bytes
  skipOnError?: boolean;     // Continue processing if size check fails
  message?: string;          // Custom error message
  includeHeaders?: boolean;  // Include headers in size calculation
  onLimitExceeded?: (req: Request, size: number, limit: number) => void;
}

/**
 * Create error response helper (local implementation)
 */
function createLocalErrorResponse(code: string, message: string, details?: any) {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };
}

/**
 * Calculate request size in bytes
 */
function calculateRequestSize(req: Request, includeHeaders: boolean = false): number {
  let size = 0;
  
  // Calculate body size
  if (req.body) {
    if (typeof req.body === 'string') {
      size += Buffer.byteLength(req.body, 'utf8');
    } else if (Buffer.isBuffer(req.body)) {
      size += req.body.length;
    } else {
      // For objects, stringify and measure
      try {
        const jsonString = JSON.stringify(req.body);
        size += Buffer.byteLength(jsonString, 'utf8');
      } catch (error) {
        // If can't stringify, estimate based on object complexity
        size += JSON.stringify(req.body || {}).length * 2; // Rough estimate
      }
    }
  }
  
  // Include headers if requested
  if (includeHeaders && req.headers) {
    Object.entries(req.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        size += Buffer.byteLength(key + value, 'utf8');
      } else if (Array.isArray(value)) {
        value.forEach(v => {
          size += Buffer.byteLength(key + v, 'utf8');
        });
      }
    });
  }
  
  // Add URL and method size
  size += Buffer.byteLength(req.url || '', 'utf8');
  size += Buffer.byteLength(req.method || '', 'utf8');
  
  return size;
}

/**
 * Create request size limiting middleware
 */
export function createRequestSizeLimit(config: RequestSizeLimitConfig) {
  const {
    maxSize,
    skipOnError = false,
    message = 'Request payload too large',
    includeHeaders = false,
    onLimitExceeded
  } = config;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const requestSize = calculateRequestSize(req, includeHeaders);
      
      if (requestSize > maxSize) {
        // Call limit exceeded callback
        if (onLimitExceeded) {
          onLimitExceeded(req, requestSize, maxSize);
        }
        
        // Log the violation
        console.warn(`Request size limit exceeded: ${requestSize} bytes (limit: ${maxSize} bytes) for ${req.method} ${req.path}`);
        
        // Return error response
        res.status(413).json(createLocalErrorResponse(
          'REQUEST_TOO_LARGE',
          message,
          {
            requestSize,
            maxSize,
            sizeExceededBy: requestSize - maxSize
          }
        ));
        return;
      }
      
      // Add size info to request for monitoring
      (req as any).requestSize = requestSize;
      
      next();
    } catch (error) {
      console.error('Request size calculation error:', error);
      
      if (skipOnError) {
        next();
      } else {
        res.status(400).json(createLocalErrorResponse(
          'VALIDATION_ERROR',
          'Unable to process request size validation'
        ));
      }
    }
  };
}

/**
 * Predefined request size limits
 */
export const RequestSizeLimits = {
  /**
   * Small requests (basic API calls)
   */
  small: () => createRequestSizeLimit({
    maxSize: 1024, // 1KB
    message: 'Request too large for this endpoint (max 1KB)'
  }),
  
  /**
   * Medium requests (agent outputs, governance decisions)
   */
  medium: () => createRequestSizeLimit({
    maxSize: 10 * 1024, // 10KB
    message: 'Request too large (max 10KB)'
  }),
  
  /**
   * Large requests (audit exports, bulk operations)
   */
  large: () => createRequestSizeLimit({
    maxSize: 100 * 1024, // 100KB
    message: 'Request too large (max 100KB)'
  }),
  
  /**
   * Extra large requests (file uploads, large data imports)
   */
  xlarge: () => createRequestSizeLimit({
    maxSize: 1024 * 1024, // 1MB
    message: 'Request too large (max 1MB)',
    onLimitExceeded: (req, size, limit) => {
      console.warn(`Large request blocked: ${size} bytes from ${req.ip} to ${req.path}`);
    }
  })
};

/**
 * Dynamic request size limiting based on endpoint
 */
export function createDynamicRequestSizeLimit() {
  return (req: Request, res: Response, next: NextFunction): void => {
    let sizeLimit: number;
    
    // Determine size limit based on endpoint
    if (req.path.includes('/agent-outputs')) {
      sizeLimit = 50 * 1024; // 50KB for agent outputs
    } else if (req.path.includes('/governance')) {
      sizeLimit = 10 * 1024; // 10KB for governance decisions
    } else if (req.path.includes('/export-audit')) {
      sizeLimit = 5 * 1024; // 5KB for audit export requests
    } else if (req.path.includes('/workflows') && req.method === 'POST') {
      sizeLimit = 2 * 1024; // 2KB for workflow creation
    } else {
      sizeLimit = 10 * 1024; // 10KB default
    }
    
    // Apply the size limit
    const middleware = createRequestSizeLimit({
      maxSize: sizeLimit,
      message: `Request too large for ${req.path} (max ${Math.round(sizeLimit / 1024)}KB)`
    });
    
    middleware(req, res, next);
  };
}

/**
 * Request size monitoring middleware
 */
export function requestSizeMonitor() {
  const sizeStats = {
    totalRequests: 0,
    totalSize: 0,
    maxSize: 0,
    averageSize: 0,
    largeRequests: 0 // Requests over 10KB
  };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const requestSize = calculateRequestSize(req, true);
      
      // Update statistics
      sizeStats.totalRequests++;
      sizeStats.totalSize += requestSize;
      sizeStats.maxSize = Math.max(sizeStats.maxSize, requestSize);
      sizeStats.averageSize = sizeStats.totalSize / sizeStats.totalRequests;
      
      if (requestSize > 10 * 1024) {
        sizeStats.largeRequests++;
      }
      
      // Add stats to request for potential logging
      (req as any).sizeStats = { ...sizeStats };
      (req as any).requestSize = requestSize;
      
      // Log large requests
      if (requestSize > 50 * 1024) {
        console.info(`Large request detected: ${requestSize} bytes for ${req.method} ${req.path}`);
      }
      
      next();
    } catch (error) {
      console.error('Request size monitoring error:', error);
      next();
    }
  };
}

/**
 * Get current size statistics
 */
export function getRequestSizeStats() {
  // This would typically be stored in a shared location
  // For now, return a placeholder
  return {
    totalRequests: 0,
    totalSize: 0,
    maxSize: 0,
    averageSize: 0,
    largeRequests: 0
  };
}