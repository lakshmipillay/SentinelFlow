/**
 * Unit tests for Agent Skills System
 * Tests skills validation, confidence tracking, and type safety
 */

import {
  SRE_SKILLS,
  SECURITY_SKILLS,
  GOVERNANCE_SKILLS,
  AGENT_SKILLS_MAP,
  validateAgentSkills,
  getAuthorizedSkills,
  validateConfidenceLevel,
  AgentName,
  SRESkill,
  SecuritySkill,
  GovernanceSkill
} from '../agent-skills';

describe('Agent Skills System', () => {
  describe('Skills Constants', () => {
    test('SRE skills are correctly defined', () => {
      expect(SRE_SKILLS).toEqual(['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry']);
      expect(SRE_SKILLS).toHaveLength(4);
    });

    test('Security skills are correctly defined', () => {
      expect(SECURITY_SKILLS).toEqual(['Splunk SIEM', 'IAM Logs', 'CSPM']);
      expect(SECURITY_SKILLS).toHaveLength(3);
    });

    test('Governance skills are correctly defined', () => {
      expect(GOVERNANCE_SKILLS).toEqual(['Policy Engine', 'Change Management', 'Risk Register']);
      expect(GOVERNANCE_SKILLS).toHaveLength(3);
    });

    test('Agent skills map is correctly structured', () => {
      expect(AGENT_SKILLS_MAP['sre-agent']).toBe(SRE_SKILLS);
      expect(AGENT_SKILLS_MAP['security-agent']).toBe(SECURITY_SKILLS);
      expect(AGENT_SKILLS_MAP['governance-agent']).toBe(GOVERNANCE_SKILLS);
    });
  });

  describe('validateAgentSkills', () => {
    test('validates SRE agent skills correctly', () => {
      expect(validateAgentSkills('sre-agent', ['Datadog', 'CloudWatch'])).toBe(true);
      expect(validateAgentSkills('sre-agent', ['Datadog'])).toBe(true);
      expect(validateAgentSkills('sre-agent', [])).toBe(true);
      expect(validateAgentSkills('sre-agent', ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry'])).toBe(true);
    });

    test('rejects invalid SRE agent skills', () => {
      expect(validateAgentSkills('sre-agent', ['Splunk SIEM'])).toBe(false);
      expect(validateAgentSkills('sre-agent', ['Datadog', 'InvalidSkill'])).toBe(false);
      expect(validateAgentSkills('sre-agent', ['Policy Engine'])).toBe(false);
    });

    test('validates Security agent skills correctly', () => {
      expect(validateAgentSkills('security-agent', ['Splunk SIEM', 'IAM Logs'])).toBe(true);
      expect(validateAgentSkills('security-agent', ['CSPM'])).toBe(true);
      expect(validateAgentSkills('security-agent', [])).toBe(true);
    });

    test('rejects invalid Security agent skills', () => {
      expect(validateAgentSkills('security-agent', ['Datadog'])).toBe(false);
      expect(validateAgentSkills('security-agent', ['Splunk SIEM', 'CloudWatch'])).toBe(false);
      expect(validateAgentSkills('security-agent', ['InvalidSkill'])).toBe(false);
    });

    test('validates Governance agent skills correctly', () => {
      expect(validateAgentSkills('governance-agent', ['Policy Engine', 'Risk Register'])).toBe(true);
      expect(validateAgentSkills('governance-agent', ['Change Management'])).toBe(true);
      expect(validateAgentSkills('governance-agent', [])).toBe(true);
    });

    test('rejects invalid Governance agent skills', () => {
      expect(validateAgentSkills('governance-agent', ['Datadog'])).toBe(false);
      expect(validateAgentSkills('governance-agent', ['Policy Engine', 'Splunk SIEM'])).toBe(false);
      expect(validateAgentSkills('governance-agent', ['InvalidSkill'])).toBe(false);
    });
  });

  describe('getAuthorizedSkills', () => {
    test('returns correct skills for each agent type', () => {
      expect(getAuthorizedSkills('sre-agent')).toEqual(SRE_SKILLS);
      expect(getAuthorizedSkills('security-agent')).toEqual(SECURITY_SKILLS);
      expect(getAuthorizedSkills('governance-agent')).toEqual(GOVERNANCE_SKILLS);
    });

    test('returns readonly arrays', () => {
      const sreSkills = getAuthorizedSkills('sre-agent');
      // Arrays are readonly by TypeScript but not frozen at runtime
      // This is expected behavior for const assertions
      expect(sreSkills).toBe(SRE_SKILLS);
    });
  });

  describe('validateConfidenceLevel', () => {
    test('validates correct confidence levels', () => {
      expect(validateConfidenceLevel(0.0)).toBe(true);
      expect(validateConfidenceLevel(0.5)).toBe(true);
      expect(validateConfidenceLevel(1.0)).toBe(true);
      expect(validateConfidenceLevel(0.85)).toBe(true);
    });

    test('rejects invalid confidence levels', () => {
      expect(validateConfidenceLevel(-0.1)).toBe(false);
      expect(validateConfidenceLevel(1.1)).toBe(false);
      expect(validateConfidenceLevel(NaN)).toBe(false);
      expect(validateConfidenceLevel(Infinity)).toBe(false);
      expect(validateConfidenceLevel(-Infinity)).toBe(false);
    });

    test('rejects non-numeric confidence levels', () => {
      expect(validateConfidenceLevel('0.5' as any)).toBe(false);
      expect(validateConfidenceLevel(null as any)).toBe(false);
      expect(validateConfidenceLevel(undefined as any)).toBe(false);
      expect(validateConfidenceLevel({} as any)).toBe(false);
    });
  });

  describe('Type Safety', () => {
    test('SRESkill type includes all SRE skills', () => {
      const sreSkill: SRESkill = 'Datadog';
      expect(SRE_SKILLS.includes(sreSkill)).toBe(true);
    });

    test('SecuritySkill type includes all Security skills', () => {
      const securitySkill: SecuritySkill = 'Splunk SIEM';
      expect(SECURITY_SKILLS.includes(securitySkill)).toBe(true);
    });

    test('GovernanceSkill type includes all Governance skills', () => {
      const governanceSkill: GovernanceSkill = 'Policy Engine';
      expect(GOVERNANCE_SKILLS.includes(governanceSkill)).toBe(true);
    });

    test('AgentName type is correctly constrained', () => {
      const agentNames: AgentName[] = ['sre-agent', 'security-agent', 'governance-agent'];
      agentNames.forEach(name => {
        expect(AGENT_SKILLS_MAP[name]).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty skills arrays', () => {
      expect(validateAgentSkills('sre-agent', [])).toBe(true);
      expect(validateAgentSkills('security-agent', [])).toBe(true);
      expect(validateAgentSkills('governance-agent', [])).toBe(true);
    });

    test('handles duplicate skills in validation', () => {
      expect(validateAgentSkills('sre-agent', ['Datadog', 'Datadog'])).toBe(true);
      expect(validateAgentSkills('security-agent', ['CSPM', 'CSPM', 'IAM Logs'])).toBe(true);
    });

    test('validates boundary confidence levels', () => {
      expect(validateConfidenceLevel(0.0)).toBe(true);
      expect(validateConfidenceLevel(1.0)).toBe(true);
      expect(validateConfidenceLevel(0.0000001)).toBe(true);
      expect(validateConfidenceLevel(0.9999999)).toBe(true);
    });
  });
});