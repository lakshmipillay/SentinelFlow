/**
 * Property-Based Tests for Governance Decision Validation
 * **Property 12: Governance Decision Validation**
 * **Validates: Requirements 4.3, 4.4**
 * 
 * Tests that governance decision validation properly enforces the three-option approval system
 * (Approve/Restrict/Block) with proper validation of all required fields and constraints.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GovernanceGateService, GovernanceRequest } from '../GovernanceGateService';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { WorkflowState } from '../../types/workflow';

describe('Property 12: Governance Decision Validation', () => {
  let stateManager: WorkflowStateManager;
  let governanceGate: GovernanceGateService;

  beforeEach(() => {
    stateManager = new WorkflowStateManager();
    governanceGate = new GovernanceGateService(stateManager);
  });

  /**
   * Simplified generators for property-based testing
   */
  const generateValidDecision = (): fc.Arbitrary<'approve' | 'approve_with_restrictions' | 'block'> => {
    return fc.constantFrom('approve', 'approve_with_restrictions', 'block');
  };

  const generateInvalidDecision = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'invalid_decision',
      'maybe',
      'reject',
      'deny',
      'accept',
      '',
      'APPROVE', // wrong case
      'approve_with_restriction', // missing 's'
      'blocked' // wrong form
    );
  };

  const generateValidRationale = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'Approved for emergency response - low risk action',
      'Blocked due to high blast radius and policy conflicts',
      'Approved with monitoring restrictions for safety',
      'Standard maintenance window approved by SRE team',
      'Critical security issue requires immediate action',
      'Production deployment blocked during business hours',
      'Database restart approved with rollback plan ready'
    );
  };

  const generateInvalidRationale = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      '', // empty
      'short', // too short
      'ok', // too short
      '123456789', // exactly 9 chars, still too short
      '   ', // whitespace only
      null as any, // null
      undefined as any // undefined
    );
  };

  const generateValidApprover = (): fc.Arbitrary<{ id: string; role: string }> => {
    return fc.constantFrom(
      { id: 'user1', role: 'incident-commander' },
      { id: 'user2', role: 'security-lead' },
      { id: 'user3', role: 'sre-lead' },
      { id: 'user4', role: 'governance-officer' },
      { id: 'admin', role: 'system-admin' }
    );
  };

  const generateInvalidApprover = (): fc.Arbitrary<any> => {
    return fc.constantFrom(
      { id: '', role: 'sre-lead' }, // empty id
      { id: 'user1', role: '' }, // empty role
      { id: null, role: 'sre-lead' }, // null id
      { id: 'user1', role: null }, // null role
      { role: 'sre-lead' }, // missing id
      { id: 'user1' }, // missing role
      null, // null approver
      undefined, // undefined approver
      'invalid-approver' // string instead of object
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

  const generateIncidentContext = (): fc.Arbitrary<{
    incidentSummary: string;
    agentFindings: string[];
    correlationSummary: string;
    confidenceLevel: number;
  }> => {
    return fc.constantFrom(
      {
        incidentSummary: 'Database connection timeout affecting API responses',
        agentFindings: ['High database latency detected', 'Connection pool exhausted'],
        correlationSummary: 'Database performance degradation causing API failures',
        confidenceLevel: 0.8
      },
      {
        incidentSummary: 'Authentication service returning 500 errors',
        agentFindings: ['Auth service memory usage at 95%', 'JWT validation failing'],
        correlationSummary: 'Memory leak in auth service causing failures',
        confidenceLevel: 0.9
      }
    );
  };

  const generateRecommendedAction = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'Restart database service',
      'Scale up API instances',
      'Rollback deployment',
      'Update configuration',
      'Restart load balancer'
    );
  };

  /**
   * Helper function to create a workflow in GOVERNANCE_PENDING state with a governance request
   */
  async function createGovernanceRequest(): Promise<{ workflowId: string; requestId: string }> {
    const workflow = await stateManager.createWorkflow();
    const workflowId = workflow.workflowId;
    
    await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
    await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
    await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
    await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
    
    const request = await governanceGate.createGovernanceRequest(
      workflowId,
      'Restart database service',
      {
        incidentSummary: 'Database timeout issue',
        agentFindings: ['High latency detected'],
        correlationSummary: 'DB performance degradation',
        confidenceLevel: 0.8
      }
    );
    
    return { workflowId, requestId: request.requestId };
  }

  /**
   * Property Tests
   */
  test('Valid governance decisions with all required fields are accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecision(),
        generateValidRationale(),
        generateValidApprover(),
        fc.option(generateValidRestrictions(), { nil: undefined }),
        async (decision, rationale, approver, restrictions) => {
          const { workflowId, requestId } = await createGovernanceRequest();
          
          // Process governance decision with valid inputs
          const result = await governanceGate.processGovernanceDecision(
            requestId,
            decision,
            rationale,
            approver,
            decision === 'approve_with_restrictions' ? (restrictions || ['Default restriction']) : undefined
          );
          
          // Verify valid decisions are accepted
          expect(result.success).toBe(true);
          expect(result.validationErrors).toBeUndefined();
          expect(result.governanceDecision).toBeDefined();
          expect(result.governanceDecision?.decision).toBe(decision);
          expect(result.governanceDecision?.rationale).toBe(rationale);
          expect(result.governanceDecision?.approver).toEqual(approver);
          
          // Verify restrictions are properly handled
          if (decision === 'approve_with_restrictions') {
            expect(result.governanceDecision?.restrictions).toBeDefined();
            expect(result.governanceDecision?.restrictions?.length).toBeGreaterThan(0);
          }
          
          // Verify workflow state changes appropriately
          if (decision === 'block') {
            expect(result.workflowTerminated).toBe(true);
            expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.TERMINATED);
          } else {
            expect(result.workflowTerminated).toBe(false);
            expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.ACTION_PROPOSED);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Invalid decision types are rejected with validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateInvalidDecision(),
        generateValidRationale(),
        generateValidApprover(),
        async (invalidDecision, rationale, approver) => {
          const { workflowId, requestId } = await createGovernanceRequest();
          
          // Attempt to process governance decision with invalid decision type
          const result = await governanceGate.processGovernanceDecision(
            requestId,
            invalidDecision as any,
            rationale,
            approver
          );
          
          // Verify invalid decisions are rejected
          expect(result.success).toBe(false);
          expect(result.validationErrors).toBeDefined();
          expect(result.validationErrors!.length).toBeGreaterThan(0);
          expect(result.validationErrors!.some(error => 
            error.includes('Invalid decision type') || error.includes('Must be one of')
          )).toBe(true);
          
          // Verify no governance decision was created
          expect(result.governanceDecision).toBeUndefined();
          expect(result.workflowTerminated).toBeUndefined();
          
          // Verify workflow remains in GOVERNANCE_PENDING state
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.GOVERNANCE_PENDING);
          
          // Verify request remains pending
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Invalid rationale inputs are rejected with validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecision(),
        generateInvalidRationale(),
        generateValidApprover(),
        async (decision, invalidRationale, approver) => {
          const { workflowId, requestId } = await createGovernanceRequest();
          
          // Attempt to process governance decision with invalid rationale
          const result = await governanceGate.processGovernanceDecision(
            requestId,
            decision,
            invalidRationale,
            approver
          );
          
          // Verify invalid rationale is rejected
          expect(result.success).toBe(false);
          expect(result.validationErrors).toBeDefined();
          expect(result.validationErrors!.length).toBeGreaterThan(0);
          expect(result.validationErrors!.some(error => 
            error.includes('Rationale') && (error.includes('required') || error.includes('10 characters'))
          )).toBe(true);
          
          // Verify no governance decision was created
          expect(result.governanceDecision).toBeUndefined();
          expect(result.workflowTerminated).toBeUndefined();
          
          // Verify workflow remains in GOVERNANCE_PENDING state
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.GOVERNANCE_PENDING);
          
          // Verify request remains pending
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Invalid approver information is rejected with validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecision(),
        generateValidRationale(),
        generateInvalidApprover(),
        async (decision, rationale, invalidApprover) => {
          const { workflowId, requestId } = await createGovernanceRequest();
          
          // Attempt to process governance decision with invalid approver
          const result = await governanceGate.processGovernanceDecision(
            requestId,
            decision,
            rationale,
            invalidApprover
          );
          
          // Verify invalid approver is rejected
          expect(result.success).toBe(false);
          expect(result.validationErrors).toBeDefined();
          expect(result.validationErrors!.length).toBeGreaterThan(0);
          expect(result.validationErrors!.some(error => 
            error.includes('approver') && (error.includes('required') || error.includes('id') || error.includes('role'))
          )).toBe(true);
          
          // Verify no governance decision was created
          expect(result.governanceDecision).toBeUndefined();
          expect(result.workflowTerminated).toBeUndefined();
          
          // Verify workflow remains in GOVERNANCE_PENDING state
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.GOVERNANCE_PENDING);
          
          // Verify request remains pending
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Approve with restrictions requires restrictions to be provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidRationale(),
        generateValidApprover(),
        async (rationale, approver) => {
          const { workflowId, requestId } = await createGovernanceRequest();
          
          // Attempt to approve with restrictions but without providing restrictions
          const result = await governanceGate.processGovernanceDecision(
            requestId,
            'approve_with_restrictions',
            rationale,
            approver,
            undefined // No restrictions provided
          );
          
          // Verify that restrictions are required for approve_with_restrictions
          expect(result.success).toBe(false);
          expect(result.validationErrors).toBeDefined();
          expect(result.validationErrors!.length).toBeGreaterThan(0);
          expect(result.validationErrors!.some(error => 
            error.includes('Restrictions are required when approving with restrictions')
          )).toBe(true);
          
          // Verify no governance decision was created
          expect(result.governanceDecision).toBeUndefined();
          expect(result.workflowTerminated).toBeUndefined();
          
          // Verify workflow remains in GOVERNANCE_PENDING state
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.GOVERNANCE_PENDING);
          
          // Verify request remains pending
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Non-existent governance requests are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecision(),
        generateValidRationale(),
        generateValidApprover(),
        fc.constantFrom('non-existent-id', 'invalid-uuid', '12345', ''),
        async (decision, rationale, approver, invalidRequestId) => {
          // Attempt to process governance decision for non-existent request
          const result = await governanceGate.processGovernanceDecision(
            invalidRequestId,
            decision,
            rationale,
            approver
          );
          
          // Verify non-existent requests are rejected
          expect(result.success).toBe(false);
          expect(result.validationErrors).toBeDefined();
          expect(result.validationErrors!.length).toBeGreaterThan(0);
          expect(result.validationErrors!.some(error => 
            error.includes('Governance request not found')
          )).toBe(true);
          
          // Verify no governance decision was created
          expect(result.governanceDecision).toBeUndefined();
          expect(result.workflowTerminated).toBeUndefined();
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Already processed governance requests are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecision(),
        generateValidRationale(),
        generateValidApprover(),
        async (decision, rationale, approver) => {
          const { workflowId, requestId } = await createGovernanceRequest();
          
          // Process the governance decision once
          const firstResult = await governanceGate.processGovernanceDecision(
            requestId,
            decision,
            rationale,
            approver,
            decision === 'approve_with_restrictions' ? ['Test restriction'] : undefined
          );
          
          expect(firstResult.success).toBe(true);
          
          // Attempt to process the same request again
          const secondResult = await governanceGate.processGovernanceDecision(
            requestId,
            decision,
            rationale,
            approver,
            decision === 'approve_with_restrictions' ? ['Test restriction'] : undefined
          );
          
          // Verify already processed requests are rejected
          expect(secondResult.success).toBe(false);
          expect(secondResult.validationErrors).toBeDefined();
          expect(secondResult.validationErrors!.length).toBeGreaterThan(0);
          expect(secondResult.validationErrors!.some(error => 
            error.includes('Governance request not found') || error.includes('Request already processed')
          )).toBe(true);
          
          // Verify no additional governance decision was created
          expect(secondResult.governanceDecision).toBeUndefined();
          expect(secondResult.workflowTerminated).toBeUndefined();
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Governance decision validation maintains consistency across all decision types', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDecision(),
        generateValidRationale(),
        generateValidApprover(),
        fc.option(generateValidRestrictions(), { nil: undefined }),
        async (decision, rationale, approver, restrictions) => {
          const { workflowId, requestId } = await createGovernanceRequest();
          
          // Process governance decision
          const result = await governanceGate.processGovernanceDecision(
            requestId,
            decision,
            rationale,
            approver,
            decision === 'approve_with_restrictions' ? (restrictions || ['Default restriction']) : undefined
          );
          
          // Verify all valid decisions are processed successfully
          expect(result.success).toBe(true);
          expect(result.validationErrors).toBeUndefined();
          expect(result.governanceDecision).toBeDefined();
          
          // Verify decision consistency
          expect(result.governanceDecision?.decision).toBe(decision);
          expect(result.governanceDecision?.rationale).toBe(rationale);
          expect(result.governanceDecision?.approver).toEqual(approver);
          expect(result.governanceDecision?.timestamp).toBeDefined();
          expect(result.governanceDecision?.blastRadiusAssessment).toBeDefined();
          
          // Verify workflow state consistency
          const expectedTerminated = decision === 'block';
          expect(result.workflowTerminated).toBe(expectedTerminated);
          
          const expectedState = decision === 'block' ? WorkflowState.TERMINATED : WorkflowState.ACTION_PROPOSED;
          expect(stateManager.getCurrentState(workflowId)).toBe(expectedState);
          
          // Verify governance decision is recorded in workflow
          const workflow = stateManager.getWorkflow(workflowId);
          expect(workflow?.governanceDecision).toBeDefined();
          expect(workflow?.governanceDecision?.decision).toBe(decision);
          
          // Verify request is no longer pending
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(false);
          
          // Verify audit trail contains governance decision
          expect(workflow?.auditTrail.some(event => 
            event.eventType === 'governance_decision'
          )).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Validation errors contain specific and actionable information', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          { decision: 'invalid', rationale: 'Valid rationale for testing', approver: { id: 'user1', role: 'sre-lead' }, expectedError: 'Invalid decision type' },
          { decision: 'approve', rationale: 'short', approver: { id: 'user1', role: 'sre-lead' }, expectedError: '10 characters' },
          { decision: 'approve', rationale: 'Valid rationale for testing', approver: { id: '', role: 'sre-lead' }, expectedError: 'approver' },
          { decision: 'approve', rationale: 'Valid rationale for testing', approver: { id: 'user1', role: '' }, expectedError: 'approver' },
          { decision: 'approve_with_restrictions', rationale: 'Valid rationale for testing', approver: { id: 'user1', role: 'sre-lead' }, expectedError: 'Restrictions are required' }
        ),
        async (testCase) => {
          const { workflowId, requestId } = await createGovernanceRequest();
          
          // Process governance decision with invalid input
          const result = await governanceGate.processGovernanceDecision(
            requestId,
            testCase.decision as any,
            testCase.rationale,
            testCase.approver as any,
            testCase.decision === 'approve_with_restrictions' ? undefined : []
          );
          
          // Verify validation fails
          expect(result.success).toBe(false);
          expect(result.validationErrors).toBeDefined();
          expect(result.validationErrors!.length).toBeGreaterThan(0);
          
          // Verify specific error message is present
          expect(result.validationErrors!.some(error => 
            error.includes(testCase.expectedError)
          )).toBe(true);
          
          // Verify error messages are actionable (not just generic)
          result.validationErrors!.forEach(error => {
            expect(error.length).toBeGreaterThan(10); // Not just "Invalid"
            expect(error).not.toBe('Error'); // Not generic
          });
          
          // Verify workflow state is unchanged
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.GOVERNANCE_PENDING);
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });
});