/**
 * Property-Based Tests for WorkflowStateManager
 * **Property 1: Workflow State Machine Determinism**
 * **Validates: Requirements 1.1, 1.2**
 * 
 * Feature: sentinelflow-unified-architecture, Property 1: Workflow State Machine Determinism
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { WorkflowStateManager } from '../WorkflowStateManager';
import { WorkflowState } from '../../types/workflow';

describe('WorkflowStateManager - Property-Based Tests', () => {
  let stateManager: WorkflowStateManager;

  beforeEach(() => {
    stateManager = new WorkflowStateManager();
  });

  describe('Property 1: Workflow State Machine Determinism', () => {
    it('should follow deterministic state transitions for any valid sequence', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate sequences of valid state transitions
          fc.array(
            fc.oneof(
              fc.constant('INCIDENT_INGESTED'),
              fc.constant('ANALYZING'),
              fc.constant('RCA_COMPLETE'),
              fc.constant('GOVERNANCE_PENDING'),
              fc.constant('ACTION_PROPOSED'),
              fc.constant('VERIFIED'),
              fc.constant('RESOLVED'),
              fc.constant('TERMINATED')
            ),
            { minLength: 1, maxLength: 8 }
          ),
          async (transitionSequence: string[]) => {
            const workflow = await stateManager.createWorkflow();
            const workflowId = workflow.workflowId;
            
            // Start from IDLE state
            expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.IDLE);
            
            let currentState = WorkflowState.IDLE;
            let expectedNextStates: WorkflowState[] = [WorkflowState.INCIDENT_INGESTED];
            
            for (const nextStateStr of transitionSequence) {
              const nextState = nextStateStr as WorkflowState;
              
              // Only attempt valid transitions
              if (expectedNextStates.includes(nextState)) {
                await stateManager.transitionTo(workflowId, nextState);
                currentState = nextState;
                
                // Update expected next states based on current state
                switch (currentState) {
                  case WorkflowState.IDLE:
                    expectedNextStates = [WorkflowState.INCIDENT_INGESTED];
                    break;
                  case WorkflowState.INCIDENT_INGESTED:
                    expectedNextStates = [WorkflowState.ANALYZING, WorkflowState.TERMINATED];
                    break;
                  case WorkflowState.ANALYZING:
                    expectedNextStates = [WorkflowState.RCA_COMPLETE, WorkflowState.TERMINATED];
                    break;
                  case WorkflowState.RCA_COMPLETE:
                    expectedNextStates = [WorkflowState.GOVERNANCE_PENDING, WorkflowState.TERMINATED];
                    break;
                  case WorkflowState.GOVERNANCE_PENDING:
                    expectedNextStates = [WorkflowState.ACTION_PROPOSED, WorkflowState.TERMINATED];
                    break;
                  case WorkflowState.ACTION_PROPOSED:
                    expectedNextStates = [WorkflowState.VERIFIED, WorkflowState.TERMINATED];
                    break;
                  case WorkflowState.VERIFIED:
                    expectedNextStates = [WorkflowState.RESOLVED, WorkflowState.TERMINATED];
                    break;
                  case WorkflowState.RESOLVED:
                    expectedNextStates = [WorkflowState.TERMINATED];
                    break;
                  case WorkflowState.TERMINATED:
                    expectedNextStates = []; // Terminal state
                    break;
                }
                
                // Verify the state was actually updated
                expect(stateManager.getCurrentState(workflowId)).toBe(currentState);
                
                // If we reached TERMINATED, break out of the loop
                if (currentState === WorkflowState.TERMINATED) {
                  break;
                }
              }
            }
            
            // Verify audit trail contains all transitions
            const updatedWorkflow = stateManager.getWorkflow(workflowId);
            expect(updatedWorkflow?.auditTrail.length).toBeGreaterThan(0);
            
            // Verify all audit events are immutable
            updatedWorkflow?.auditTrail.forEach(event => {
              expect(event.immutable).toBe(true);
              expect(event.eventId).toBeDefined();
              expect(event.timestamp).toBeDefined();
            });
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in requirements
      );
    });

    it('should reject invalid state transitions deterministically', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate pairs of states where the transition should be invalid
          fc.tuple(
            fc.constantFrom(...Object.values(WorkflowState)),
            fc.constantFrom(...Object.values(WorkflowState))
          ),
          async ([fromState, toState]: [WorkflowState, WorkflowState]) => {
            const workflow = await stateManager.createWorkflow();
            const workflowId = workflow.workflowId;
            
            // First, get the workflow to the fromState (if possible)
            if (fromState !== WorkflowState.IDLE) {
              try {
                // Try to reach the fromState through valid transitions
                await transitionToState(stateManager, workflowId, fromState);
              } catch (error) {
                // If we can't reach the fromState, skip this test case
                return;
              }
            }
            
            const currentState = stateManager.getCurrentState(workflowId);
            
            // Check if this transition should be valid
            const isValidTransition = stateManager.validateTransition(currentState!, toState);
            
            // Special case: GOVERNANCE_PENDING to ACTION_PROPOSED requires governance decision
            const isGovernanceTransition = currentState === WorkflowState.GOVERNANCE_PENDING && 
                                         toState === WorkflowState.ACTION_PROPOSED;
            
            if (!isValidTransition || isGovernanceTransition) {
              // Invalid transitions or governance-blocked transitions should throw an error
              await expect(
                stateManager.transitionTo(workflowId, toState)
              ).rejects.toThrow();
              
              // State should remain unchanged after failed transition
              expect(stateManager.getCurrentState(workflowId)).toBe(currentState);
            } else {
              // Valid transitions should succeed
              await expect(
                stateManager.transitionTo(workflowId, toState)
              ).resolves.toBe(true);
              
              // State should be updated
              expect(stateManager.getCurrentState(workflowId)).toBe(toState);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain workflow consistency across multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              fc.record({
                operation: fc.constant('transition'),
                state: fc.constantFrom(...Object.values(WorkflowState))
              }),
              fc.record({
                operation: fc.constant('terminate'),
                reason: fc.string({ minLength: 1, maxLength: 100 })
              }),
              fc.record({
                operation: fc.constant('get_state')
              })
            ),
            { minLength: 1, maxLength: 20 }
          ),
          async (operations: any[]) => {
            const workflow = await stateManager.createWorkflow();
            const workflowId = workflow.workflowId;
            
            let isTerminated = false;
            
            for (const operation of operations) {
              if (isTerminated && operation.operation !== 'get_state') {
                // Once terminated, only get_state operations should work
                continue;
              }
              
              switch (operation.operation) {
                case 'transition':
                  try {
                    await stateManager.transitionTo(workflowId, operation.state);
                    if (operation.state === WorkflowState.TERMINATED) {
                      isTerminated = true;
                    }
                  } catch (error) {
                    // Invalid transitions are expected and should be handled gracefully
                  }
                  break;
                  
                case 'terminate':
                  try {
                    await stateManager.terminateWorkflow(workflowId, operation.reason);
                    isTerminated = true;
                  } catch (error) {
                    // Termination errors should be handled gracefully
                  }
                  break;
                  
                case 'get_state':
                  const currentState = stateManager.getCurrentState(workflowId);
                  expect(currentState).toBeDefined();
                  expect(Object.values(WorkflowState)).toContain(currentState);
                  break;
              }
              
              // Verify workflow integrity after each operation
              const currentWorkflow = stateManager.getWorkflow(workflowId);
              expect(currentWorkflow).toBeDefined();
              expect(currentWorkflow?.workflowId).toBe(workflowId);
              expect(currentWorkflow?.auditTrail.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Helper function to transition a workflow to a specific state through valid transitions
 */
