/**
 * SentinelFlow API Validation Engine
 * Comprehensive input validation with security features
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationSchema, UUID_PATTERN } from './schemas';

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
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

/**
 * Sanitization options
 */
export interface SanitizationOptions {
  trimStrings?: boolean;
  removeHtmlTags?: boolean;
  escapeHtml?: boolean;
  maxStringLength?: number;
}

/**
 * HTML tag removal regex
 */
const HTML_TAG_REGEX = /<[^>]*>/g;

/**
 * HTML entity encoding map
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;'
};

/**
 * Sanitize string input
 */
export function sanitizeString(
  value: string, 
  options: SanitizationOptions = {}
): string {
  let sanitized = value;
  
  // Trim whitespace
  if (options.trimStrings !== false) {
    sanitized = sanitized.trim();
  }
  
  // Remove HTML tags
  if (options.removeHtmlTags) {
    sanitized = sanitized.replace(HTML_TAG_REGEX, '');
  }
  
  // Escape HTML entities
  if (options.escapeHtml) {
    sanitized = sanitized.replace(/[&<>"'\/]/g, (char) => HTML_ENTITIES[char] || char);
  }
  
  // Enforce maximum length
  if (options.maxStringLength && sanitized.length > options.maxStringLength) {
    sanitized = sanitized.substring(0, options.maxStringLength);
  }
  
  return sanitized;
}

/**
 * Validate individual field against schema
 */
export function validateField(
  value: any, 
  schema: ValidationSchema, 
  fieldName: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check required fields
  if (schema.required && (value === undefined || value === null || value === '')) {
    errors.push({
      field: fieldName,
      message: `${fieldName} is required`,
      constraint: 'required'
    });
    return errors;
  }
  
  // Skip validation if field is not required and empty
  if (!schema.required && (value === undefined || value === null || value === '')) {
    return errors;
  }
  
  // Type validation
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (actualType !== schema.type) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be of type ${schema.type}`,
      value: actualType,
      constraint: 'type'
    });
    return errors;
  }
  
  // String validations
  if (schema.type === 'string' && typeof value === 'string') {
    // Length validations
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at least ${schema.minLength} characters long`,
        value: value.length,
        constraint: 'minLength'
      });
    }
    
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at most ${schema.maxLength} characters long`,
        value: value.length,
        constraint: 'maxLength'
      });
    }
    
    // Pattern validation
    if (schema.pattern && !schema.pattern.test(value)) {
      errors.push({
        field: fieldName,
        message: `${fieldName} format is invalid`,
        value,
        constraint: 'pattern'
      });
    }
    
    // Format validation
    if (schema.format) {
      switch (schema.format) {
        case 'uuid':
          if (!UUID_PATTERN.test(value)) {
            errors.push({
              field: fieldName,
              message: `${fieldName} must be a valid UUID`,
              value,
              constraint: 'format'
            });
          }
          break;
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push({
              field: fieldName,
              message: `${fieldName} must be a valid email address`,
              value,
              constraint: 'format'
            });
          }
          break;
        case 'date':
          if (isNaN(Date.parse(value))) {
            errors.push({
              field: fieldName,
              message: `${fieldName} must be a valid ISO date string`,
              value,
              constraint: 'format'
            });
          }
          break;
        case 'url':
          try {
            new URL(value);
          } catch {
            errors.push({
              field: fieldName,
              message: `${fieldName} must be a valid URL`,
              value,
              constraint: 'format'
            });
          }
          break;
      }
    }
  }
  
  // Number validations
  if (schema.type === 'number' && typeof value === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at least ${schema.min}`,
        value,
        constraint: 'min'
      });
    }
    
    if (schema.max !== undefined && value > schema.max) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at most ${schema.max}`,
        value,
        constraint: 'max'
      });
    }
  }
  
  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be one of: ${schema.enum.join(', ')}`,
      value,
      constraint: 'enum'
    });
  }
  
  // Array validation
  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.items) {
      value.forEach((item, index) => {
        const itemErrors = validateField(item, schema.items!, `${fieldName}[${index}]`);
        errors.push(...itemErrors);
      });
    }
  }
  
  // Object validation
  if (schema.type === 'object' && typeof value === 'object' && value !== null) {
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([propName, propSchema]) => {
        const propErrors = validateField(value[propName], propSchema, `${fieldName}.${propName}`);
        errors.push(...propErrors);
      });
    }
  }
  
  return errors;
}

