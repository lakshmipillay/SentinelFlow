/**
 * SentinelFlow Agent Output Validator
 * Validates agent outputs against schemas and business rules
 * Implements: Requirements 3.1, 3.2 - Structured output validation
 */

import { AgentOutput } from '../types/workflow';
import { 
  AgentName, 
  AgentSkill, 
  validateAgentSkills, 
  validateConfidenceLevel,
  getAuthorizedSkills,
  AgentSkillsMetadata
} from '../types/agent-skills';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AgentOutputValidationResult extends ValidationResult {
  validatedOutput?: AgentOutput;
}

/**
 * Comprehensive agent output validator
 */
export class AgentOutputValidator {
  
  /**
   * Validates a complete agent output against all requirements
   * @param output - The agent output to validate
   * @returns Validation result with errors and warnings
   */
  static validateAgentOutput(output: any): AgentOutputValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Schema validation
    const schemaResult = this.validateSchema(output);
    errors.push(...schemaResult.errors);
    warnings.push(...schemaResult.warnings);

    if (!schemaResult.isValid) {
      return {
        isValid: false,
        errors,
        warnings
      };
    }

    // Cast to AgentOutput after basic schema validation
    const agentOutput = output as AgentOutput;

    // Skills validation
    const skillsResult = this.validateSkills(agentOutput.agentName, agentOutput.skillsUsed);
    errors.push(...skillsResult.errors);
    warnings.push(...skillsResult.warnings);

    // Confidence level validation
    const confidenceResult = this.validateConfidence(agentOutput.confidenceLevel);
    errors.push(...confidenceResult.errors);
    warnings.push(...confidenceResult.warnings);

    // Findings validation (no conversational text)
    const findingsResult = this.validateFindings(agentOutput.findings);
    errors.push(...findingsResult.errors);
    warnings.push(...findingsResult.warnings);

    // Timestamp validation
    const timestampResult = this.validateTimestamp(agentOutput.timestamp);
    errors.push(...timestampResult.errors);
    warnings.push(...timestampResult.warnings);

