/**
 * SentinelFlow Realistic Agent Simulation Tests
 * Tests for progressive disclosure, skills attribution, and human approval scenarios
 * Validates Requirements 9.2, 9.4, 9.5
 */

import { DemoModeManager } from '../DemoModeManager';
import { DemoDataGenerator } from '../data-generators/DemoDataGenerator';
import { AgentName } from '../../types/agent-skills';

describe('Realistic Agent Simulation', () => {
  let demoManager: DemoModeManager;
  let dataGenerator: DemoDataGenerator;

  beforeEach(() => {
    demoManager = new DemoModeManager({
      enableProgressiveDisclosure: true,
      enableRealisticTiming: false, // Disable for faster tests
      timingConfig: {
        agentProcessingDelayMs: 100, // Reduced for testing
        stateTransitionDelayMs: 50,
        progressiveDisclosureIntervalMs: 100
      }
    });
    dataGenerator = new DemoDataGenerator();
  });

  afterEach(async () => {
    if (demoManager.isDemo()) {
      await demoManager.deactivateDemoMode();
    }
  });

  describe('Progressive Disclosure', () => {
    test('should emit progressive updates during agent analysis', async () => {
      // Activate demo mode
      const session = await demoManager.activateDemoMode({
        scenarioType: 'database-outage'
      });

      // Simulate incident
      const { workflowId } = await demoManager.simulateIncident();

      // Track progressive updates
      const progressUpdates: any[] = [];
      demoManager.on('agentProgressUpdate', (update) => {
        progressUpdates.push(update);
      });

      // Simulate agent analysis
      await demoManager.simulateAgentAnalysis(workflowId, 'sre-agent');

      // Verify progressive updates were emitted
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Verify update structure
      const firstUpdate = progressUpdates[0];
      expect(firstUpdate).toMatchObject({
        workflowId,
        agentName: 'sre-agent',
        step: expect.any(Number),
        totalSteps: expect.any(Number),
        currentActivity: expect.any(String),
        skillInUse: expect.any(String),
        partialFindings: expect.any(Array),
        confidenceLevel: expect.any(Number),
        isDemo: true
      });

      // Verify confidence builds progressively
      const confidenceLevels = progressUpdates.map(u => u.confidenceLevel);
      for (let i = 1; i < confidenceLevels.length; i++) {
        expect(confidenceLevels[i]).toBeGreaterThanOrEqual(confidenceLevels[i - 1]);
      }
    });

    test('should show different skills being used progressively', async () => {
      const session = await demoManager.activateDemoMode({
        scenarioType: 'database-outage'
      });

      const { workflowId } = await demoManager.simulateIncident();

      const progressUpdates: any[] = [];
      demoManager.on('agentProgressUpdate', (update) => {
        progressUpdates.push(update);
      });

      await demoManager.simulateAgentAnalysis(workflowId, 'sre-agent');

      // Verify different skills are used
      const skillsUsed = progressUpdates.map(u => u.skillInUse);
      const uniqueSkills = [...new Set(skillsUsed)];
      expect(uniqueSkills.length).toBeGreaterThan(1);

      // Verify skills are from authorized SRE skills
      const authorizedSkills = ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry'];
      skillsUsed.forEach(skill => {
        expect(authorizedSkills).toContain(skill);
      });
    });

    test('should emit analysis started and completed events', async () => {
      const session = await demoManager.activateDemoMode({
        scenarioType: 'database-outage'
      });

      const { workflowId } = await demoManager.simulateIncident();

      let analysisStarted = false;
      let analysisCompleted = false;

      demoManager.on('agentAnalysisStarted', () => {
        analysisStarted = true;
      });

      demoManager.on('agentAnalysisCompleted', () => {
        analysisCompleted = true;
      });

      await demoManager.simulateAgentAnalysis(workflowId, 'sre-agent');

      expect(analysisStarted).toBe(true);
      expect(analysisCompleted).toBe(true);
    });
  });

  describe('Skills Attribution', () => {
    test('should generate detailed skills metadata for agent outputs', () => {
      const incident = dataGenerator.generateIncident({
        type: 'database-outage',
        name: 'Test Scenario',
        description: 'Test',
        complexity: 'moderate',
        estimatedDuration: '10 minutes',
        incidentTemplate: {
          severity: 'high',
          affectedServices: ['db-service'],
          symptoms: ['connection errors'],
          initialMetrics: { cpu: 80, memory: 75, errorRate: 10, responseTime: 5000, throughput: 50 },
          timelineEvents: []
        },
        expectedAnalysis: {
          sreFindings: ['Database connection issues'],
          securityFindings: ['No security concerns'],
          governanceFindings: ['Policy compliant'],
          correlationPoints: ['Recent deployment']
        },
        governanceScenario: {
          defaultRiskLevel: 'medium',
          policyConflicts: [],
          blastRadiusServices: ['db-service'],
          recommendedDecision: 'approve'
        }
      } as any);

      const scenario = {
        type: 'database-outage',
        expectedAnalysis: {
          sreFindings: ['Database connection pool exhausted', 'High CPU utilization'],
          securityFindings: ['No security indicators'],
          governanceFindings: ['Change management compliant']
        }
      } as any;

      const agentOutput = dataGenerator.generateAgentOutput('sre-agent', incident, scenario);

      // Verify skills metadata structure
      expect(agentOutput.metadata?.skillsMetadata).toBeDefined();
      expect(agentOutput.metadata?.skillsMetadata).toMatchObject({
        totalSkillsAvailable: expect.any(Number),
        skillsUtilized: expect.any(Number),
        utilizationRate: expect.any(Number),
        primarySkill: expect.any(String),
        analysisDepth: expect.stringMatching(/^(shallow|moderate|deep)$/),
        skillUsageDetails: expect.any(Array),
        skillEffectiveness: expect.any(Object)
      });

      // Verify skill usage details
      const skillUsageDetails = agentOutput.metadata?.skillsMetadata?.skillUsageDetails;
      expect(skillUsageDetails).toBeDefined();
      expect(skillUsageDetails!.length).toBeGreaterThan(0);

      skillUsageDetails!.forEach(detail => {
        expect(detail).toMatchObject({
          skill: expect.any(String),
          usedAt: expect.any(String),
          duration: expect.any(Number),
          dataSourcesAccessed: expect.any(Array),
          findingsContributed: expect.any(Number),
          confidenceContribution: expect.any(Number)
        });
      });
    });

    test('should validate skills are appropriate for each agent type', () => {
      const incident = dataGenerator.generateIncident({
        type: 'security-incident',
        incidentTemplate: {
          severity: 'critical',
          affectedServices: ['auth-service'],
          symptoms: ['suspicious logins'],
          initialMetrics: { cpu: 60, memory: 70, errorRate: 5, responseTime: 3000, throughput: 100 },
          timelineEvents: []
        },
        expectedAnalysis: {
          securityFindings: ['Suspicious authentication patterns']
        }
      } as any);

      const scenario = {
        type: 'security-incident',
        expectedAnalysis: {
          securityFindings: ['Coordinated attack pattern identified']
        }
      } as any;

      const agentOutput = dataGenerator.generateAgentOutput('security-agent', incident, scenario);

      // Verify only authorized security skills are used
      const authorizedSecuritySkills = ['Splunk SIEM', 'IAM Logs', 'CSPM'];
      agentOutput.skillsUsed.forEach(skill => {
        expect(authorizedSecuritySkills).toContain(skill);
      });

      // Verify validation flags
      expect(agentOutput.validation.skillsValid).toBe(true);
    });

    test('should show progressive disclosure metadata', () => {
      const incident = dataGenerator.generateIncident({
        type: 'database-outage',
        incidentTemplate: {
          severity: 'high',
          affectedServices: ['db-service'],
          symptoms: ['connection timeouts'],
          initialMetrics: { cpu: 85, memory: 90, errorRate: 15, responseTime: 8000, throughput: 30 },
          timelineEvents: []
        },
        expectedAnalysis: {
          sreFindings: ['Database connection pool exhausted']
        }
      } as any);

      const scenario = {
        type: 'database-outage',
        expectedAnalysis: {
          sreFindings: ['Database connection pool exhausted']
        }
      } as any;

      const agentOutput = dataGenerator.generateAgentOutput('sre-agent', incident, scenario);

      // Verify progressive disclosure metadata
      expect(agentOutput.metadata?.progressiveDisclosure).toBeDefined();
      expect(agentOutput.metadata?.progressiveDisclosure).toMatchObject({
        totalSteps: expect.any(Number),
        stepsCompleted: expect.any(Number),
        averageStepDuration: expect.any(Number),
        skillProgression: expect.any(Array)
      });

      // Verify skill progression details
      const skillProgression = agentOutput.metadata?.progressiveDisclosure?.skillProgression;
      expect(skillProgression).toBeDefined();
      expect(skillProgression!.length).toBeGreaterThan(0);

      skillProgression!.forEach(step => {
        expect(step).toMatchObject({
          step: expect.any(Number),
          skill: expect.any(String),
          startTime: expect.any(Number),
          duration: expect.any(Number),
          partialFindings: expect.any(Array),
          cumulativeConfidence: expect.any(Number)
        });
      });
    });
  });

  describe('Human Approval Scenarios', () => {
    test('should generate governance scenarios requiring human approval', async () => {
      const session = await demoManager.activateDemoMode({
        scenarioType: 'security-incident'
      });

      const { workflowId } = await demoManager.simulateIncident();

      let humanApprovalRequired = false;
      let approvalDetails: any = null;

      demoManager.on('humanApprovalRequired', (details) => {
        humanApprovalRequired = true;
        approvalDetails = details;
      });

      const governanceResult = await demoManager.simulateGovernanceScenario(
        workflowId, 
        'human_required'
      );

      expect(governanceResult.requiresHumanApproval).toBe(true);
      expect(governanceResult.humanApprovalReason).toBeDefined();
      expect(humanApprovalRequired).toBe(true);
      expect(approvalDetails).toMatchObject({
        workflowId,
        approvalReason: expect.any(String),
        timeoutMinutes: expect.any(Number),
        isDemo: true
      });
    });

    test('should simulate human approval decisions', async () => {
      const session = await demoManager.activateDemoMode({
        scenarioType: 'security-incident'
      });

      const { workflowId } = await demoManager.simulateIncident();

      let approvalDecision: any = null;
      demoManager.on('humanApprovalDecision', (decision) => {
        approvalDecision = decision;
      });

      const decision = await demoManager.simulateHumanApprovalDecision(
        workflowId,
        'approve_with_restrictions',
        'CISO',
        'Approved with enhanced monitoring requirements'
      );

      expect(decision).toMatchObject({
        decision: 'approve_with_restrictions',
        approver: 'CISO',
        justification: 'Approved with enhanced monitoring requirements',
        timestamp: expect.any(String),
        restrictions: expect.any(Array)
      });

      expect(approvalDecision).toBeDefined();
      expect(approvalDecision.approvalResult).toEqual(decision);
    });

    test('should generate different approval types with appropriate requirements', () => {
      const incident = dataGenerator.generateIncident({
        type: 'security-incident',
        incidentTemplate: {
          severity: 'critical',
          affectedServices: ['auth-service', 'user-service'],
          symptoms: ['unauthorized access'],
          initialMetrics: { cpu: 70, memory: 80, errorRate: 8, responseTime: 4000, throughput: 90 },
          timelineEvents: []
        }
      } as any);

      const scenario = {
        type: 'security-incident',
        governanceScenario: {
          defaultRiskLevel: 'critical',
          policyConflicts: ['Security incident response required'],
          blastRadiusServices: ['auth-service', 'user-service'],
          recommendedDecision: 'block'
        }
      } as any;

      const approvalTypes = ['security_review', 'executive_approval', 'compliance_check', 'risk_assessment'];

      approvalTypes.forEach(approvalType => {
        const humanApprovalScenario = dataGenerator.generateHumanApprovalScenario(
          incident,
          scenario,
          approvalType as any
        );

        expect(humanApprovalScenario.humanApprovalRequired).toBe(true);
        expect(humanApprovalScenario.approvalType).toBe(approvalType);
        expect(humanApprovalScenario.approvalReason).toBeDefined();
        expect(humanApprovalScenario.escalationLevel).toBeDefined();
        expect(humanApprovalScenario.timeoutMinutes).toBeGreaterThan(0);
        expect(humanApprovalScenario.requiredApprovers).toBeDefined();
        expect(humanApprovalScenario.requiredApprovers.length).toBeGreaterThan(0);
      });
    });

    test('should determine human approval requirements based on risk factors', async () => {
      const session = await demoManager.activateDemoMode({
        scenarioType: 'security-incident'
      });

      const { workflowId } = await demoManager.simulateIncident();

      // Test critical risk level requires human approval
      const criticalResult = await demoManager.simulateGovernanceScenario(workflowId, 'realistic');
      
      // Security incidents should require human approval
      expect(criticalResult.requiresHumanApproval).toBe(true);
      expect(criticalResult.humanApprovalReason).toMatch(/Security|security|Critical|critical/);
    });

    test('should generate appropriate restrictions for conditional approvals', async () => {
      const session = await demoManager.activateDemoMode({
        scenarioType: 'database-outage'
      });

      const { workflowId } = await demoManager.simulateIncident();

      const decision = await demoManager.simulateHumanApprovalDecision(
        workflowId,
        'approve_with_restrictions',
        'DBA Manager',
        'Approved with database monitoring requirements'
      );

      expect(decision.restrictions).toBeDefined();
      expect(decision.restrictions!.length).toBeGreaterThan(0);
      
      // Should include post-incident review
      expect(decision.restrictions!.some(r => r.includes('review'))).toBe(true);
    });
  });

  describe('Safety Constraints', () => {
    test('should maintain safety constraints during realistic simulation', async () => {
      const session = await demoManager.activateDemoMode({
        scenarioType: 'database-outage'
      });

      const { workflowId } = await demoManager.simulateIncident();

      // Simulate full workflow with realistic timing
      await demoManager.simulateAgentAnalysis(workflowId, 'sre-agent');
      await demoManager.simulateAgentAnalysis(workflowId, 'security-agent');
      await demoManager.simulateAgentAnalysis(workflowId, 'governance-agent');

      const governanceResult = await demoManager.simulateGovernanceScenario(workflowId, 'realistic');

      // Verify safety status is maintained
      expect(session.safetyStatus.isolated).toBe(true);
      expect(session.safetyStatus.noExternalActions).toBe(true);
      expect(session.safetyStatus.auditTrailActive).toBe(true);
      expect(session.safetyStatus.clearlyMarked).toBe(true);

      // Verify demo mode is clearly marked in all outputs
      const status = demoManager.getDemoStatus();
      expect(status.isActive).toBe(true);
    });

    test('should generate comprehensive audit trail for realistic simulation', async () => {
      const session = await demoManager.activateDemoMode({
        scenarioType: 'database-outage'
      });

      const { workflowId } = await demoManager.simulateIncident();

      const auditEvents: any[] = [];
      demoManager.on('demoAuditEvent', (event) => {
        auditEvents.push(event);
      });

      // Simulate realistic workflow
      await demoManager.simulateAgentAnalysis(workflowId, 'sre-agent');
      await demoManager.simulateGovernanceScenario(workflowId, 'human_required');
      await demoManager.simulateHumanApprovalDecision(workflowId, 'approve', 'Manager', 'Approved for execution');

      // Verify comprehensive audit trail
      expect(auditEvents.length).toBeGreaterThan(3);
      
      // Verify all events are marked as demo mode
      auditEvents.forEach(event => {
        expect(event.demoMode).toBe(true);
        expect(event.immutable).toBe(true);
        expect(event.sessionId).toBe(session.sessionId);
      });

      // Verify specific event types are present
      const eventTypes = auditEvents.map(e => e.eventType);
      expect(eventTypes).toContain('agent_analysis_simulated');
      expect(eventTypes).toContain('governance_scenario_simulated');
    });
  });
});