/**
 * Property-Based Tests for Human Decision Validation
 * **Property 22: Human Decision Validation**
 * **Validates: Requirements 8.3**
 * 
 * Tests that human decision validation properly enforces:
 * 1. Non-empty rationale requirement
 * 2. Decision maker ID requirement
 * 3. Decision maker role requirement
 * 4. Timestamp recording in ISO8601 format
 * 5. Rationale length validation (min 10, max 2000 characters)
 * 6. Restrictions requirement for 'approve_with_restrictions' decisions
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  HumanDecisionService, 
  HumanDecisionInput, 
  DecisionValidationResult,
  createHumanDecisionService,
  validateHumanDecisionInput
} from '../HumanDecisionService';

describe('Property 22: Human Decision Validation', () => {
  let decisionService: HumanDecisionService;

  beforeEach(() => {
    decisionService = createHumanDecisionService();
  });

  /**
   * Simplified generators for property-based testing
   * Using fc.constantFrom() to avoid timeout issues
   */
  const generateValidDecisionType = (): fc.Arbitrary<'approve' | 'approve_with_restrictions' | 'block'> => {
    return fc.constantFrom('approve', 'approve_with_restrictions', 'block');
  };

  const generateValidRationale = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'Approved for emergency response - low risk action with proper monitoring',
      'Blocked due to high blast radius and policy conflicts detected',
      'Approved with monitoring restrictions for safety compliance',
      'Standard maintenance window approved by SRE team lead',
      'Critical security issue requires immediate remediation action',
      'Production deployment blocked during peak business hours',
      'Database restart approved with rollback plan ready and tested'
    );
  };

  const generateInvalidRationale = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      '', // empty
      'short', // too short (5 chars)
      'ok', // too short (2 chars)
      '123456789', // exactly 9 chars, still too short
      '   ', // whitespace only
      'a'.repeat(9), // exactly 9 chars
      '  spaces  ' // 10 chars but only 6 non-whitespace
    );
  };

  const generateValidDecisionMaker = (): fc.Arbitrary<{ id: string; role: string; name?: string }> => {
    return fc.constantFrom(
      { id: 'user-001', role: 'admin', name: 'John Admin' },
      { id: 'user-002', role: 'sre', name: 'Jane SRE' },
      { id: 'user-003', role: 'security', name: 'Bob Security' },
      { id: 'user-004', role: 'governance', name: 'Alice Governance' },
      { id: 'user-005', role: 'manager', name: 'Charlie Manager' },
      { id: 'user-006', role: 'engineer' },
      { id: 'user-007', role: 'operator' }
    );
  };

  const generateInvalidDecisionMaker = (): fc.Arbitrary<any> => {
    return fc.constantFrom(
      { id: '', role: 'sre' }, // empty id
      { id: 'user1', role: '' }, // empty role
      { id: '   ', role: 'sre' }, // whitespace id
      { id: 'user1', role: '   ' }, // whitespace role
      { role: 'sre' }, // missing id
      { id: 'user1' }, // missing role
      null, // null
      undefined // undefined
    );
  };

  const generateValidRestrictions = (): fc.Arbitrary<string[]> => {
    return fc.constantFrom(
      ['Monitor closely during execution'],
      ['Rollback immediately if issues detected'],
      ['Notify stakeholders before proceeding'],
      ['Monitor closely', 'Rollback if issues', 'Notify team'],
      ['Execute during maintenance window only'],
      ['Require additional approval for production']
    );
  };

  const generateInvalidRestrictions = (): fc.Arbitrary<any> => {
    return fc.constantFrom(
      [], // empty array
      [''], // array with empty string
      ['  '], // array with whitespace only
      ['valid', ''], // mixed valid and empty
      null, // null
      undefined // undefined
    );
  };

  const generateValidBlastRadiusAssessment = (): fc.Arbitrary<{
    affectedServices: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reversible: boolean;
  }> => {
    return fc.constantFrom(
      { affectedServices: ['api-gateway'], riskLevel: 'low', reversible: true },
      { affectedServices: ['database', 'api'], riskLevel: 'medium', reversible: true },
      { affectedServices: ['auth-service', 'user-service'], riskLevel: 'high', reversible: false },
      { affectedServices: ['payment-service', 'database', 'cache'], riskLevel: 'critical', reversible: false },
      { affectedServices: [], riskLevel: 'low', reversible: true }
    );
  };

  /**
   * Helper function to create a valid HumanDecisionInput
   */
  function createValidInput(overrides?: Partial<HumanDecisionInput>): HumanDecisionInput {
    return {
      decision: 'approve',
      rationale: 'Valid rationale for testing purposes with sufficient length',
      decisionMaker: { id: 'user-001', role: 'admin' },
      blastRadiusAssessment: {
        affectedServices: ['api-gateway'],
        riskLevel: 'low',
        reversible: true
      },
      ...overrides
    };
  }

  /**
   * Property Tests
   */

  test('Valid decision inputs with all required fields are accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        generateValidRationale(),
        generateValidDecisionMaker(),
        generateValidBlastRadiusAssessment(),
        fc.option(generateValidRestrictions(), { nil: undefined }),
        async (decision, rationale, decisionMaker, blastRadius, restrictions) => {
          const input: HumanDecisionInput = {
            decision,
            rationale,
            decisionMaker,
            blastRadiusAssessment: blastRadius,
            restrictions: decision === 'approve_with_restrictions' 
              ? (restrictions || ['Default restriction for approval']) 
              : restrictions
          };

          const result = decisionService.validateDecisionInput(input);

          // Valid inputs should pass validation
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
          
          // Timestamp should be recorded in ISO8601 format
          expect(result.validatedAt).toBeDefined();
          expect(result.validatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          
          // Verify ISO8601 format is parseable
          const parsedDate = new Date(result.validatedAt);
          expect(parsedDate.toISOString()).toBe(result.validatedAt);
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Empty rationale is always rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        generateValidDecisionMaker(),
        generateValidBlastRadiusAssessment(),
        async (decision, decisionMaker, blastRadius) => {
          const input: HumanDecisionInput = {
            decision,
            rationale: '', // Empty rationale
            decisionMaker,
            blastRadiusAssessment: blastRadius
          };

          const result = decisionService.validateDecisionInput(input);

          // Empty rationale should fail validation
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some(e => 
            e.toLowerCase().includes('rationale') && 
            (e.toLowerCase().includes('required') || e.toLowerCase().includes('empty'))
          )).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Rationale below minimum length is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        generateInvalidRationale(),
        generateValidDecisionMaker(),
        generateValidBlastRadiusAssessment(),
        async (decision, invalidRationale, decisionMaker, blastRadius) => {
          const input: HumanDecisionInput = {
            decision,
            rationale: invalidRationale,
            decisionMaker,
            blastRadiusAssessment: blastRadius
          };

          const result = decisionService.validateDecisionInput(input);

          // Short rationale should fail validation
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some(e => 
            e.toLowerCase().includes('rationale') || 
            e.toLowerCase().includes('character') ||
            e.toLowerCase().includes('empty')
          )).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Rationale exceeding maximum length is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        generateValidDecisionMaker(),
        generateValidBlastRadiusAssessment(),
        async (decision, decisionMaker, blastRadius) => {
          // Create rationale exceeding 2000 characters
          const longRationale = 'A'.repeat(2001);
          
          const input: HumanDecisionInput = {
            decision,
            rationale: longRationale,
            decisionMaker,
            blastRadiusAssessment: blastRadius
          };

          const result = decisionService.validateDecisionInput(input);

          // Long rationale should fail validation
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some(e => 
            e.toLowerCase().includes('rationale') && 
            (e.toLowerCase().includes('exceed') || e.toLowerCase().includes('2000'))
          )).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Missing decision maker ID is always rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        generateValidRationale(),
        generateValidBlastRadiusAssessment(),
        async (decision, rationale, blastRadius) => {
          const input: HumanDecisionInput = {
            decision,
            rationale,
            decisionMaker: { id: '', role: 'admin' }, // Empty ID
            blastRadiusAssessment: blastRadius
          };

          const result = decisionService.validateDecisionInput(input);

          // Missing decision maker ID should fail validation
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some(e => 
            e.toLowerCase().includes('decision maker') && e.toLowerCase().includes('id')
          )).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Missing decision maker role is always rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        generateValidRationale(),
        generateValidBlastRadiusAssessment(),
        async (decision, rationale, blastRadius) => {
          const input: HumanDecisionInput = {
            decision,
            rationale,
            decisionMaker: { id: 'user-001', role: '' }, // Empty role
            blastRadiusAssessment: blastRadius
          };

          const result = decisionService.validateDecisionInput(input);

          // Missing decision maker role should fail validation
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some(e => 
            e.toLowerCase().includes('decision maker') && e.toLowerCase().includes('role')
          )).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Invalid decision maker objects are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        generateValidRationale(),
        generateInvalidDecisionMaker(),
        generateValidBlastRadiusAssessment(),
        async (decision, rationale, invalidDecisionMaker, blastRadius) => {
          const input: HumanDecisionInput = {
            decision,
            rationale,
            decisionMaker: invalidDecisionMaker,
            blastRadiusAssessment: blastRadius
          };

          const result = decisionService.validateDecisionInput(input);

          // Invalid decision maker should fail validation
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some(e => 
            e.toLowerCase().includes('decision maker') || 
            e.toLowerCase().includes('id') || 
            e.toLowerCase().includes('role')
          )).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Timestamp is always recorded in ISO8601 format', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        generateValidRationale(),
        generateValidDecisionMaker(),
        generateValidBlastRadiusAssessment(),
        async (decision, rationale, decisionMaker, blastRadius) => {
          const input: HumanDecisionInput = {
            decision,
            rationale,
            decisionMaker,
            blastRadiusAssessment: blastRadius,
            restrictions: decision === 'approve_with_restrictions' 
              ? ['Default restriction'] 
              : undefined
          };

          const result = decisionService.validateDecisionInput(input);

          // Timestamp should always be present
          expect(result.validatedAt).toBeDefined();
          expect(typeof result.validatedAt).toBe('string');
          
          // Verify ISO8601 format
          const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
          expect(result.validatedAt).toMatch(iso8601Regex);
          
          // Verify it's a valid date
          const parsedDate = new Date(result.validatedAt);
          expect(parsedDate.toString()).not.toBe('Invalid Date');
          
          // Verify round-trip conversion
          expect(parsedDate.toISOString()).toBe(result.validatedAt);
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Approve with restrictions requires non-empty restrictions array', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidRationale(),
        generateValidDecisionMaker(),
        generateValidBlastRadiusAssessment(),
        generateInvalidRestrictions(),
        async (rationale, decisionMaker, blastRadius, invalidRestrictions) => {
          const input: HumanDecisionInput = {
            decision: 'approve_with_restrictions',
            rationale,
            decisionMaker,
            blastRadiusAssessment: blastRadius,
            restrictions: invalidRestrictions
          };

          const result = decisionService.validateDecisionInput(input);

          // Missing or invalid restrictions should fail for approve_with_restrictions
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some(e => 
            e.toLowerCase().includes('restriction')
          )).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Approve and block decisions do not require restrictions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('approve', 'block') as fc.Arbitrary<'approve' | 'block'>,
        generateValidRationale(),
        generateValidDecisionMaker(),
        generateValidBlastRadiusAssessment(),
        async (decision, rationale, decisionMaker, blastRadius) => {
          const input: HumanDecisionInput = {
            decision,
            rationale,
            decisionMaker,
            blastRadiusAssessment: blastRadius,
            restrictions: undefined // No restrictions
          };

          const result = decisionService.validateDecisionInput(input);

          // Approve and block should not require restrictions
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Validation result always contains required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        fc.oneof(generateValidRationale(), generateInvalidRationale()),
        fc.oneof(generateValidDecisionMaker(), generateInvalidDecisionMaker()),
        generateValidBlastRadiusAssessment(),
        async (decision, rationale, decisionMaker, blastRadius) => {
          const input: HumanDecisionInput = {
            decision,
            rationale,
            decisionMaker,
            blastRadiusAssessment: blastRadius,
            restrictions: decision === 'approve_with_restrictions' 
              ? ['Test restriction'] 
              : undefined
          };

          const result = decisionService.validateDecisionInput(input);

          // Validation result should always have required fields
          expect(result).toHaveProperty('isValid');
          expect(result).toHaveProperty('errors');
          expect(result).toHaveProperty('warnings');
          expect(result).toHaveProperty('validatedAt');
          
          expect(typeof result.isValid).toBe('boolean');
          expect(Array.isArray(result.errors)).toBe(true);
          expect(Array.isArray(result.warnings)).toBe(true);
          expect(typeof result.validatedAt).toBe('string');
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Decision capture requires valid input and records all metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        generateValidRationale(),
        generateValidDecisionMaker(),
        generateValidBlastRadiusAssessment(),
        fc.constantFrom('workflow-001', 'workflow-002', 'workflow-003'),
        async (decision, rationale, decisionMaker, blastRadius, workflowId) => {
          const input: HumanDecisionInput = {
            decision,
            rationale,
            decisionMaker,
            blastRadiusAssessment: blastRadius,
            restrictions: decision === 'approve_with_restrictions' 
              ? ['Monitoring required'] 
              : undefined
          };

          // Capture the decision
          const captured = decisionService.captureDecision(workflowId, input);

          // Verify captured decision has all required metadata
          expect(captured.decisionId).toBeDefined();
          expect(captured.workflowId).toBe(workflowId);
          expect(captured.capturedAt).toBeDefined();
          
          // Verify timestamp is ISO8601
          expect(captured.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          
          // Verify governance decision contains all required fields
          expect(captured.governanceDecision.decision).toBe(decision);
          expect(captured.governanceDecision.rationale).toBe(rationale.trim());
          expect(captured.governanceDecision.approver.id).toBe(decisionMaker.id.trim());
          expect(captured.governanceDecision.approver.role).toBe(decisionMaker.role.trim());
          expect(captured.governanceDecision.timestamp).toBeDefined();
          
          // Verify validation result is included
          expect(captured.validationResult.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Invalid inputs throw error when attempting to capture decision', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        generateInvalidRationale(),
        generateValidDecisionMaker(),
        generateValidBlastRadiusAssessment(),
        fc.constantFrom('workflow-001', 'workflow-002'),
        async (decision, invalidRationale, decisionMaker, blastRadius, workflowId) => {
          const input: HumanDecisionInput = {
            decision,
            rationale: invalidRationale,
            decisionMaker,
            blastRadiusAssessment: blastRadius
          };

          // Attempting to capture invalid decision should throw
          expect(() => {
            decisionService.captureDecision(workflowId, input);
          }).toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Utility function validateHumanDecisionInput works consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecisionType(),
        generateValidRationale(),
        generateValidDecisionMaker(),
        generateValidBlastRadiusAssessment(),
        async (decision, rationale, decisionMaker, blastRadius) => {
          const input: HumanDecisionInput = {
            decision,
            rationale,
            decisionMaker,
            blastRadiusAssessment: blastRadius,
            restrictions: decision === 'approve_with_restrictions' 
              ? ['Test restriction'] 
              : undefined
          };

          // Use utility function
          const utilityResult = validateHumanDecisionInput(input);
          
          // Use service method
          const serviceResult = decisionService.validateDecisionInput(input);

          // Results should be consistent
          expect(utilityResult.isValid).toBe(serviceResult.isValid);
          expect(utilityResult.errors).toEqual(serviceResult.errors);
          expect(utilityResult.warnings).toEqual(serviceResult.warnings);
        }
      ),
      { numRuns: 20 }
    );
  });
});
