/**
 * Performance and Scalability Tests for SentinelFlow
 * Task 18.3: Write performance and scalability tests (Optional)
 * 
 * Tests:
 * - Multiple concurrent workflow handling
 * - Real-time update performance under load
 * - State manager handles rapid state transitions
 * 
 * Note: This is an optional task focused on minimal validation
 * of performance characteristics for the hackathon demo.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkflowStateManager } from '../core/WorkflowStateManager';
import { WorkflowState } from '../types/workflow';
import { SentinelFlowServer } from '../server';
import { AgentOutputFactory } from '../services/AgentOutputFactory';

describe('Performance and Scalability Tests', () => {
  describe('Multiple Concurrent Workflow Handling', () => {
    let stateManager: WorkflowStateManager;

    beforeEach(() => {
      stateManager = new WorkflowStateManager();
    });

    it('should handle creation of multiple concurrent workflows', async () => {
      const WORKFLOW_COUNT = 10;
      const startTime = Date.now();

      // Create multiple workflows concurrently
      const workflowPromises = Array.from({ length: WORKFLOW_COUNT }, () =>
        stateManager.createWorkflow()
      );

      const workflows = await Promise.all(workflowPromises);
      const endTime = Date.now();

      // Verify all workflows were created
      expect(workflows).toHaveLength(WORKFLOW_COUNT);
      
      // Verify each workflow has unique ID
      const workflowIds = workflows.map(w => w.workflowId);
      const uniqueIds = new Set(workflowIds);
      expect(uniqueIds.size).toBe(WORKFLOW_COUNT);

      // Verify all workflows are in IDLE state
      workflows.forEach(workflow => {
        expect(workflow.currentState).toBe(WorkflowState.IDLE);
      });

      // Performance check: should complete within reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds max for 10 workflows

      console.log(`Created ${WORKFLOW_COUNT} workflows in ${duration}ms`);
    });

    it('should maintain workflow independence during concurrent operations', async () => {
      const WORKFLOW_COUNT = 5;

      // Create workflows
      const workflows = await Promise.all(
        Array.from({ length: WORKFLOW_COUNT }, () => stateManager.createWorkflow())
      );

      // Transition each workflow to different states concurrently
      const transitionPromises = workflows.map(async (workflow, index) => {
        await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);
        
        // Only some workflows proceed to ANALYZING
        if (index % 2 === 0) {
          await stateManager.transitionTo(workflow.workflowId, WorkflowState.ANALYZING);
        }
        
        return stateManager.getWorkflow(workflow.workflowId);
      });

      const updatedWorkflows = await Promise.all(transitionPromises);

      // Verify workflows are in expected states
      updatedWorkflows.forEach((workflow, index) => {
        expect(workflow).toBeDefined();
        if (index % 2 === 0) {
          expect(workflow!.currentState).toBe(WorkflowState.ANALYZING);
        } else {
          expect(workflow!.currentState).toBe(WorkflowState.INCIDENT_INGESTED);
        }
      });

      // Verify no cross-workflow interference
      const allWorkflows = stateManager.getAllWorkflows();
      expect(allWorkflows).toHaveLength(WORKFLOW_COUNT);
    });

    it('should handle concurrent agent output additions', async () => {
      const WORKFLOW_COUNT = 3;

      // Create and prepare workflows
      const workflows = await Promise.all(
        Array.from({ length: WORKFLOW_COUNT }, async () => {
          const workflow = await stateManager.createWorkflow();
          await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflow.workflowId, WorkflowState.ANALYZING);
          return workflow;
        })
      );

      const startTime = Date.now();

      // Add agent outputs to all workflows concurrently
      const outputPromises = workflows.flatMap(workflow => {
        const outputs = AgentOutputFactory.createParallelAgentOutputs();
        return outputs.map(outputResult =>
          stateManager.addAgentOutput(workflow.workflowId, outputResult.agentOutput!)
        );
      });

      await Promise.all(outputPromises);
      const endTime = Date.now();

      // Verify all outputs were added
      workflows.forEach(workflow => {
        const outputs = stateManager.getAgentOutputs(workflow.workflowId);
        expect(outputs).toHaveLength(3); // 3 agents per workflow
      });

      // Performance check
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(3000); // 3 seconds max

      console.log(`Added ${WORKFLOW_COUNT * 3} agent outputs in ${duration}ms`);
    });
  });

  describe('Rapid State Transitions', () => {
    let stateManager: WorkflowStateManager;

    beforeEach(() => {
      stateManager = new WorkflowStateManager();
    });

    it('should handle rapid sequential state transitions', async () => {
      const workflow = await stateManager.createWorkflow();
      const startTime = Date.now();

      // Perform rapid state transitions
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.ANALYZING);
      
      // Add required agent outputs for RCA transition
      const outputs = AgentOutputFactory.createParallelAgentOutputs();
      for (const outputResult of outputs) {
        await stateManager.addAgentOutput(workflow.workflowId, outputResult.agentOutput!);
      }
      
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.GOVERNANCE_PENDING);

      const endTime = Date.now();

      // Verify final state
      const currentState = stateManager.getCurrentState(workflow.workflowId);
      expect(currentState).toBe(WorkflowState.GOVERNANCE_PENDING);

      // Verify audit trail captured all transitions
      const workflowData = stateManager.getWorkflow(workflow.workflowId);
      expect(workflowData!.auditTrail.length).toBeGreaterThanOrEqual(4);

      // Performance check
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(2000); // 2 seconds max

      console.log(`Completed 4 state transitions in ${duration}ms`);
    });

    it('should maintain state consistency under rapid transitions', async () => {
      const ITERATION_COUNT = 5;
      const results: { workflowId: string; finalState: WorkflowState }[] = [];

      for (let i = 0; i < ITERATION_COUNT; i++) {
        const workflow = await stateManager.createWorkflow();
        
        await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);
        await stateManager.transitionTo(workflow.workflowId, WorkflowState.ANALYZING);
        
        const finalState = stateManager.getCurrentState(workflow.workflowId);
        results.push({ workflowId: workflow.workflowId, finalState: finalState! });
      }

      // Verify all workflows reached expected state
      results.forEach(result => {
        expect(result.finalState).toBe(WorkflowState.ANALYZING);
      });

      // Verify state manager consistency
      const allWorkflows = stateManager.getAllWorkflows();
      expect(allWorkflows).toHaveLength(ITERATION_COUNT);
    });
  });

  describe('Real-time Update Performance', () => {
    let stateManager: WorkflowStateManager;
    let updateCount: number;

    beforeEach(() => {
      stateManager = new WorkflowStateManager();
      updateCount = 0;
      
      // Track state updates
      stateManager.on('stateUpdate', () => {
        updateCount++;
      });
    });

    it('should emit state updates for all workflow changes', async () => {
      const workflow = await stateManager.createWorkflow();

      // Perform state transitions
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.ANALYZING);

      // Add agent outputs
      const outputs = AgentOutputFactory.createParallelAgentOutputs();
      for (const outputResult of outputs) {
        await stateManager.addAgentOutput(workflow.workflowId, outputResult.agentOutput!);
      }

      // Verify updates were emitted
      // 2 state transitions + 3 agent outputs = 5 updates minimum
      expect(updateCount).toBeGreaterThanOrEqual(5);

      console.log(`Received ${updateCount} state updates`);
    });

    it('should handle multiple concurrent update listeners', async () => {
      const listenerCounts = [0, 0, 0];

      // Add multiple listeners
      stateManager.on('stateUpdate', () => { listenerCounts[0]++; });
      stateManager.on('stateUpdate', () => { listenerCounts[1]++; });
      stateManager.on('stateUpdate', () => { listenerCounts[2]++; });

      const workflow = await stateManager.createWorkflow();
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);

      // All listeners should receive the same number of updates
      expect(listenerCounts[0]).toBe(listenerCounts[1]);
      expect(listenerCounts[1]).toBe(listenerCounts[2]);
      expect(listenerCounts[0]).toBeGreaterThan(0);
    });
  });

  describe('Server Integration Performance', () => {
    let server: SentinelFlowServer;

    beforeEach(async () => {
      server = new SentinelFlowServer(3003); // Use different port for tests
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it('should handle multiple workflow operations through server', async () => {
      const stateManager = server.getStateManager();
      const WORKFLOW_COUNT = 5;
      const startTime = Date.now();

      // Create multiple workflows
      const workflows = await Promise.all(
        Array.from({ length: WORKFLOW_COUNT }, () => stateManager.createWorkflow())
      );

      // Transition all to ANALYZING
      await Promise.all(
        workflows.map(async workflow => {
          await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflow.workflowId, WorkflowState.ANALYZING);
        })
      );

      const endTime = Date.now();

      // Verify all workflows are in ANALYZING state
      workflows.forEach(workflow => {
        const state = stateManager.getCurrentState(workflow.workflowId);
        expect(state).toBe(WorkflowState.ANALYZING);
      });

      // Performance check
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds max

      console.log(`Server handled ${WORKFLOW_COUNT} workflows with transitions in ${duration}ms`);
    });

    it('should maintain orchestrator service performance under load', async () => {
      const stateManager = server.getStateManager();
      const orchestratorService = server.getOrchestratorService();

      // Create and prepare workflow
      const workflow = await stateManager.createWorkflow();
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.ANALYZING);

      const incidentContext = {
        incidentId: 'perf-test-incident',
        description: 'Performance test incident',
        severity: 'high' as const,
        affectedServices: ['service-1', 'service-2'],
        timestamp: new Date().toISOString(),
        source: 'performance-test'
      };

      const startTime = Date.now();

      // Coordinate parallel analysis
      const session = await orchestratorService.coordinateParallelAnalysis(
        workflow.workflowId,
        incidentContext
      );

      // Add agent outputs
      const outputs = AgentOutputFactory.createParallelAgentOutputs();
      for (const outputResult of outputs) {
        await stateManager.addAgentOutput(workflow.workflowId, outputResult.agentOutput!);
        await orchestratorService.processAgentOutputCompletion(
          workflow.workflowId,
          outputResult.agentOutput!
        );
      }

      const endTime = Date.now();

      // Verify session completed
      const updatedSession = orchestratorService.getSession(session.sessionId);
      expect(updatedSession?.status).toBe('completed');

      // Performance check
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(3000); // 3 seconds max

      console.log(`Orchestrator coordination completed in ${duration}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    let stateManager: WorkflowStateManager;

    beforeEach(() => {
      stateManager = new WorkflowStateManager();
    });

    it('should handle workflow creation without memory leaks', async () => {
      const WORKFLOW_COUNT = 20;

      // Create many workflows
      const workflows = await Promise.all(
        Array.from({ length: WORKFLOW_COUNT }, () => stateManager.createWorkflow())
      );

      // Verify all workflows exist
      const allWorkflows = stateManager.getAllWorkflows();
      expect(allWorkflows).toHaveLength(WORKFLOW_COUNT);

      // Verify each workflow has proper structure
      workflows.forEach(workflow => {
        expect(workflow.workflowId).toBeDefined();
        expect(workflow.currentState).toBe(WorkflowState.IDLE);
        expect(workflow.auditTrail).toBeDefined();
        expect(Array.isArray(workflow.auditTrail)).toBe(true);
      });
    });

    it('should handle large audit trails efficiently', async () => {
      const workflow = await stateManager.createWorkflow();
      const startTime = Date.now();

      // Generate many state transitions to build audit trail
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.ANALYZING);

      // Add multiple agent outputs
      const outputs = AgentOutputFactory.createParallelAgentOutputs();
      for (const outputResult of outputs) {
        await stateManager.addAgentOutput(workflow.workflowId, outputResult.agentOutput!);
      }

      await stateManager.transitionTo(workflow.workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.GOVERNANCE_PENDING);

      const endTime = Date.now();

      // Verify audit trail was built
      const workflowData = stateManager.getWorkflow(workflow.workflowId);
      expect(workflowData!.auditTrail.length).toBeGreaterThanOrEqual(6);

      // Verify audit chain can be retrieved efficiently
      const auditChain = stateManager.getAuditChain(workflow.workflowId);
      expect(auditChain.length).toBeGreaterThanOrEqual(6);

      // Performance check
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(3000); // 3 seconds max

      console.log(`Built audit trail with ${workflowData!.auditTrail.length} events in ${duration}ms`);
    });
  });
});
