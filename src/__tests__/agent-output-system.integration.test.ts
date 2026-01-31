/**
 * Integration tests for the complete Agent Output System
 * Tests the full workflow from agent output creation to validation and workflow management
 */

import { WorkflowStateManager } from '../core/WorkflowStateManager';
import { AgentOutputFactory } from '../services/AgentOutputFactory';
import { AgentOutputValidator } from '../services/AgentOutputValidator';
import { WorkflowState } from '../types/workflow';
import { validateAgentSkills, getAuthorizedSkills } from '../types/agent-skills';

describe('Agent Output System Integration', () => {
  let stateManager: WorkflowStateManager;
  let workflowId: string;

  beforeEach(async () => {
    stateManager = new WorkflowStateManager();
    const workflow = await stateManager.createWorkflow();
    workflowId = workflow.workflowId;
  });

  describe('Complete Workflow with Agent Outputs', () => {
    test('should handle complete incident response workflow with all agent outputs', async () => {
      // Start workflow
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      // Create parallel agent outputs for database issue scenario
      const parallelOutputs = AgentOutputFactory.createParallelAgentOutputs('database-issue');
      
      // Verify all outputs were created successfully
      expect(parallelOutputs.every(result => result.success)).toBe(true);
      expect(parallelOutputs).toHaveLength(3);

      // Add all agent outputs to workflow
      for (const outputResult of parallelOutputs) {
        const success = await stateManager.addAgentOutput(workflowId, outputResult.agentOutput!);
        expect(success).toBe(true);
      }

      // Verify analysis is complete
      expect(stateManager.isAnalysisComplete(workflowId)).toBe(true);
      expect(stateManager.canTransitionToRCAComplete(workflowId)).toBe(true);

      // Get analysis summary
      const summary = stateManager.getAnalysisSummary(workflowId);
      expect(summary.totalOutputs).toBe(3);
      expect(summary.validationStatus.allValid).toBe(true);
      expect(summary.averageConfidence).toBeGreaterThan(0.7);

      // Verify skills are properly attributed
      expect(summary.skillsUsed).toContain('Datadog');
      expect(summary.skillsUsed).toContain('Splunk SIEM');
      expect(summary.skillsUsed).toContain('Policy Engine');

      // Transition to RCA_COMPLETE
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);

      // Verify workflow state
      const workflow = stateManager.getWorkflow(workflowId);
      expect(workflow!.currentState).toBe(WorkflowState.RCA_COMPLETE);
      expect(workflow!.agentOutputs).toHaveLength(3);

      // Verify audit trail includes all agent outputs
      const agentOutputEvents = workflow!.auditTrail.filter(event => event.eventType === 'agent_output');
      expect(agentOutputEvents).toHaveLength(3);
    });

    test('should handle security breach scenario with appropriate skills', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      // Create outputs for security breach scenario
      const parallelOutputs = AgentOutputFactory.createParallelAgentOutputs('security-breach');
      
      for (const outputResult of parallelOutputs) {
        await stateManager.addAgentOutput(workflowId, outputResult.agentOutput!);
      }

      // Verify security-specific content
      const securityOutputs = stateManager.getAgentOutputs(workflowId, 'security-agent');
      expect(securityOutputs).toHaveLength(1);
      expect(securityOutputs[0].findings.summary).toContain('Suspicious authentication patterns');
      expect(securityOutputs[0].skillsUsed).toContain('Splunk SIEM');
      expect(securityOutputs[0].skillsUsed).toContain('IAM Logs');

      // Verify SRE agent still provides operational analysis
      const sreOutputs = stateManager.getAgentOutputs(workflowId, 'sre-agent');
      expect(sreOutputs).toHaveLength(1);
      expect(sreOutputs[0].skillsUsed.every(skill => 
        getAuthorizedSkills('sre-agent').includes(skill)
      )).toBe(true);
    });

    test('should handle policy violation scenario with governance focus', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      // Create outputs for policy violation scenario
      const parallelOutputs = AgentOutputFactory.createParallelAgentOutputs('policy-violation');
      
      for (const outputResult of parallelOutputs) {
        await stateManager.addAgentOutput(workflowId, outputResult.agentOutput!);
      }

      // Verify governance-specific content
      const governanceOutputs = stateManager.getAgentOutputs(workflowId, 'governance-agent');
      expect(governanceOutputs).toHaveLength(1);
      expect(governanceOutputs[0].findings.summary).toContain('Policy compliance violation');
      expect(governanceOutputs[0].skillsUsed).toContain('Policy Engine');
      expect(governanceOutputs[0].skillsUsed).toContain('Risk Register');

      // Verify high confidence in policy violations
      expect(governanceOutputs[0].confidenceLevel).toBeGreaterThan(0.7);
    });
  });

  describe('Skills Validation Integration', () => {
    test('should enforce skills boundaries across all agents', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      // Test each agent type with their authorized skills
      const agentTypes = ['sre-agent', 'security-agent', 'governance-agent'] as const;
      
      for (const agentType of agentTypes) {
        const output = AgentOutputFactory.createMockAgentOutput(agentType);
        expect(output.success).toBe(true);
        
        const agentOutput = output.agentOutput!;
        
        // Verify skills are authorized for this agent
        expect(validateAgentSkills(agentType, agentOutput.skillsUsed)).toBe(true);
        
        // Verify skills metadata is correct
        const authorizedSkills = getAuthorizedSkills(agentType);
        expect(agentOutput.metadata.skillsMetadata.totalSkillsAvailable).toBe(authorizedSkills.length);
        expect(agentOutput.metadata.skillsMetadata.skillsUtilizationRate).toBeLessThanOrEqual(1.0);
        
        await stateManager.addAgentOutput(workflowId, agentOutput);
      }

      // Verify all outputs are valid
      const summary = stateManager.getAnalysisSummary(workflowId);
      expect(summary.validationStatus.allValid).toBe(true);
      expect(summary.validationStatus.invalidCount).toBe(0);
    });

    test('should reject outputs with cross-agent skill contamination', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      // Try to create SRE output with Security skills
      const invalidRequest = {
        agentName: 'sre-agent' as const,
        skillsUsed: ['Datadog', 'Splunk SIEM'], // Splunk SIEM not authorized for SRE
        findings: {
          summary: 'Test summary',
          evidence: ['Test evidence'],
          correlations: ['Test correlation']
        },
        confidenceLevel: 0.8,
        processingTimeMs: 2000,
        dataSourcesAccessed: ['test-api']
      };

      const result = AgentOutputFactory.createAgentOutput(invalidRequest);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('used unauthorized skills: Splunk SIEM');
    });
  });

  describe('Confidence Level Validation', () => {
    test('should validate confidence levels across all scenarios', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      const scenarios = ['database-issue', 'security-breach', 'policy-violation'] as const;
      
      for (const scenario of scenarios) {
        const outputs = AgentOutputFactory.createParallelAgentOutputs(scenario);
        
        for (const outputResult of outputs) {
          expect(outputResult.success).toBe(true);
          
          const agentOutput = outputResult.agentOutput!;
          expect(agentOutput.confidenceLevel).toBeGreaterThanOrEqual(0.0);
          expect(agentOutput.confidenceLevel).toBeLessThanOrEqual(1.0);
          expect(agentOutput.validation.confidenceLevelValid).toBe(true);
        }
      }
    });

    test('should warn about low confidence levels', () => {
      const lowConfidenceRequest = {
        agentName: 'sre-agent' as const,
        skillsUsed: ['Datadog'],
        findings: {
          summary: 'Uncertain analysis',
          evidence: ['Limited data'],
          correlations: ['Unclear patterns']
        },
        confidenceLevel: 0.2, // Low confidence
        processingTimeMs: 1000,
        dataSourcesAccessed: ['limited-api']
      };

      const result = AgentOutputFactory.createAgentOutput(lowConfidenceRequest);
      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Low confidence level (0.2) - findings may be unreliable');
    });
  });

  describe('Audit Trail Integration', () => {
    test('should create comprehensive audit trail for agent outputs', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      const parallelOutputs = AgentOutputFactory.createParallelAgentOutputs();
      
      for (const outputResult of parallelOutputs) {
        await stateManager.addAgentOutput(workflowId, outputResult.agentOutput!);
      }

      const workflow = stateManager.getWorkflow(workflowId);
      const auditEvents = workflow!.auditTrail;

      // Should have state transitions + agent outputs
      expect(auditEvents.length).toBeGreaterThan(3);

      // Verify agent output audit events
      const agentOutputEvents = auditEvents.filter(event => event.eventType === 'agent_output');
      expect(agentOutputEvents).toHaveLength(3);

      // Verify each agent output event has proper structure
      for (const event of agentOutputEvents) {
        expect(event.details.agentOutput).toBeDefined();
        expect(event.details.agentOutput!.validation.skillsValid).toBe(true);
        expect(event.details.agentOutput!.validation.confidenceLevelValid).toBe(true);
        expect(event.details.agentOutput!.validation.schemaCompliant).toBe(true);
        expect(event.immutable).toBe(true);
      }
    });
  });

  describe('Real-time Updates Integration', () => {
    test('should emit state updates for agent outputs', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      const stateUpdates: any[] = [];
      stateManager.on('stateUpdate', (update) => {
        stateUpdates.push(update);
      });

      const sreOutput = AgentOutputFactory.createMockAgentOutput('sre-agent');
      await stateManager.addAgentOutput(workflowId, sreOutput.agentOutput!);

      // Should have emitted agent_output update
      const agentOutputUpdates = stateUpdates.filter(update => update.type === 'agent_output');
      expect(agentOutputUpdates).toHaveLength(1);
      expect(agentOutputUpdates[0].payload.agentName).toBe('sre-agent');
      expect(agentOutputUpdates[0].workflowId).toBe(workflowId);
    });
  });
});