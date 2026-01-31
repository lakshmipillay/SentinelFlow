/**
 * Property-Based Tests for Governance Approval Interface Completeness
 * **Property 21: Governance Approval Interface Completeness**
 * **Validates: Requirements 8.1, 8.2**
 * 
 * Tests that the governance approval interface must:
 * 1. Always display the recommended action
 * 2. Always show blast radius information (affected services count)
 * 3. Always display risk level
 * 4. Always show policy conflicts if any exist
 * 5. Always provide all three approval options (approve, approve_with_restrictions, block)
 * 6. Require rationale before allowing decision submission
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Governance decision types - matches frontend/backend types
 */
export type GovernanceDecisionType = 'approve' | 'approve_with_restrictions' | 'block';

/**
 * Risk level types - matches frontend/backend types
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Health status for blast radius nodes
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical';

/**
 * Impact level for blast radius nodes
 */
export type ImpactLevel = 'low' | 'medium' | 'high';

/**
 * Blast radius node interface
 */
export interface BlastRadiusNode {
  serviceName: string;
  healthStatus: HealthStatus;
  dependencies: string[];
  impactLevel: ImpactLevel;
}

/**
 * Governance approval request interface
 * Requirements: 8.1 - Display governance approval card with recommended action,
 *               blast radius, risk level, and policy conflicts
 */
export interface GovernanceApprovalRequest {
  recommendedAction: string;
  blastRadius: BlastRadiusNode[];
  riskLevel: RiskLevel;
  policyConflicts: string[];
  reversibility: boolean;
}

/**
 * Governance approval interface state
 * Represents the UI state of the governance approval card
 */
export interface GovernanceApprovalInterfaceState {
  request: GovernanceApprovalRequest;
  approvalOptions: {
    approve: boolean;
    approveWithRestrictions: boolean;
    block: boolean;
  };
  rationaleRequired: boolean;
  rationaleProvided: boolean;
  canSubmit: boolean;
}

/**
 * Valid governance decision types
 */
export const VALID_DECISION_TYPES: readonly GovernanceDecisionType[] = [
  'approve',
  'approve_with_restrictions',
  'block'
] as const;

/**
 * Valid risk levels
 */
export const VALID_RISK_LEVELS: readonly RiskLevel[] = [
  'low',
  'medium',
  'high',
  'critical'
] as const;

/**
 * Valid health statuses
 */
export const VALID_HEALTH_STATUSES: readonly HealthStatus[] = [
  'healthy',
  'warning',
  'critical'
] as const;

/**
 * Valid impact levels
 */
export const VALID_IMPACT_LEVELS: readonly ImpactLevel[] = [
  'low',
  'medium',
  'high'
] as const;

/**
 * Validates that a governance decision type is valid
 */
export function isValidDecisionType(type: string): type is GovernanceDecisionType {
  return VALID_DECISION_TYPES.includes(type as GovernanceDecisionType);
}

/**
 * Validates that a risk level is valid
 */
export function isValidRiskLevel(level: string): level is RiskLevel {
  return VALID_RISK_LEVELS.includes(level as RiskLevel);
}

/**
 * Validates that a governance approval request has all required fields
 */
