/**
 * Unit tests for AgentOutputFactory
 * Tests creation of validated agent outputs with proper skills attribution
 */

import { AgentOutputFactory, AgentOutputRequest } from '../AgentOutputFactory';
import { AgentName } from '../../types/agent-skills';

describe('AgentOutputFactory', () => {
  const validSRERequest: AgentOutputRequest = {
    agentName: 'sre-agent',
    skillsUsed: ['Datadog', 'CloudWatch'],
    findings: {
      summary: 'Database connection pool exhaustion detected',
      evidence: ['CPU spike to 95%', 'Connection timeout errors'],
      correlations: ['Recent deployment', 'Increased traffic'],
      recommendations: ['Increase connection pool size']
    },
    confidenceLevel: 0.85,
    processingTimeMs: 2500,
    dataSourcesAccessed: ['datadog-api', 'cloudwatch-api']
  };

  describe('createAgentOutput', () => {
    test('creates valid SRE agent output', () => {
      const result = AgentOutputFactory.createAgentOutput(validSRERequest);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.agentOutput).toBeDefined();
      
      const output = result.agentOutput!;
      expect(output.agentName).toBe('sre-agent');
      expect(output.skillsUsed).toEqual(['Datadog', 'CloudWatch']);
      expect(output.confidenceLevel).toBe(0.85);
      expect(output.validation.skillsValid).toBe(true);
      expect(output.validation.confidenceLevelValid).toBe(true);
      expect(output.validation.schemaCompliant).toBe(true);
      expect(output.metadata.skillsMetadata.skillsUtilizationRate).toBe(0.5); // 2/4 skills
    });

    test('creates valid Security agent output', () => {
      const securityRequest: AgentOutputRequest = {
        ...validSRERequest,
        agentName: 'security-agent',
        skillsUsed: ['Splunk SIEM', 'IAM Logs'],
        dataSourcesAccessed: ['splunk-api', 'iam-api']
      };

      const result = AgentOutputFactory.createAgentOutput(securityRequest);
      
      expect(result.success).toBe(true);
      expect(result.agentOutput!.agentName).toBe('security-agent');
      expect(result.agentOutput!.skillsUsed).toEqual(['Splunk SIEM', 'IAM Logs']);
      expect(result.agentOutput!.metadata.skillsMetadata.skillsUtilizationRate).toBeCloseTo(0.67, 2); // 2/3 skills
    });

    test('creates valid Governance agent output', () => {
      const governanceRequest: AgentOutputRequest = {
        ...validSRERequest,
        agentName: 'governance-agent',
        skillsUsed: ['Policy Engine', 'Risk Register'],
        dataSourcesAccessed: ['policy-api', 'risk-api']
      };

      const result = AgentOutputFactory.createAgentOutput(governanceRequest);
      
      expect(result.success).toBe(true);
      expect(result.agentOutput!.agentName).toBe('governance-agent');
      expect(result.agentOutput!.skillsUsed).toEqual(['Policy Engine', 'Risk Register']);
    });

    test('rejects request with unauthorized skills', () => {
      const invalidRequest: AgentOutputRequest = {
        ...validSRERequest,
        skillsUsed: ['Datadog', 'Splunk SIEM'] // Splunk SIEM not authorized for SRE
      };

      const result = AgentOutputFactory.createAgentOutput(invalidRequest);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('used unauthorized skills');
    });

    test('rejects request with invalid confidence level', () => {
      const invalidRequest: AgentOutputRequest = {
        ...validSRERequest,
        confidenceLevel: 1.5 // Invalid - above 1.0
      };

      const result = AgentOutputFactory.createAgentOutput(invalidRequest);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid confidence level: 1.5. Must be a number between 0.0 and 1.0');
    });

    test('rejects request with missing required fields', () => {
      const invalidRequest = {
        agentName: 'sre-agent',
        skillsUsed: ['Datadog']
        // Missing other required fields
      } as AgentOutputRequest;

      const result = AgentOutputFactory.createAgentOutput(invalidRequest);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('warns about very short processing time', () => {
      const shortProcessingRequest: AgentOutputRequest = {
        ...validSRERequest,
        processingTimeMs: 500 // Very short processing time
      };

      const result = AgentOutputFactory.createAgentOutput(shortProcessingRequest);
      
      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Very short processing time - analysis may be incomplete');
    });
  });

  describe('createMockAgentOutput', () => {
    test('creates mock SRE agent output for database issue', () => {
      const result = AgentOutputFactory.createMockAgentOutput('sre-agent', 'database-issue');
      
      expect(result.success).toBe(true);
      expect(result.agentOutput).toBeDefined();
      expect(result.agentOutput!.agentName).toBe('sre-agent');
      expect(result.agentOutput!.skillsUsed).toContain('Datadog');
      expect(result.agentOutput!.findings.summary).toContain('Database connection pool exhaustion');
    });

    test('creates mock Security agent output for security breach', () => {
      const result = AgentOutputFactory.createMockAgentOutput('security-agent', 'security-breach');
      
      expect(result.success).toBe(true);
      expect(result.agentOutput!.agentName).toBe('security-agent');
      expect(result.agentOutput!.skillsUsed).toContain('Splunk SIEM');
      expect(result.agentOutput!.findings.summary).toContain('Suspicious authentication patterns');
    });

    test('creates mock Governance agent output for policy violation', () => {
      const result = AgentOutputFactory.createMockAgentOutput('governance-agent', 'policy-violation');
      
      expect(result.success).toBe(true);
      expect(result.agentOutput!.agentName).toBe('governance-agent');
      expect(result.agentOutput!.skillsUsed).toContain('Policy Engine');
      expect(result.agentOutput!.findings.summary).toContain('Policy compliance violation');
    });

    test('creates realistic confidence levels', () => {
      const result = AgentOutputFactory.createMockAgentOutput('sre-agent');
      
      expect(result.success).toBe(true);
      expect(result.agentOutput!.confidenceLevel).toBeGreaterThanOrEqual(0.7);
      expect(result.agentOutput!.confidenceLevel).toBeLessThanOrEqual(0.95);
    });

    test('creates realistic processing times', () => {
      const result = AgentOutputFactory.createMockAgentOutput('sre-agent');
      
      expect(result.success).toBe(true);
      expect(result.agentOutput!.metadata.processingTimeMs).toBeGreaterThanOrEqual(2000);
      expect(result.agentOutput!.metadata.processingTimeMs).toBeLessThanOrEqual(5000);
    });
  });

  describe('createParallelAgentOutputs', () => {
    test('creates outputs for all three agent types', () => {
      const results = AgentOutputFactory.createParallelAgentOutputs('database-issue');
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      
      const agentNames = results.map(r => r.agentOutput!.agentName);
      expect(agentNames).toContain('sre-agent');
      expect(agentNames).toContain('security-agent');
      expect(agentNames).toContain('governance-agent');
    });

    test('all parallel outputs are valid', () => {
      const results = AgentOutputFactory.createParallelAgentOutputs();
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.agentOutput).toBeDefined();
        expect(result.agentOutput!.validation.skillsValid).toBe(true);
        expect(result.agentOutput!.validation.confidenceLevelValid).toBe(true);
        expect(result.agentOutput!.validation.schemaCompliant).toBe(true);
      });
    });
  });

  describe('Skills Metadata Generation', () => {
    test('generates correct skills utilization rate', () => {
      // SRE agent using 2 out of 4 available skills
      const result = AgentOutputFactory.createAgentOutput(validSRERequest);
      
      expect(result.success).toBe(true);
      expect(result.agentOutput!.metadata.skillsMetadata.totalSkillsAvailable).toBe(4);
      expect(result.agentOutput!.metadata.skillsMetadata.skillsUtilizationRate).toBe(0.5);
    });

    test('includes skill usage details', () => {
      const result = AgentOutputFactory.createAgentOutput(validSRERequest);
      
      expect(result.success).toBe(true);
      const skillsMetadata = result.agentOutput!.metadata.skillsMetadata;
      expect(skillsMetadata.skillUsageDetails).toHaveLength(2);
      expect(skillsMetadata.skillUsageDetails[0].skill).toBe('Datadog');
      expect(skillsMetadata.skillUsageDetails[1].skill).toBe('CloudWatch');
    });
  });
});