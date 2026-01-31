/**
 * Unit tests for WorkflowStateManager Agent Output functionality
 * Tests the enhanced agent output validation and skills tracking
 */

import { WorkflowStateManager } from '../WorkflowStateManager';
import { WorkflowState } from '../../types/workflow';
import { AgentOutputFactory } from '../../services/AgentOutputFactory';

describe('WorkflowStateManager - Agent Outputs', () => {
  let stateManager: WorkflowStateManager;
  let workflowId: string;

  beforeEach(async () => {
    stateManager = new WorkflowStateManager();
    const workflow = await stateManager.createWorkflow();
    workflowId = workflow.workflowId;
  });

  describe('addAgentOutput', () => {
    beforeEach(async () => {
      // Transition to ANALYZING state to allow agent outputs
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
    });

    test('should add valid SRE agent output', async () => {
      const sreOutputResult = AgentOutputFactory.createMockAgentOutput('sre-agent');
      expect(sreOutputResult.success).toBe(true);

      const success = await stateManager.addAgentOutput(workflowId, sreOutputResult.agentOutput!);
      expect(success).toBe(true);

      const outputs = stateManager.getAgentOutputs(workflowId);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].agentName).toBe('sre-agent');
      expect(outputs[0].validation.skillsValid).toBe(true);
    });

    test('should add valid Security agent output', async () => {
      const securityOutputResult = AgentOutputFactory.createMockAgentOutput('security-agent');
      expect(securityOutputResult.success).toBe(true);

      const success = await stateManager.addAgentOutput(workflowId, securityOutputResult.agentOutput!);
      expect(success).toBe(true);

      const outputs = stateManager.getAgentOutputs(workflowId);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].agentName).toBe('security-agent');
      expect(outputs[0].skillsUsed).toContain('Splunk SIEM');
    });

    test('should add valid Governance agent output', async () => {
      const governanceOutputResult = AgentOutputFactory.createMockAgentOutput('governance-agent');
      expect(governanceOutputResult.success).toBe(true);

      const success = await stateManager.addAgentOutput(workflowId, governanceOutputResult.agentOutput!);
      expect(success).toBe(true);

      const outputs = stateManager.getAgentOutputs(workflowId);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].agentName).toBe('governance-agent');
      expect(outputs[0].skillsUsed).toContain('Policy Engine');
    });

    test('should reject invalid agent output', async () => {
      const invalidOutput = {
        agentName: 'sre-agent',
        skillsUsed: ['InvalidSkill'], // Invalid skill
        findings: {
          summary: 'Test',
          evidence: [],
          correlations: []
        },
        confidenceLevel: 0.8,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 1000,
          dataSourcesAccessed: [],
          skillsMetadata: {
            skillsUsed: ['InvalidSkill'],
            skillUsageDetails: [],
            totalSkillsAvailable: 4,
            skillsUtilizationRate: 0.25
          }
        },
        validation: {
          skillsValid: false,
          confidenceLevelValid: true,
          schemaCompliant: true
        }
      } as any;

      await expect(stateManager.addAgentOutput(workflowId, invalidOutput))
        .rejects.toThrow('Invalid agent output');
    });

    test('should create audit event for agent output', async () => {
      const sreOutputResult = AgentOutputFactory.createMockAgentOutput('sre-agent');
      await stateManager.addAgentOutput(workflowId, sreOutputResult.agentOutput!);

      const workflow = stateManager.getWorkflow(workflowId);
      const auditEvents = workflow!.auditTrail.filter(event => event.eventType === 'agent_output');
      
      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0].actor).toBe('sre-agent');
      expect(auditEvents[0].details.agentOutput).toBeDefined();
    });

    test('should emit state update event for agent output', async () => {
      const stateUpdateSpy = vi.fn();
      stateManager.on('stateUpdate', stateUpdateSpy);

      const sreOutputResult = AgentOutputFactory.createMockAgentOutput('sre-agent');
      await stateManager.addAgentOutput(workflowId, sreOutputResult.agentOutput!);

      expect(stateUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_output',
          workflowId,
          payload: expect.objectContaining({
            agentName: 'sre-agent'
          })
        })
      );
    });
  });

  describe('getAgentOutputs', () => {
    beforeEach(async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
    });

    test('should return empty array for workflow with no outputs', () => {
      const outputs = stateManager.getAgentOutputs(workflowId);
      expect(outputs).toEqual([]);
    });

    test('should return all outputs when no filter specified', async () => {
      const sreOutput = AgentOutputFactory.createMockAgentOutput('sre-agent');
      const securityOutput = AgentOutputFactory.createMockAgentOutput('security-agent');

      await stateManager.addAgentOutput(workflowId, sreOutput.agentOutput!);
      await stateManager.addAgentOutput(workflowId, securityOutput.agentOutput!);

      const outputs = stateManager.getAgentOutputs(workflowId);
      expect(outputs).toHaveLength(2);
    });

    test('should filter outputs by agent name', async () => {
      const sreOutput = AgentOutputFactory.createMockAgentOutput('sre-agent');
      const securityOutput = AgentOutputFactory.createMockAgentOutput('security-agent');

      await stateManager.addAgentOutput(workflowId, sreOutput.agentOutput!);
      await stateManager.addAgentOutput(workflowId, securityOutput.agentOutput!);

      const sreOutputs = stateManager.getAgentOutputs(workflowId, 'sre-agent');
      expect(sreOutputs).toHaveLength(1);
      expect(sreOutputs[0].agentName).toBe('sre-agent');
    });

    test('should return empty array for non-existent workflow', () => {
      const outputs = stateManager.getAgentOutputs('non-existent-id');
      expect(outputs).toEqual([]);
    });
  });

  describe('isAnalysisComplete', () => {
    beforeEach(async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
    });

    test('should return false when no outputs present', () => {
      const isComplete = stateManager.isAnalysisComplete(workflowId);
      expect(isComplete).toBe(false);
    });

    test('should return false when only some agents have provided outputs', async () => {
      const sreOutput = AgentOutputFactory.createMockAgentOutput('sre-agent');
      await stateManager.addAgentOutput(workflowId, sreOutput.agentOutput!);

      const isComplete = stateManager.isAnalysisComplete(workflowId);
      expect(isComplete).toBe(false);
    });

    test('should return true when all three agents have provided outputs', async () => {
      const parallelOutputs = AgentOutputFactory.createParallelAgentOutputs();
      
      for (const outputResult of parallelOutputs) {
        await stateManager.addAgentOutput(workflowId, outputResult.agentOutput!);
      }

      const isComplete = stateManager.isAnalysisComplete(workflowId);
      expect(isComplete).toBe(true);
    });

    test('should return false for workflow not in ANALYZING state', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);

      const isComplete = stateManager.isAnalysisComplete(workflowId);
      expect(isComplete).toBe(false);
    });
  });

  describe('getAnalysisSummary', () => {
    beforeEach(async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
    });

    test('should return empty summary for workflow with no outputs', () => {
      const summary = stateManager.getAnalysisSummary(workflowId);
      
      expect(summary.totalOutputs).toBe(0);
      expect(summary.agentBreakdown).toEqual({});
      expect(summary.averageConfidence).toBe(0);
      expect(summary.skillsUsed).toEqual([]);
      expect(summary.validationStatus.allValid).toBe(true);
      expect(summary.validationStatus.invalidCount).toBe(0);
    });

    test('should calculate correct summary for multiple outputs', async () => {
      const parallelOutputs = AgentOutputFactory.createParallelAgentOutputs();
      
      for (const outputResult of parallelOutputs) {
        await stateManager.addAgentOutput(workflowId, outputResult.agentOutput!);
      }

      const summary = stateManager.getAnalysisSummary(workflowId);
      
      expect(summary.totalOutputs).toBe(3);
      expect(summary.agentBreakdown['sre-agent']).toBe(1);
      expect(summary.agentBreakdown['security-agent']).toBe(1);
      expect(summary.agentBreakdown['governance-agent']).toBe(1);
      expect(summary.averageConfidence).toBeGreaterThan(0);
      expect(summary.skillsUsed.length).toBeGreaterThan(0);
      expect(summary.validationStatus.allValid).toBe(true);
    });

    test('should include all unique skills used', async () => {
      const sreOutput = AgentOutputFactory.createMockAgentOutput('sre-agent');
      const securityOutput = AgentOutputFactory.createMockAgentOutput('security-agent');

      await stateManager.addAgentOutput(workflowId, sreOutput.agentOutput!);
      await stateManager.addAgentOutput(workflowId, securityOutput.agentOutput!);

      const summary = stateManager.getAnalysisSummary(workflowId);
      
      expect(summary.skillsUsed).toContain('Datadog');
      expect(summary.skillsUsed).toContain('Splunk SIEM');
      // Should not have duplicates
      expect(new Set(summary.skillsUsed).size).toBe(summary.skillsUsed.length);
    });
  });

  describe('canTransitionToRCAComplete', () => {
    beforeEach(async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
    });

    test('should return false when analysis is not complete', () => {
      const canTransition = stateManager.canTransitionToRCAComplete(workflowId);
      expect(canTransition).toBe(false);
    });

    test('should return true when all agents have provided valid outputs', async () => {
      const parallelOutputs = AgentOutputFactory.createParallelAgentOutputs();
      
      for (const outputResult of parallelOutputs) {
        await stateManager.addAgentOutput(workflowId, outputResult.agentOutput!);
      }

      const canTransition = stateManager.canTransitionToRCAComplete(workflowId);
      expect(canTransition).toBe(true);
    });

    test('should return false for workflow not in ANALYZING state', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);

      const canTransition = stateManager.canTransitionToRCAComplete(workflowId);
      expect(canTransition).toBe(false);
    });

    test('should return false for non-existent workflow', () => {
      const canTransition = stateManager.canTransitionToRCAComplete('non-existent-id');
      expect(canTransition).toBe(false);
    });
  });
});