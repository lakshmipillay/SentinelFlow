/**
 * Tests for WorkflowStateManager
 * Validates deterministic state transitions and workflow management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowStateManager } from '../WorkflowStateManager';
import { WorkflowState } from '../../types/workflow';

describe('WorkflowStateManager', () => {
  let stateManager: WorkflowStateManager;

  beforeEach(() => {
    stateManager = new WorkflowStateManager();
  });

  describe('Workflow Creation', () => {
    it('should create a new workflow in IDLE state', async () => {
      const workflow = await stateManager.createWorkflow();
      
      expect(workflow.workflowId).toBeDefined();
      expect(workflow.currentState).toBe(WorkflowState.IDLE);
      expect(workflow.agentOutputs).toEqual([]);
      expect(workflow.auditTrail).toHaveLength(1);
      expect(workflow.auditTrail[0].eventType).toBe('state_transition');
      expect(workflow.auditTrail[0].details.toState).toBe(WorkflowState.IDLE);
    });

    it('should generate unique workflow IDs', async () => {
      const workflow1 = await stateManager.createWorkflow();
      const workflow2 = await stateManager.createWorkflow();
      
      expect(workflow1.workflowId).not.toBe(workflow2.workflowId);
    });
  });

  describe('State Transitions', () => {
    it('should allow valid state transitions', async () => {
      const workflow = await stateManager.createWorkflow();
      
      // IDLE -> INCIDENT_INGESTED
      const result = await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);
      expect(result).toBe(true);
      expect(stateManager.getCurrentState(workflow.workflowId)).toBe(WorkflowState.INCIDENT_INGESTED);
    });

    it('should reject invalid state transitions', async () => {
      const workflow = await stateManager.createWorkflow();
      
      // IDLE -> ANALYZING (invalid, must go through INCIDENT_INGESTED)
      await expect(
        stateManager.transitionTo(workflow.workflowId, WorkflowState.ANALYZING)
      ).rejects.toThrow('Invalid state transition from IDLE to ANALYZING');
    });

    it('should follow the complete valid workflow sequence', async () => {
      const workflow = await stateManager.createWorkflow();
      const workflowId = workflow.workflowId;
      
      // Test complete valid sequence
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.INCIDENT_INGESTED);
      
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.ANALYZING);
      
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.RCA_COMPLETE);
      
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
      expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.GOVERNANCE_PENDING);
      
      // Add governance decision before transitioning to ACTION_PROPOSED
      const governanceDecision = {
        decision: 'approve' as const,
        rationale: 'Test approval for workflow progression',
        approver: { id: 'test-user', role: 'test-role' },
        timestamp: new Date().toISOString(),
        restrictions: [],
        blastRadiusAssessment: {
          affectedServices: ['test-service'],
          riskLevel: 'low' as const,
          reversible: true
        }
      };
      await stateManager.addGovernanceDecision(workflowId, governanceDecision);
      
      await stateManager.transitionTo(workflowId, WorkflowState.ACTION_PROPOSED);
      expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.ACTION_PROPOSED);
      
      await stateManager.transitionTo(workflowId, WorkflowState.VERIFIED);
      expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.VERIFIED);
      
      await stateManager.transitionTo(workflowId, WorkflowState.RESOLVED);
      expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.RESOLVED);
      
      await stateManager.transitionTo(workflowId, WorkflowState.TERMINATED);
      expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.TERMINATED);
    });

    it('should allow termination from any state', async () => {
      const workflow = await stateManager.createWorkflow();
      const workflowId = workflow.workflowId;
      
      // Transition to ANALYZING
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      
      // Should allow termination from ANALYZING
      await stateManager.transitionTo(workflowId, WorkflowState.TERMINATED);
      expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.TERMINATED);
    });

    it('should not allow transitions from TERMINATED state', async () => {
      const workflow = await stateManager.createWorkflow();
      const workflowId = workflow.workflowId;
      
      // Transition to TERMINATED
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.TERMINATED);
      
      // Should reject any transition from TERMINATED
      await expect(
        stateManager.transitionTo(workflowId, WorkflowState.IDLE)
      ).rejects.toThrow('Invalid state transition from TERMINATED to IDLE');
    });
  });

  describe('State Validation', () => {
    it('should validate allowed transitions correctly', () => {
      expect(stateManager.validateTransition(WorkflowState.IDLE, WorkflowState.INCIDENT_INGESTED)).toBe(true);
      expect(stateManager.validateTransition(WorkflowState.IDLE, WorkflowState.ANALYZING)).toBe(false);
      expect(stateManager.validateTransition(WorkflowState.GOVERNANCE_PENDING, WorkflowState.ACTION_PROPOSED)).toBe(true);
      expect(stateManager.validateTransition(WorkflowState.GOVERNANCE_PENDING, WorkflowState.TERMINATED)).toBe(true);
      expect(stateManager.validateTransition(WorkflowState.TERMINATED, WorkflowState.IDLE)).toBe(false);
    });
  });

  describe('Audit Trail', () => {
    it('should create audit events for state transitions', async () => {
      const workflow = await stateManager.createWorkflow();
      const workflowId = workflow.workflowId;
      
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      
      const updatedWorkflow = stateManager.getWorkflow(workflowId);
      expect(updatedWorkflow?.auditTrail).toHaveLength(2); // Initial + transition
      
      const transitionEvent = updatedWorkflow?.auditTrail[1];
      expect(transitionEvent?.eventType).toBe('state_transition');
      expect(transitionEvent?.details.fromState).toBe(WorkflowState.IDLE);
      expect(transitionEvent?.details.toState).toBe(WorkflowState.INCIDENT_INGESTED);
      expect(transitionEvent?.actor).toBe('orchestrator');
      expect(transitionEvent?.immutable).toBe(true);
    });

    it('should generate unique audit event IDs', async () => {
      const workflow = await stateManager.createWorkflow();
      const workflowId = workflow.workflowId;
      
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      
      const updatedWorkflow = stateManager.getWorkflow(workflowId);
      const eventIds = updatedWorkflow?.auditTrail.map(event => event.eventId) || [];
      const uniqueIds = new Set(eventIds);
      
      expect(uniqueIds.size).toBe(eventIds.length);
    });
  });

  describe('Workflow Termination', () => {
    it('should terminate workflow with reason', async () => {
      const workflow = await stateManager.createWorkflow();
      const workflowId = workflow.workflowId;
      
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.terminateWorkflow(workflowId, 'User requested termination');
      
      expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.TERMINATED);
      
      const updatedWorkflow = stateManager.getWorkflow(workflowId);
      const terminationEvent = updatedWorkflow?.auditTrail.find(
        event => event.eventType === 'workflow_termination'
      );
      
      expect(terminationEvent).toBeDefined();
      expect(terminationEvent?.details.terminationReason).toBe('User requested termination');
    });
  });

  describe('State Broadcasting', () => {
    it('should emit state update events', async () => {
      const workflow = await stateManager.createWorkflow();
      const workflowId = workflow.workflowId;
      
      let emittedUpdate: any = null;
      stateManager.on('stateUpdate', (update) => {
        emittedUpdate = update;
      });
      
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      
      expect(emittedUpdate).toBeDefined();
      expect(emittedUpdate.type).toBe('workflow_state');
      expect(emittedUpdate.workflowId).toBe(workflowId);
      expect(emittedUpdate.payload).toBe(WorkflowState.INCIDENT_INGESTED);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent workflow', async () => {
      await expect(
        stateManager.transitionTo('non-existent-id', WorkflowState.INCIDENT_INGESTED)
      ).rejects.toThrow('Workflow non-existent-id not found');
    });

    it('should throw error when terminating non-existent workflow', async () => {
      await expect(
        stateManager.terminateWorkflow('non-existent-id', 'test reason')
      ).rejects.toThrow('Workflow non-existent-id not found');
    });
  });

  describe('Workflow Recovery', () => {
    it('should complete recovery without errors', async () => {
      await expect(stateManager.recoverWorkflows()).resolves.toBeUndefined();
    });
  });
});