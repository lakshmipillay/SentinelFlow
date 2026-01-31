/**
 * SentinelFlow API Rate Limiting
 * Request rate limiting and abuse prevention
 */

import { Request, Response, NextFunction } from 'express';

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
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  max: number;            // Maximum requests per window
  message?: string;       // Custom error message
  standardHeaders?: boolean; // Send standard rate limit headers
  legacyHeaders?: boolean;   // Send legacy X-RateLimit headers
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean;     // Don't count failed requests
  keyGenerator?: (req: Request) => string; // Custom key generator
  skip?: (req: Request) => boolean;        // Skip rate limiting for certain requests
  onLimitReached?: (req: Request, res: Response) => void; // Callback when limit is reached
}

/**
 * Rate limit store interface
 */
export interface RateLimitStore {
  get(key: string): Promise<{ count: number; resetTime: number } | null>;
  set(key: string, count: number, resetTime: number): Promise<void>;
  increment(key: string, resetTime: number): Promise<{ count: number; resetTime: number }>;
  reset(key: string): Promise<void>;
}

/**
 * In-memory rate limit store
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor(cleanupIntervalMs: number = 60000) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }
  
  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    // Check if entry has expired
    if (Date.now() > entry.resetTime) {
      this.store.delete(key);
      return null;
    }
    
    return entry;
  }
  
  async set(key: string, count: number, resetTime: number): Promise<void> {
    this.store.set(key, { count, resetTime });
  }
  
  async increment(key: string, resetTime: number): Promise<{ count: number; resetTime: number }> {
    const existing = await this.get(key);
    
    if (!existing) {
      const entry = { count: 1, resetTime };
      await this.set(key, 1, resetTime);
      return entry;
    }
    
    const newCount = existing.count + 1;
    const entry = { count: newCount, resetTime: existing.resetTime };
    await this.set(key, newCount, existing.resetTime);
    return entry;
  }
  
  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
  
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

/**
 * Default rate limit store instance
 */
const defaultStore = new MemoryRateLimitStore();

/**
 * Default key generator (uses IP address)
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip || req.connection.remoteAddress || 'unknown';
}

/**
 * Create rate limiting middleware
 */
export function createRateLimit(config: RateLimitConfig, store: RateLimitStore = defaultStore) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later',
    standardHeaders = true,
    legacyHeaders = false,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
    skip,
    onLimitReached
  } = config;
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if configured to do so
    if (skip && skip(req)) {
      return next();
    }
    
    const key = keyGenerator(req);
    const now = Date.now();
    const resetTime = now + windowMs;
    
    try {
      // Get or increment counter
      const result = await store.increment(key, resetTime);
      const { count, resetTime: actualResetTime } = result;
      
      // Set rate limit headers
      if (standardHeaders) {
        res.setHeader('RateLimit-Limit', max);
        res.setHeader('RateLimit-Remaining', Math.max(0, max - count));
        res.setHeader('RateLimit-Reset', new Date(actualResetTime).toISOString());
      }
      
      if (legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
        res.setHeader('X-RateLimit-Reset', Math.ceil(actualResetTime / 1000));
      }
      
      // Check if limit exceeded
      if (count > max) {
        // Call limit reached callback
        if (onLimitReached) {
          onLimitReached(req, res);
        }
        
        // Set retry-after header
        const retryAfter = Math.ceil((actualResetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        
        // Return rate limit error
        res.status(429).json(createLocalErrorResponse(
          'RATE_LIMIT_EXCEEDED',
          message,
          {
            limit: max,
            windowMs,
            retryAfter,
            resetTime: new Date(actualResetTime).toISOString()
          }
        ));
        return;
      }
      
      // Handle response counting
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalSend = res.json;
        res.json = function(body: any) {
          const statusCode = res.statusCode;
          const shouldSkip = 
            (skipSuccessfulRequests && statusCode >= 200 && statusCode < 300) ||
            (skipFailedRequests && statusCode >= 400);
          
          if (shouldSkip) {
            // Decrement counter since we're skipping this request
            store.increment(key, actualResetTime).then(result => {
              const newCount = result.count - 1;
              if (newCount <= 0) {
                store.reset(key);
              } else {
                store.set(key, newCount, actualResetTime);
              }
            });
          }
          
          return originalSend.call(this, body);
        };
      }
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue without rate limiting on store errors
      next();
    }
  };
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  /**
   * Strict rate limiting for sensitive operations
   */
  strict: (store?: RateLimitStore) => createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: 'Too many requests for this sensitive operation'
  }, store),
  
  /**
   * Standard rate limiting for general API usage
   */
  standard: (store?: RateLimitStore) => createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests, please try again later'
  }, store),
  
  /**
   * Governance-specific rate limiting
   */
  governance: (store?: RateLimitStore) => createRateLimit({
    windowMs: 60 * 1000, // 1 minute (reduced from 1 hour for demo)
    max: 50, // Increased for demo mode
    message: 'Too many governance decisions, please wait before submitting more',
    onLimitReached: (req, res) => {
      console.warn(`Governance rate limit exceeded for IP: ${req.ip}`);
    }
  }, store),
  
  /**
   * Audit export rate limiting
   */
  auditExport: (store?: RateLimitStore) => createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Increased for demo mode
    message: 'Too many audit export requests, please wait before requesting more exports'
  }, store),
  
  /**
   * Workflow creation rate limiting
   */
  workflowCreation: (store?: RateLimitStore) => createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 50, // Increased from 10 for demo mode
    message: 'Too many workflow creation requests, please slow down'
  }, store)
};

/**
 * IP-based key generator with user agent fingerprinting
 */
export function enhancedKeyGenerator(req: Request): string {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  // Create a simple hash of user agent for fingerprinting
  let hash = 0;
  for (let i = 0; i < userAgent.length; i++) {
    const char = userAgent.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `${ip}:${hash}`;
}

/**
 * Skip rate limiting for health checks and system endpoints
 */
export function skipSystemEndpoints(req: Request): boolean {
  const systemPaths = ['/health', '/version', '/metrics'];
  return systemPaths.some(path => req.path.includes(path));
}

/**
 * Cleanup function for graceful shutdown
 */
export function cleanup(): void {
  if (defaultStore instanceof MemoryRateLimitStore) {
    defaultStore.destroy();
  }
}