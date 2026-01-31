/**
 * SentinelFlow Demo Workflow Integration Tests
 * Tests complete demo workflow execution from activation to completion
 * Implements Task 17.3 - Integration tests for demo scenarios
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { DemoModeManager } from '../DemoModeManager';
import { WorkflowState } from '../../types/workflow';

describe('Demo Workflow Integration Tests', () => {
  let demoManager: DemoModeManager;

  beforeEach(() => {
    demoManager = new DemoModeManager({
      maxConcurrentWorkflows: 5,
      enableRealisticTiming: false, // Disable for faster testing
      enableProgressiveDisclosure: false,
      timingConfig: {
        agentProcessingDelayMs: 10,
        stateTransitionDelayMs: 5,
        progressiveDisclosureIntervalMs: 15
      }
    });
  });

  afterEach(async () => {
    if (demoManager.isDemo()) {
      await demoManager.deactivateDemoMode();
    }
    vi.clearAllMocks();
  });

  describe('Complete Demo Workflow Execution', () => {
    test('should execute complete workflow: activate → simulate → analyze → governance → complete', async () => {
      // Step 1: Activate demo mode
      const session = await demoManager.activateDemoMode({
        scenarioType: 'database-outage'
      });
      
      expect(session.isActive).toBe(true);
      expect(session.scenario.type).toBe('database-outage');
      expect(session.safetyStatus.isolated).toBe(true);
      expect(session.safetyStatus.noExternalActions).toBe(true);

      // Step 2: Simulate incident
      const incidentResult = await demoManager.simulateIncident();
      
      expect(incidentResult.workflowId).toBeDefined();
      expect(incidentResult.incident).toBeDefined();
      expect(incidentResult.incident.type).toBe('database-outage');
      expect(incidentResult.incident.severity).toBe('critical');
      expect(incidentResult.expectedProgression).toBeInstanceOf(Array);

      const workflowId = incidentResult.workflowId;

      // Step 3: Simulate parallel agent analysis
      const [sreOutput, securityOutput, governanceOutput] = await Promise.all([
        demoManager.simulateAgentAnalysis(workflowId, 'sre-agent'),
        demoManager.simulateAgentAnalysis(workflowId, 'security-agent'),
        demoManager.simulateAgentAnalysis(workflowId, 'governance-agent')
      ]);

      // Verify SRE agent output
      expect(sreOutput.agentName).toBe('sre-agent');
      expect(sreOutput.skillsUsed).toContain('Datadog');
      expect(sreOutput.skillsUsed).toContain('CloudWatch');
      expect(sreOutput.findings.summary).toBeDefined();
      expect(sreOutput.confidenceLevel).toBeGreaterThan(0);
      expect(sreOutput.confidenceLevel).toBeLessThanOrEqual(1);

      // Verify Security agent output
      expect(securityOutput.agentName).toBe('security-agent');
      expect(securityOutput.skillsUsed).toContain('Splunk SIEM');
      expect(securityOutput.skillsUsed).toContain('IAM Logs');
      expect(securityOutput.findings.summary).toBeDefined();

      // Verify Governance agent output
      expect(governanceOutput.agentName).toBe('governance-agent');
      expect(governanceOutput.skillsUsed).toContain('Policy Engine');
      expect(governanceOutput.skillsUsed).toContain('Change Management');
      expect(governanceOutput.findings.summary).toBeDefined();

      // Step 4: Simulate governance scenario
      const governanceScenario = await demoManager.simulateGovernanceScenario(
        workflowId,
        'realistic'
      );

      expect(governanceScenario.blastRadiusAssessment).toBeDefined();
      expect(governanceScenario.blastRadiusAssessment.affectedServices).toBeInstanceOf(Array);
      expect(governanceScenario.riskLevel).toMatch(/^(low|medium|high|critical)$/);
      expect(governanceScenario.policyConflicts).toBeInstanceOf(Array);
      expect(governanceScenario.recommendedDecision).toMatch(
        /^(approve|approve_with_restrictions|block)$/
      );

      // Step 5: Verify workflow state
      const status = demoManager.getDemoStatus();
      expect(status.isActive).toBe(true);
      expect(status.metrics.activeWorkflows).toBe(1);
      expect(status.metrics.totalIncidentsSimulated).toBeGreaterThanOrEqual(1);

      // Step 6: Verify safety constraints maintained throughout
      expect(status.session?.safetyStatus.isolated).toBe(true);
      expect(status.session?.safetyStatus.noExternalActions).toBe(true);
      expect(status.session?.safetyStatus.auditTrailActive).toBe(true);
      expect(status.session?.safetyStatus.clearlyMarked).toBe(true);
    });

    test('should execute workflow with human approval requirement', async () => {
      await demoManager.activateDemoMode({
        scenarioType: 'security-incident'
      });

      const incidentResult = await demoManager.simulateIncident();
      const workflowId = incidentResult.workflowId;

      // Simulate agent analysis
      await demoManager.simulateAgentAnalysis(workflowId, 'sre-agent');
      await demoManager.simulateAgentAnalysis(workflowId, 'security-agent');
      await demoManager.simulateAgentAnalysis(workflowId, 'governance-agent');

      // Simulate governance scenario requiring human approval
      const governanceScenario = await demoManager.simulateGovernanceScenario(
        workflowId,
        'human_required'
      );

      expect(governanceScenario.requiresHumanApproval).toBe(true);
      expect(governanceScenario.humanApprovalReason).toBeDefined();

      // Simulate human approval decision
      const approvalResult = await demoManager.simulateHumanApprovalDecision(
        workflowId,
        'approve_with_restrictions',
        'test-approver',
        'Approved with monitoring requirements'
      );

      expect(approvalResult.decision).toBe('approve_with_restrictions');
      expect(approvalResult.approver).toBe('test-approver');
      expect(approvalResult.justification).toBe('Approved with monitoring requirements');
      expect(approvalResult.restrictions).toBeInstanceOf(Array);
      expect(approvalResult.restrictions!.length).toBeGreaterThan(0);
    });

    test('should execute workflow with block decision', async () => {
      await demoManager.activateDemoMode({
        scenarioType: 'api-failure'
      });

      const incidentResult = await demoManager.simulateIncident();
      const workflowId = incidentResult.workflowId;

      // Simulate agent analysis
      await demoManager.simulateAgentAnalysis(workflowId, 'sre-agent');

      // Simulate governance scenario with block
      const governanceScenario = await demoManager.simulateGovernanceScenario(
        workflowId,
        'block'
      );

      expect(governanceScenario.recommendedDecision).toBe('block');

      // Simulate human block decision
      const blockResult = await demoManager.simulateHumanApprovalDecision(
        workflowId,
        'block',
        'security-reviewer',
        'Blocked due to high risk and policy violations'
      );

      expect(blockResult.decision).toBe('block');
      expect(blockResult.approver).toBe('security-reviewer');
    });
  });

  describe('Scenario Reset Functionality', () => {
    test('should reset demo mode and preserve scenario configuration', async () => {
      // Activate with specific scenario
      const originalSession = await demoManager.activateDemoMode({
        scenarioType: 'api-failure',
        enableAutoProgression: true
      });

      // Simulate some activity
      await demoManager.simulateIncident();
      await demoManager.simulateIncident();

      const statusBeforeReset = demoManager.getDemoStatus();
      expect(statusBeforeReset.metrics.activeWorkflows).toBe(2);

      // Reset demo mode
      const resetSession = await demoManager.resetDemoMode();

      expect(resetSession).toBeDefined();
      expect(resetSession!.sessionId).not.toBe(originalSession.sessionId);
      expect(resetSession!.scenario.type).toBe('api-failure');
      expect(resetSession!.autoProgression).toBe(true);

      // Verify workflows are cleared
      const statusAfterReset = demoManager.getDemoStatus();
      expect(statusAfterReset.metrics.activeWorkflows).toBe(0);
      expect(statusAfterReset.isActive).toBe(true);

      // Verify safety constraints maintained after reset
      expect(resetSession!.safetyStatus.isolated).toBe(true);
      expect(resetSession!.safetyStatus.noExternalActions).toBe(true);
    });

    test('should create and restore state snapshots', async () => {
      // Create initial session with activity
      const originalSession = await demoManager.activateDemoMode({
        scenarioType: 'database-outage'
      });
      
      const incidentResult = await demoManager.simulateIncident();
      await demoManager.simulateAgentAnalysis(incidentResult.workflowId, 'sre-agent');

      // Create snapshot
      const snapshot = demoManager.createStateSnapshot();
      
      expect(snapshot).toBeDefined();
      expect(snapshot!.sessionId).toBe(originalSession.sessionId);
      expect(snapshot!.scenario.type).toBe('database-outage');
      expect(snapshot!.workflows.length).toBe(1);
      expect(snapshot!.workflows[0].workflowId).toBe(incidentResult.workflowId);

      // Deactivate and restore
      await demoManager.deactivateDemoMode();
      expect(demoManager.isDemo()).toBe(false);

      await demoManager.restoreFromSnapshot(snapshot!);
      
      expect(demoManager.isDemo()).toBe(true);
      expect(demoManager.getCurrentSessionId()).toBe(originalSession.sessionId);

      // Verify restored state
      const restoredStatus = demoManager.getDemoStatus();
      expect(restoredStatus.session?.scenario.type).toBe('database-outage');
      expect(restoredStatus.metrics.activeWorkflows).toBe(1);
    });

    test('should handle multiple reset cycles', async () => {
      await demoManager.activateDemoMode({
        scenarioType: 'security-incident'
      });

      const sessionIds: string[] = [];
      sessionIds.push(demoManager.getCurrentSessionId()!);

      // Perform multiple reset cycles
      for (let i = 0; i < 3; i++) {
        await demoManager.simulateIncident();
        const resetSession = await demoManager.resetDemoMode();
        sessionIds.push(resetSession!.sessionId);
        
        // Verify each reset creates new session
        expect(resetSession!.scenario.type).toBe('security-incident');
        expect(demoManager.getDemoStatus().metrics.activeWorkflows).toBe(0);
      }

      // All session IDs should be unique
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(sessionIds.length);
    });
  });

  describe('Demo Mode Safety Constraints', () => {
    test('should maintain isolation throughout workflow execution', async () => {
      const isolationEvents: any[] = [];
      demoManager.on('externalCallBlocked', (event) => {
        isolationEvents.push(event);
      });

      await demoManager.activateDemoMode();
      const incidentResult = await demoManager.simulateIncident();

      // Execute full workflow
      await demoManager.simulateAgentAnalysis(incidentResult.workflowId, 'sre-agent');
      await demoManager.simulateAgentAnalysis(incidentResult.workflowId, 'security-agent');
      await demoManager.simulateAgentAnalysis(incidentResult.workflowId, 'governance-agent');
      await demoManager.simulateGovernanceScenario(incidentResult.workflowId, 'realistic');

      // Verify isolation status
      const isolationStatus = demoManager.getIsolationStatus();
      expect(isolationStatus.isActive).toBe(true);
      expect(isolationStatus.demoModeEnabled).toBe(true);
      expect(isolationStatus.safetyConstraints.noExternalActions).toBe(true);
      expect(isolationStatus.safetyConstraints.noCredentialAccess).toBe(true);
      expect(isolationStatus.safetyConstraints.noInfrastructureMutation).toBe(true);
    });

    test('should prevent external HTTP requests during demo', async () => {
      await demoManager.activateDemoMode();

      // Validate external HTTP request is blocked
      const httpResult = demoManager.validateHttpRequest(
        'https://api.amazonaws.com/ec2/instances',
        'GET'
      );

      expect(httpResult.allowed).toBe(false);
      expect(httpResult.reason).toContain('Demo mode');
      expect(httpResult.mockResponse).toBeDefined();
    });

    test('should prevent credential access during demo', async () => {
      await demoManager.activateDemoMode();

      // Validate credential access is blocked
      const credResult = demoManager.validateCredentialAccess(
        'AWS_ACCESS_KEY',
        'environment'
      );

      expect(credResult.allowed).toBe(false);
      expect(credResult.reason).toContain('Demo mode');
    });

    test('should prevent command execution during demo', async () => {
      await demoManager.activateDemoMode();

      // Validate dangerous command is blocked
      const cmdResult = demoManager.validateCommandExecution(
        'kubectl apply -f deployment.yaml'
      );

      expect(cmdResult.allowed).toBe(false);
      expect(cmdResult.reason).toContain('Demo mode');
      expect(cmdResult.isDangerous).toBe(true);
    });

    test('should prevent cloud API calls during demo', async () => {
      await demoManager.activateDemoMode();

      // Validate cloud API call is blocked
      const cloudResult = demoManager.validateCloudApiCall(
        'aws',
        'ec2',
        'DescribeInstances'
      );

      expect(cloudResult.allowed).toBe(false);
      expect(cloudResult.reason).toContain('Demo mode');
      expect(cloudResult.mockResponse).toBeDefined();
    });

    test('should display clear simulation indicators', async () => {
      await demoManager.activateDemoMode();

      const indicators = demoManager.getSimulationIndicators();

      expect(indicators.isDemoMode).toBe(true);
      expect(indicators.statusText).toContain('DEMO');
      expect(indicators.statusColor).toBe('yellow');
      expect(indicators.warningMessage).toBeDefined();
      expect(indicators.isolationActive).toBe(true);
    });

    test('should generate audit trail for all demo operations', async () => {
      const auditEvents: any[] = [];
      demoManager.on('demoAuditEvent', (event) => {
        auditEvents.push(event);
      });

      await demoManager.activateDemoMode();
      const incidentResult = await demoManager.simulateIncident();
      await demoManager.simulateAgentAnalysis(incidentResult.workflowId, 'sre-agent');
      await demoManager.simulateGovernanceScenario(incidentResult.workflowId, 'realistic');

      // Verify audit events were generated
      expect(auditEvents.length).toBeGreaterThanOrEqual(4);

      // Verify audit event structure
      auditEvents.forEach(event => {
        expect(event.eventId).toBeDefined();
        expect(event.timestamp).toBeDefined();
        expect(event.demoMode).toBe(true);
        expect(event.immutable).toBe(true);
      });

      // Verify specific event types
      const eventTypes = auditEvents.map(e => e.eventType);
      expect(eventTypes).toContain('demo_activated');
      expect(eventTypes).toContain('incident_simulated');
      expect(eventTypes).toContain('agent_analysis_simulated');
      expect(eventTypes).toContain('governance_scenario_simulated');
    });

    test('should track blocked external calls', async () => {
      await demoManager.activateDemoMode();

      // Attempt various external calls
      demoManager.validateHttpRequest('https://api.datadog.com/v1/metrics', 'GET');
      demoManager.validateWebSocketConnection('wss://api.splunk.com/stream');
      demoManager.validateCloudApiCall('aws', 's3', 'PutObject');

      // Verify blocked calls are tracked
      const blockedCalls = demoManager.getBlockedCalls();
      expect(blockedCalls.length).toBe(3);

      const summary = demoManager.getBlockedCallsSummary();
      expect(summary['http_request']).toBe(1);
      expect(summary['websocket_connection']).toBe(1);
      expect(summary['cloud_api']).toBe(1);
    });
  });

  describe('Multiple Scenario Types', () => {
    const scenarioTypes = [
      'database-outage',
      'api-failure',
      'security-incident',
      'infrastructure-issue',
      'deployment-problem'
    ];

    test.each(scenarioTypes)('should execute complete workflow for %s scenario', async (scenarioType) => {
      const session = await demoManager.activateDemoMode({ scenarioType });
      
      expect(session.scenario.type).toBe(scenarioType);
      expect(session.isActive).toBe(true);

      const incidentResult = await demoManager.simulateIncident();
      expect(incidentResult.incident.type).toBe(scenarioType);

      // Execute agent analysis
      const sreOutput = await demoManager.simulateAgentAnalysis(
        incidentResult.workflowId,
        'sre-agent'
      );
      expect(sreOutput.agentName).toBe('sre-agent');
      expect(sreOutput.findings.summary).toBeDefined();

      // Execute governance scenario
      const governanceScenario = await demoManager.simulateGovernanceScenario(
        incidentResult.workflowId,
        'realistic'
      );
      expect(governanceScenario.blastRadiusAssessment).toBeDefined();

      // Verify safety maintained
      const status = demoManager.getDemoStatus();
      expect(status.session?.safetyStatus.isolated).toBe(true);
    });
  });

  describe('Concurrent Workflow Handling', () => {
    test('should handle multiple concurrent workflows', async () => {
      await demoManager.activateDemoMode();

      // Create multiple incidents
      const incidents = await Promise.all([
        demoManager.simulateIncident(),
        demoManager.simulateIncident(),
        demoManager.simulateIncident()
      ]);

      expect(incidents.length).toBe(3);
      
      const workflowIds = incidents.map(i => i.workflowId);
      const uniqueIds = new Set(workflowIds);
      expect(uniqueIds.size).toBe(3);

      // Verify all workflows are tracked
      const status = demoManager.getDemoStatus();
      expect(status.metrics.activeWorkflows).toBe(3);

      // Execute analysis on all workflows concurrently
      const analysisResults = await Promise.all(
        workflowIds.map(id => demoManager.simulateAgentAnalysis(id, 'sre-agent'))
      );

      expect(analysisResults.length).toBe(3);
      analysisResults.forEach(result => {
        expect(result.agentName).toBe('sre-agent');
        expect(result.findings.summary).toBeDefined();
      });
    });

    test('should enforce maximum concurrent workflows limit', async () => {
      demoManager.updateConfig({ maxConcurrentWorkflows: 2 });
      await demoManager.activateDemoMode();

      // Create workflows up to limit
      await demoManager.simulateIncident();
      await demoManager.simulateIncident();

      // Third workflow should fail
      await expect(demoManager.simulateIncident()).rejects.toThrow(
        'Maximum concurrent workflows'
      );
    });
  });

  describe('Error Recovery', () => {
    test('should handle invalid workflow ID gracefully', async () => {
      await demoManager.activateDemoMode();

      await expect(
        demoManager.simulateAgentAnalysis('non-existent-workflow', 'sre-agent')
      ).rejects.toThrow('Demo workflow non-existent-workflow not found');
    });

    test('should handle invalid agent name gracefully', async () => {
      await demoManager.activateDemoMode();
      const incidentResult = await demoManager.simulateIncident();

      await expect(
        demoManager.simulateAgentAnalysis(incidentResult.workflowId, 'invalid-agent' as any)
      ).rejects.toThrow();
    });

    test('should handle operations when demo mode inactive', async () => {
      // Don't activate demo mode
      await expect(demoManager.simulateIncident()).rejects.toThrow(
        'Demo mode is not active'
      );
    });

    test('should prevent double activation', async () => {
      await demoManager.activateDemoMode();

      await expect(demoManager.activateDemoMode()).rejects.toThrow(
        'Demo mode is already active'
      );
    });
  });
});
