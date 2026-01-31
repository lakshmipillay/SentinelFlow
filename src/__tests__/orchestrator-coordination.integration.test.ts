/**
 * Integration tests for enhanced orchestrator agent coordination
 * Tests the complete workflow coordination with parallel agent execution
 * Validates Requirements 2.1, 2.2, 3.4 - Enhanced orchestrator coordination
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SentinelFlowServer } from '../server';
import { WorkflowState } from '../types/workflow';
import { AgentOutputFactory } from '../services/AgentOutputFactory';

describe('Orchestrator Coordination Integration', () => {
  let server: SentinelFlowServer;
  let workflowId: string;

  beforeEach(async () => {
    server = new SentinelFlowServer(3002); // Use different port for tests
    await server.start();
    
    // Create a workflow and transition to ANALYZING state
    const stateManager = server.getStateManager();
    const workflow = await stateManager.createWorkflow();
    workflowId = workflow.workflowId;
    
    await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
    await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('End-to-End Orchestrator Coordination', () => {
    it('should coordinate complete parallel agent analysis workflow', async () => {
      const stateManager = server.getStateManager();
      const orchestratorService = server.getOrchestratorService();

      const incidentContext = {
        incidentId: 'integration-test-incident',
        description: 'Database connection pool exhaustion during peak traffic',
        severity: 'high' as const,
        affectedServices: ['user-service', 'database', 'api-gateway'],
        timestamp: new Date().toISOString(),
        source: 'integration-test'
      };

      // Step 1: Coordinate parallel analysis
      const session = await orchestratorService.coordinateParallelAnalysis(workflowId, incidentContext);
      
      expect(session.status).toBe('in-progress');
      expect(session.agentTasks).toHaveLength(3);
      expect(session.agentTasks.every(task => task.status === 'pending')).toBe(true);

      // Step 2: Simulate agents completing analysis in parallel
      const parallelOutputs = AgentOutputFactory.createParallelAgentOutputs('database-issue');
      
      // Add agent outputs and track completion
      for (const outputResult of parallelOutputs) {
        expect(outputResult.success).toBe(true);
        
        await stateManager.addAgentOutput(workflowId, outputResult.agentOutput!);
        const completionResult = await orchestratorService.processAgentOutputCompletion(
          workflowId, 
          outputResult.agentOutput!
        );
        
        expect(completionResult.sessionUpdated).toBe(true);
      }

      // Step 3: Verify all agents completed
      const updatedSession = orchestratorService.getSession(session.sessionId);
      expect(updatedSession?.status).toBe('completed');
      expect(updatedSession?.agentTasks.every(task => task.status === 'completed')).toBe(true);

      // Step 4: Check RCA transition readiness
      const rcaReadiness = await orchestratorService.coordinateRCATransition(workflowId);
      expect(rcaReadiness.canTransition).toBe(true);
      expect(rcaReadiness.blockers).toHaveLength(0);
      expect(rcaReadiness.correlation).toBeDefined();

      // Step 5: Verify correlation data structure (orchestrator role: structure, not interpret)
      const correlation = rcaReadiness.correlation;
      expect(correlation.agentOutputSummary.totalAgents).toBe(3);
      expect(correlation.agentOutputSummary.completedAgents).toHaveLength(3);
      expect(correlation.agentOutputSummary.pendingAgents).toHaveLength(0);
      expect(correlation.structuredCorrelations.skillsUtilization.totalSkillsUsed).toBeGreaterThan(0);
      expect(correlation.readyForRCA).toBe(true);
    });

    it('should maintain role separation throughout coordination process', async () => {
      const stateManager = server.getStateManager();
      const orchestratorService = server.getOrchestratorService();

      const incidentContext = {
        incidentId: 'role-separation-test',
        description: 'Security incident requiring analysis',
        severity: 'critical' as const,
        affectedServices: ['auth-service', 'user-accounts'],
        timestamp: new Date().toISOString(),
        source: 'security-monitoring'
      };

      // Coordinate analysis
      const session = await orchestratorService.coordinateParallelAnalysis(workflowId, incidentContext);

      // Verify orchestrator defines structure without domain analysis
      expect(session.agentTasks[0].context.focus).toBe('operational-reliability-analysis');
      expect(session.agentTasks[1].context.focus).toBe('security-risk-analysis');
      expect(session.agentTasks[2].context.focus).toBe('policy-compliance-analysis');

      // Add agent outputs
      const parallelOutputs = AgentOutputFactory.createParallelAgentOutputs('security-breach');
      for (const outputResult of parallelOutputs) {
        await stateManager.addAgentOutput(workflowId, outputResult.agentOutput!);
      }

      // Get correlation - verify orchestrator structures but doesn't interpret
      const correlation = stateManager.correlateAgentOutputs(workflowId);
      
      // Orchestrator provides structure, not domain interpretation
      expect(correlation.structuredCorrelations.crossAgentFindings).toBeDefined();
      expect(correlation.structuredCorrelations.skillsUtilization).toBeDefined();
      expect(correlation.structuredCorrelations.evidenceCorrelation).toBeDefined();
      
      // Verify no domain-specific analysis in orchestrator correlation
      expect(typeof correlation.correlationId).toBe('string');
      expect(typeof correlation.timestamp).toBe('string');
      expect(typeof correlation.readyForRCA).toBe('boolean');
    });

    it('should handle partial agent completion gracefully', async () => {
      const stateManager = server.getStateManager();
      const orchestratorService = server.getOrchestratorService();

      const incidentContext = {
        incidentId: 'partial-completion-test',
        description: 'Policy violation incident',
        severity: 'medium' as const,
        affectedServices: ['deployment-pipeline'],
        timestamp: new Date().toISOString(),
        source: 'governance-system'
      };

      // Start coordination
      const session = await orchestratorService.coordinateParallelAnalysis(workflowId, incidentContext);

      // Only SRE agent completes
      const sreOutput = AgentOutputFactory.createMockAgentOutput('sre-agent', 'policy-violation');
      await stateManager.addAgentOutput(workflowId, sreOutput.agentOutput!);
      
      const completionResult = await orchestratorService.processAgentOutputCompletion(
        workflowId, 
        sreOutput.agentOutput!
      );

      expect(completionResult.sessionUpdated).toBe(true);
      expect(completionResult.allAgentsComplete).toBe(false);
      expect(completionResult.readyForCorrelation).toBe(false);

      // Check RCA readiness - should not be ready
      const rcaReadiness = await orchestratorService.coordinateRCATransition(workflowId);
      expect(rcaReadiness.canTransition).toBe(false);
      expect(rcaReadiness.blockers).toContain('Not all required agents have completed analysis');
    });

    it('should validate workflow state constraints', async () => {
      const orchestratorService = server.getOrchestratorService();

      // Try to coordinate from wrong state
      const stateManager = server.getStateManager();
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);

      const incidentContext = {
        incidentId: 'state-validation-test',
        description: 'Test incident',
        severity: 'low' as const,
        affectedServices: ['test-service'],
        timestamp: new Date().toISOString(),
        source: 'test'
      };

      await expect(
        orchestratorService.coordinateParallelAnalysis(workflowId, incidentContext)
      ).rejects.toThrow('Cannot coordinate analysis - workflow is in RCA_COMPLETE state, expected ANALYZING');
    });
  });

  describe('Real-time State Broadcasting', () => {
    it('should broadcast state updates during orchestrator coordination', async () => {
      const stateManager = server.getStateManager();
      const orchestratorService = server.getOrchestratorService();

      let stateUpdateCount = 0;
      stateManager.on('stateUpdate', () => {
        stateUpdateCount++;
      });

      const incidentContext = {
        incidentId: 'broadcast-test',
        description: 'Test incident for broadcasting',
        severity: 'medium' as const,
        affectedServices: ['test-service'],
        timestamp: new Date().toISOString(),
        source: 'test'
      };

      // Coordinate analysis - should trigger state updates
      await orchestratorService.coordinateParallelAnalysis(workflowId, incidentContext);

      // Add agent outputs - should trigger more state updates
      const parallelOutputs = AgentOutputFactory.createParallelAgentOutputs();
      for (const outputResult of parallelOutputs) {
        await stateManager.addAgentOutput(workflowId, outputResult.agentOutput!);
      }

      // Should have received multiple state updates
      expect(stateUpdateCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle invalid incident context gracefully', async () => {
      const orchestratorService = server.getOrchestratorService();

      const invalidContext = {
        incidentId: '',
        description: '',
        severity: 'invalid' as any,
        affectedServices: [],
        timestamp: 'invalid-timestamp',
        source: ''
      };

      // Should still create session but with invalid data
      const session = await orchestratorService.coordinateParallelAnalysis(workflowId, invalidContext);
      expect(session.sessionId).toBeDefined();
      expect(session.status).toBe('in-progress');
    });

    it('should handle concurrent coordination sessions', async () => {
      const stateManager = server.getStateManager();
      const orchestratorService = server.getOrchestratorService();

      // Create second workflow
      const workflow2 = await stateManager.createWorkflow();
      await stateManager.transitionTo(workflow2.workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflow2.workflowId, WorkflowState.ANALYZING);

      const incidentContext1 = {
        incidentId: 'concurrent-test-1',
        description: 'First incident',
        severity: 'high' as const,
        affectedServices: ['service-1'],
        timestamp: new Date().toISOString(),
        source: 'test'
      };

      const incidentContext2 = {
        incidentId: 'concurrent-test-2',
        description: 'Second incident',
        severity: 'medium' as const,
        affectedServices: ['service-2'],
        timestamp: new Date().toISOString(),
        source: 'test'
      };

      // Start both sessions
      const session1 = await orchestratorService.coordinateParallelAnalysis(workflowId, incidentContext1);
      const session2 = await orchestratorService.coordinateParallelAnalysis(workflow2.workflowId, incidentContext2);

      expect(session1.sessionId).not.toBe(session2.sessionId);
      expect(orchestratorService.getActiveSessions()).toHaveLength(2);
    });
  });
});