/**
 * Validate request data against schema
 */
export function validateData(
  data: any, 
  schema: ValidationSchema,
  sanitizationOptions: SanitizationOptions = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  let sanitizedData = data;
  
  // Sanitize strings recursively
  if (sanitizationOptions.trimStrings || sanitizationOptions.removeHtmlTags || sanitizationOptions.escapeHtml) {
    sanitizedData = sanitizeDataRecursively(data, sanitizationOptions);
  }
  
  // Validate against schema
  const validationErrors = validateField(sanitizedData, schema, 'root');
  errors.push(...validationErrors);
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizedData : undefined
  };
}

/**
 * Recursively sanitize data
 */
function sanitizeDataRecursively(data: any, options: SanitizationOptions): any {
  if (typeof data === 'string') {
    return sanitizeString(data, options);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeDataRecursively(item, options));
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    Object.entries(data).forEach(([key, value]) => {
      sanitized[key] = sanitizeDataRecursively(value, options);
    });
    return sanitized;
  }
  
  return data;
}

/**
 * Create validation middleware
 */
export function createValidationMiddleware(
  schemas: {
    params?: ValidationSchema;
    query?: ValidationSchema;
    body?: ValidationSchema;
  },
  sanitizationOptions: SanitizationOptions = {
    trimStrings: true,
    removeHtmlTags: true,
    escapeHtml: true,
    maxStringLength: 10000
  }
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allErrors: ValidationError[] = [];
    
    // Validate parameters
    if (schemas.params) {
      const paramResult = validateData(req.params, schemas.params, sanitizationOptions);
      if (!paramResult.isValid) {
        allErrors.push(...paramResult.errors);
      } else {
        req.params = paramResult.sanitizedData;
      }
    }
    
    // Validate query parameters
    if (schemas.query) {
      const queryResult = validateData(req.query, schemas.query, sanitizationOptions);
      if (!queryResult.isValid) {
        allErrors.push(...queryResult.errors);
      } else {
        req.query = queryResult.sanitizedData;
      }
    }
    
    // Validate request body
    if (schemas.body) {
      const bodyResult = validateData(req.body, schemas.body, sanitizationOptions);
      if (!bodyResult.isValid) {
        allErrors.push(...bodyResult.errors);
      } else {
        req.body = bodyResult.sanitizedData;
      }
    }
    
    // Return validation errors if any
    if (allErrors.length > 0) {
      res.status(400).json(createLocalErrorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        {
          validationErrors: allErrors,
          errorCount: allErrors.length
        }
      ));
      return;
    }
    
    next();
  };
}

/**
 * Quick validation helpers for common patterns
 */
export const ValidationHelpers = {
  /**
   * Validate UUID parameter
   */
  validateUUID: (paramName: string) => createValidationMiddleware({
    params: {
      type: 'object',
      properties: {
        [paramName]: {
          type: 'string',
          pattern: UUID_PATTERN,
          required: true
        }
      }
    }
  }),
  
  /**
   * Validate required body
   */
  validateRequiredBody: () => createValidationMiddleware({
    body: {
      type: 'object',
      required: true
    }
  }),
  
  /**
   * Validate workflow state
   */
  validateWorkflowState: () => createValidationMiddleware({
    body: {
      type: 'object',
      properties: {
        newState: {
          type: 'string',
          enum: ['IDLE', 'INGESTING', 'ANALYZING', 'SYNTHESIZING', 'GOVERNING', 'PROPOSING', 'VERIFYING', 'RESOLVED', 'TERMINATED'],
          required: true
        }
      },
      required: true
    }
  })
};