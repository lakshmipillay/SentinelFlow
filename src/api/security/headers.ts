/**
 * SentinelFlow API Security Headers
 * Security middleware for HTTP headers and protocol enforcement
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Security header configuration
 */
export interface SecurityHeaderConfig {
  contentSecurityPolicy?: string;
  frameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  contentTypeOptions?: boolean;
  xssProtection?: boolean;
  referrerPolicy?: string;
  strictTransportSecurity?: {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  permissionsPolicy?: string;
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityHeaderConfig = {
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';",
  frameOptions: 'DENY',
  contentTypeOptions: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  permissionsPolicy: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=()'
};

/**
 * Security headers middleware
 */
export function securityHeaders(config: SecurityHeaderConfig = DEFAULT_SECURITY_CONFIG) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Content Security Policy
    if (config.contentSecurityPolicy) {
      res.setHeader('Content-Security-Policy', config.contentSecurityPolicy);
    }
    
    // X-Frame-Options
    if (config.frameOptions) {
      res.setHeader('X-Frame-Options', config.frameOptions);
    }
    
    // X-Content-Type-Options
    if (config.contentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    
    // X-XSS-Protection
    if (config.xssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }
    
    // Referrer-Policy
    if (config.referrerPolicy) {
      res.setHeader('Referrer-Policy', config.referrerPolicy);
    }
    
    // Strict-Transport-Security (HTTPS only)
    if (config.strictTransportSecurity && req.secure) {
      let hstsValue = `max-age=${config.strictTransportSecurity.maxAge}`;
      if (config.strictTransportSecurity.includeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (config.strictTransportSecurity.preload) {
        hstsValue += '; preload';
      }
      res.setHeader('Strict-Transport-Security', hstsValue);
    }
    
    // Permissions-Policy
    if (config.permissionsPolicy) {
      res.setHeader('Permissions-Policy', config.permissionsPolicy);
    }
    
    // Additional security headers
    res.setHeader('X-Powered-By', 'SentinelFlow'); // Custom header instead of default
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    next();
  };
}

/**
 * HTTPS enforcement middleware
 */
export function enforceHTTPS(options: { trustProxy?: boolean } = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip in development and test environments
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !process.env.NODE_ENV) {
      return next();
    }
    
    // Check if request is secure
    const isSecure = options.trustProxy 
      ? req.headers['x-forwarded-proto'] === 'https' || req.secure
      : req.secure;
    
    if (!isSecure) {
      // Redirect to HTTPS
      const httpsUrl = `https://${req.get('host')}${req.originalUrl}`;
      res.redirect(301, httpsUrl);
      return;
    }
    
    next();
  };
}

/**
 * CORS configuration with security considerations
 */
export interface CorsConfig {
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
}

/**
 * Secure CORS middleware
 */
export function secureCors(config: CorsConfig = {}) {
  const defaultConfig: CorsConfig = {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.ALLOWED_ORIGINS?.split(',') || false
      : true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key'
    ],
    credentials: false, // Disable credentials for security
    maxAge: 86400, // 24 hours
    preflightContinue: false
  };
  
  const finalConfig = { ...defaultConfig, ...config };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    
    // Handle origin validation
    if (finalConfig.origin === true) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (typeof finalConfig.origin === 'string') {
      if (origin === finalConfig.origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    } else if (Array.isArray(finalConfig.origin)) {
      if (origin && finalConfig.origin.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }
    
    // Set other CORS headers
    if (finalConfig.methods) {
      res.setHeader('Access-Control-Allow-Methods', finalConfig.methods.join(', '));
    }
    
    if (finalConfig.allowedHeaders) {
      res.setHeader('Access-Control-Allow-Headers', finalConfig.allowedHeaders.join(', '));
    }
    
    if (finalConfig.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    if (finalConfig.maxAge) {
      res.setHeader('Access-Control-Max-Age', finalConfig.maxAge.toString());
    }
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      if (finalConfig.preflightContinue) {
        next();
      } else {
        res.status(204).end();
      }
      return;
    }
    
    next();
  };
}

/**
 * Content-Type validation middleware
 */
export function validateContentType(allowedTypes: string[] = ['application/json']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip for GET requests and OPTIONS
    if (req.method === 'GET' || req.method === 'OPTIONS') {
      return next();
    }
    
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CONTENT_TYPE',
          message: 'Content-Type header is required'
        },
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Check if content type is allowed (ignore charset and other parameters)
    const baseContentType = contentType.split(';')[0].trim();
    if (!allowedTypes.includes(baseContentType)) {
      res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_CONTENT_TYPE',
          message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
          details: { received: baseContentType, allowed: allowedTypes }
        },
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    next();
  };
}

/**
 * Request origin validation
 */
export function validateOrigin(allowedOrigins: string[] = []) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    
    const origin = req.headers.origin || req.headers.referer;
    
    if (!origin) {
      // Allow requests without origin (e.g., direct API calls)
      return next();
    }
    
    try {
      const originUrl = new URL(origin);
      const isAllowed = allowedOrigins.some(allowed => {
        const allowedUrl = new URL(allowed);
        return originUrl.hostname === allowedUrl.hostname;
      });
      
      if (!isAllowed) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_ORIGIN',
            message: 'Request origin is not allowed'
          },
          timestamp: new Date().toISOString()
        });
        return;
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ORIGIN',
          message: 'Invalid origin header'
        },
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    next();
  };
}