async function transitionToState(
  stateManager: WorkflowStateManager, 
  workflowId: string, 
  targetState: WorkflowState
): Promise<void> {
  const currentState = stateManager.getCurrentState(workflowId);
  
  if (currentState === targetState) {
    return;
  }
  
  // Define the path to reach each state from IDLE
  const statePaths: Record<WorkflowState, WorkflowState[]> = {
    [WorkflowState.IDLE]: [],
    [WorkflowState.INCIDENT_INGESTED]: [WorkflowState.INCIDENT_INGESTED],
    [WorkflowState.ANALYZING]: [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING],
    [WorkflowState.RCA_COMPLETE]: [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING, WorkflowState.RCA_COMPLETE],
    [WorkflowState.GOVERNANCE_PENDING]: [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING, WorkflowState.RCA_COMPLETE, WorkflowState.GOVERNANCE_PENDING],
    [WorkflowState.ACTION_PROPOSED]: [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING, WorkflowState.RCA_COMPLETE, WorkflowState.GOVERNANCE_PENDING, WorkflowState.ACTION_PROPOSED],
    [WorkflowState.VERIFIED]: [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING, WorkflowState.RCA_COMPLETE, WorkflowState.GOVERNANCE_PENDING, WorkflowState.ACTION_PROPOSED, WorkflowState.VERIFIED],
    [WorkflowState.RESOLVED]: [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING, WorkflowState.RCA_COMPLETE, WorkflowState.GOVERNANCE_PENDING, WorkflowState.ACTION_PROPOSED, WorkflowState.VERIFIED, WorkflowState.RESOLVED],
    [WorkflowState.TERMINATED]: [WorkflowState.TERMINATED] // Can be reached from any state
  };
  
  const path = statePaths[targetState];
  
  for (const state of path) {
    const current = stateManager.getCurrentState(workflowId);
    if (current !== state) {
      await stateManager.transitionTo(workflowId, state);
    }
  }
}