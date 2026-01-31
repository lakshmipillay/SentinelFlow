/**
 * SentinelFlow Demo Mode Manager Tests
 * Comprehensive tests for demo mode functionality with safety validation
 * Implements Requirements 9.1, 9.2, 9.3 - Demo mode testing
 */

import { vi } from 'vitest';
import { DemoModeManager } from '../DemoModeManager';
import { DemoConfig, DemoScenario } from '../types/demo-types';

describe('DemoModeManager', () => {
  let demoManager: DemoModeManager;

  beforeEach(() => {
    demoManager = new DemoModeManager();
  });

  afterEach(async () => {
    if (demoManager.isDemo()) {
      await demoManager.deactivateDemoMode();
    }
  });

  describe('Demo Mode Activation', () => {
    test('should activate demo mode with default scenario', async () => {
      const session = await demoManager.activateDemoMode();

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.isActive).toBe(true);
      expect(session.scenario.type).toBe('database-outage');
      expect(session.safetyStatus.isolated).toBe(true);
      expect(session.safetyStatus.noExternalActions).toBe(true);
      expect(session.safetyStatus.auditTrailActive).toBe(true);
      expect(session.safetyStatus.clearlyMarked).toBe(true);
      expect(demoManager.isDemo()).toBe(true);
    });

    test('should activate demo mode with specific scenario type', async () => {
      const session = await demoManager.activateDemoMode({
        scenarioType: 'api-failure'
      });

      expect(session.scenario.type).toBe('api-failure');
      expect(session.scenario.name).toContain('API Gateway');
      expect(session.scenario.complexity).toBe('complex');
    });

    test('should activate demo mode with custom scenario', async () => {
      const customScenario: Partial<DemoScenario> = {
        type: 'custom-test',
        name: 'Custom Test Scenario',
        description: 'Test scenario for validation',
        complexity: 'simple'
      };

      const session = await demoManager.activateDemoMode({
        customScenario
      });

      expect(session.scenario.type).toBe('custom-test');
      expect(session.scenario.name).toBe('Custom Test Scenario');
      expect(session.scenario.complexity).toBe('simple');
    });

    test('should prevent multiple active sessions', async () => {
      await demoManager.activateDemoMode();

      await expect(demoManager.activateDemoMode()).rejects.toThrow(
        'Demo mode is already active'
      );
    });

    test('should emit demoModeActivated event', async () => {
      const eventSpy = vi.fn();
      demoManager.on('demoModeActivated', eventSpy);

      const session = await demoManager.activateDemoMode();

      expect(eventSpy).toHaveBeenCalledWith(session);
    });
  });

  describe('Demo Mode Deactivation', () => {
    test('should deactivate demo mode successfully', async () => {
      await demoManager.activateDemoMode();
      expect(demoManager.isDemo()).toBe(true);

      await demoManager.deactivateDemoMode();

      expect(demoManager.isDemo()).toBe(false);
      expect(demoManager.getCurrentSessionId()).toBeNull();
    });

    test('should handle deactivation when not active', async () => {
      // Should not throw error
      await expect(demoManager.deactivateDemoMode()).resolves.toBeUndefined();
    });

    test('should emit demoModeDeactivated event', async () => {
      const session = await demoManager.activateDemoMode();
      const eventSpy = vi.fn();
      demoManager.on('demoModeDeactivated', eventSpy);

      await demoManager.deactivateDemoMode();

      expect(eventSpy).toHaveBeenCalledWith({ sessionId: session.sessionId });
    });
  });

  describe('Demo Mode Reset', () => {
    test('should reset demo mode with same configuration', async () => {
      const originalSession = await demoManager.activateDemoMode({
        scenarioType: 'security-incident',
        enableAutoProgression: true
      });

      const resetSession = await demoManager.resetDemoMode();

      expect(resetSession).toBeDefined();
      expect(resetSession!.sessionId).not.toBe(originalSession.sessionId);
      expect(resetSession!.scenario.type).toBe('security-incident');
      expect(resetSession!.autoProgression).toBe(true);
    });

    test('should return null when no active session to reset', async () => {
      const result = await demoManager.resetDemoMode();
      expect(result).toBeNull();
    });
  });

  describe('Incident Simulation', () => {
    beforeEach(async () => {
      await demoManager.activateDemoMode();
    });

    test('should simulate incident with realistic data', async () => {
      const result = await demoManager.simulateIncident();

      expect(result.workflowId).toBeDefined();
      expect(result.incident).toBeDefined();
      expect(result.incident.incidentId).toBeDefined();
      expect(result.incident.type).toBe('database-outage');
      expect(result.incident.severity).toBe('critical');
      expect(result.incident.affectedServices).toContain('user-service');
      expect(result.incident.metrics).toBeDefined();
      expect(result.incident.logs).toBeInstanceOf(Array);
      expect(result.incident.alert).toBeDefined();
      expect(result.expectedProgression).toBeInstanceOf(Array);
    });

    test('should prevent simulation when demo mode inactive', async () => {
      await demoManager.deactivateDemoMode();

      await expect(demoManager.simulateIncident()).rejects.toThrow(
        'Demo mode is not active'
      );
    });

    test('should enforce maximum concurrent workflows', async () => {
      // Update config to limit concurrent workflows
      demoManager.updateConfig({ maxConcurrentWorkflows: 1 });

      // First incident should succeed
      await demoManager.simulateIncident();

      // Second incident should fail
      await expect(demoManager.simulateIncident()).rejects.toThrow(
        'Maximum concurrent workflows'
      );
    });

    test('should emit incidentSimulated event', async () => {
      const eventSpy = vi.fn();
      demoManager.on('incidentSimulated', eventSpy);

      const result = await demoManager.simulateIncident();

      expect(eventSpy).toHaveBeenCalledWith({
        workflowId: result.workflowId,
        incident: result.incident,
        scenario: 'database-outage'
      });
    });
  });

  describe('Agent Analysis Simulation', () => {
    let workflowId: string;

    beforeEach(async () => {
      await demoManager.activateDemoMode();
      const result = await demoManager.simulateIncident();
      workflowId = result.workflowId;
    });

    test('should simulate SRE agent analysis', async () => {
      const agentOutput = await demoManager.simulateAgentAnalysis(workflowId, 'sre-agent');

      expect(agentOutput.agentName).toBe('sre-agent');
      expect(agentOutput.skillsUsed).toContain('Datadog');
      expect(agentOutput.skillsUsed).toContain('CloudWatch');
      expect(agentOutput.findings.summary).toBeDefined();
      expect(agentOutput.findings.evidence).toBeInstanceOf(Array);
      expect(agentOutput.findings.correlations).toBeInstanceOf(Array);
      expect(agentOutput.confidenceLevel).toBeGreaterThan(0);
      expect(agentOutput.confidenceLevel).toBeLessThanOrEqual(1);
      expect(agentOutput.validation.skillsValid).toBe(true);
      expect(agentOutput.validation.confidenceLevelValid).toBe(true);
      expect(agentOutput.validation.schemaCompliant).toBe(true);
    });

    test('should simulate Security agent analysis', async () => {
      const agentOutput = await demoManager.simulateAgentAnalysis(workflowId, 'security-agent');

      expect(agentOutput.agentName).toBe('security-agent');
      expect(agentOutput.skillsUsed).toContain('Splunk SIEM');
      expect(agentOutput.skillsUsed).toContain('IAM Logs');
      expect(agentOutput.findings.summary).toBeDefined();
      expect(agentOutput.metadata.skillsMetadata.primarySkill).toBeDefined();
    });

    test('should simulate Governance agent analysis', async () => {
      const agentOutput = await demoManager.simulateAgentAnalysis(workflowId, 'governance-agent');

      expect(agentOutput.agentName).toBe('governance-agent');
      expect(agentOutput.skillsUsed).toContain('Policy Engine');
      expect(agentOutput.skillsUsed).toContain('Change Management');
      expect(agentOutput.findings.summary).toBeDefined();
    });

    test('should apply realistic timing delays', async () => {
      const startTime = Date.now();
      await demoManager.simulateAgentAnalysis(workflowId, 'sre-agent');
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(1500); // Minimum delay
    });

    test('should prevent simulation when demo mode inactive', async () => {
      await demoManager.deactivateDemoMode();

      await expect(
        demoManager.simulateAgentAnalysis(workflowId, 'sre-agent')
      ).rejects.toThrow('Demo mode is not active');
    });

    test('should prevent simulation for non-existent workflow', async () => {
      await expect(
        demoManager.simulateAgentAnalysis('non-existent', 'sre-agent')
      ).rejects.toThrow('Demo workflow non-existent not found');
    });

    test('should emit agentAnalysisCompleted event', async () => {
      const eventSpy = vi.fn();
      demoManager.on('agentAnalysisCompleted', eventSpy);

      const agentOutput = await demoManager.simulateAgentAnalysis(workflowId, 'sre-agent');

      expect(eventSpy).toHaveBeenCalledWith({
        workflowId,
        agentName: 'sre-agent',
        agentOutput,
        isDemo: true
      });
    });
  });

  describe('Governance Scenario Simulation', () => {
    let workflowId: string;

    beforeEach(async () => {
      await demoManager.activateDemoMode();
      const result = await demoManager.simulateIncident();
      workflowId = result.workflowId;
    });

    test('should simulate realistic governance scenario', async () => {
      const scenario = await demoManager.simulateGovernanceScenario(workflowId, 'realistic');

      expect(scenario.blastRadiusAssessment).toBeDefined();
      expect(scenario.blastRadiusAssessment.affectedServices).toBeInstanceOf(Array);
      expect(scenario.blastRadiusAssessment.riskLevel).toMatch(/^(low|medium|high|critical)$/);
      expect(scenario.blastRadiusAssessment.reversible).toBeDefined();
      expect(scenario.policyConflicts).toBeInstanceOf(Array);
      expect(scenario.recommendedDecision).toMatch(/^(approve|approve_with_restrictions|block)$/);
      expect(scenario.decisionFactors).toBeDefined();
    });

    test('should simulate forced approval scenario', async () => {
      const scenario = await demoManager.simulateGovernanceScenario(workflowId, 'approve');

      expect(scenario.recommendedDecision).toBe('approve');
    });

    test('should simulate forced block scenario', async () => {
      const scenario = await demoManager.simulateGovernanceScenario(workflowId, 'block');

      expect(scenario.recommendedDecision).toBe('block');
    });

    test('should emit governanceScenarioGenerated event', async () => {
      const eventSpy = vi.fn();
      demoManager.on('governanceScenarioGenerated', eventSpy);

      const scenario = await demoManager.simulateGovernanceScenario(workflowId, 'realistic');

      expect(eventSpy).toHaveBeenCalledWith({
        workflowId,
        scenario,
        isDemo: true
      });
    });
  });

  describe('Demo Status and Metrics', () => {
    test('should return correct status when inactive', () => {
      const status = demoManager.getDemoStatus();

      expect(status.isActive).toBe(false);
      expect(status.session).toBeNull();
      expect(status.config).toBeDefined();
      expect(status.metrics.activeWorkflows).toBe(0);
      expect(status.metrics.totalIncidentsSimulated).toBe(0);
      expect(status.metrics.sessionDuration).toBe(0);
    });

    test('should return correct status when active', async () => {
      const session = await demoManager.activateDemoMode();
      await demoManager.simulateIncident();

      const status = demoManager.getDemoStatus();

      expect(status.isActive).toBe(true);
      expect(status.session).toBe(session);
      expect(status.metrics.activeWorkflows).toBe(1);
      expect(status.metrics.totalIncidentsSimulated).toBe(1);
      expect(status.metrics.sessionDuration).toBeGreaterThan(0);
    });

    test('should return available scenarios', () => {
      const scenarios = demoManager.getAvailableScenarios();

      expect(scenarios).toBeInstanceOf(Array);
      expect(scenarios.length).toBeGreaterThan(0);
      
      const dbScenario = scenarios.find(s => s.type === 'database-outage');
      expect(dbScenario).toBeDefined();
      expect(dbScenario!.name).toBeDefined();
      expect(dbScenario!.description).toBeDefined();
      expect(dbScenario!.complexity).toMatch(/^(simple|moderate|complex)$/);
      expect(dbScenario!.estimatedDuration).toBeDefined();
    });
  });

  describe('State Snapshots', () => {
    test('should create state snapshot when active', async () => {
      await demoManager.activateDemoMode();
      await demoManager.simulateIncident();

      const snapshot = demoManager.createStateSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot!.sessionId).toBeDefined();
      expect(snapshot!.timestamp).toBeDefined();
      expect(snapshot!.scenario).toBeDefined();
      expect(snapshot!.workflows).toBeInstanceOf(Array);
      expect(snapshot!.workflows.length).toBe(1);
      expect(snapshot!.config).toBeDefined();
    });

    test('should return null when no active session', () => {
      const snapshot = demoManager.createStateSnapshot();
      expect(snapshot).toBeNull();
    });

    test('should restore from snapshot', async () => {
      // Create initial session and snapshot
      const originalSession = await demoManager.activateDemoMode();
      await demoManager.simulateIncident();
      const snapshot = demoManager.createStateSnapshot();

      // Deactivate and restore
      await demoManager.deactivateDemoMode();
      await demoManager.restoreFromSnapshot(snapshot!);

      expect(demoManager.isDemo()).toBe(true);
      expect(demoManager.getCurrentSessionId()).toBe(originalSession.sessionId);
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig: Partial<DemoConfig> = {
        maxConcurrentWorkflows: 5,
        enableRealisticTiming: false,
        timingConfig: {
          agentProcessingDelayMs: 1000,
          stateTransitionDelayMs: 500,
          progressiveDisclosureIntervalMs: 2000
        }
      };

      demoManager.updateConfig(newConfig);

      const status = demoManager.getDemoStatus();
      expect(status.config.maxConcurrentWorkflows).toBe(5);
      expect(status.config.enableRealisticTiming).toBe(false);
      expect(status.config.timingConfig.agentProcessingDelayMs).toBe(1000);
    });

    test('should maintain safety constraints', () => {
      const status = demoManager.getDemoStatus();

      expect(status.config.safetyConstraints.noExternalActions).toBe(true);
      expect(status.config.safetyConstraints.isolatedEnvironment).toBe(true);
      expect(status.config.safetyConstraints.auditAllOperations).toBe(true);
    });
  });

  describe('Safety Validation', () => {
    test('should enforce safety constraints in all operations', async () => {
      const session = await demoManager.activateDemoMode();

      // Verify safety status
      expect(session.safetyStatus.isolated).toBe(true);
      expect(session.safetyStatus.noExternalActions).toBe(true);
      expect(session.safetyStatus.auditTrailActive).toBe(true);
      expect(session.safetyStatus.clearlyMarked).toBe(true);
    });

    test('should generate audit events for all operations', async () => {
      const auditSpy = vi.fn();
      demoManager.on('demoAuditEvent', auditSpy);

      await demoManager.activateDemoMode();
      await demoManager.simulateIncident();

      expect(auditSpy).toHaveBeenCalledTimes(2); // Activation + incident simulation
      
      const activationEvent = auditSpy.mock.calls[0][0];
      expect(activationEvent.eventType).toBe('demo_activated');
      expect(activationEvent.demoMode).toBe(true);
      expect(activationEvent.immutable).toBe(true);
    });

    test('should prevent external actions in demo mode', async () => {
      await demoManager.activateDemoMode();
      const result = await demoManager.simulateIncident();
      const agentOutput = await demoManager.simulateAgentAnalysis(result.workflowId, 'sre-agent');

      // Verify no external action recommendations
      if (agentOutput.findings.recommendations) {
        agentOutput.findings.recommendations.forEach(rec => {
          expect(rec).not.toMatch(/execute|deploy|restart/i);
        });
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid scenario types gracefully', async () => {
      await expect(
        demoManager.activateDemoMode({ scenarioType: 'invalid-scenario' as any })
      ).rejects.toThrow('Unknown scenario type');
    });

    test('should handle invalid agent names gracefully', async () => {
      await demoManager.activateDemoMode();
      const result = await demoManager.simulateIncident();

      await expect(
        demoManager.simulateAgentAnalysis(result.workflowId, 'invalid-agent' as any)
      ).rejects.toThrow();
    });

    test('should handle malformed snapshots gracefully', async () => {
      const invalidSnapshot = {
        sessionId: 'test',
        // Missing required fields
      };

      await expect(
        demoManager.restoreFromSnapshot(invalidSnapshot as any)
      ).rejects.toThrow();
    });
  });
});