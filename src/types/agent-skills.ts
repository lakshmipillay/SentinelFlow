/**
 * SentinelFlow Agent Skills System
 * Defines specific enterprise tools and capabilities for each agent type
 * Implements validation to ensure agents only report authorized skills
 */

// Define specific skills for each agent type based on requirements
export const SRE_SKILLS = [
  'Datadog',
  'CloudWatch', 
  'Prometheus',
  'OpenTelemetry'
] as const;

export const SECURITY_SKILLS = [
  'Splunk SIEM',
  'IAM Logs',
  'CSPM'
] as const;

export const GOVERNANCE_SKILLS = [
  'Policy Engine',
  'Change Management',
  'Risk Register'
] as const;

// Create union types for type safety
export type SRESkill = typeof SRE_SKILLS[number];
export type SecuritySkill = typeof SECURITY_SKILLS[number];
export type GovernanceSkill = typeof GOVERNANCE_SKILLS[number];

// Union of all possible skills
export type AgentSkill = SRESkill | SecuritySkill | GovernanceSkill;

// Agent type to skills mapping
export const AGENT_SKILLS_MAP = {
  'sre-agent': SRE_SKILLS,
  'security-agent': SECURITY_SKILLS,
  'governance-agent': GOVERNANCE_SKILLS
} as const;

// Type for agent names
export type AgentName = keyof typeof AGENT_SKILLS_MAP;

/**
 * Validates that the provided skills are authorized for the given agent type
 * @param agentName - The name of the agent
 * @param skillsUsed - Array of skills the agent claims to have used
 * @returns true if all skills are valid for the agent, false otherwise
 */
export function validateAgentSkills(agentName: AgentName, skillsUsed: string[]): boolean {
  const authorizedSkills = AGENT_SKILLS_MAP[agentName];
  
  // Check that all reported skills are in the authorized list for this agent
  return skillsUsed.every(skill => 
    (authorizedSkills as readonly string[]).includes(skill)
  );
}

/**
 * Gets the authorized skills for a specific agent type
 * @param agentName - The name of the agent
 * @returns Array of authorized skills for the agent
 */
export function getAuthorizedSkills(agentName: AgentName): readonly string[] {
  return AGENT_SKILLS_MAP[agentName];
}

/**
 * Validates that a confidence level is within the valid range (0.0 to 1.0)
 * @param confidenceLevel - The confidence level to validate
 * @returns true if confidence level is valid, false otherwise
 */
export function validateConfidenceLevel(confidenceLevel: number): boolean {
  return typeof confidenceLevel === 'number' && 
         confidenceLevel >= 0.0 && 
         confidenceLevel <= 1.0 &&
         !isNaN(confidenceLevel);
}

/**
 * Skills usage tracking for audit purposes
 */
export interface SkillUsage {
  skill: AgentSkill;
  usedAt: string; // ISO8601 timestamp
  duration?: number; // Optional duration in milliseconds
  dataSourcesAccessed?: string[]; // Optional list of data sources accessed via this skill
}

/**
 * Enhanced agent skills metadata for detailed tracking
 */
export interface AgentSkillsMetadata {
  skillsUsed: AgentSkill[];
  skillUsageDetails: SkillUsage[];
  totalSkillsAvailable: number;
  skillsUtilizationRate: number; // Percentage of available skills used (0.0 to 1.0)
}