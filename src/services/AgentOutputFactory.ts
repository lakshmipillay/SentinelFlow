/**
 * SentinelFlow Agent Output Factory
 * Creates validated agent outputs with proper skills attribution and confidence tracking
 * Implements: Requirements 2.3, 2.4, 2.5, 3.1 - Structured agent output creation
 */

import { AgentOutput } from '../types/workflow';
import { 
  AgentName, 
  AgentSkill, 
  getAuthorizedSkills,
  AgentSkillsMetadata,
  SkillUsage
} from '../types/agent-skills';
import { AgentOutputValidator, AgentOutputValidationResult } from './AgentOutputValidator';

export interface AgentOutputRequest {
  agentName: AgentName;
  skillsUsed: AgentSkill[];
  findings: {
    summary: string;
    evidence: string[];
    correlations: string[];
    recommendations?: string[];
  };
  confidenceLevel: number;
  processingTimeMs: number;
  dataSourcesAccessed: string[];
  skillUsageDetails?: SkillUsage[];
}

export interface AgentOutputCreationResult {
  success: boolean;
  agentOutput?: AgentOutput;
  errors: string[];
  warnings: string[];
}

/**
 * Factory for creating validated agent outputs
 */
export class AgentOutputFactory {
  
  /**
   * Creates a validated agent output with all required metadata
   * @param request - The agent output request
   * @returns Creation result with validated output or errors
   */
  static createAgentOutput(request: AgentOutputRequest): AgentOutputCreationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Pre-validation checks
    const preValidationResult = this.preValidateRequest(request);
    if (!preValidationResult.isValid) {
      return {
        success: false,
        errors: preValidationResult.errors,
        warnings: preValidationResult.warnings
      };
    }

    // Collect pre-validation warnings
    warnings.push(...preValidationResult.warnings);

    // Generate skills metadata
    const skillsMetadata = this.generateSkillsMetadata(
      request.agentName, 
      request.skillsUsed,
      request.skillUsageDetails
    );

    // Create the agent output
    const agentOutput: AgentOutput = {
      agentName: request.agentName,
      skillsUsed: request.skillsUsed,
      findings: request.findings,
      confidenceLevel: request.confidenceLevel,
      timestamp: new Date().toISOString(),
      metadata: {
        processingTimeMs: request.processingTimeMs,
        dataSourcesAccessed: request.dataSourcesAccessed,
        skillsMetadata
      },
      validation: {
        skillsValid: false, // Will be set by validator
        confidenceLevelValid: false, // Will be set by validator
        schemaCompliant: false // Will be set by validator
      }
    };

    // Validate the created output
    const validationResult = AgentOutputValidator.validateAgentOutput(agentOutput);
    
    if (!validationResult.isValid) {
      return {
        success: false,
        errors: validationResult.errors,
        warnings: [...warnings, ...validationResult.warnings]
      };
    }

