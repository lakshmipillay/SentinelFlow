/**
 * Property-Based Tests for Agent Visualization Accuracy
 * **Property 16: Agent Visualization Accuracy**
 * **Validates: Requirements 6.1, 6.3**
 * 
 * Tests that:
 * - All agent cards must have required fields (agentName, status, skillsActive, findings, confidenceLevel, thinkingAnimation)
 * - Agent name must be one of: sre-agent, security-agent, governance-agent
 * - Status must be one of: idle, analyzing, complete
 * - Confidence level must be between 0 and 1
 * - Skills active must be a subset of the agent's available skills
 * - Each agent type has distinct visual styling
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Agent types in the SentinelFlow system
 */
export type AgentType = 'sre-agent' | 'security-agent' | 'governance-agent';

/**
 * Agent status during workflow execution
 */
export type AgentStatus = 'idle' | 'analyzing' | 'complete';

/**
 * Valid agent types
 */
export const VALID_AGENT_TYPES: readonly AgentType[] = ['sre-agent', 'security-agent', 'governance-agent'] as const;

/**
 * Valid agent statuses
 */
export const VALID_AGENT_STATUSES: readonly AgentStatus[] = ['idle', 'analyzing', 'complete'] as const;

/**
 * Agent skills by agent type - matches frontend/src/types/workflow.ts
 * Requirements: 2.3, 2.4, 2.5 - Each agent has specific skills
 */
export const AGENT_SKILLS: Record<AgentType, string[]> = {
  'sre-agent': ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry'],
  'security-agent': ['Splunk SIEM', 'IAM Logs', 'CSPM'],
  'governance-agent': ['Policy Engine', 'Change Management', 'Risk Register']
};

/**
 * Agent visual styling configuration - each agent type has distinct styling
 */
export const AGENT_VISUAL_CONFIG: Record<AgentType, {
  displayName: string;
  colorClass: string;
  bgColorClass: string;
  borderColorClass: string;
}> = {
  'sre-agent': {
    displayName: 'SRE Agent',
    colorClass: 'text-agent-sre',
    bgColorClass: 'bg-agent-sre/10',
    borderColorClass: 'border-agent-sre'
  },
  'security-agent': {
    displayName: 'Security Agent',
    colorClass: 'text-agent-security',
    bgColorClass: 'bg-agent-security/10',
    borderColorClass: 'border-agent-security'
  },
  'governance-agent': {
    displayName: 'Governance Agent',
    colorClass: 'text-agent-governance',
    bgColorClass: 'bg-agent-governance/10',
    borderColorClass: 'border-agent-governance'
  }
};

/**
 * Agent card state for UI display - matches frontend/src/types/workflow.ts
 */
export interface AgentCard {
  agentName: AgentType;
  status: AgentStatus;
  skillsActive: string[];
  findings: string[];
  confidenceLevel: number;
  thinkingAnimation: boolean;
}

/**
 * Validates that an agent name is one of the allowed values
 */
export function isValidAgentType(agentName: string): agentName is AgentType {
  return VALID_AGENT_TYPES.includes(agentName as AgentType);
}

/**
 * Validates that an agent status is one of the allowed values
 */
export function isValidAgentStatus(status: string): status is AgentStatus {
  return VALID_AGENT_STATUSES.includes(status as AgentStatus);
}

/**
 * Validates that confidence level is between 0 and 1 (inclusive)
 */
export function isValidConfidenceLevel(level: number): boolean {
  return typeof level === 'number' && 
         !isNaN(level) && 
         isFinite(level) && 
         level >= 0 && 
         level <= 1;
}

/**
 * Validates that skills active are a subset of the agent's available skills
 */
export function areValidSkillsForAgent(agentName: AgentType, skillsActive: string[]): boolean {
  if (!Array.isArray(skillsActive)) {
    return false;
  }
  
  const availableSkills = AGENT_SKILLS[agentName];
  if (!availableSkills) {
    return false;
  }
  
  return skillsActive.every(skill => availableSkills.includes(skill));
}

/**
 * Validates that each agent type has distinct visual styling
 */
