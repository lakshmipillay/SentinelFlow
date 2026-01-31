/**
 * Property-Based Tests for Blast Radius Graph Completeness
 * **Property 19: Blast Radius Graph Completeness**
 * **Validates: Requirements 7.1, 7.2**
 * 
 * Tests that all blast radius nodes have required fields (serviceName, healthStatus, dependencies, impactLevel),
 * health status is one of: healthy, warning, critical,
 * impact level is one of: low, medium, high,
 * service name is a non-empty string,
 * dependencies is an array of strings,
 * and all referenced dependencies exist in the node list (graph integrity).
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Health status types for blast radius nodes
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical';

/**
 * Impact level types for blast radius nodes
 */
export type ImpactLevel = 'low' | 'medium' | 'high';

/**
 * Blast radius node interface matching frontend requirements
 * Requirements: 7.1 - Generate blast radius graphs showing affected system components with relationships
 * Requirements: 7.2 - Color-code component health status and show dependency chains
 */
export interface BlastRadiusNode {
  serviceName: string;
  healthStatus: HealthStatus;
  dependencies: string[];
  impactLevel: ImpactLevel;
}

/**
 * Valid health status values
 */
export const VALID_HEALTH_STATUSES: readonly HealthStatus[] = ['healthy', 'warning', 'critical'] as const;

/**
 * Valid impact level values
 */
export const VALID_IMPACT_LEVELS: readonly ImpactLevel[] = ['low', 'medium', 'high'] as const;

/**
 * Validates that a health status is one of the allowed values
 */
export function isValidHealthStatus(status: string): status is HealthStatus {
  return VALID_HEALTH_STATUSES.includes(status as HealthStatus);
}

/**
 * Validates that an impact level is one of the allowed values
 */
export function isValidImpactLevel(level: string): level is ImpactLevel {
  return VALID_IMPACT_LEVELS.includes(level as ImpactLevel);
}

/**
 * Validates that a string is non-empty
 */
export function isNonEmptyString(str: string): boolean {
  return typeof str === 'string' && str.trim().length > 0;
}

/**
 * Validates that dependencies is an array of strings
 */
export function isValidDependenciesArray(deps: unknown): deps is string[] {
  if (!Array.isArray(deps)) {
    return false;
  }
  return deps.every(dep => typeof dep === 'string');
}

/**
 * Validates a single blast radius node has all required fields with correct types
 */