    return {
      success: true,
      agentOutput: validationResult.validatedOutput!,
      errors: [],
      warnings: [...warnings, ...validationResult.warnings]
    };
  }

  /**
   * Creates a mock agent output for demo/testing purposes
   * @param agentName - The agent to create output for
   * @param scenario - The scenario type for realistic data
   * @returns Validated mock agent output
   */
  static createMockAgentOutput(
    agentName: AgentName, 
    scenario: 'database-issue' | 'security-breach' | 'policy-violation' = 'database-issue'
  ): AgentOutputCreationResult {
    const mockData = this.getMockDataForScenario(agentName, scenario);
    return this.createAgentOutput(mockData);
  }

  /**
   * Creates a validated agent output with simplified parameters for testing
   * @param params - Simplified parameters for agent output creation
   * @returns Validated agent output
   */
  static createValidatedAgentOutput(params: {
    agentName: AgentName;
    findings: {
      summary: string;
      evidence: string[];
      correlations: string[];
      recommendations?: string[];
    };
    confidenceLevel: number;
  }): AgentOutput {
    const authorizedSkills = getAuthorizedSkills(params.agentName);
    const skillsToUse = authorizedSkills.slice(0, Math.min(2, authorizedSkills.length)) as AgentSkill[]; // Use first 2 skills
    
    const request: AgentOutputRequest = {
      agentName: params.agentName,
      skillsUsed: skillsToUse,
      findings: params.findings,
      confidenceLevel: params.confidenceLevel,
      processingTimeMs: Math.floor(Math.random() * 3000) + 2000, // 2-5 seconds
      dataSourcesAccessed: skillsToUse.map(skill => `${skill.toLowerCase().replace(' ', '-')}-api`)
    };

    const result = this.createAgentOutput(request);
    if (!result.success || !result.agentOutput) {
      throw new Error(`Failed to create validated agent output: ${result.errors.join(', ')}`);
    }

    return result.agentOutput;
  }

  /**
   * Pre-validates the request before creating agent output
   */
  private static preValidateRequest(request: AgentOutputRequest): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!request.agentName) {
      errors.push('Agent name is required');
    }

    if (!Array.isArray(request.skillsUsed)) {
      errors.push('Skills used must be an array');
    }

    if (!request.findings || typeof request.findings !== 'object') {
      errors.push('Findings must be a valid object');
    }

    if (typeof request.confidenceLevel !== 'number') {
      errors.push('Confidence level must be a number');
    }

    if (typeof request.processingTimeMs !== 'number' || request.processingTimeMs < 0) {
      errors.push('Processing time must be a non-negative number');
    }

    if (!Array.isArray(request.dataSourcesAccessed)) {
      errors.push('Data sources accessed must be an array');
    }

    // Validate agent name is recognized
    const validAgentNames: AgentName[] = ['sre-agent', 'security-agent', 'governance-agent'];
    if (request.agentName && !validAgentNames.includes(request.agentName)) {
      errors.push(`Invalid agent name: ${request.agentName}`);
    }

    // Warning for very short processing time (may indicate insufficient analysis)
    if (request.processingTimeMs < 1000) {
      warnings.push('Very short processing time - analysis may be incomplete');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generates comprehensive skills metadata
   */
  private static generateSkillsMetadata(
    agentName: AgentName, 
    skillsUsed: AgentSkill[],
    skillUsageDetails?: SkillUsage[]
  ): AgentSkillsMetadata {
    const authorizedSkills = getAuthorizedSkills(agentName);
    const now = new Date().toISOString();

    // Generate skill usage details if not provided
    const usageDetails = skillUsageDetails || skillsUsed.map(skill => ({
      skill,
      usedAt: now,
      duration: Math.floor(Math.random() * 5000) + 1000, // Mock duration 1-6 seconds
      dataSourcesAccessed: [`${skill.toLowerCase().replace(' ', '-')}-api`]
    }));

    return {
      skillsUsed,
      skillUsageDetails: usageDetails,
      totalSkillsAvailable: authorizedSkills.length,
      skillsUtilizationRate: skillsUsed.length / authorizedSkills.length
    };
  }

  /**
   * Generates realistic mock data for different scenarios
   */
  private static getMockDataForScenario(agentName: AgentName, scenario: string): AgentOutputRequest {
    const baseProcessingTime = 2000 + Math.floor(Math.random() * 3000); // 2-5 seconds
    const baseConfidence = 0.7 + Math.random() * 0.25; // 0.7-0.95

    switch (agentName) {
      case 'sre-agent':
        return this.createSREMockData(scenario, baseProcessingTime, baseConfidence);
      case 'security-agent':
        return this.createSecurityMockData(scenario, baseProcessingTime, baseConfidence);
      case 'governance-agent':
        return this.createGovernanceMockData(scenario, baseProcessingTime, baseConfidence);
      default:
        throw new Error(`Unknown agent name: ${agentName}`);
    }
  }

  private static createSREMockData(scenario: string, processingTime: number, confidence: number): AgentOutputRequest {
    const skillsUsed: AgentSkill[] = ['Datadog', 'CloudWatch'];
    
    let findings;
    switch (scenario) {
      case 'database-issue':
        findings = {
          summary: 'Database connection pool exhaustion detected',
          evidence: [
            'CPU spike to 95% at 14:32 UTC',
            'Connection timeout errors in application logs',
            'Database connection pool at 100% utilization'
          ],
          correlations: [
            'Recent deployment at 14:30 UTC',
            'Increased traffic volume by 300%'
          ],
          recommendations: [
            'Increase connection pool size',
            'Implement connection pooling optimization'
          ]
        };
        break;
      default:
        findings = {
          summary: 'System performance degradation observed',
          evidence: ['High latency detected', 'Error rate increased'],
          correlations: ['Recent configuration change'],
          recommendations: ['Review recent changes']
        };
    }

    return {
      agentName: 'sre-agent',
      skillsUsed,
      findings,
      confidenceLevel: confidence,
      processingTimeMs: processingTime,
      dataSourcesAccessed: ['datadog-api', 'cloudwatch-api']
    };
  }

  private static createSecurityMockData(scenario: string, processingTime: number, confidence: number): AgentOutputRequest {
    const skillsUsed: AgentSkill[] = ['Splunk SIEM', 'IAM Logs'];
    
    let findings;
    switch (scenario) {
      case 'security-breach':
        findings = {
          summary: 'Suspicious authentication patterns detected',
          evidence: [
            'Multiple failed login attempts from unusual IP ranges',
            'Successful login after failed attempts',
            'Access to sensitive resources immediately after login'
          ],
          correlations: [
            'IP addresses match known threat intelligence feeds',
            'User account shows no recent activity history'
          ],
          recommendations: [
            'Immediately disable affected user account',
            'Review access logs for data exfiltration'
          ]
        };
        break;
      default:
        findings = {
          summary: 'Security posture assessment completed',
          evidence: ['Access patterns analyzed', 'No immediate threats detected'],
          correlations: ['Normal user behavior patterns'],
          recommendations: ['Continue monitoring']
        };
    }

    return {
      agentName: 'security-agent',
      skillsUsed,
      findings,
      confidenceLevel: confidence,
      processingTimeMs: processingTime,
      dataSourcesAccessed: ['splunk-api', 'iam-logs-api']
    };
  }

  private static createGovernanceMockData(scenario: string, processingTime: number, confidence: number): AgentOutputRequest {
    const skillsUsed: AgentSkill[] = ['Policy Engine', 'Risk Register'];
    
    let findings;
    switch (scenario) {
      case 'policy-violation':
        findings = {
          summary: 'Policy compliance violation detected',
          evidence: [
            'Change deployed without required approvals',
            'Production access granted outside business hours',
            'No change management ticket found'
          ],
          correlations: [
            'Emergency deployment process bypassed',
            'Standard approval workflow not followed'
          ],
          recommendations: [
            'Require immediate post-deployment review',
            'Implement stricter emergency deployment controls'
          ]
        };
        break;
      default:
        findings = {
          summary: 'Governance compliance assessment completed',
          evidence: ['Policy adherence verified', 'Risk levels within acceptable range'],
          correlations: ['Standard procedures followed'],
          recommendations: ['Proceed with standard approval process']
        };
    }

    return {
      agentName: 'governance-agent',
      skillsUsed,
      findings,
      confidenceLevel: confidence,
      processingTimeMs: processingTime,
      dataSourcesAccessed: ['policy-engine-api', 'risk-register-api']
    };
  }

  /**
   * Batch creates multiple agent outputs for parallel analysis simulation
   */
  static createParallelAgentOutputs(scenario: string = 'database-issue'): AgentOutputCreationResult[] {
    const agents: AgentName[] = ['sre-agent', 'security-agent', 'governance-agent'];
    return agents.map(agent => this.createMockAgentOutput(agent, scenario as any));
  }
}