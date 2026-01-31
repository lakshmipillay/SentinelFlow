/**
 * Unit tests for AgentOutputValidator
 * Tests comprehensive validation of agent outputs including skills, confidence, and schema compliance
 */

import { AgentOutputValidator } from '../AgentOutputValidator';
import { AgentOutput } from '../../types/workflow';

describe('AgentOutputValidator', () => {
  const validSREOutput: AgentOutput = {
    agentName: 'sre-agent',
    skillsUsed: ['Datadog', 'CloudWatch'],
    findings: {
      summary: 'Database connection pool exhaustion detected',
      evidence: ['CPU spike to 95%', 'Connection timeout errors'],
      correlations: ['Recent deployment', 'Increased traffic']
    },
    confidenceLevel: 0.85,
    timestamp: new Date().toISOString(),
    metadata: {
      processingTimeMs: 2500,
      dataSourcesAccessed: ['datadog-api', 'cloudwatch-api'],
      skillsMetadata: {
        skillsUsed: ['Datadog', 'CloudWatch'],
        skillUsageDetails: [],
        totalSkillsAvailable: 4,
        skillsUtilizationRate: 0.5
      }
    },
    validation: {
      skillsValid: false,
      confidenceLevelValid: false,
      schemaCompliant: false
    }
  };

  describe('validateAgentOutput', () => {
    test('validates correct SRE agent output', () => {
      const result = AgentOutputValidator.validateAgentOutput(validSREOutput);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validatedOutput).toBeDefined();
      expect(result.validatedOutput!.validation.skillsValid).toBe(true);
      expect(result.validatedOutput!.validation.confidenceLevelValid).toBe(true);
      expect(result.validatedOutput!.validation.schemaCompliant).toBe(true);
    });

    test('rejects invalid agent output with unauthorized skills', () => {
      const invalidOutput = {
        ...validSREOutput,
        skillsUsed: ['Datadog', 'Splunk SIEM'] // Splunk SIEM not authorized for SRE
      };

      const result = AgentOutputValidator.validateAgentOutput(invalidOutput);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('used unauthorized skills: Splunk SIEM');
    });

    test('rejects invalid confidence level', () => {
      const invalidOutput = {
        ...validSREOutput,
        confidenceLevel: 1.5 // Invalid - above 1.0
      };

      const result = AgentOutputValidator.validateAgentOutput(invalidOutput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid confidence level: 1.5. Must be a number between 0.0 and 1.0');
    });

    test('warns about low confidence level', () => {
      const lowConfidenceOutput = {
        ...validSREOutput,
        confidenceLevel: 0.2
      };

      const result = AgentOutputValidator.validateAgentOutput(lowConfidenceOutput);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Low confidence level (0.2) - findings may be unreliable');
    });
  });

  describe('validateMultipleOutputs', () => {
    test('validates array of valid outputs', () => {
      const outputs = [validSREOutput, validSREOutput];
      const result = AgentOutputValidator.validateMultipleOutputs(outputs);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects non-array input', () => {
      const result = AgentOutputValidator.validateMultipleOutputs('not an array' as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Outputs must be an array');
    });
  });
});