export function hasDistinctVisualStyling(agentName: AgentType): boolean {
  const config = AGENT_VISUAL_CONFIG[agentName];
  if (!config) {
    return false;
  }
  
  // Check that this agent's styling is unique
  const otherAgents = VALID_AGENT_TYPES.filter(a => a !== agentName);
  
  for (const otherAgent of otherAgents) {
    const otherConfig = AGENT_VISUAL_CONFIG[otherAgent];
    
    // Each agent should have different color classes
    if (config.colorClass === otherConfig.colorClass ||
        config.bgColorClass === otherConfig.bgColorClass ||
        config.borderColorClass === otherConfig.borderColorClass ||
        config.displayName === otherConfig.displayName) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validates an agent card object has all required fields with correct types
 */
export function validateAgentCard(card: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!card || typeof card !== 'object') {
    return { isValid: false, errors: ['Agent card must be a non-null object'] };
  }
  
  const cardObj = card as Record<string, unknown>;
  
  // Validate agentName field
  if (!('agentName' in cardObj)) {
    errors.push('Missing required field: agentName');
  } else if (!isValidAgentType(cardObj.agentName as string)) {
    errors.push(`Field "agentName" must be one of: ${VALID_AGENT_TYPES.join(', ')}`);
  }
  
  // Validate status field
  if (!('status' in cardObj)) {
    errors.push('Missing required field: status');
  } else if (!isValidAgentStatus(cardObj.status as string)) {
    errors.push(`Field "status" must be one of: ${VALID_AGENT_STATUSES.join(', ')}`);
  }
  
  // Validate skillsActive field
  if (!('skillsActive' in cardObj)) {
    errors.push('Missing required field: skillsActive');
  } else if (!Array.isArray(cardObj.skillsActive)) {
    errors.push('Field "skillsActive" must be an array');
  } else if (isValidAgentType(cardObj.agentName as string)) {
    if (!areValidSkillsForAgent(cardObj.agentName as AgentType, cardObj.skillsActive as string[])) {
      errors.push('Field "skillsActive" must only contain skills available to this agent type');
    }
  }
  
  // Validate findings field
  if (!('findings' in cardObj)) {
    errors.push('Missing required field: findings');
  } else if (!Array.isArray(cardObj.findings)) {
    errors.push('Field "findings" must be an array');
  }
  
  // Validate confidenceLevel field
  if (!('confidenceLevel' in cardObj)) {
    errors.push('Missing required field: confidenceLevel');
  } else if (!isValidConfidenceLevel(cardObj.confidenceLevel as number)) {
    errors.push('Field "confidenceLevel" must be a number between 0 and 1');
  }
  
  // Validate thinkingAnimation field
  if (!('thinkingAnimation' in cardObj)) {
    errors.push('Missing required field: thinkingAnimation');
  } else if (typeof cardObj.thinkingAnimation !== 'boolean') {
    errors.push('Field "thinkingAnimation" must be a boolean');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Creates a valid agent card object for testing
 */
export function createValidAgentCard(overrides: Partial<AgentCard> = {}): AgentCard {
  const agentName = overrides.agentName || 'sre-agent';
  // Handle case where agentName might be invalid (for testing invalid agent names)
  const availableSkills = AGENT_SKILLS[agentName as AgentType];
  const defaultSkillsActive = availableSkills ? [availableSkills[0]] : [];
  
  return {
    agentName,
    status: 'analyzing',
    skillsActive: overrides.skillsActive !== undefined ? overrides.skillsActive : defaultSkillsActive,
    findings: ['Sample finding'],
    confidenceLevel: 0.85,
    thinkingAnimation: true,
    ...overrides
  };
}

describe('Property 16: Agent Visualization Accuracy', () => {
  
  /**
   * Generators for property-based testing
   */
  const generateValidAgentType = (): fc.Arbitrary<AgentType> => {
    return fc.constantFrom('sre-agent', 'security-agent', 'governance-agent');
  };

  const generateInvalidAgentType = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'unknown-agent',
      'SRE-AGENT',
      'sre_agent',
      'security',
      'governance',
      '',
      'agent',
      'orchestrator-agent'
    );
  };

  const generateValidAgentStatus = (): fc.Arbitrary<AgentStatus> => {
    return fc.constantFrom('idle', 'analyzing', 'complete');
  };

  const generateInvalidAgentStatus = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'running',
      'pending',
      'error',
      'IDLE',
      'ANALYZING',
      'COMPLETE',
      '',
      'active',
      'stopped'
    );
  };

  const generateValidConfidenceLevel = (): fc.Arbitrary<number> => {
    return fc.oneof(
      fc.float({ min: 0, max: 1, noNaN: true }),
      fc.constant(0),
      fc.constant(1),
      fc.constant(0.5),
      fc.constant(0.85)
    );
  };

  const generateInvalidConfidenceLevel = (): fc.Arbitrary<number> => {
    return fc.oneof(
      fc.constant(-0.1),
      fc.constant(1.1),
      fc.constant(-1),
      fc.constant(2),
      fc.constant(NaN),
      fc.constant(Infinity),
      fc.constant(-Infinity)
    );
  };

  const generateValidSkillsForAgent = (agentType: AgentType): fc.Arbitrary<string[]> => {
    const availableSkills = AGENT_SKILLS[agentType];
    return fc.subarray(availableSkills, { minLength: 0, maxLength: availableSkills.length });
  };

  const generateInvalidSkillsForAgent = (agentType: AgentType): fc.Arbitrary<string[]> => {
    // Get skills from other agents that are not available to this agent
    const otherAgentSkills = VALID_AGENT_TYPES
      .filter(a => a !== agentType)
      .flatMap(a => AGENT_SKILLS[a]);
    
    return fc.subarray(otherAgentSkills, { minLength: 1, maxLength: 2 });
  };

  const generateValidFindings = (): fc.Arbitrary<string[]> => {
    return fc.array(
      fc.constantFrom(
        'Database connection pool exhaustion detected',
        'CPU spike at 14:32 UTC',
        'Memory usage exceeded threshold',
        'Network latency increased by 200%',
        'Authentication failures detected',
        'Policy violation: unauthorized access attempt'
      ),
      { minLength: 0, maxLength: 5 }
    );
  };

  const generateValidAgentCard = (): fc.Arbitrary<AgentCard> => {
    return generateValidAgentType().chain(agentType => 
      fc.record({
        agentName: fc.constant(agentType),
        status: generateValidAgentStatus(),
        skillsActive: generateValidSkillsForAgent(agentType),
        findings: generateValidFindings(),
        confidenceLevel: generateValidConfidenceLevel(),
        thinkingAnimation: fc.boolean()
      })
    );
  };

  /**
   * Property Tests
   */
  test('All valid agent cards must have required fields (agentName, status, skillsActive, findings, confidenceLevel, thinkingAnimation)', async () => {
    await fc.assert(
      fc.property(
        generateValidAgentCard(),
        (card: AgentCard) => {
          const result = validateAgentCard(card);
          
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
          
          // Verify all required fields are present
          expect(card).toHaveProperty('agentName');
          expect(card).toHaveProperty('status');
          expect(card).toHaveProperty('skillsActive');
          expect(card).toHaveProperty('findings');
          expect(card).toHaveProperty('confidenceLevel');
          expect(card).toHaveProperty('thinkingAnimation');
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Agent name must be one of: sre-agent, security-agent, governance-agent', async () => {
    await fc.assert(
      fc.property(
        generateValidAgentType(),
        (agentType: AgentType) => {
          expect(isValidAgentType(agentType)).toBe(true);
          expect(VALID_AGENT_TYPES).toContain(agentType);
          
          const card = createValidAgentCard({ agentName: agentType });
          const result = validateAgentCard(card);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Invalid agent names must be rejected', async () => {
    await fc.assert(
      fc.property(
        generateInvalidAgentType(),
        (invalidAgentType: string) => {
          expect(isValidAgentType(invalidAgentType)).toBe(false);
          
          const card = createValidAgentCard({ agentName: invalidAgentType as AgentType });
          const result = validateAgentCard(card);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('agentName'))).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Status must be one of: idle, analyzing, complete', async () => {
    await fc.assert(
      fc.property(
        generateValidAgentStatus(),
        (status: AgentStatus) => {
          expect(isValidAgentStatus(status)).toBe(true);
          expect(VALID_AGENT_STATUSES).toContain(status);
          
          const card = createValidAgentCard({ status });
          const result = validateAgentCard(card);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Invalid status values must be rejected', async () => {
    await fc.assert(
      fc.property(
        generateInvalidAgentStatus(),
        (invalidStatus: string) => {
          expect(isValidAgentStatus(invalidStatus)).toBe(false);
          
          const card = createValidAgentCard({ status: invalidStatus as AgentStatus });
          const result = validateAgentCard(card);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('status'))).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Confidence level must be between 0 and 1', async () => {
    await fc.assert(
      fc.property(
        generateValidConfidenceLevel(),
        (confidenceLevel: number) => {
          expect(isValidConfidenceLevel(confidenceLevel)).toBe(true);
          expect(confidenceLevel).toBeGreaterThanOrEqual(0);
          expect(confidenceLevel).toBeLessThanOrEqual(1);
          
          const card = createValidAgentCard({ confidenceLevel });
          const result = validateAgentCard(card);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Invalid confidence levels (outside 0-1 range, NaN, Infinity) must be rejected', async () => {
    await fc.assert(
      fc.property(
        generateInvalidConfidenceLevel(),
        (invalidConfidenceLevel: number) => {
          expect(isValidConfidenceLevel(invalidConfidenceLevel)).toBe(false);
          
          const card = createValidAgentCard({ confidenceLevel: invalidConfidenceLevel });
          const result = validateAgentCard(card);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('confidenceLevel'))).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Skills active must be a subset of the agent\'s available skills', async () => {
    await fc.assert(
      fc.property(
        generateValidAgentType(),
        (agentType: AgentType) => {
          return fc.assert(
            fc.property(
              generateValidSkillsForAgent(agentType),
              (skillsActive: string[]) => {
                expect(areValidSkillsForAgent(agentType, skillsActive)).toBe(true);
                
                // Verify each skill is in the agent's available skills
                const availableSkills = AGENT_SKILLS[agentType];
                skillsActive.forEach(skill => {
                  expect(availableSkills).toContain(skill);
                });
                
                const card = createValidAgentCard({ agentName: agentType, skillsActive });
                const result = validateAgentCard(card);
                expect(result.isValid).toBe(true);
              }
            ),
            { numRuns: 10 }
          );
        }
      ),
      { numRuns: 3 }
    );
  });

  test('Skills from other agents must be rejected', async () => {
    await fc.assert(
      fc.property(
        generateValidAgentType(),
        (agentType: AgentType) => {
          return fc.assert(
            fc.property(
              generateInvalidSkillsForAgent(agentType),
              (invalidSkills: string[]) => {
                expect(areValidSkillsForAgent(agentType, invalidSkills)).toBe(false);
                
                const card = createValidAgentCard({ agentName: agentType, skillsActive: invalidSkills });
                const result = validateAgentCard(card);
                expect(result.isValid).toBe(false);
                expect(result.errors.some(e => e.includes('skillsActive'))).toBe(true);
              }
            ),
            { numRuns: 10 }
          );
        }
      ),
      { numRuns: 3 }
    );
  });

  test('Each agent type has distinct visual styling', async () => {
    await fc.assert(
      fc.property(
        generateValidAgentType(),
        (agentType: AgentType) => {
          expect(hasDistinctVisualStyling(agentType)).toBe(true);
          
          const config = AGENT_VISUAL_CONFIG[agentType];
          expect(config).toBeDefined();
          expect(config.displayName).toBeTruthy();
          expect(config.colorClass).toBeTruthy();
          expect(config.bgColorClass).toBeTruthy();
          expect(config.borderColorClass).toBeTruthy();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('All three agent types have unique display names', () => {
    const displayNames = VALID_AGENT_TYPES.map(agent => AGENT_VISUAL_CONFIG[agent].displayName);
    const uniqueNames = new Set(displayNames);
    
    expect(uniqueNames.size).toBe(VALID_AGENT_TYPES.length);
  });

  test('All three agent types have unique color classes', () => {
    const colorClasses = VALID_AGENT_TYPES.map(agent => AGENT_VISUAL_CONFIG[agent].colorClass);
    const uniqueColors = new Set(colorClasses);
    
    expect(uniqueColors.size).toBe(VALID_AGENT_TYPES.length);
  });

  test('ThinkingAnimation must be a boolean', async () => {
    await fc.assert(
      fc.property(
        fc.boolean(),
        (thinkingAnimation: boolean) => {
          const card = createValidAgentCard({ thinkingAnimation });
          const result = validateAgentCard(card);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Missing required fields must be detected', () => {
    // Test missing agentName
    const noAgentName = { status: 'analyzing', skillsActive: [], findings: [], confidenceLevel: 0.5, thinkingAnimation: true };
    expect(validateAgentCard(noAgentName).errors.some(e => e.includes('agentName'))).toBe(true);
    
    // Test missing status
    const noStatus = { agentName: 'sre-agent', skillsActive: [], findings: [], confidenceLevel: 0.5, thinkingAnimation: true };
    expect(validateAgentCard(noStatus).errors.some(e => e.includes('status'))).toBe(true);
    
    // Test missing skillsActive
    const noSkillsActive = { agentName: 'sre-agent', status: 'analyzing', findings: [], confidenceLevel: 0.5, thinkingAnimation: true };
    expect(validateAgentCard(noSkillsActive).errors.some(e => e.includes('skillsActive'))).toBe(true);
    
    // Test missing findings
    const noFindings = { agentName: 'sre-agent', status: 'analyzing', skillsActive: [], confidenceLevel: 0.5, thinkingAnimation: true };
    expect(validateAgentCard(noFindings).errors.some(e => e.includes('findings'))).toBe(true);
    
    // Test missing confidenceLevel
    const noConfidenceLevel = { agentName: 'sre-agent', status: 'analyzing', skillsActive: [], findings: [], thinkingAnimation: true };
    expect(validateAgentCard(noConfidenceLevel).errors.some(e => e.includes('confidenceLevel'))).toBe(true);
    
    // Test missing thinkingAnimation
    const noThinkingAnimation = { agentName: 'sre-agent', status: 'analyzing', skillsActive: [], findings: [], confidenceLevel: 0.5 };
    expect(validateAgentCard(noThinkingAnimation).errors.some(e => e.includes('thinkingAnimation'))).toBe(true);
  });

  test('Null and undefined agent cards must be rejected', () => {
    expect(validateAgentCard(null).isValid).toBe(false);
    expect(validateAgentCard(undefined).isValid).toBe(false);
    expect(validateAgentCard({}).isValid).toBe(false);
  });

  test('Agent card validation is consistent across multiple runs', async () => {
    await fc.assert(
      fc.property(
        generateValidAgentCard(),
        (card: AgentCard) => {
          const result1 = validateAgentCard(card);
          const result2 = validateAgentCard(card);
          const result3 = validateAgentCard(card);
          
          // Validation should be deterministic
          expect(result1.isValid).toBe(result2.isValid);
          expect(result2.isValid).toBe(result3.isValid);
          expect(result1.errors).toEqual(result2.errors);
          expect(result2.errors).toEqual(result3.errors);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('SRE agent skills are correctly defined', () => {
    const sreSkills = AGENT_SKILLS['sre-agent'];
    expect(sreSkills).toContain('Datadog');
    expect(sreSkills).toContain('CloudWatch');
    expect(sreSkills).toContain('Prometheus');
    expect(sreSkills).toContain('OpenTelemetry');
    expect(sreSkills).toHaveLength(4);
  });

  test('Security agent skills are correctly defined', () => {
    const securitySkills = AGENT_SKILLS['security-agent'];
    expect(securitySkills).toContain('Splunk SIEM');
    expect(securitySkills).toContain('IAM Logs');
    expect(securitySkills).toContain('CSPM');
    expect(securitySkills).toHaveLength(3);
  });

  test('Governance agent skills are correctly defined', () => {
    const governanceSkills = AGENT_SKILLS['governance-agent'];
    expect(governanceSkills).toContain('Policy Engine');
    expect(governanceSkills).toContain('Change Management');
    expect(governanceSkills).toContain('Risk Register');
    expect(governanceSkills).toHaveLength(3);
  });

  test('Confidence level boundary values (0 and 1) are valid', () => {
    const cardWithZero = createValidAgentCard({ confidenceLevel: 0 });
    const cardWithOne = createValidAgentCard({ confidenceLevel: 1 });
    
    expect(validateAgentCard(cardWithZero).isValid).toBe(true);
    expect(validateAgentCard(cardWithOne).isValid).toBe(true);
  });

  test('Empty skillsActive array is valid', () => {
    const card = createValidAgentCard({ skillsActive: [] });
    const result = validateAgentCard(card);
    
    expect(result.isValid).toBe(true);
  });

  test('Empty findings array is valid', () => {
    const card = createValidAgentCard({ findings: [] });
    const result = validateAgentCard(card);
    
    expect(result.isValid).toBe(true);
  });

  test('All agent statuses produce valid cards', () => {
    for (const status of VALID_AGENT_STATUSES) {
      const card = createValidAgentCard({ status });
      const result = validateAgentCard(card);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  test('All agent types produce valid cards', () => {
    for (const agentType of VALID_AGENT_TYPES) {
      const card = createValidAgentCard({ 
        agentName: agentType,
        skillsActive: [AGENT_SKILLS[agentType][0]]
      });
      const result = validateAgentCard(card);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });
});
