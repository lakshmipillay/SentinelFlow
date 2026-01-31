/**
 * Property-Based Tests for Governance Gate Enforcement
 * **Property 4: Governance Gate Enforcement Invariant**
 * **Validates: Requirements 1.5, 4.1**
 * 
 * Tests that governance gates properly enforce blocking behavior and prevent 
 * unauthorized workflow progression across all possible governance scenarios.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GovernanceGateService, GovernanceRequest } from '../GovernanceGateService';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { WorkflowState, GovernanceDecision } from '../../types/workflow';

describe('Property 4: Governance Gate Enforcement Invariant', () => {
  let stateManager: WorkflowStateManager;
  let governanceGate: GovernanceGateService;

  beforeEach(() => {
    stateManager = new WorkflowStateManager();
    governanceGate = new GovernanceGateService(stateManager);
  });

  /**
   * Simplified generators for property-based testing
   */
  const generateGovernanceDecision = (): fc.Arbitrary<'approve' | 'approve_with_restrictions' | 'block'> => {
    return fc.constantFrom('approve', 'approve_with_restrictions', 'block');
  };

  const generateRationale = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'Approved for emergency response',
      'Low risk action approved',
      'Blocked due to high risk',
      'Approved with monitoring restrictions',
      'Standard maintenance approved'
    );
  };

  const generateApprover = (): fc.Arbitrary<{ id: string; role: string }> => {
    return fc.constantFrom(
      { id: 'user1', role: 'incident-commander' },
      { id: 'user2', role: 'security-lead' },
      { id: 'user3', role: 'sre-lead' },
      { id: 'user4', role: 'governance-officer' }
    );
  };

  const generateRestrictions = (): fc.Arbitrary<string[]> => {
    return fc.constantFrom(
      ['Monitor closely'],
      ['Rollback if issues'],
      ['Notify stakeholders'],
      ['Monitor closely', 'Rollback if issues']
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
      },
      {
        incidentSummary: 'Payment processing delays reported by users',
        agentFindings: ['Payment gateway timeout', 'Queue backlog detected'],
        correlationSummary: 'External payment service degradation',
        confidenceLevel: 0.7
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
   * Helper function to create a workflow in GOVERNANCE_PENDING state
   */
  async function createWorkflowInGovernancePending(): Promise<string> {
    const workflow = await stateManager.createWorkflow();
    const workflowId = workflow.workflowId;
    
    await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
    await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
    await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
    await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
    
    return workflowId;
  }

  /**
   * Property Tests
   */
  test('Governance gate blocks workflow progression without explicit approval', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateIncidentContext(),
        generateRecommendedAction(),
        async (incidentContext, recommendedAction) => {
          const workflowId = await createWorkflowInGovernancePending();
          
          // Create governance request
          const request = await governanceGate.createGovernanceRequest(
            workflowId,
            recommendedAction,
            incidentContext
          );
          
          // Verify workflow is in GOVERNANCE_PENDING state
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.GOVERNANCE_PENDING);
          
          // Attempt to transition to ACTION_PROPOSED without governance decision
          await expect(
            stateManager.transitionTo(workflowId, WorkflowState.ACTION_PROPOSED)
          ).rejects.toThrow('Cannot transition from GOVERNANCE_PENDING to ACTION_PROPOSED without governance decision');
          
          // Verify workflow remains in GOVERNANCE_PENDING state
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.GOVERNANCE_PENDING);
          
          // Verify no governance decision exists
          const workflow = stateManager.getWorkflow(workflowId);
          expect(workflow?.governanceDecision).toBeUndefined();
          
          // Verify governance request is still pending
          expect(request.status).toBe('pending');
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Block decisions immediately terminate workflows and prevent progression', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateIncidentContext(),
        generateRecommendedAction(),
        generateRationale(),
        generateApprover(),
        async (incidentContext, recommendedAction, rationale, approver) => {
          const workflowId = await createWorkflowInGovernancePending();
          
          // Create governance request
          const request = await governanceGate.createGovernanceRequest(
            workflowId,
            recommendedAction,
            incidentContext
          );
          
          // Process block decision
          const result = await governanceGate.processGovernanceDecision(
            request.requestId,
            'block',
            rationale,
            approver
          );
          
          // Verify decision was processed successfully
          expect(result.success).toBe(true);
          expect(result.workflowTerminated).toBe(true);
          expect(result.governanceDecision?.decision).toBe('block');
          
          // Verify workflow was terminated
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.TERMINATED);
          
          // Verify governance decision is recorded
          const workflow = stateManager.getWorkflow(workflowId);
          expect(workflow?.governanceDecision).toBeDefined();
          expect(workflow?.governanceDecision?.decision).toBe('block');
          
          // Verify no further transitions are possible
          await expect(
            stateManager.transitionTo(workflowId, WorkflowState.ACTION_PROPOSED)
          ).rejects.toThrow('Invalid state transition from TERMINATED');
          
          await expect(
            stateManager.transitionTo(workflowId, WorkflowState.VERIFIED)
          ).rejects.toThrow('Invalid state transition from TERMINATED');
          
          // Verify request is no longer pending
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(false);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Approve decisions allow workflow progression to ACTION_PROPOSED', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateIncidentContext(),
        generateRecommendedAction(),
        generateRationale(),
        generateApprover(),
        async (incidentContext, recommendedAction, rationale, approver) => {
          const workflowId = await createWorkflowInGovernancePending();
          
          // Create governance request
          const request = await governanceGate.createGovernanceRequest(
            workflowId,
            recommendedAction,
            incidentContext
          );
          
          // Process approve decision
          const result = await governanceGate.processGovernanceDecision(
            request.requestId,
            'approve',
            rationale,
            approver
          );
          
          // Verify decision was processed successfully
          expect(result.success).toBe(true);
          expect(result.workflowTerminated).toBe(false);
          expect(result.governanceDecision?.decision).toBe('approve');
          
          // Verify workflow transitioned to ACTION_PROPOSED
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.ACTION_PROPOSED);
          
          // Verify governance decision is recorded
          const workflow = stateManager.getWorkflow(workflowId);
          expect(workflow?.governanceDecision).toBeDefined();
          expect(workflow?.governanceDecision?.decision).toBe('approve');
          
          // Verify further valid transitions are possible
          await expect(
            stateManager.transitionTo(workflowId, WorkflowState.VERIFIED)
          ).resolves.toBe(true);
          
          // Verify request is no longer pending
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(false);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Approve with restrictions decisions allow progression with recorded restrictions', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateIncidentContext(),
        generateRecommendedAction(),
        generateRationale(),
        generateApprover(),
        generateRestrictions(),
        async (incidentContext, recommendedAction, rationale, approver, restrictions) => {
          const workflowId = await createWorkflowInGovernancePending();
          
          // Create governance request
          const request = await governanceGate.createGovernanceRequest(
            workflowId,
            recommendedAction,
            incidentContext
          );
          
          // Process approve with restrictions decision
          const result = await governanceGate.processGovernanceDecision(
            request.requestId,
            'approve_with_restrictions',
            rationale,
            approver,
            restrictions
          );
          
          // Verify decision was processed successfully
          expect(result.success).toBe(true);
          expect(result.workflowTerminated).toBe(false);
          expect(result.governanceDecision?.decision).toBe('approve_with_restrictions');
          expect(result.governanceDecision?.restrictions).toEqual(restrictions);
          
          // Verify workflow transitioned to ACTION_PROPOSED
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.ACTION_PROPOSED);
          
          // Verify governance decision and restrictions are recorded
          const workflow = stateManager.getWorkflow(workflowId);
          expect(workflow?.governanceDecision).toBeDefined();
          expect(workflow?.governanceDecision?.decision).toBe('approve_with_restrictions');
          expect(workflow?.governanceDecision?.restrictions).toEqual(restrictions);
          
          // Verify further valid transitions are possible
          await expect(
            stateManager.transitionTo(workflowId, WorkflowState.VERIFIED)
          ).resolves.toBe(true);
          
          // Verify request is no longer pending
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(false);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Governance gate enforcement is consistent across all decision types', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateIncidentContext(),
        generateRecommendedAction(),
        generateGovernanceDecision(),
        generateRationale(),
        generateApprover(),
        fc.option(generateRestrictions(), { nil: undefined }),
        async (incidentContext, recommendedAction, decision, rationale, approver, restrictions) => {
          const workflowId = await createWorkflowInGovernancePending();
          
          // Create governance request
          const request = await governanceGate.createGovernanceRequest(
            workflowId,
            recommendedAction,
            incidentContext
          );
          
          // Verify initial state
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.GOVERNANCE_PENDING);
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(true);
          
          // Process governance decision
          const result = await governanceGate.processGovernanceDecision(
            request.requestId,
            decision,
            rationale,
            approver,
            decision === 'approve_with_restrictions' ? (restrictions || ['Default restriction']) : undefined
          );
          
          // Verify decision was processed successfully
          expect(result.success).toBe(true);
          expect(result.governanceDecision?.decision).toBe(decision);
          
          // Verify state transitions based on decision type
          if (decision === 'block') {
            expect(result.workflowTerminated).toBe(true);
            expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.TERMINATED);
            
            // Verify no further transitions are possible
            await expect(
              stateManager.transitionTo(workflowId, WorkflowState.ACTION_PROPOSED)
            ).rejects.toThrow('Invalid state transition from TERMINATED');
          } else {
            expect(result.workflowTerminated).toBe(false);
            expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.ACTION_PROPOSED);
            
            // Verify further valid transitions are possible
            await expect(
              stateManager.transitionTo(workflowId, WorkflowState.VERIFIED)
            ).resolves.toBe(true);
          }
          
          // Verify governance decision is recorded
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

  test('Multiple workflows maintain independent governance gate enforcement', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          [
            {
              incidentContext: {
                incidentSummary: 'Database timeout',
                agentFindings: ['High latency'],
                correlationSummary: 'DB performance issue',
                confidenceLevel: 0.8
              },
              recommendedAction: 'Restart database service',
              decision: 'approve' as const,
              rationale: 'Low risk restart approved',
              approver: { id: 'user1', role: 'sre-lead' }
            },
            {
              incidentContext: {
                incidentSummary: 'Auth service errors',
                agentFindings: ['Memory leak'],
                correlationSummary: 'Auth service degradation',
                confidenceLevel: 0.9
              },
              recommendedAction: 'Scale up API instances',
              decision: 'block' as const,
              rationale: 'High risk action blocked',
              approver: { id: 'user2', role: 'security-lead' }
            }
          ]
        ),
        async (workflowScenarios) => {
          const workflowIds: string[] = [];
          const requests: GovernanceRequest[] = [];
          
          // Create multiple workflows in GOVERNANCE_PENDING state
          for (const scenario of workflowScenarios) {
            const workflowId = await createWorkflowInGovernancePending();
            workflowIds.push(workflowId);
            
            const request = await governanceGate.createGovernanceRequest(
              workflowId,
              scenario.recommendedAction,
              scenario.incidentContext
            );
            requests.push(request);
          }
          
          // Verify all workflows are in GOVERNANCE_PENDING state
          workflowIds.forEach(workflowId => {
            expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.GOVERNANCE_PENDING);
            expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(true);
          });
          
          // Process governance decisions for each workflow
          for (let i = 0; i < workflowScenarios.length; i++) {
            const scenario = workflowScenarios[i];
            const request = requests[i];
            const workflowId = workflowIds[i];
            
            const result = await governanceGate.processGovernanceDecision(
              request.requestId,
              scenario.decision,
              scenario.rationale,
              scenario.approver,
              scenario.decision === 'approve_with_restrictions' ? ['Test restriction'] : undefined
            );
            
            expect(result.success).toBe(true);
            
            // Verify this workflow's state changed appropriately
            if (scenario.decision === 'block') {
              expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.TERMINATED);
            } else {
              expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.ACTION_PROPOSED);
            }
            
            // Verify other workflows remain unaffected
            for (let j = i + 1; j < workflowIds.length; j++) {
              expect(stateManager.getCurrentState(workflowIds[j])).toBe(WorkflowState.GOVERNANCE_PENDING);
              expect(governanceGate.hasPendingGovernanceRequest(workflowIds[j])).toBe(true);
            }
          }
          
          // Verify final states are correct
          workflowScenarios.forEach((scenario, index) => {
            const workflowId = workflowIds[index];
            const expectedState = scenario.decision === 'block' ? WorkflowState.TERMINATED : WorkflowState.ACTION_PROPOSED;
            expect(stateManager.getCurrentState(workflowId)).toBe(expectedState);
            expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(false);
          });
        }
      ),
      { numRuns: 20 } // Reduced from 50 for performance
    );
  }, 10000); // 10 second timeout

  test('Governance gate validation prevents invalid decision processing', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateIncidentContext(),
        generateRecommendedAction(),
        fc.constantFrom(
          { decision: 'invalid_decision', rationale: 'Valid rationale', approver: { id: 'user1', role: 'sre-lead' } },
          { decision: 'approve', rationale: 'short', approver: { id: 'user1', role: 'sre-lead' } },
          { decision: 'approve', rationale: 'Valid rationale', approver: { id: '', role: 'sre-lead' } },
          { decision: 'approve', rationale: 'Valid rationale', approver: { id: 'user1', role: '' } }
        ),
        async (incidentContext, recommendedAction, invalidInputs) => {
          const workflowId = await createWorkflowInGovernancePending();
          
          // Create governance request
          const request = await governanceGate.createGovernanceRequest(
            workflowId,
            recommendedAction,
            incidentContext
          );
          
          // Attempt to process invalid governance decision
          const result = await governanceGate.processGovernanceDecision(
            request.requestId,
            invalidInputs.decision as any,
            invalidInputs.rationale,
            invalidInputs.approver as any
          );
          
          // Verify invalid decisions are rejected
          expect(result.success).toBe(false);
          expect(result.validationErrors).toBeDefined();
          expect(result.validationErrors!.length).toBeGreaterThan(0);
          
          // Verify workflow remains in GOVERNANCE_PENDING state
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.GOVERNANCE_PENDING);
          
          // Verify no governance decision was recorded
          const workflow = stateManager.getWorkflow(workflowId);
          expect(workflow?.governanceDecision).toBeUndefined();
          
          // Verify request remains pending
          expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Governance gate enforcement maintains audit trail integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateIncidentContext(),
        generateRecommendedAction(),
        generateGovernanceDecision(),
        generateRationale(),
        generateApprover(),
        async (incidentContext, recommendedAction, decision, rationale, approver) => {
          const workflowId = await createWorkflowInGovernancePending();
          
          // Get initial audit trail length
          const initialWorkflow = stateManager.getWorkflow(workflowId);
          const initialAuditLength = initialWorkflow?.auditTrail.length || 0;
          
          // Create governance request
          const request = await governanceGate.createGovernanceRequest(
            workflowId,
            recommendedAction,
            incidentContext
          );
          
          // Process governance decision
          const result = await governanceGate.processGovernanceDecision(
            request.requestId,
            decision,
            rationale,
            approver,
            decision === 'approve_with_restrictions' ? ['Test restriction'] : undefined
          );
          
          expect(result.success).toBe(true);
          
          // Verify audit trail was updated
          const finalWorkflow = stateManager.getWorkflow(workflowId);
          expect(finalWorkflow?.auditTrail.length).toBeGreaterThan(initialAuditLength);
          
          // Verify governance decision audit event exists
          const governanceAuditEvent = finalWorkflow?.auditTrail.find(event => 
            event.eventType === 'governance_decision'
          );
          expect(governanceAuditEvent).toBeDefined();
          expect(governanceAuditEvent?.actor).toBe('human');
          expect(governanceAuditEvent?.details.governanceDecision).toBeDefined();
          expect(governanceAuditEvent?.details.governanceDecision?.decision).toBe(decision);
          expect(governanceAuditEvent?.immutable).toBe(true);
          
          // Verify state transition audit events
          const stateTransitionEvents = finalWorkflow?.auditTrail.filter(event => 
            event.eventType === 'state_transition'
          );
          expect(stateTransitionEvents!.length).toBeGreaterThan(0);
          
          // For block decisions, verify termination audit event
          if (decision === 'block') {
            const terminationEvent = finalWorkflow?.auditTrail.find(event => 
              event.eventType === 'workflow_termination'
            );
            expect(terminationEvent).toBeDefined();
            expect(terminationEvent?.immutable).toBe(true);
          }
          
          // Verify all audit events are immutable and have required fields
          finalWorkflow?.auditTrail.forEach(event => {
            expect(event.immutable).toBe(true);
            expect(event.eventId).toBeDefined();
            expect(event.workflowId).toBe(workflowId);
            expect(event.timestamp).toBeDefined();
            expect(event.actor).toBeDefined();
          });
        }
      ),
      { numRuns: 30 }
    );
  });
});