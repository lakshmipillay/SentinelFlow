/**
 * Property-Based Tests for Agent Skills Validation
 * **Property 7: Agent Skills Validation**
 * **Validates: Requirements 2.3, 2.4, 2.5**
 * 
 * Tests that agents can only use authorized skills, skills validation works correctly,
 * and agent outputs contain complete skills metadata with proper confidence tracking.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AgentOutputValidator, AgentOutputValidationResult } from '../AgentOutputValidator';
import { AgentOutputFactory, AgentOutputRequest } from '../AgentOutputFactory';
import { 
  AgentName, 
  AgentSkill, 
  SRE_SKILLS, 
  SECURITY_SKILLS, 
  GOVERNANCE_SKILLS,
  AGENT_SKILLS_MAP,
  validateAgentSkills,
  validateConfidenceLevel,
  getAuthorizedSkills
} from '../../types/agent-skills';
import { AgentOutput } from '../../types/workflow';

interface SkillsTestScenario {
  agentName: AgentName;
  skillsUsed: string[];
  confidenceLevel: number;
  shouldBeValid: boolean;
}

interface CrossAgentSkillsScenario {
  agentName: AgentName;
  unauthorizedSkills: string[];
  authorizedSkills: string[];
}

describe('Property 7: Agent Skills Validation', () => {
  
  /**
   * Generators for property-based testing
   */
  const generateAgentName = (): fc.Arbitrary<AgentName> => {
    return fc.constantFrom('sre-agent', 'security-agent', 'governance-agent');
  };

  const generateAuthorizedSkills = (agentName: AgentName): fc.Arbitrary<string[]> => {
    const authorizedSkills = getAuthorizedSkills(agentName);
    return fc.subarray(authorizedSkills as string[], { minLength: 0, maxLength: authorizedSkills.length });
  };

  const generateUnauthorizedSkills = (agentName: AgentName): fc.Arbitrary<string[]> => {
    const authorizedSkills = new Set(getAuthorizedSkills(agentName));
    const allSkills = [...SRE_SKILLS, ...SECURITY_SKILLS, ...GOVERNANCE_SKILLS];
    const unauthorizedSkills = allSkills.filter(skill => !authorizedSkills.has(skill));
    
    return fc.subarray(unauthorizedSkills, { minLength: 1, maxLength: Math.min(3, unauthorizedSkills.length) });
  };

  const generateValidConfidenceLevel = (): fc.Arbitrary<number> => {
    // Use integer-based generation to avoid NaN issues with fc.float
    return fc.integer({ min: 0, max: 100 }).map(n => n / 100);
  };

  const generateInvalidConfidenceLevel = (): fc.Arbitrary<number> => {
    return fc.oneof(
      fc.float({ min: Math.fround(-10.0), max: Math.fround(-0.001) }), // Negative values
      fc.float({ min: Math.fround(1.001), max: Math.fround(10.0) }),   // Values > 1.0
      fc.constant(NaN),                       // NaN
      fc.constant(Infinity),                  // Infinity
      fc.constant(-Infinity)                  // -Infinity
    );
  };

  const generateValidAgentOutput = (): fc.Arbitrary<AgentOutputRequest> => {
    return fc.record({
      agentName: generateAgentName(),
      findings: fc.record({
        summary: fc.string({ minLength: 10, maxLength: 100 }),
        evidence: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        correlations: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 0, maxLength: 3 }),
        recommendations: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 0, maxLength: 3 })
      }),
      confidenceLevel: generateValidConfidenceLevel(),
      processingTimeMs: fc.integer({ min: 1000, max: 10000 }),
      dataSourcesAccessed: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 5 })
    }).chain(baseRequest => {
      // Generate authorized skills for the selected agent
      return generateAuthorizedSkills(baseRequest.agentName).map(skillsUsed => ({
        ...baseRequest,
        skillsUsed: skillsUsed as AgentSkill[]
      }));
    });
  };

  /**
   * Property Tests
   */
  test('Agents can only use skills they are authorized for', async () => {
    await fc.assert(
      fc.property(
        generateAgentName(),
        (agentName: AgentName) => {
          const authorizedSkills = getAuthorizedSkills(agentName);
          const unauthorizedSkills = [...SRE_SKILLS, ...SECURITY_SKILLS, ...GOVERNANCE_SKILLS]
            .filter(skill => !authorizedSkills.includes(skill));

          // Test with authorized skills - should be valid
          const validResult = validateAgentSkills(agentName, authorizedSkills as string[]);
          expect(validResult).toBe(true);

          // Test with unauthorized skills - should be invalid
          if (unauthorizedSkills.length > 0) {
            const invalidResult = validateAgentSkills(agentName, [unauthorizedSkills[0]]);
            expect(invalidResult).toBe(false);
          }

          // Test with mixed skills - should be invalid
          if (unauthorizedSkills.length > 0) {
            const mixedSkills = [authorizedSkills[0], unauthorizedSkills[0]];
            const mixedResult = validateAgentSkills(agentName, mixedSkills);
            expect(mixedResult).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Skills validation correctly identifies valid and invalid skill combinations', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          agentName: generateAgentName(),
          useAuthorizedSkills: fc.boolean(),
          skillCount: fc.integer({ min: 1, max: 3 })
        }),
        ({ agentName, useAuthorizedSkills, skillCount }) => {
          const authorizedSkills = getAuthorizedSkills(agentName);
          
          if (useAuthorizedSkills) {
            // Use only authorized skills
            const skillsToTest = authorizedSkills.slice(0, Math.min(skillCount, authorizedSkills.length));
            const result = validateAgentSkills(agentName, skillsToTest as string[]);
            expect(result).toBe(true);
          } else {
            // Use unauthorized skills
            const allSkills = [...SRE_SKILLS, ...SECURITY_SKILLS, ...GOVERNANCE_SKILLS];
            const unauthorizedSkills = allSkills.filter(skill => !authorizedSkills.includes(skill));
            
            if (unauthorizedSkills.length > 0) {
              const skillsToTest = unauthorizedSkills.slice(0, Math.min(skillCount, unauthorizedSkills.length));
              const result = validateAgentSkills(agentName, skillsToTest);
              expect(result).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Agent outputs contain complete and accurate skills metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidAgentOutput(),
        async (request: AgentOutputRequest) => {
          const result = AgentOutputFactory.createAgentOutput(request);
          
          expect(result.success).toBe(true);
          expect(result.agentOutput).toBeDefined();
          
          const agentOutput = result.agentOutput!;
          
          // Validate skills metadata structure
          expect(agentOutput.metadata?.skillsMetadata).toBeDefined();
          const skillsMetadata = agentOutput.metadata!.skillsMetadata!;
          
          // Validate skills metadata completeness
          expect(skillsMetadata.skillsUsed).toEqual(request.skillsUsed);
          expect(skillsMetadata.totalSkillsAvailable).toBe(getAuthorizedSkills(request.agentName).length);
          expect(skillsMetadata.skillsUtilizationRate).toBe(
            request.skillsUsed.length / getAuthorizedSkills(request.agentName).length
          );
          expect(skillsMetadata.skillUsageDetails).toBeDefined();
          expect(Array.isArray(skillsMetadata.skillUsageDetails)).toBe(true);
          expect(skillsMetadata.skillUsageDetails.length).toBe(request.skillsUsed.length);
          
          // Validate skill usage details
          skillsMetadata.skillUsageDetails.forEach((detail, index) => {
            expect(detail.skill).toBe(request.skillsUsed[index]);
            expect(detail.usedAt).toBeDefined();
            expect(typeof detail.usedAt).toBe('string');
            expect(new Date(detail.usedAt)).toBeInstanceOf(Date);
          });
          
          // Validate validation flags
          expect(agentOutput.validation.skillsValid).toBe(true);
          expect(agentOutput.validation.confidenceLevelValid).toBe(true);
          expect(agentOutput.validation.schemaCompliant).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Confidence levels are properly validated and tracked', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          validConfidence: generateValidConfidenceLevel(),
          invalidConfidence: generateInvalidConfidenceLevel()
        }),
        ({ validConfidence, invalidConfidence }) => {
          // Test valid confidence levels
          expect(validateConfidenceLevel(validConfidence)).toBe(true);
          
          // Test invalid confidence levels
          expect(validateConfidenceLevel(invalidConfidence)).toBe(false);
          
          // Test edge cases
          expect(validateConfidenceLevel(0.0)).toBe(true);
          expect(validateConfidenceLevel(1.0)).toBe(true);
          expect(validateConfidenceLevel(-0.001)).toBe(false);
          expect(validateConfidenceLevel(1.001)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Cross-agent skill isolation prevents unauthorized skill usage', async () => {
    await fc.assert(
      fc.property(
        generateAgentName(),
        (agentName: AgentName) => {
          const authorizedSkills = getAuthorizedSkills(agentName);
          
          // Get skills from other agent types
          const otherAgentSkills: string[] = [];
          Object.entries(AGENT_SKILLS_MAP).forEach(([otherAgentName, skills]) => {
            if (otherAgentName !== agentName) {
              otherAgentSkills.push(...skills);
            }
          });
          
          // Filter out any overlapping skills (though there shouldn't be any)
          const unauthorizedSkills = otherAgentSkills.filter(skill => 
            !authorizedSkills.includes(skill)
          );
          
          if (unauthorizedSkills.length > 0) {
            // Test that using skills from other agents is invalid
            const result = validateAgentSkills(agentName, [unauthorizedSkills[0]]);
            expect(result).toBe(false);
            
            // Test that mixing authorized and unauthorized skills is invalid
            const mixedSkills = [authorizedSkills[0], unauthorizedSkills[0]];
            const mixedResult = validateAgentSkills(agentName, mixedSkills);
            expect(mixedResult).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Skills utilization rates are calculated correctly', async () => {
    await fc.assert(
      fc.property(
        generateAgentName(),
        fc.integer({ min: 0, max: 4 }),
        (agentName: AgentName, skillsToUse: number) => {
          const authorizedSkills = getAuthorizedSkills(agentName);
          const actualSkillsToUse = Math.min(skillsToUse, authorizedSkills.length);
          const selectedSkills = authorizedSkills.slice(0, actualSkillsToUse);
          
          const request: AgentOutputRequest = {
            agentName,
            skillsUsed: selectedSkills as AgentSkill[],
            findings: {
              summary: 'Test analysis completed',
              evidence: ['Test evidence'],
              correlations: ['Test correlation']
            },
            confidenceLevel: 0.8,
            processingTimeMs: 2000,
            dataSourcesAccessed: ['test-api']
          };
          
          const result = AgentOutputFactory.createAgentOutput(request);
          expect(result.success).toBe(true);
          
          const expectedUtilizationRate = actualSkillsToUse / authorizedSkills.length;
          const actualUtilizationRate = result.agentOutput!.metadata!.skillsMetadata!.skillsUtilizationRate;
          
          expect(actualUtilizationRate).toBeCloseTo(expectedUtilizationRate, 5);
          expect(actualUtilizationRate).toBeGreaterThanOrEqual(0);
          expect(actualUtilizationRate).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Invalid skill usage is properly detected and reported', async () => {
    await fc.assert(
      fc.property(
        generateAgentName(),
        (agentName: AgentName) => {
          const authorizedSkills = getAuthorizedSkills(agentName);
          const allSkills = [...SRE_SKILLS, ...SECURITY_SKILLS, ...GOVERNANCE_SKILLS];
          const unauthorizedSkills = allSkills.filter(skill => !authorizedSkills.includes(skill));
          
          if (unauthorizedSkills.length > 0) {
            // Create agent output with unauthorized skills
            const invalidOutput = {
              agentName,
              skillsUsed: [unauthorizedSkills[0]], // Use unauthorized skill
              findings: {
                summary: 'Test analysis',
                evidence: ['Test evidence'],
                correlations: ['Test correlation']
              },
              confidenceLevel: 0.8,
              timestamp: new Date().toISOString(),
              metadata: {
                processingTimeMs: 2000,
                dataSourcesAccessed: ['test-api'],
                skillsMetadata: {
                  skillsUsed: [unauthorizedSkills[0]],
                  skillUsageDetails: [],
                  totalSkillsAvailable: authorizedSkills.length,
                  skillsUtilizationRate: 1 / authorizedSkills.length
                }
              },
              validation: {
                skillsValid: false,
                confidenceLevelValid: true,
                schemaCompliant: true
              }
            };
            
            const validationResult = AgentOutputValidator.validateAgentOutput(invalidOutput);
            
            expect(validationResult.isValid).toBe(false);
            expect(validationResult.errors.length).toBeGreaterThan(0);
            expect(validationResult.errors.some(error => 
              error.includes('unauthorized skills')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Agent output validation handles edge cases correctly', async () => {
    await fc.assert(
      fc.property(
        generateAgentName(),
        (agentName: AgentName) => {
          const authorizedSkills = getAuthorizedSkills(agentName);
          
          // Test with empty skills array
          const emptySkillsOutput = {
            agentName,
            skillsUsed: [],
            findings: {
              summary: 'Test analysis',
              evidence: ['Test evidence'],
              correlations: []
            },
            confidenceLevel: 0.5,
            timestamp: new Date().toISOString(),
            metadata: {
              processingTimeMs: 1000,
              dataSourcesAccessed: [],
              skillsMetadata: {
                skillsUsed: [],
                skillUsageDetails: [],
                totalSkillsAvailable: authorizedSkills.length,
                skillsUtilizationRate: 0
              }
            },
            validation: {
              skillsValid: true,
              confidenceLevelValid: true,
              schemaCompliant: true
            }
          };
          
          const emptySkillsResult = AgentOutputValidator.validateAgentOutput(emptySkillsOutput);
          expect(emptySkillsResult.isValid).toBe(true);
          expect(emptySkillsResult.warnings.some(warning => 
            warning.includes('no skills used')
          )).toBe(true);
          
          // Test with duplicate skills
          if (authorizedSkills.length > 0) {
            const duplicateSkillsOutput = {
              ...emptySkillsOutput,
              skillsUsed: [authorizedSkills[0], authorizedSkills[0]], // Duplicate skill
              metadata: {
                ...emptySkillsOutput.metadata,
                skillsMetadata: {
                  ...emptySkillsOutput.metadata.skillsMetadata,
                  skillsUsed: [authorizedSkills[0], authorizedSkills[0]],
                  skillsUtilizationRate: 2 / authorizedSkills.length
                }
              }
            };
            
            const duplicateSkillsResult = AgentOutputValidator.validateAgentOutput(duplicateSkillsOutput);
            expect(duplicateSkillsResult.warnings.some(warning => 
              warning.includes('Duplicate skills')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Skills metadata generation is consistent and complete', async () => {
    // Use a more constrained generator that ensures valid data
    const generateStrictlyValidAgentOutput = (): fc.Arbitrary<AgentOutputRequest> => {
      return fc.record({
        agentName: generateAgentName(),
        findings: fc.record({
          summary: fc.string({ minLength: 10, maxLength: 100 }),
          evidence: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
          correlations: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 0, maxLength: 3 }),
          recommendations: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 0, maxLength: 3 })
        }),
        // Use integer-based confidence to avoid NaN issues
        confidenceLevel: fc.integer({ min: 0, max: 100 }).map(n => n / 100),
        processingTimeMs: fc.integer({ min: 1000, max: 10000 }),
        dataSourcesAccessed: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 5 })
      }).chain(baseRequest => {
        // Generate at least one authorized skill for the selected agent
        const authorizedSkills = getAuthorizedSkills(baseRequest.agentName);
        return fc.subarray(authorizedSkills as string[], { minLength: 1, maxLength: authorizedSkills.length }).map(skillsUsed => ({
          ...baseRequest,
          skillsUsed: skillsUsed as AgentSkill[]
        }));
      });
    };

    await fc.assert(
      fc.property(
        generateStrictlyValidAgentOutput(),
        (request: AgentOutputRequest) => {
          const result1 = AgentOutputFactory.createAgentOutput(request);
          const result2 = AgentOutputFactory.createAgentOutput(request);
          
          expect(result1.success).toBe(true);
          expect(result2.success).toBe(true);
          
          const metadata1 = result1.agentOutput!.metadata!.skillsMetadata!;
          const metadata2 = result2.agentOutput!.metadata!.skillsMetadata!;
          
          // Skills metadata should be consistent for same input
          expect(metadata1.skillsUsed).toEqual(metadata2.skillsUsed);
          expect(metadata1.totalSkillsAvailable).toBe(metadata2.totalSkillsAvailable);
          expect(metadata1.skillsUtilizationRate).toBe(metadata2.skillsUtilizationRate);
          expect(metadata1.skillUsageDetails.length).toBe(metadata2.skillUsageDetails.length);
          
          // Validate completeness
          expect(metadata1.skillsUsed).toEqual(request.skillsUsed);
          expect(metadata1.totalSkillsAvailable).toBeGreaterThan(0);
          expect(metadata1.skillsUtilizationRate).toBeGreaterThanOrEqual(0);
          expect(metadata1.skillsUtilizationRate).toBeLessThanOrEqual(1);
          expect(metadata1.skillUsageDetails.length).toBe(request.skillsUsed.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});