/**
 * SentinelFlow API Validation Tests
 * Comprehensive tests for input validation and sanitization
 */

import { describe, test, expect } from 'vitest';
import {
  validateField,
  validateData,
  sanitizeString,
  createValidationMiddleware,
  ValidationHelpers
} from '../validation/validator';
import {
  WorkflowSchemas,
  AgentOutputSchemas,
  GovernanceSchemas,
  CommonSchemas,
  UUID_PATTERN
} from '../validation/schemas';

describe('API Validation Tests', () => {
  describe('Field Validation', () => {
    test('should validate required fields', () => {
      const schema = { type: 'string' as const, required: true };
      
      const errors1 = validateField(undefined, schema, 'testField');
      expect(errors1).toHaveLength(1);
      expect(errors1[0].constraint).toBe('required');
      
      const errors2 = validateField('value', schema, 'testField');
      expect(errors2).toHaveLength(0);
    });

    test('should validate string length constraints', () => {
      const schema = { 
        type: 'string' as const, 
        minLength: 5, 
        maxLength: 10,
        required: true 
      };
      
      const errors1 = validateField('abc', schema, 'testField');
      expect(errors1).toHaveLength(1);
      expect(errors1[0].constraint).toBe('minLength');
      
      const errors2 = validateField('abcdefghijk', schema, 'testField');
      expect(errors2).toHaveLength(1);
      expect(errors2[0].constraint).toBe('maxLength');
      
      const errors3 = validateField('abcdef', schema, 'testField');
      expect(errors3).toHaveLength(0);
    });

    test('should validate enum values', () => {
      const schema = { 
        type: 'string' as const, 
        enum: ['approve', 'block', 'approve_with_restrictions'],
        required: true 
      };
      
      const errors1 = validateField('invalid', schema, 'decision');
      expect(errors1).toHaveLength(1);
      expect(errors1[0].constraint).toBe('enum');
      
      const errors2 = validateField('approve', schema, 'decision');
      expect(errors2).toHaveLength(0);
    });

    test('should validate UUID format', () => {
      const schema = { 
        type: 'string' as const, 
        pattern: UUID_PATTERN,
        required: true 
      };
      
      const errors1 = validateField('invalid-uuid', schema, 'workflowId');
      expect(errors1).toHaveLength(1);
      expect(errors1[0].constraint).toBe('pattern');
      
      const errors2 = validateField('123e4567-e89b-12d3-a456-426614174000', schema, 'workflowId');
      expect(errors2).toHaveLength(0);
    });

    test('should validate number constraints', () => {
      const schema = { 
        type: 'number' as const, 
        min: 0, 
        max: 1,
        required: true 
      };
      
      const errors1 = validateField(-1, schema, 'confidence');
      expect(errors1).toHaveLength(1);
      expect(errors1[0].constraint).toBe('min');
      
      const errors2 = validateField(2, schema, 'confidence');
      expect(errors2).toHaveLength(1);
      expect(errors2[0].constraint).toBe('max');
      
      const errors3 = validateField(0.5, schema, 'confidence');
      expect(errors3).toHaveLength(0);
    });

    test('should validate array items', () => {
      const schema = { 
        type: 'array' as const,
        items: { type: 'string' as const, minLength: 1, required: true },
        required: true 
      };
      
      const errors1 = validateField(['valid', ''], schema, 'restrictions');
      expect(errors1).toHaveLength(1);
      expect(errors1[0].field).toBe('restrictions[1]');
      
      const errors2 = validateField(['valid1', 'valid2'], schema, 'restrictions');
      expect(errors2).toHaveLength(0);
    });

    test('should validate nested objects', () => {
      const schema = { 
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, minLength: 1, required: true },
          role: { type: 'string' as const, enum: ['senior-sre', 'security-lead'], required: true }
        },
        required: true 
      };
      
      const errors1 = validateField({ id: '', role: 'invalid' }, schema, 'approver');
      expect(errors1).toHaveLength(2);
      
      const errors2 = validateField({ id: 'test', role: 'senior-sre' }, schema, 'approver');
      expect(errors2).toHaveLength(0);
    });
  });

  describe('String Sanitization', () => {
    test('should trim whitespace', () => {
      const result = sanitizeString('  test  ', { trimStrings: true });
      expect(result).toBe('test');
    });

    test('should remove HTML tags', () => {
      const result = sanitizeString('<script>alert("xss")</script>test', { removeHtmlTags: true });
      expect(result).toBe('test');
    });

    test('should escape HTML entities', () => {
      const result = sanitizeString('<script>&"test"</script>', { escapeHtml: true });
      expect(result).toBe('&lt;script&gt;&amp;&quot;test&quot;&lt;&#x2F;script&gt;');
    });

    test('should enforce maximum length', () => {
      const result = sanitizeString('abcdefghijk', { maxStringLength: 5 });
      expect(result).toBe('abcde');
    });

    test('should apply all sanitization options', () => {
      const input = '  <script>alert("xss")</script>test  ';
      const result = sanitizeString(input, {
        trimStrings: true,
        removeHtmlTags: true,
        escapeHtml: true,
        maxStringLength: 10
      });
      expect(result).toBe('test');
    });
  });

  describe('Data Validation', () => {
    test('should validate and sanitize complex data', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          decision: { type: 'string' as const, enum: ['approve', 'block'], required: true },
          rationale: { type: 'string' as const, minLength: 10, required: true }
        },
        required: true
      };

      const data = {
        decision: 'approve',
        rationale: '  <script>This is a valid rationale</script>  '
      };

      const result = validateData(data, schema, {
        trimStrings: true,
        removeHtmlTags: true,
        escapeHtml: true
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.rationale).toBe('This is a valid rationale');
      expect(result.sanitizedData?.rationale).not.toContain('<script>');
    });

    test('should return validation errors for invalid data', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          decision: { type: 'string' as const, enum: ['approve', 'block'], required: true },
          rationale: { type: 'string' as const, minLength: 10, required: true }
        },
        required: true
      };

      const data = {
        decision: 'invalid',
        rationale: 'short'
      };

      const result = validateData(data, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.some(e => e.constraint === 'enum')).toBe(true);
      expect(result.errors.some(e => e.constraint === 'minLength')).toBe(true);
    });
  });

  describe('Schema Validation', () => {
    test('should validate workflow creation schema', () => {
      const validData = {
        description: 'Test workflow',
        priority: 'high'
      };

      const result = validateData(validData, WorkflowSchemas.createWorkflow.body!);
      expect(result.isValid).toBe(true);
    });

    test('should validate workflow state update schema', () => {
      const validData = {
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        newState: 'ANALYZING',
        reason: 'Starting analysis phase'
      };

      // Validate params
      const paramsResult = validateData(
        { workflowId: validData.workflowId }, 
        { type: 'object', properties: WorkflowSchemas.updateWorkflowState.params }
      );
      expect(paramsResult.isValid).toBe(true);

      // Validate body
      const bodyResult = validateData(
        { newState: validData.newState, reason: validData.reason },
        WorkflowSchemas.updateWorkflowState.body!
      );
      expect(bodyResult.isValid).toBe(true);
    });

    test('should validate agent output schema', () => {
      const validData = {
        agentName: 'sre-agent',
        outputType: 'analysis',
        content: { findings: ['test'] },
        confidence: 0.8
      };

      const result = validateData(validData, AgentOutputSchemas.addAgentOutput.body!);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid agent name', () => {
      const invalidData = {
        agentName: 'invalid-agent',
        outputType: 'analysis',
        content: { findings: ['test'] }
      };

      const result = validateData(invalidData, AgentOutputSchemas.addAgentOutput.body!);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field.includes('agentName') && e.constraint === 'enum')).toBe(true);
    });

    test('should validate governance decision schema', () => {
      const validData = {
        decision: 'approve_with_restrictions',
        rationale: 'This is a valid rationale with sufficient detail',
        approver: {
          id: 'test-approver',
          role: 'senior-sre',
          name: 'Test Approver'
        },
        restrictions: ['Must be deployed during maintenance window'],
        expiresAt: new Date().toISOString()
      };

      const result = validateData(validData, GovernanceSchemas.submitDecision.body!);
      expect(result.isValid).toBe(true);
    });

    test('should reject governance decision with invalid approver role', () => {
      const invalidData = {
        decision: 'approve',
        rationale: 'Valid rationale with sufficient length',
        approver: {
          id: 'test-approver',
          role: 'invalid-role'
        }
      };

      const result = validateData(invalidData, GovernanceSchemas.submitDecision.body!);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field.includes('role') && e.constraint === 'enum')).toBe(true);
    });

    test('should reject governance decision with short rationale', () => {
      const invalidData = {
        decision: 'approve',
        rationale: 'Short',
        approver: {
          id: 'test-approver',
          role: 'senior-sre'
        }
      };

      const result = validateData(invalidData, GovernanceSchemas.submitDecision.body!);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field.includes('rationale') && e.constraint === 'minLength')).toBe(true);
    });
  });

  describe('Common Schemas', () => {
    test('should validate UUID schema', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUuid = 'invalid-uuid';

      const validResult = validateField(validUuid, CommonSchemas.uuid, 'id');
      expect(validResult).toHaveLength(0);

      const invalidResult = validateField(invalidUuid, CommonSchemas.uuid, 'id');
      expect(invalidResult).toHaveLength(1);
      expect(invalidResult[0].constraint).toBe('pattern');
    });

    test('should validate workflow state schema', () => {
      const validState = 'ANALYZING';
      const invalidState = 'INVALID_STATE';

      const validResult = validateField(validState, CommonSchemas.workflowState, 'state');
      expect(validResult).toHaveLength(0);

      const invalidResult = validateField(invalidState, CommonSchemas.workflowState, 'state');
      expect(invalidResult).toHaveLength(1);
      expect(invalidResult[0].constraint).toBe('enum');
    });

    test('should validate non-empty string schema', () => {
      const validString = 'test';
      const emptyString = '';
      const longString = 'x'.repeat(1001);

      const validResult = validateField(validString, CommonSchemas.nonEmptyString, 'field');
      expect(validResult).toHaveLength(0);

      const emptyResult = validateField(emptyString, CommonSchemas.nonEmptyString, 'field');
      expect(emptyResult).toHaveLength(1);
      expect(emptyResult[0].constraint).toBe('minLength');

      const longResult = validateField(longString, CommonSchemas.nonEmptyString, 'field');
      expect(longResult).toHaveLength(1);
      expect(longResult[0].constraint).toBe('maxLength');
    });

    test('should validate long text schema', () => {
      const validText = 'This is a valid long text with sufficient length';
      const shortText = 'Short';
      const tooLongText = 'x'.repeat(5001);

      const validResult = validateField(validText, CommonSchemas.longText, 'rationale');
      expect(validResult).toHaveLength(0);

      const shortResult = validateField(shortText, CommonSchemas.longText, 'rationale');
      expect(shortResult).toHaveLength(1);
      expect(shortResult[0].constraint).toBe('minLength');

      const longResult = validateField(tooLongText, CommonSchemas.longText, 'rationale');
      expect(longResult).toHaveLength(1);
      expect(longResult[0].constraint).toBe('maxLength');
    });
  });

  describe('Validation Helpers', () => {
    test('should create UUID validation middleware', () => {
      const middleware = ValidationHelpers.validateUUID('workflowId');
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    test('should create required body validation middleware', () => {
      const middleware = ValidationHelpers.validateRequiredBody();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    test('should create workflow state validation middleware', () => {
      const middleware = ValidationHelpers.validateWorkflowState();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Format Validation', () => {
    test('should validate email format', () => {
      const schema = { type: 'string' as const, format: 'email' as const, required: true };
      
      const validResult = validateField('test@example.com', schema, 'email');
      expect(validResult).toHaveLength(0);

      const invalidResult = validateField('invalid-email', schema, 'email');
      expect(invalidResult).toHaveLength(1);
      expect(invalidResult[0].constraint).toBe('format');
    });

    test('should validate date format', () => {
      const schema = { type: 'string' as const, format: 'date' as const, required: true };
      
      const validResult = validateField(new Date().toISOString(), schema, 'date');
      expect(validResult).toHaveLength(0);

      const invalidResult = validateField('invalid-date', schema, 'date');
      expect(invalidResult).toHaveLength(1);
      expect(invalidResult[0].constraint).toBe('format');
    });

    test('should validate URL format', () => {
      const schema = { type: 'string' as const, format: 'url' as const, required: true };
      
      const validResult = validateField('https://example.com', schema, 'url');
      expect(validResult).toHaveLength(0);

      const invalidResult = validateField('invalid-url', schema, 'url');
      expect(invalidResult).toHaveLength(1);
      expect(invalidResult[0].constraint).toBe('format');
    });
  });
});