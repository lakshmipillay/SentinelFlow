/**
 * Unit tests for OrchestratorService
 * Tests enhanced orchestrator agent coordination while maintaining role separation
 * Validates Requirements 2.1, 2.2, 3.4 - Orchestrator coordination and parallel execution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestratorService, IncidentContext } from '../OrchestratorService';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { WorkflowState } from '../../types/workflow';
import { AgentOutputFactory } from '../AgentOutputFactory';

describe('OrchestratorService', () => {
  let orchestratorService: OrchestratorService;
  let stateManager: WorkflowStateManager;
  let workflowId: string;

  const mockIncidentContext: IncidentContext = {
    incidentId: 'incident-123',
    description: 'Database connection pool exhaustion',
    severity: 'high',
    affectedServices: ['user-service', 'database', 'api-gateway'],
    timestamp: new Date().toISOString(),
    source: 'monitoring-system'
  };

  beforeEach(async () => {
    stateManager = new WorkflowStateManager();
    orchestratorService = new OrchestratorService(stateManager);
    
    // Initialize agent configurations from YAML files (or defaults)
    await orchestratorService.initialize();
    
    const workflow = await stateManager.createWorkflow();
    workflowId = workflow.workflowId;
  });

  describe('Role Separation Validation', () => {
    it('should maintain orchestrator role separation - coordinate but not analyze', async () => {
      // Transition to ANALYZING state
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      const session = await orchestratorService.coordinateParallelAnalysis(workflowId, mockIncidentContext);

      // Verify orchestrator creates coordination structure without domain analysis
      expect(session.agentTasks).toHaveLength(3);
      expect(session.agentTasks.map(t => t.agentName)).toEqual(['sre-agent', 'security-agent', 'governance-agent']);
      
      // Verify orchestrator defines WHAT to analyze, not HOW
      expect(session.agentTasks[0].context.focus).toBe('operational-reliability-analysis');
      expect(session.agentTasks[1].context.focus).toBe('security-risk-analysis');
      expect(session.agentTasks[2].context.focus).toBe('policy-compliance-analysis');

      // Verify no domain-specific analysis in orchestrator output
      expect(session.incidentContext.description).toBe(mockIncidentContext.description);
      expect(session.status).toBe('in-progress');
    });

    it('should create agent tasks with expected skills but no domain knowledge', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      const session = await orchestratorService.coordinateParallelAnalysis(workflowId, mockIncidentContext);

      // Verify orchestrator knows agent capabilities but not domain analysis
      const sreTask = session.agentTasks.find(t => t.agentName === 'sre-agent');
      const securityTask = session.agentTasks.find(t => t.agentName === 'security-agent');
      const governanceTask = session.agentTasks.find(t => t.agentName === 'governance-agent');

      expect(sreTask?.expectedSkills).toEqual(['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry']);
      expect(securityTask?.expectedSkills).toEqual(['Splunk SIEM', 'IAM Logs', 'CSPM']);
      expect(governanceTask?.expectedSkills).toEqual(['Policy Engine', 'Change Management', 'Risk Register']);
    });
  });

  describe('Parallel Agent Coordination', () => {
    beforeEach(async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
    });

    it('should coordinate parallel analysis session creation', async () => {
      const session = await orchestratorService.coordinateParallelAnalysis(workflowId, mockIncidentContext);

      expect(session.sessionId).toBeDefined();
      expect(session.workflowId).toBe(workflowId);
      expect(session.status).toBe('in-progress');
      expect(session.agentTasks).toHaveLength(3);
      expect(session.startedAt).toBeDefined();

      // Verify all agent tasks are initially pending
      expect(session.agentTasks.every(task => task.status === 'pending')).toBe(true);
    });

    it('should track agent task completion without domain interpretation', async () => {
      const session = await orchestratorService.coordinateParallelAnalysis(workflowId, mockIncidentContext);

      // Simulate SRE agent completing analysis
      const sreOutput = AgentOutputFactory.createMockAgentOutput('sre-agent');
      expect(sreOutput.success).toBe(true);

      await stateManager.addAgentOutput(workflowId, sreOutput.agentOutput!);
      const completionResult = await orchestratorService.processAgentOutputCompletion(workflowId, sreOutput.agentOutput!);

      expect(completionResult.sessionUpdated).toBe(true);
      expect(completionResult.allAgentsComplete).toBe(false);
      expect(completionResult.readyForCorrelation).toBe(false);

      // Verify task status updated
      const updatedSession = orchestratorService.getSession(session.sessionId);
      const sreTask = updatedSession?.agentTasks.find(t => t.agentName === 'sre-agent');
      expect(sreTask?.status).toBe('completed');
      expect(sreTask?.completedAt).toBeDefined();
    });

    it('should detect when all agents complete analysis', async () => {
      const session = await orchestratorService.coordinateParallelAnalysis(workflowId, mockIncidentContext);

      // Add outputs from all three agents
      const parallelOutputs = AgentOutputFactory.createParallelAgentOutputs();
      
      for (const outputResult of parallelOutputs) {
        await stateManager.addAgentOutput(workflowId, outputResult.agentOutput!);
        await orchestratorService.processAgentOutputCompletion(workflowId, outputResult.agentOutput!);
      }

      const updatedSession = orchestratorService.getSession(session.sessionId);
      expect(updatedSession?.status).toBe('completed');
      expect(updatedSession?.completedAt).toBeDefined();
      expect(updatedSession?.agentTasks.every(task => task.status === 'completed')).toBe(true);
    });

    it('should validate workflow state before coordination', async () => {
      // Try to coordinate from wrong state
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);

      await expect(
        orchestratorService.coordinateParallelAnalysis(workflowId, mockIncidentContext)
      ).rejects.toThrow('Cannot coordinate analysis - workflow is in RCA_COMPLETE state, expected ANALYZING');
    });

    it('should handle non-existent workflow', async () => {
      await expect(
        orchestratorService.coordinateParallelAnalysis('non-existent-id', mockIncidentContext)
      ).rejects.toThrow('Workflow non-existent-id not found');
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
    });

    it('should track active sessions', async () => {
      expect(orchestratorService.getActiveSessions()).toHaveLength(0);

      const session = await orchestratorService.coordinateParallelAnalysis(workflowId, mockIncidentContext);
      
      expect(orchestratorService.getActiveSessions()).toHaveLength(1);
      expect(orchestratorService.getSession(session.sessionId)).toBeDefined();
      expect(orchestratorService.getSessionByWorkflow(workflowId)).toBeDefined();
    });
  });
});