export function validateBlastRadiusNode(node: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!node || typeof node !== 'object') {
    return { isValid: false, errors: ['Node must be a non-null object'] };
  }
  
  const nodeObj = node as Record<string, unknown>;
  
  // Validate serviceName field
  if (!('serviceName' in nodeObj)) {
    errors.push('Missing required field: serviceName');
  } else if (!isNonEmptyString(nodeObj.serviceName as string)) {
    errors.push('Field "serviceName" must be a non-empty string');
  }
  
  // Validate healthStatus field
  if (!('healthStatus' in nodeObj)) {
    errors.push('Missing required field: healthStatus');
  } else if (!isValidHealthStatus(nodeObj.healthStatus as string)) {
    errors.push(`Field "healthStatus" must be one of: ${VALID_HEALTH_STATUSES.join(', ')}`);
  }
  
  // Validate dependencies field
  if (!('dependencies' in nodeObj)) {
    errors.push('Missing required field: dependencies');
  } else if (!isValidDependenciesArray(nodeObj.dependencies)) {
    errors.push('Field "dependencies" must be an array of strings');
  }
  
  // Validate impactLevel field
  if (!('impactLevel' in nodeObj)) {
    errors.push('Missing required field: impactLevel');
  } else if (!isValidImpactLevel(nodeObj.impactLevel as string)) {
    errors.push(`Field "impactLevel" must be one of: ${VALID_IMPACT_LEVELS.join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Validates graph integrity - all referenced dependencies must exist in the node list
 */
export function validateGraphIntegrity(nodes: BlastRadiusNode[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Build a set of all service names
  const serviceNames = new Set(nodes.map(node => node.serviceName));
  
  // Check that all dependencies reference existing services
  for (const node of nodes) {
    for (const dep of node.dependencies) {
      if (!serviceNames.has(dep)) {
        errors.push(`Service "${node.serviceName}" references non-existent dependency "${dep}"`);
      }
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Validates an entire blast radius graph
 */
export function validateBlastRadiusGraph(nodes: unknown[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!Array.isArray(nodes)) {
    return { isValid: false, errors: ['Nodes must be an array'] };
  }
  
  // Validate each node
  for (let i = 0; i < nodes.length; i++) {
    const nodeResult = validateBlastRadiusNode(nodes[i]);
    if (!nodeResult.isValid) {
      errors.push(...nodeResult.errors.map(e => `Node ${i}: ${e}`));
    }
  }
  
  // If all nodes are valid, check graph integrity
  if (errors.length === 0) {
    const integrityResult = validateGraphIntegrity(nodes as BlastRadiusNode[]);
    errors.push(...integrityResult.errors);
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Creates a valid blast radius node for testing
 */
export function createValidNode(overrides: Partial<BlastRadiusNode> = {}): BlastRadiusNode {
  return {
    serviceName: 'api-gateway',
    healthStatus: 'healthy',
    dependencies: [],
    impactLevel: 'low',
    ...overrides
  };
}

/**
 * Creates a valid blast radius graph with proper dependencies
 */
export function createValidGraph(): BlastRadiusNode[] {
  return [
    { serviceName: 'frontend', healthStatus: 'healthy', dependencies: ['api-gateway'], impactLevel: 'low' },
    { serviceName: 'api-gateway', healthStatus: 'warning', dependencies: ['database'], impactLevel: 'medium' },
    { serviceName: 'database', healthStatus: 'critical', dependencies: [], impactLevel: 'high' }
  ];
}

describe('Property 19: Blast Radius Graph Completeness', () => {
  
  /**
   * Generators for property-based testing
   */
  const generateValidServiceName = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'frontend',
      'api-gateway',
      'database',
      'auth-service',
      'payment-service',
      'cache-layer',
      'message-queue',
      'load-balancer'
    );
  };

  const generateValidHealthStatus = (): fc.Arbitrary<HealthStatus> => {
    return fc.constantFrom('healthy', 'warning', 'critical');
  };

  const generateInvalidHealthStatus = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'ok',
      'error',
      'unknown',
      'HEALTHY',
      'WARNING',
      'CRITICAL',
      '',
      'degraded'
    );
  };

  const generateValidImpactLevel = (): fc.Arbitrary<ImpactLevel> => {
    return fc.constantFrom('low', 'medium', 'high');
  };

  const generateInvalidImpactLevel = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'none',
      'critical',
      'severe',
      'LOW',
      'MEDIUM',
      'HIGH',
      '',
      'minimal'
    );
  };

  const generateValidNode = (): fc.Arbitrary<BlastRadiusNode> => {
    return fc.record({
      serviceName: generateValidServiceName(),
      healthStatus: generateValidHealthStatus(),
      dependencies: fc.constant([]), // Empty dependencies for single node validation
      impactLevel: generateValidImpactLevel()
    });
  };

  /**
   * Generates a valid graph with proper dependency references
   */
  const generateValidGraph = (): fc.Arbitrary<BlastRadiusNode[]> => {
    return fc.integer({ min: 1, max: 5 }).chain(size => {
      // Generate unique service names
      const serviceNames = [
        'frontend',
        'api-gateway',
        'database',
        'auth-service',
        'cache-layer'
      ].slice(0, size);
      
      // Generate nodes with valid dependencies (only referencing existing services)
      return fc.tuple(
        ...serviceNames.map((name, index) => {
          // Each node can only depend on services that come after it (to avoid cycles for simplicity)
          const possibleDeps = serviceNames.slice(index + 1);
          return fc.record({
            serviceName: fc.constant(name),
            healthStatus: generateValidHealthStatus(),
            dependencies: possibleDeps.length > 0 
              ? fc.subarray(possibleDeps, { minLength: 0, maxLength: possibleDeps.length })
              : fc.constant([]),
            impactLevel: generateValidImpactLevel()
          });
        })
      );
    });
  };

  /**
   * Property Tests
   */
  test('All valid blast radius nodes must have required fields (serviceName, healthStatus, dependencies, impactLevel)', async () => {
    await fc.assert(
      fc.property(
        generateValidNode(),
        (node: BlastRadiusNode) => {
          const result = validateBlastRadiusNode(node);
          
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
          
          // Verify all required fields are present
          expect(node).toHaveProperty('serviceName');
          expect(node).toHaveProperty('healthStatus');
          expect(node).toHaveProperty('dependencies');
          expect(node).toHaveProperty('impactLevel');
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Health status must be one of: healthy, warning, critical', async () => {
    await fc.assert(
      fc.property(
        generateValidHealthStatus(),
        (healthStatus: HealthStatus) => {
          expect(isValidHealthStatus(healthStatus)).toBe(true);
          expect(VALID_HEALTH_STATUSES).toContain(healthStatus);
          
          const node = createValidNode({ healthStatus });
          const result = validateBlastRadiusNode(node);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Invalid health status values must be rejected', async () => {
    await fc.assert(
      fc.property(
        generateInvalidHealthStatus(),
        (invalidStatus: string) => {
          expect(isValidHealthStatus(invalidStatus)).toBe(false);
          
          const node = createValidNode({ healthStatus: invalidStatus as HealthStatus });
          const result = validateBlastRadiusNode(node);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('healthStatus'))).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Impact level must be one of: low, medium, high', async () => {
    await fc.assert(
      fc.property(
        generateValidImpactLevel(),
        (impactLevel: ImpactLevel) => {
          expect(isValidImpactLevel(impactLevel)).toBe(true);
          expect(VALID_IMPACT_LEVELS).toContain(impactLevel);
          
          const node = createValidNode({ impactLevel });
          const result = validateBlastRadiusNode(node);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Invalid impact level values must be rejected', async () => {
    await fc.assert(
      fc.property(
        generateInvalidImpactLevel(),
        (invalidLevel: string) => {
          expect(isValidImpactLevel(invalidLevel)).toBe(false);
          
          const node = createValidNode({ impactLevel: invalidLevel as ImpactLevel });
          const result = validateBlastRadiusNode(node);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('impactLevel'))).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Service name must be a non-empty string', async () => {
    await fc.assert(
      fc.property(
        generateValidServiceName(),
        (serviceName: string) => {
          expect(isNonEmptyString(serviceName)).toBe(true);
          
          const node = createValidNode({ serviceName });
          const result = validateBlastRadiusNode(node);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Empty service name must be rejected', () => {
    const nodeWithEmptyName = createValidNode({ serviceName: '' });
    const result = validateBlastRadiusNode(nodeWithEmptyName);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('serviceName'))).toBe(true);
  });

  test('Whitespace-only service name must be rejected', () => {
    const nodeWithWhitespaceName = createValidNode({ serviceName: '   ' });
    const result = validateBlastRadiusNode(nodeWithWhitespaceName);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('serviceName'))).toBe(true);
  });

  test('Dependencies must be an array of strings', async () => {
    await fc.assert(
      fc.property(
        fc.array(generateValidServiceName(), { minLength: 0, maxLength: 3 }),
        (dependencies: string[]) => {
          expect(isValidDependenciesArray(dependencies)).toBe(true);
          
          // Create a graph where all dependencies exist
          const serviceNames = [...new Set([...dependencies, 'main-service'])];
          const nodes = serviceNames.map(name => createValidNode({ 
            serviceName: name,
            dependencies: name === 'main-service' ? dependencies.filter(d => d !== 'main-service') : []
          }));
          
          const result = validateBlastRadiusGraph(nodes);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Non-array dependencies must be rejected', () => {
    expect(isValidDependenciesArray('not-an-array')).toBe(false);
    expect(isValidDependenciesArray(null)).toBe(false);
    expect(isValidDependenciesArray(undefined)).toBe(false);
    expect(isValidDependenciesArray(123)).toBe(false);
    expect(isValidDependenciesArray({ key: 'value' })).toBe(false);
  });

  test('Dependencies array with non-string elements must be rejected', () => {
    expect(isValidDependenciesArray([1, 2, 3])).toBe(false);
    expect(isValidDependenciesArray(['valid', 123])).toBe(false);
    expect(isValidDependenciesArray([null])).toBe(false);
    expect(isValidDependenciesArray([undefined])).toBe(false);
  });

  test('All referenced dependencies must exist in the node list (graph integrity)', async () => {
    await fc.assert(
      fc.property(
        generateValidGraph(),
        (nodes: BlastRadiusNode[]) => {
          const result = validateBlastRadiusGraph(nodes);
          
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
          
          // Verify graph integrity manually
          const serviceNames = new Set(nodes.map(n => n.serviceName));
          for (const node of nodes) {
            for (const dep of node.dependencies) {
              expect(serviceNames.has(dep)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Non-existent dependency references must be detected', () => {
    const invalidGraph: BlastRadiusNode[] = [
      { serviceName: 'frontend', healthStatus: 'healthy', dependencies: ['non-existent-service'], impactLevel: 'low' },
      { serviceName: 'api-gateway', healthStatus: 'warning', dependencies: [], impactLevel: 'medium' }
    ];
    
    const result = validateBlastRadiusGraph(invalidGraph);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('non-existent'))).toBe(true);
  });

  test('Missing required fields must be detected', () => {
    // Test missing serviceName
    const noServiceName = { healthStatus: 'healthy', dependencies: [], impactLevel: 'low' };
    expect(validateBlastRadiusNode(noServiceName).errors.some(e => e.includes('serviceName'))).toBe(true);
    
    // Test missing healthStatus
    const noHealthStatus = { serviceName: 'test', dependencies: [], impactLevel: 'low' };
    expect(validateBlastRadiusNode(noHealthStatus).errors.some(e => e.includes('healthStatus'))).toBe(true);
    
    // Test missing dependencies
    const noDependencies = { serviceName: 'test', healthStatus: 'healthy', impactLevel: 'low' };
    expect(validateBlastRadiusNode(noDependencies).errors.some(e => e.includes('dependencies'))).toBe(true);
    
    // Test missing impactLevel
    const noImpactLevel = { serviceName: 'test', healthStatus: 'healthy', dependencies: [] };
    expect(validateBlastRadiusNode(noImpactLevel).errors.some(e => e.includes('impactLevel'))).toBe(true);
  });

  test('Null and undefined nodes must be rejected', () => {
    expect(validateBlastRadiusNode(null).isValid).toBe(false);
    expect(validateBlastRadiusNode(undefined).isValid).toBe(false);
    expect(validateBlastRadiusNode({}).isValid).toBe(false);
  });

  test('Node validation is consistent across multiple runs', async () => {
    await fc.assert(
      fc.property(
        generateValidNode(),
        (node: BlastRadiusNode) => {
          const result1 = validateBlastRadiusNode(node);
          const result2 = validateBlastRadiusNode(node);
          const result3 = validateBlastRadiusNode(node);
          
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

  test('All three health status values produce valid nodes', () => {
    for (const healthStatus of VALID_HEALTH_STATUSES) {
      const node = createValidNode({ healthStatus });
      const result = validateBlastRadiusNode(node);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  test('All three impact level values produce valid nodes', () => {
    for (const impactLevel of VALID_IMPACT_LEVELS) {
      const node = createValidNode({ impactLevel });
      const result = validateBlastRadiusNode(node);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  test('Valid graph with complex dependency chains passes validation', () => {
    const complexGraph: BlastRadiusNode[] = [
      { serviceName: 'frontend', healthStatus: 'healthy', dependencies: ['api-gateway'], impactLevel: 'low' },
      { serviceName: 'api-gateway', healthStatus: 'warning', dependencies: ['auth-service', 'database'], impactLevel: 'medium' },
      { serviceName: 'auth-service', healthStatus: 'healthy', dependencies: ['database'], impactLevel: 'medium' },
      { serviceName: 'database', healthStatus: 'critical', dependencies: [], impactLevel: 'high' }
    ];
    
    const result = validateBlastRadiusGraph(complexGraph);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('Empty graph is valid', () => {
    const result = validateBlastRadiusGraph([]);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('Single node with no dependencies is valid', () => {
    const singleNode: BlastRadiusNode[] = [
      { serviceName: 'standalone-service', healthStatus: 'healthy', dependencies: [], impactLevel: 'low' }
    ];
    
    const result = validateBlastRadiusGraph(singleNode);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('Self-referencing dependency is valid if service exists', () => {
    // A service can technically depend on itself (though unusual)
    const selfRefGraph: BlastRadiusNode[] = [
      { serviceName: 'recursive-service', healthStatus: 'warning', dependencies: ['recursive-service'], impactLevel: 'medium' }
    ];
    
    const result = validateBlastRadiusGraph(selfRefGraph);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('Multiple nodes with same service name are allowed (no uniqueness constraint)', () => {
    // Note: This tests current behavior - duplicate names are technically allowed
    // The graph integrity check only verifies dependencies exist, not uniqueness
    const duplicateGraph: BlastRadiusNode[] = [
      { serviceName: 'api-gateway', healthStatus: 'healthy', dependencies: [], impactLevel: 'low' },
      { serviceName: 'api-gateway', healthStatus: 'warning', dependencies: [], impactLevel: 'medium' }
    ];
    
    const result = validateBlastRadiusGraph(duplicateGraph);
    
    // Both nodes are valid individually and dependencies (none) are satisfied
    expect(result.isValid).toBe(true);
  });

  test('Graph validation reports all invalid nodes', () => {
    const multipleInvalidNodes = [
      { serviceName: '', healthStatus: 'healthy', dependencies: [], impactLevel: 'low' },
      { serviceName: 'valid-service', healthStatus: 'invalid', dependencies: [], impactLevel: 'low' },
      { serviceName: 'another-service', healthStatus: 'healthy', dependencies: [], impactLevel: 'invalid' }
    ];
    
    const result = validateBlastRadiusGraph(multipleInvalidNodes);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