    // Create enhanced output with validation flags
    const validatedOutput: AgentOutput = {
      ...agentOutput,
      validation: {
        skillsValid: skillsResult.isValid,
        confidenceLevelValid: confidenceResult.isValid,
        schemaCompliant: schemaResult.isValid && findingsResult.isValid && timestampResult.isValid
      },
      metadata: {
        ...agentOutput.metadata,
        skillsMetadata: this.generateSkillsMetadata(agentOutput.agentName, agentOutput.skillsUsed)
      }
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedOutput: errors.length === 0 ? validatedOutput : undefined
    };
  }

  /**
   * Validates basic schema structure
   */
  private static validateSchema(output: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!output || typeof output !== 'object') {
      errors.push('Agent output must be a valid object');
      return { isValid: false, errors, warnings };
    }

    const requiredFields = ['agentName', 'skillsUsed', 'findings', 'confidenceLevel', 'timestamp', 'metadata'];
    for (const field of requiredFields) {
      if (!(field in output)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Agent name validation
    if (output.agentName && !['sre-agent', 'security-agent', 'governance-agent'].includes(output.agentName)) {
      errors.push(`Invalid agent name: ${output.agentName}. Must be one of: sre-agent, security-agent, governance-agent`);
    }

    // Skills array validation
    if (output.skillsUsed && !Array.isArray(output.skillsUsed)) {
      errors.push('skillsUsed must be an array');
    }

    // Findings structure validation
    if (output.findings && typeof output.findings !== 'object') {
      errors.push('findings must be an object');
    } else if (output.findings) {
      const requiredFindingsFields = ['summary', 'evidence', 'correlations'];
      for (const field of requiredFindingsFields) {
        if (!(field in output.findings)) {
          errors.push(`Missing required findings field: ${field}`);
        }
      }
    }

    // Metadata validation
    if (output.metadata && typeof output.metadata !== 'object') {
      errors.push('metadata must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates agent skills against authorized skills for the agent type
   */
  private static validateSkills(agentName: AgentName, skillsUsed: AgentSkill[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(skillsUsed)) {
      errors.push('skillsUsed must be an array');
      return { isValid: false, errors, warnings };
    }

    // Validate skills are authorized for this agent
    if (!validateAgentSkills(agentName, skillsUsed)) {
      const authorizedSkills = getAuthorizedSkills(agentName);
      const invalidSkills = skillsUsed.filter(skill => 
        !authorizedSkills.includes(skill)
      );
      errors.push(
        `Agent ${agentName} used unauthorized skills: ${invalidSkills.join(', ')}. ` +
        `Authorized skills: ${authorizedSkills.join(', ')}`
      );
    }

    // Warning for no skills used
    if (skillsUsed.length === 0) {
      warnings.push(`Agent ${agentName} reported no skills used - this may indicate incomplete analysis`);
    }

    // Warning for duplicate skills
    const uniqueSkills = new Set(skillsUsed);
    if (uniqueSkills.size !== skillsUsed.length) {
      warnings.push('Duplicate skills reported in skillsUsed array');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates confidence level is within valid range
   */
  private static validateConfidence(confidenceLevel: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!validateConfidenceLevel(confidenceLevel)) {
      errors.push(`Invalid confidence level: ${confidenceLevel}. Must be a number between 0.0 and 1.0`);
    }

    // Warning for very low confidence
    if (confidenceLevel < 0.3) {
      warnings.push(`Low confidence level (${confidenceLevel}) - findings may be unreliable`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates findings structure and content (no conversational text)
   */
  private static validateFindings(findings: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!findings || typeof findings !== 'object') {
      errors.push('findings must be a valid object');
      return { isValid: false, errors, warnings };
    }

    // Validate required fields
    const requiredFields = ['summary', 'evidence', 'correlations'];
    for (const field of requiredFields) {
      if (!(field in findings)) {
        errors.push(`Missing required findings field: ${field}`);
      }
    }

    // Validate field types
    if (findings.summary && typeof findings.summary !== 'string') {
      errors.push('findings.summary must be a string');
    }

    if (findings.evidence && !Array.isArray(findings.evidence)) {
      errors.push('findings.evidence must be an array');
    }

    if (findings.correlations && !Array.isArray(findings.correlations)) {
      errors.push('findings.correlations must be an array');
    }

    if (findings.recommendations && !Array.isArray(findings.recommendations)) {
      errors.push('findings.recommendations must be an array');
    }

    // Check for conversational language patterns (basic heuristics)
    const conversationalPatterns = [
      /\bi think\b/i,
      /\bi believe\b/i,
      /\bin my opinion\b/i,
      /\bit seems like\b/i,
      /\bmaybe\b/i,
      /\bperhaps\b/i
    ];

    const textToCheck = [
      findings.summary,
      ...(findings.evidence || []),
      ...(findings.correlations || []),
      ...(findings.recommendations || [])
    ].join(' ');

    for (const pattern of conversationalPatterns) {
      if (pattern.test(textToCheck)) {
        warnings.push('Findings contain conversational language - should be structured and deterministic');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates timestamp format
   */
  private static validateTimestamp(timestamp: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof timestamp !== 'string') {
      errors.push('timestamp must be a string');
      return { isValid: false, errors, warnings };
    }

    // Validate ISO8601 format
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!iso8601Regex.test(timestamp)) {
      errors.push(`Invalid timestamp format: ${timestamp}. Must be ISO8601 format`);
    }

    // Validate timestamp is not in the future (with 5 minute tolerance)
    const timestampDate = new Date(timestamp);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (timestampDate > fiveMinutesFromNow) {
      warnings.push('Timestamp is in the future - this may indicate clock synchronization issues');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generates skills metadata for audit purposes
   */
  private static generateSkillsMetadata(agentName: AgentName, skillsUsed: AgentSkill[]): AgentSkillsMetadata {
    const authorizedSkills = getAuthorizedSkills(agentName);
    const now = new Date().toISOString();

    return {
      skillsUsed,
      skillUsageDetails: skillsUsed.map(skill => ({
        skill,
        usedAt: now,
        // Duration and data sources would be populated by the actual agent implementation
      })),
      totalSkillsAvailable: authorizedSkills.length,
      skillsUtilizationRate: skillsUsed.length / authorizedSkills.length
    };
  }

  /**
   * Validates multiple agent outputs (for batch validation)
   */
  static validateMultipleOutputs(outputs: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(outputs)) {
      errors.push('Outputs must be an array');
      return { isValid: false, errors, warnings };
    }

    outputs.forEach((output, index) => {
      const result = this.validateAgentOutput(output);
      if (!result.isValid) {
        errors.push(`Output ${index}: ${result.errors.join(', ')}`);
      }
      if (result.warnings.length > 0) {
        warnings.push(`Output ${index}: ${result.warnings.join(', ')}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}