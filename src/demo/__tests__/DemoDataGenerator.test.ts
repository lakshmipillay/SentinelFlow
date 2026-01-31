/**
 * SentinelFlow Demo Data Generator Tests
 * Tests for realistic data generation with proper skills attribution
 * Implements Requirements 9.2, 9.4 - Data generation testing
 */

import { DemoDataGenerator } from '../data-generators/DemoDataGenerator';
import { DemoScenarioGenerator } from '../scenarios/DemoScenarioGenerator';
import { AgentName } from '../../types/agent-skills';

describe('DemoDataGenerator', () => {
  let dataGenerator: DemoDataGenerator;
  let scenarioGenerator: DemoScenarioGenerator;

  beforeEach(() => {
    dataGenerator = new DemoDataGenerator();
    scenarioGenerator = new DemoScenarioGenerator();
  });

  describe('Incident Generation', () => {
    test('should generate realistic database outage incident', () => {
      const scenario = scenarioGenerator.generateScenario('database-outage');
      const incident = dataGenerator.generateIncident(scenario);

      expect(incident.incidentId).toMatch(/^INC-\d+-[A-Z0-9]+$/);
      expect(incident.type).toBe('database-outage');
      expect(incident.severity).toBe('critical');
      expect(incident.affectedServices).toContain('user-service');
      expect(incident.affectedServices).toContain('order-service');
      expect(incident.timestamp).toBeDefined();

      // Validate metrics structure
      expect(incident.metrics.cpu).toBeGreaterThan(0);
      expect(incident.metrics.memory).toBeGreaterThan(0);
      expect(incident.metrics.errorRate).toBeGreaterThan(0);
      expect(incident.metrics.responseTime).toBeGreaterThan(0);
      expect(incident.metrics.throughput).toBeGreaterThan(0);

      // Validate logs structure
      expect(incident.logs).toBeInstanceOf(Array);
      expect(incident.logs.length).toBeGreaterThan(0);
      incident.logs.forEach(log => {
        expect(log.timestamp).toBeDefined();
        expect(log.level).toMatch(/^(info|warn|error|critical)$/);
        expect(log.service).toBeDefined();
        expect(log.message).toBeDefined();
      });

      // Validate alert structure
      expect(incident.alert.alertId).toMatch(/^ALERT-\d+-[A-Z0-9]+$/);
      expect(incident.alert.source).toBe('Database Monitoring');
      expect(incident.alert.rule).toBeDefined();
      expect(incident.alert.threshold).toBeGreaterThan(0);
      expect(incident.alert.currentValue).toBeGreaterThan(0);
      expect(incident.alert.duration).toBeDefined();
    });

    test('should generate realistic API failure incident', () => {
      const scenario = scenarioGenerator.generateScenario('api-failure');
      const incident = dataGenerator.generateIncident(scenario);

      expect(incident.type).toBe('api-failure');
      expect(incident.severity).toBe('high');
      expect(incident.affectedServices).toContain('api-gateway');
      expect(incident.alert.source).toBe('API Gateway');
    });

    test('should generate realistic security incident', () => {
      const scenario = scenarioGenerator.generateScenario('security-incident');
      const incident = dataGenerator.generateIncident(scenario);

      expect(incident.type).toBe('security-incident');
      expect(incident.severity).toBe('critical');
      expect(incident.affectedServices).toContain('auth-service');
      expect(incident.alert.source).toBe('Security Operations Center');
    });

    test('should apply metric variations', () => {
      const scenario = scenarioGenerator.generateScenario('database-outage');
      const incident1 = dataGenerator.generateIncident(scenario);
      const incident2 = dataGenerator.generateIncident(scenario);

      // Metrics should have some variation but be in similar ranges
      expect(incident1.metrics.cpu).not.toBe(incident2.metrics.cpu);
      expect(Math.abs(incident1.metrics.cpu - incident2.metrics.cpu)).toBeLessThan(20);
    });

    test('should generate appropriate log levels for severity', () => {
      const criticalScenario = scenarioGenerator.generateScenario('security-incident');
      const criticalIncident = dataGenerator.generateIncident(criticalScenario);

      const mediumScenario = scenarioGenerator.generateScenario('deployment-problem');
      const mediumIncident = dataGenerator.generateIncident(mediumScenario);

      // Critical incidents should have more error/critical logs
      const criticalErrorLogs = criticalIncident.logs.filter(log => 
        log.level === 'error' || log.level === 'critical'
      );
      const mediumErrorLogs = mediumIncident.logs.filter(log => 
        log.level === 'error' || log.level === 'critical'
      );

      expect(criticalErrorLogs.length).toBeGreaterThanOrEqual(mediumErrorLogs.length);
    });
  });

  describe('Agent Output Generation', () => {
    let incident: any;
    let scenario: any;

    beforeEach(() => {
      scenario = scenarioGenerator.generateScenario('database-outage');
      incident = dataGenerator.generateIncident(scenario);
    });

    test('should generate valid SRE agent output', () => {
      const agentOutput = dataGenerator.generateAgentOutput('sre-agent', incident, scenario);

      expect(agentOutput.agentName).toBe('sre-agent');
      expect(agentOutput.skillsUsed).toContain('Datadog');
      expect(agentOutput.skillsUsed).toContain('CloudWatch');
      expect(agentOutput.skillsUsed.every(skill => 
        ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry'].includes(skill)
      )).toBe(true);

      expect(agentOutput.findings.summary).toBeDefined();
      expect(agentOutput.findings.evidence).toBeInstanceOf(Array);
      expect(agentOutput.findings.correlations).toBeInstanceOf(Array);
      expect(agentOutput.findings.recommendations).toBeInstanceOf(Array);

      expect(agentOutput.confidenceLevel).toBeGreaterThanOrEqual(0.7);
      expect(agentOutput.confidenceLevel).toBeLessThanOrEqual(0.95);

      expect(agentOutput.metadata.processingTimeMs).toBeGreaterThanOrEqual(1500);
      expect(agentOutput.metadata.processingTimeMs).toBeLessThanOrEqual(3000);
      expect(agentOutput.metadata.dataSourcesAccessed).toContain('datadog-metrics');
      expect(agentOutput.metadata.skillsMetadata.primarySkill).toBeDefined();

      expect(agentOutput.validation.skillsValid).toBe(true);
      expect(agentOutput.validation.confidenceLevelValid).toBe(true);
      expect(agentOutput.validation.schemaCompliant).toBe(true);
    });

    test('should generate valid Security agent output', () => {
      const agentOutput = dataGenerator.generateAgentOutput('security-agent', incident, scenario);

      expect(agentOutput.agentName).toBe('security-agent');
      expect(agentOutput.skillsUsed).toContain('Splunk SIEM');
      expect(agentOutput.skillsUsed).toContain('IAM Logs');
      expect(agentOutput.skillsUsed.every(skill => 
        ['Splunk SIEM', 'IAM Logs', 'CSPM'].includes(skill)
      )).toBe(true);

      expect(agentOutput.confidenceLevel).toBeGreaterThanOrEqual(0.6);
      expect(agentOutput.confidenceLevel).toBeLessThanOrEqual(0.9);

      expect(agentOutput.metadata.processingTimeMs).toBeGreaterThanOrEqual(2000);
      expect(agentOutput.metadata.processingTimeMs).toBeLessThanOrEqual(4000);
      expect(agentOutput.metadata.dataSourcesAccessed).toContain('splunk-security-events');
    });

    test('should generate valid Governance agent output', () => {
      const agentOutput = dataGenerator.generateAgentOutput('governance-agent', incident, scenario);

      expect(agentOutput.agentName).toBe('governance-agent');
      expect(agentOutput.skillsUsed).toContain('Policy Engine');
      expect(agentOutput.skillsUsed).toContain('Change Management');
      expect(agentOutput.skillsUsed.every(skill => 
        ['Policy Engine', 'Change Management', 'Risk Register'].includes(skill)
      )).toBe(true);

      expect(agentOutput.confidenceLevel).toBeGreaterThanOrEqual(0.8);
      expect(agentOutput.confidenceLevel).toBeLessThanOrEqual(0.95);

      expect(agentOutput.metadata.processingTimeMs).toBeGreaterThanOrEqual(1000);
      expect(agentOutput.metadata.processingTimeMs).toBeLessThanOrEqual(2500);
      expect(agentOutput.metadata.dataSourcesAccessed).toContain('policy-definitions');
    });

    test('should adjust skills based on incident severity', () => {
      const criticalIncident = { ...incident, severity: 'critical' };
      const lowIncident = { ...incident, severity: 'low' };

      const criticalOutput = dataGenerator.generateAgentOutput('sre-agent', criticalIncident, scenario);
      const lowOutput = dataGenerator.generateAgentOutput('sre-agent', lowIncident, scenario);

      // Critical incidents should use more skills
      expect(criticalOutput.skillsUsed.length).toBeGreaterThanOrEqual(lowOutput.skillsUsed.length);
    });

    test('should adjust confidence based on severity', () => {
      const criticalIncident = { ...incident, severity: 'critical' };
      const lowIncident = { ...incident, severity: 'low' };

      const criticalOutput = dataGenerator.generateAgentOutput('sre-agent', criticalIncident, scenario);
      const lowOutput = dataGenerator.generateAgentOutput('sre-agent', lowIncident, scenario);

      // Critical incidents should have higher confidence (more data available)
      expect(criticalOutput.confidenceLevel).toBeGreaterThanOrEqual(lowOutput.confidenceLevel);
    });

    test('should use expected findings from scenario', () => {
      const agentOutput = dataGenerator.generateAgentOutput('sre-agent', incident, scenario);

      // Should use findings from scenario's expected analysis
      const expectedFindings = scenario.expectedAnalysis.sreFindings;
      expect(expectedFindings.some(finding => 
        agentOutput.findings.summary.includes(finding.split(' ')[0])
      )).toBe(true);
    });

    test('should validate skills for agent type', () => {
      const sreOutput = dataGenerator.generateAgentOutput('sre-agent', incident, scenario);
      const securityOutput = dataGenerator.generateAgentOutput('security-agent', incident, scenario);
      const governanceOutput = dataGenerator.generateAgentOutput('governance-agent', incident, scenario);

      expect(sreOutput.validation.skillsValid).toBe(true);
      expect(securityOutput.validation.skillsValid).toBe(true);
      expect(governanceOutput.validation.skillsValid).toBe(true);

      // Skills should not overlap between agents
      expect(sreOutput.skillsUsed.some(skill => 
        securityOutput.skillsUsed.includes(skill)
      )).toBe(false);
    });

    test('should generate appropriate data sources for skills', () => {
      const agentOutput = dataGenerator.generateAgentOutput('sre-agent', incident, scenario);

      agentOutput.skillsUsed.forEach(skill => {
        const expectedSources = {
          'Datadog': ['datadog-metrics', 'datadog-logs', 'datadog-traces'],
          'CloudWatch': ['cloudwatch-metrics', 'cloudwatch-logs', 'cloudwatch-alarms'],
          'Prometheus': ['prometheus-metrics', 'prometheus-alerts'],
          'OpenTelemetry': ['otel-traces', 'otel-metrics', 'otel-logs']
        };

        const sources = expectedSources[skill as keyof typeof expectedSources];
        if (sources) {
          expect(sources.some(source => 
            agentOutput.metadata.dataSourcesAccessed.includes(source)
          )).toBe(true);
        }
      });
    });

    test('should calculate analysis depth correctly', () => {
      const highConfidenceOutput = dataGenerator.generateAgentOutput('governance-agent', incident, scenario);
      const lowConfidenceOutput = dataGenerator.generateAgentOutput('security-agent', { ...incident, severity: 'low' }, scenario);

      expect(highConfidenceOutput.metadata.skillsMetadata.analysisDepth).toBeDefined();
      expect(['shallow', 'moderate', 'deep']).toContain(
        highConfidenceOutput.metadata.skillsMetadata.analysisDepth
      );

      // Higher confidence and more skills should lead to deeper analysis
      if (highConfidenceOutput.confidenceLevel > lowConfidenceOutput.confidenceLevel &&
          highConfidenceOutput.skillsUsed.length >= lowConfidenceOutput.skillsUsed.length) {
        const depthOrder = { 'shallow': 1, 'moderate': 2, 'deep': 3 };
        expect(depthOrder[highConfidenceOutput.metadata.skillsMetadata.analysisDepth as keyof typeof depthOrder])
          .toBeGreaterThanOrEqual(depthOrder[lowConfidenceOutput.metadata.skillsMetadata.analysisDepth as keyof typeof depthOrder]);
      }
    });
  });

  describe('Governance Scenario Generation', () => {
    let incident: any;
    let scenario: any;

    beforeEach(() => {
      scenario = scenarioGenerator.generateScenario('database-outage');
      incident = dataGenerator.generateIncident(scenario);
    });

    test('should generate realistic governance scenario', () => {
      const governanceScenario = dataGenerator.generateGovernanceScenario(incident, scenario);

      expect(governanceScenario.blastRadiusAssessment).toBeDefined();
      expect(governanceScenario.blastRadiusAssessment.affectedServices).toEqual(
        scenario.governanceScenario.blastRadiusServices
      );
      expect(governanceScenario.blastRadiusAssessment.riskLevel).toBe(
        scenario.governanceScenario.defaultRiskLevel
      );
      expect(governanceScenario.blastRadiusAssessment.dependencyChain).toBeInstanceOf(Array);
      expect(governanceScenario.blastRadiusAssessment.estimatedImpact).toBeDefined();

      expect(governanceScenario.policyConflicts).toEqual(
        scenario.governanceScenario.policyConflicts
      );
      expect(governanceScenario.recommendedDecision).toMatch(
        /^(approve|approve_with_restrictions|block)$/
      );
      expect(governanceScenario.decisionFactors).toBeDefined();
    });

    test('should generate forced decision scenarios', () => {
      const approveScenario = dataGenerator.generateGovernanceScenario(incident, scenario, 'approve');
      const blockScenario = dataGenerator.generateGovernanceScenario(incident, scenario, 'block');
      const restrictedScenario = dataGenerator.generateGovernanceScenario(incident, scenario, 'approve_with_restrictions');

      expect(approveScenario.recommendedDecision).toBe('approve');
      expect(blockScenario.recommendedDecision).toBe('block');
      expect(restrictedScenario.recommendedDecision).toBe('approve_with_restrictions');
    });

    test('should assess reversibility correctly', () => {
      const dbScenario = scenarioGenerator.generateScenario('database-outage');
      const securityScenario = scenarioGenerator.generateScenario('security-incident');

      const dbGovernance = dataGenerator.generateGovernanceScenario(incident, dbScenario);
      const securityGovernance = dataGenerator.generateGovernanceScenario(incident, securityScenario);

      expect(dbGovernance.blastRadiusAssessment.reversible).toBe(true);
      expect(securityGovernance.blastRadiusAssessment.reversible).toBe(false);
    });

    test('should estimate users affected based on severity', () => {
      const criticalIncident = { ...incident, severity: 'critical' };
      const lowIncident = { ...incident, severity: 'low' };

      const criticalGovernance = dataGenerator.generateGovernanceScenario(criticalIncident, scenario);
      const lowGovernance = dataGenerator.generateGovernanceScenario(lowIncident, scenario);

      expect(criticalGovernance.blastRadiusAssessment.estimatedImpact.usersAffected)
        .toBeGreaterThan(lowGovernance.blastRadiusAssessment.estimatedImpact.usersAffected);
    });

    test('should generate dependency chains correctly', () => {
      const governanceScenario = dataGenerator.generateGovernanceScenario(incident, scenario);

      governanceScenario.blastRadiusAssessment.dependencyChain.forEach((service, index) => {
        expect(service.service).toBeDefined();
        expect(service.dependencies).toBeInstanceOf(Array);
        expect(service.criticalPath).toBeDefined();

        // First two services should be on critical path
        if (index < 2) {
          expect(service.criticalPath).toBe(true);
        }
      });
    });

    test('should calculate decision factors appropriately', () => {
      const criticalIncident = { ...incident, severity: 'critical' };
      const governanceScenario = dataGenerator.generateGovernanceScenario(criticalIncident, scenario);

      expect(governanceScenario.decisionFactors.businessImpact).toBe('critical');
      expect(governanceScenario.decisionFactors.timeConstraints).toBe('critical');
      expect(['low', 'medium', 'high', 'critical']).toContain(
        governanceScenario.decisionFactors.technicalRisk
      );
      expect(['low', 'medium', 'high', 'critical']).toContain(
        governanceScenario.decisionFactors.complianceRisk
      );
    });

    test('should assess compliance risk by scenario type', () => {
      const securityScenario = scenarioGenerator.generateScenario('security-incident');
      const securityIncident = dataGenerator.generateIncident(securityScenario);
      const securityGovernance = dataGenerator.generateGovernanceScenario(securityIncident, securityScenario);

      const deploymentScenario = scenarioGenerator.generateScenario('deployment-problem');
      const deploymentIncident = dataGenerator.generateIncident(deploymentScenario);
      const deploymentGovernance = dataGenerator.generateGovernanceScenario(deploymentIncident, deploymentScenario);

      expect(securityGovernance.decisionFactors.complianceRisk).toBe('critical');
      expect(deploymentGovernance.decisionFactors.complianceRisk).toBe('low');
    });
  });

  describe('Data Consistency and Validation', () => {
    test('should generate consistent data across multiple calls', () => {
      const scenario = scenarioGenerator.generateScenario('database-outage');
      
      // Generate multiple incidents
      const incidents = Array.from({ length: 5 }, () => dataGenerator.generateIncident(scenario));

      // All should have same basic properties from scenario
      incidents.forEach(incident => {
        expect(incident.type).toBe('database-outage');
        expect(incident.severity).toBe('critical');
        expect(incident.affectedServices).toEqual(scenario.incidentTemplate.affectedServices);
      });

      // But should have unique IDs and some metric variation
      const incidentIds = incidents.map(i => i.incidentId);
      expect(new Set(incidentIds).size).toBe(5); // All unique

      const cpuValues = incidents.map(i => i.metrics.cpu);
      expect(new Set(cpuValues).size).toBeGreaterThan(1); // Some variation
    });

    test('should validate all generated data structures', () => {
      const scenario = scenarioGenerator.generateScenario('api-failure');
      const incident = dataGenerator.generateIncident(scenario);

      // Test all agent types
      const agents: AgentName[] = ['sre-agent', 'security-agent', 'governance-agent'];
      
      agents.forEach(agentName => {
        const agentOutput = dataGenerator.generateAgentOutput(agentName, incident, scenario);
        
        // Validate required fields
        expect(agentOutput.agentName).toBe(agentName);
        expect(agentOutput.skillsUsed).toBeInstanceOf(Array);
        expect(agentOutput.skillsUsed.length).toBeGreaterThan(0);
        expect(agentOutput.findings).toBeDefined();
        expect(agentOutput.confidenceLevel).toBeGreaterThan(0);
        expect(agentOutput.confidenceLevel).toBeLessThanOrEqual(1);
        expect(agentOutput.timestamp).toBeDefined();
        expect(agentOutput.metadata).toBeDefined();
        expect(agentOutput.validation).toBeDefined();

        // Validate timestamp format
        expect(() => new Date(agentOutput.timestamp)).not.toThrow();

        // Validate metadata structure
        expect(agentOutput.metadata.processingTimeMs).toBeGreaterThan(0);
        expect(agentOutput.metadata.dataSourcesAccessed).toBeInstanceOf(Array);
        expect(agentOutput.metadata.skillsMetadata).toBeDefined();

        // Validate validation flags
        expect(typeof agentOutput.validation.skillsValid).toBe('boolean');
        expect(typeof agentOutput.validation.confidenceLevelValid).toBe('boolean');
        expect(typeof agentOutput.validation.schemaCompliant).toBe('boolean');
      });
    });

    test('should prevent external action recommendations in demo mode', () => {
      const scenario = scenarioGenerator.generateScenario('database-outage');
      const incident = dataGenerator.generateIncident(scenario);
      const agentOutput = dataGenerator.generateAgentOutput('sre-agent', incident, scenario);

      if (agentOutput.findings.recommendations) {
        agentOutput.findings.recommendations.forEach(recommendation => {
          // Should not contain actual execution commands
          expect(recommendation.toLowerCase()).not.toMatch(/execute|deploy|restart|shutdown|delete/);
        });
      }
    });
  });
});