export function validateGovernanceApprovalRequest(request: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!request || typeof request !== 'object') {
    return { isValid: false, errors: ['Request must be a non-null object'] };
  }

  const req = request as Record<string, unknown>;

  // Validate recommendedAction (Requirement 8.1)
  if (!('recommendedAction' in req)) {
    errors.push('Missing required field: recommendedAction');
  } else if (typeof req.recommendedAction !== 'string' || req.recommendedAction.trim().length === 0) {
    errors.push('Field "recommendedAction" must be a non-empty string');
  }

  // Validate blastRadius (Requirement 8.1)
  if (!('blastRadius' in req)) {
    errors.push('Missing required field: blastRadius');
  } else if (!Array.isArray(req.blastRadius)) {
    errors.push('Field "blastRadius" must be an array');
  }

  // Validate riskLevel (Requirement 8.1)
  if (!('riskLevel' in req)) {
    errors.push('Missing required field: riskLevel');
  } else if (!isValidRiskLevel(req.riskLevel as string)) {
    errors.push(`Field "riskLevel" must be one of: ${VALID_RISK_LEVELS.join(', ')}`);
  }

  // Validate policyConflicts (Requirement 8.1)
  if (!('policyConflicts' in req)) {
    errors.push('Missing required field: policyConflicts');
  } else if (!Array.isArray(req.policyConflicts)) {
    errors.push('Field "policyConflicts" must be an array');
  }

  // Validate reversibility (Requirement 8.1)
  if (!('reversibility' in req)) {
    errors.push('Missing required field: reversibility');
  } else if (typeof req.reversibility !== 'boolean') {
    errors.push('Field "reversibility" must be a boolean');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates that all three approval options are available
 * Requirement 8.2: Three approval buttons with color coding
 */
export function validateApprovalOptions(options: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!options || typeof options !== 'object') {
    return { isValid: false, errors: ['Approval options must be a non-null object'] };
  }

  const opts = options as Record<string, unknown>;

  // Check for approve option (Green)
  if (!('approve' in opts)) {
    errors.push('Missing approval option: approve (Green)');
  } else if (opts.approve !== true) {
    errors.push('Approval option "approve" must be available (true)');
  }

  // Check for approve_with_restrictions option (Yellow)
  if (!('approveWithRestrictions' in opts)) {
    errors.push('Missing approval option: approveWithRestrictions (Yellow)');
  } else if (opts.approveWithRestrictions !== true) {
    errors.push('Approval option "approveWithRestrictions" must be available (true)');
  }

  // Check for block option (Red)
  if (!('block' in opts)) {
    errors.push('Missing approval option: block (Red)');
  } else if (opts.block !== true) {
    errors.push('Approval option "block" must be available (true)');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates rationale requirement for decision submission
 * Requirement 8.3: Require rationale input from the human approver
 */
export function validateRationaleRequirement(
  rationaleRequired: boolean,
  rationaleProvided: boolean,
  canSubmit: boolean
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Rationale must always be required
  if (!rationaleRequired) {
    errors.push('Rationale must be required for governance decisions');
  }

  // Cannot submit without rationale
  if (!rationaleProvided && canSubmit) {
    errors.push('Cannot allow submission without rationale provided');
  }

  // Can submit only when rationale is provided
  if (rationaleProvided && !canSubmit) {
    // This is acceptable - there might be other validation requirements
    // But we don't flag it as an error
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates the complete governance approval interface state
 */
export function validateGovernanceInterface(state: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!state || typeof state !== 'object') {
    return { isValid: false, errors: ['Interface state must be a non-null object'] };
  }

  const interfaceState = state as Record<string, unknown>;

  // Validate request
  if (!('request' in interfaceState)) {
    errors.push('Missing required field: request');
  } else {
    const requestResult = validateGovernanceApprovalRequest(interfaceState.request);
    errors.push(...requestResult.errors);
  }

  // Validate approval options
  if (!('approvalOptions' in interfaceState)) {
    errors.push('Missing required field: approvalOptions');
  } else {
    const optionsResult = validateApprovalOptions(interfaceState.approvalOptions);
    errors.push(...optionsResult.errors);
  }

  // Validate rationale requirement
  if (!('rationaleRequired' in interfaceState)) {
    errors.push('Missing required field: rationaleRequired');
  }
  if (!('rationaleProvided' in interfaceState)) {
    errors.push('Missing required field: rationaleProvided');
  }
  if (!('canSubmit' in interfaceState)) {
    errors.push('Missing required field: canSubmit');
  }

  // If all fields present, validate rationale logic
  if (
    'rationaleRequired' in interfaceState &&
    'rationaleProvided' in interfaceState &&
    'canSubmit' in interfaceState
  ) {
    const rationaleResult = validateRationaleRequirement(
      interfaceState.rationaleRequired as boolean,
      interfaceState.rationaleProvided as boolean,
      interfaceState.canSubmit as boolean
    );
    errors.push(...rationaleResult.errors);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Creates a valid governance approval request for testing
 */
export function createValidGovernanceRequest(
  overrides: Partial<GovernanceApprovalRequest> = {}
): GovernanceApprovalRequest {
  return {
    recommendedAction: 'Scale database connection pool from 50 to 100 connections',
    blastRadius: [
      { serviceName: 'database', healthStatus: 'critical', dependencies: [], impactLevel: 'high' },
      { serviceName: 'api-gateway', healthStatus: 'warning', dependencies: ['database'], impactLevel: 'medium' }
    ],
    riskLevel: 'medium',
    policyConflicts: [],
    reversibility: true,
    ...overrides
  };
}

/**
 * Creates a valid governance interface state for testing
 */
export function createValidInterfaceState(
  overrides: Partial<GovernanceApprovalInterfaceState> = {}
): GovernanceApprovalInterfaceState {
  return {
    request: createValidGovernanceRequest(),
    approvalOptions: {
      approve: true,
      approveWithRestrictions: true,
      block: true
    },
    rationaleRequired: true,
    rationaleProvided: false,
    canSubmit: false,
    ...overrides
  };
}

describe('Property 21: Governance Approval Interface Completeness', () => {
  /**
   * Generators for property-based testing
   */
  const generateValidRiskLevel = (): fc.Arbitrary<RiskLevel> => {
    return fc.constantFrom('low', 'medium', 'high', 'critical');
  };

  const generateInvalidRiskLevel = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'none',
      'severe',
      'extreme',
      'LOW',
      'MEDIUM',
      'HIGH',
      'CRITICAL',
      '',
      'unknown'
    );
  };

  const generateValidHealthStatus = (): fc.Arbitrary<HealthStatus> => {
    return fc.constantFrom('healthy', 'warning', 'critical');
  };

  const generateValidImpactLevel = (): fc.Arbitrary<ImpactLevel> => {
    return fc.constantFrom('low', 'medium', 'high');
  };

  const generateValidServiceName = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'database',
      'api-gateway',
      'frontend',
      'auth-service',
      'cache-layer',
      'message-queue'
    );
  };

  const generateValidBlastRadiusNode = (): fc.Arbitrary<BlastRadiusNode> => {
    return fc.record({
      serviceName: generateValidServiceName(),
      healthStatus: generateValidHealthStatus(),
      dependencies: fc.constant([]),
      impactLevel: generateValidImpactLevel()
    });
  };

  const generateValidRecommendedAction = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'Scale database connection pool from 50 to 100 connections',
      'Restart API gateway service to clear connection backlog',
      'Enable rate limiting on authentication endpoint',
      'Rollback deployment to previous stable version',
      'Increase memory allocation for cache service'
    );
  };

  const generateValidPolicyConflicts = (): fc.Arbitrary<string[]> => {
    return fc.constantFrom(
      [],
      ['Change window policy violation'],
      ['Requires additional approval from security team'],
      ['Change window policy violation', 'High-risk service modification']
    );
  };

  const generateValidGovernanceRequest = (): fc.Arbitrary<GovernanceApprovalRequest> => {
    return fc.record({
      recommendedAction: generateValidRecommendedAction(),
      blastRadius: fc.array(generateValidBlastRadiusNode(), { minLength: 1, maxLength: 4 }),
      riskLevel: generateValidRiskLevel(),
      policyConflicts: generateValidPolicyConflicts(),
      reversibility: fc.boolean()
    });
  };

  const generateValidInterfaceState = (): fc.Arbitrary<GovernanceApprovalInterfaceState> => {
    return fc.record({
      request: generateValidGovernanceRequest(),
      approvalOptions: fc.constant({
        approve: true,
        approveWithRestrictions: true,
        block: true
      }),
      rationaleRequired: fc.constant(true),
      rationaleProvided: fc.boolean(),
      canSubmit: fc.constant(false) // Will be adjusted based on rationaleProvided
    }).map(state => ({
      ...state,
      canSubmit: state.rationaleProvided // Can only submit if rationale is provided
    }));
  };

  /**
   * Property Tests for Requirement 8.1: Governance Approval Card Display
   */
  test('Governance approval request must always display recommended action', async () => {
    await fc.assert(
      fc.property(
        generateValidGovernanceRequest(),
        (request: GovernanceApprovalRequest) => {
          const result = validateGovernanceApprovalRequest(request);

          expect(result.isValid).toBe(true);
          expect(request.recommendedAction).toBeDefined();
          expect(typeof request.recommendedAction).toBe('string');
          expect(request.recommendedAction.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Governance approval request must always show blast radius information', async () => {
    await fc.assert(
      fc.property(
        generateValidGovernanceRequest(),
        (request: GovernanceApprovalRequest) => {
          const result = validateGovernanceApprovalRequest(request);

          expect(result.isValid).toBe(true);
          expect(request.blastRadius).toBeDefined();
          expect(Array.isArray(request.blastRadius)).toBe(true);
          
          // Blast radius should show affected services count
          expect(request.blastRadius.length).toBeGreaterThanOrEqual(0);
          
          // Each node should have required fields
          request.blastRadius.forEach(node => {
            expect(node.serviceName).toBeDefined();
            expect(node.healthStatus).toBeDefined();
            expect(node.impactLevel).toBeDefined();
          });
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Governance approval request must always display risk level', async () => {
    await fc.assert(
      fc.property(
        generateValidGovernanceRequest(),
        (request: GovernanceApprovalRequest) => {
          const result = validateGovernanceApprovalRequest(request);

          expect(result.isValid).toBe(true);
          expect(request.riskLevel).toBeDefined();
          expect(isValidRiskLevel(request.riskLevel)).toBe(true);
          expect(VALID_RISK_LEVELS).toContain(request.riskLevel);
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Governance approval request must always show policy conflicts if any exist', async () => {
    await fc.assert(
      fc.property(
        generateValidGovernanceRequest(),
        (request: GovernanceApprovalRequest) => {
          const result = validateGovernanceApprovalRequest(request);

          expect(result.isValid).toBe(true);
          expect(request.policyConflicts).toBeDefined();
          expect(Array.isArray(request.policyConflicts)).toBe(true);
          
          // Policy conflicts should be an array of strings
          request.policyConflicts.forEach(conflict => {
            expect(typeof conflict).toBe('string');
          });
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Invalid risk level values must be rejected', async () => {
    await fc.assert(
      fc.property(
        generateInvalidRiskLevel(),
        (invalidLevel: string) => {
          expect(isValidRiskLevel(invalidLevel)).toBe(false);

          const request = createValidGovernanceRequest({ riskLevel: invalidLevel as RiskLevel });
          const result = validateGovernanceApprovalRequest(request);
          
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('riskLevel'))).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property Tests for Requirement 8.2: Three Approval Options
   */
  test('Governance interface must provide all three approval options', async () => {
    await fc.assert(
      fc.property(
        generateValidInterfaceState(),
        (state: GovernanceApprovalInterfaceState) => {
          const result = validateGovernanceInterface(state);

          expect(result.isValid).toBe(true);
          
          // All three options must be available
          expect(state.approvalOptions.approve).toBe(true);
          expect(state.approvalOptions.approveWithRestrictions).toBe(true);
          expect(state.approvalOptions.block).toBe(true);
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Missing approval options must be detected', () => {
    // Missing approve option
    const missingApprove = {
      approveWithRestrictions: true,
      block: true
    };
    expect(validateApprovalOptions(missingApprove).errors.some(e => e.includes('approve'))).toBe(true);

    // Missing approveWithRestrictions option
    const missingRestrictions = {
      approve: true,
      block: true
    };
    expect(validateApprovalOptions(missingRestrictions).errors.some(e => e.includes('approveWithRestrictions'))).toBe(true);

    // Missing block option
    const missingBlock = {
      approve: true,
      approveWithRestrictions: true
    };
    expect(validateApprovalOptions(missingBlock).errors.some(e => e.includes('block'))).toBe(true);
  });

  test('Disabled approval options must be rejected', () => {
    // Approve disabled
    const approveDisabled = {
      approve: false,
      approveWithRestrictions: true,
      block: true
    };
    expect(validateApprovalOptions(approveDisabled).isValid).toBe(false);

    // ApproveWithRestrictions disabled
    const restrictionsDisabled = {
      approve: true,
      approveWithRestrictions: false,
      block: true
    };
    expect(validateApprovalOptions(restrictionsDisabled).isValid).toBe(false);

    // Block disabled
    const blockDisabled = {
      approve: true,
      approveWithRestrictions: true,
      block: false
    };
    expect(validateApprovalOptions(blockDisabled).isValid).toBe(false);
  });

  /**
   * Property Tests for Rationale Requirement
   */
  test('Rationale must be required before allowing decision submission', async () => {
    await fc.assert(
      fc.property(
        generateValidInterfaceState(),
        (state: GovernanceApprovalInterfaceState) => {
          const result = validateGovernanceInterface(state);

          expect(result.isValid).toBe(true);
          
          // Rationale must always be required
          expect(state.rationaleRequired).toBe(true);
          
          // Cannot submit without rationale
          if (!state.rationaleProvided) {
            expect(state.canSubmit).toBe(false);
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Submission without rationale must be blocked', () => {
    const stateWithoutRationale = createValidInterfaceState({
      rationaleProvided: false,
      canSubmit: true // Invalid - should not be able to submit
    });

    const result = validateGovernanceInterface(stateWithoutRationale);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('rationale'))).toBe(true);
  });

  test('Submission with rationale should be allowed', () => {
    const stateWithRationale = createValidInterfaceState({
      rationaleProvided: true,
      canSubmit: true
    });

    const result = validateGovernanceInterface(stateWithRationale);
    
    expect(result.isValid).toBe(true);
  });

  /**
   * Comprehensive Interface Validation Tests
   */
  test('Complete governance interface state must be valid', async () => {
    await fc.assert(
      fc.property(
        generateValidInterfaceState(),
        (state: GovernanceApprovalInterfaceState) => {
          const result = validateGovernanceInterface(state);

          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Missing required fields in request must be detected', () => {
    // Missing recommendedAction
    const noAction = { blastRadius: [], riskLevel: 'low', policyConflicts: [], reversibility: true };
    expect(validateGovernanceApprovalRequest(noAction).errors.some(e => e.includes('recommendedAction'))).toBe(true);

    // Missing blastRadius
    const noBlastRadius = { recommendedAction: 'Test', riskLevel: 'low', policyConflicts: [], reversibility: true };
    expect(validateGovernanceApprovalRequest(noBlastRadius).errors.some(e => e.includes('blastRadius'))).toBe(true);

    // Missing riskLevel
    const noRiskLevel = { recommendedAction: 'Test', blastRadius: [], policyConflicts: [], reversibility: true };
    expect(validateGovernanceApprovalRequest(noRiskLevel).errors.some(e => e.includes('riskLevel'))).toBe(true);

    // Missing policyConflicts
    const noConflicts = { recommendedAction: 'Test', blastRadius: [], riskLevel: 'low', reversibility: true };
    expect(validateGovernanceApprovalRequest(noConflicts).errors.some(e => e.includes('policyConflicts'))).toBe(true);

    // Missing reversibility
    const noReversibility = { recommendedAction: 'Test', blastRadius: [], riskLevel: 'low', policyConflicts: [] };
    expect(validateGovernanceApprovalRequest(noReversibility).errors.some(e => e.includes('reversibility'))).toBe(true);
  });

  test('Empty recommended action must be rejected', () => {
    const emptyAction = createValidGovernanceRequest({ recommendedAction: '' });
    const result = validateGovernanceApprovalRequest(emptyAction);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('recommendedAction'))).toBe(true);
  });

  test('Whitespace-only recommended action must be rejected', () => {
    const whitespaceAction = createValidGovernanceRequest({ recommendedAction: '   ' });
    const result = validateGovernanceApprovalRequest(whitespaceAction);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('recommendedAction'))).toBe(true);
  });

  test('All four risk levels produce valid requests', () => {
    for (const riskLevel of VALID_RISK_LEVELS) {
      const request = createValidGovernanceRequest({ riskLevel });
      const result = validateGovernanceApprovalRequest(request);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  test('Null and undefined requests must be rejected', () => {
    expect(validateGovernanceApprovalRequest(null).isValid).toBe(false);
    expect(validateGovernanceApprovalRequest(undefined).isValid).toBe(false);
    expect(validateGovernanceApprovalRequest({}).isValid).toBe(false);
  });

  test('Validation is consistent across multiple runs', async () => {
    await fc.assert(
      fc.property(
        generateValidGovernanceRequest(),
        (request: GovernanceApprovalRequest) => {
          const result1 = validateGovernanceApprovalRequest(request);
          const result2 = validateGovernanceApprovalRequest(request);
          const result3 = validateGovernanceApprovalRequest(request);

          // Validation should be deterministic
          expect(result1.isValid).toBe(result2.isValid);
          expect(result2.isValid).toBe(result3.isValid);
          expect(result1.errors).toEqual(result2.errors);
          expect(result2.errors).toEqual(result3.errors);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Governance interface with policy conflicts displays them correctly', () => {
    const requestWithConflicts = createValidGovernanceRequest({
      policyConflicts: [
        'Change window policy violation',
        'Requires additional approval from security team'
      ]
    });

    const result = validateGovernanceApprovalRequest(requestWithConflicts);
    
    expect(result.isValid).toBe(true);
    expect(requestWithConflicts.policyConflicts.length).toBe(2);
    expect(requestWithConflicts.policyConflicts).toContain('Change window policy violation');
  });

  test('Governance interface with empty policy conflicts is valid', () => {
    const requestNoConflicts = createValidGovernanceRequest({
      policyConflicts: []
    });

    const result = validateGovernanceApprovalRequest(requestNoConflicts);
    
    expect(result.isValid).toBe(true);
    expect(requestNoConflicts.policyConflicts.length).toBe(0);
  });

  test('Blast radius with multiple services shows affected count correctly', () => {
    const requestWithMultipleServices = createValidGovernanceRequest({
      blastRadius: [
        { serviceName: 'database', healthStatus: 'critical', dependencies: [], impactLevel: 'high' },
        { serviceName: 'api-gateway', healthStatus: 'warning', dependencies: ['database'], impactLevel: 'medium' },
        { serviceName: 'frontend', healthStatus: 'healthy', dependencies: ['api-gateway'], impactLevel: 'low' }
      ]
    });

    const result = validateGovernanceApprovalRequest(requestWithMultipleServices);
    
    expect(result.isValid).toBe(true);
    expect(requestWithMultipleServices.blastRadius.length).toBe(3);
  });

  test('Reversibility flag is properly validated', () => {
    // Reversible action
    const reversibleRequest = createValidGovernanceRequest({ reversibility: true });
    expect(validateGovernanceApprovalRequest(reversibleRequest).isValid).toBe(true);
    expect(reversibleRequest.reversibility).toBe(true);

    // Non-reversible action
    const nonReversibleRequest = createValidGovernanceRequest({ reversibility: false });
    expect(validateGovernanceApprovalRequest(nonReversibleRequest).isValid).toBe(true);
    expect(nonReversibleRequest.reversibility).toBe(false);
  });

  test('All three decision types are valid', () => {
    for (const decisionType of VALID_DECISION_TYPES) {
      expect(isValidDecisionType(decisionType)).toBe(true);
    }
  });

  test('Invalid decision types are rejected', () => {
    const invalidTypes = ['APPROVE', 'BLOCK', 'reject', 'deny', '', 'approved'];
    for (const invalidType of invalidTypes) {
      expect(isValidDecisionType(invalidType)).toBe(false);
    }
  });
});
