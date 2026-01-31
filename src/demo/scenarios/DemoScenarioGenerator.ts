/**
 * SentinelFlow Demo Scenario Generator
 * Generates realistic incident scenarios with structured data
 * Implements Requirements 9.2 - Realistic scenario generation
 */

import { DemoScenario } from '../types/demo-types';

export class DemoScenarioGenerator {
  private scenarios: Map<string, DemoScenario> = new Map();

  constructor() {
    this.initializeScenarios();
  }

  /**
   * Generate scenario by type with structured configuration
   * Implements deterministic scenario generation per coding standards
   */
  generateScenario(scenarioType: string): DemoScenario {
    const scenario = this.scenarios.get(scenarioType);
    if (!scenario) {
      throw new Error(`Unknown scenario type: ${scenarioType}`);
    }

    // Return deep copy to prevent mutation
    return JSON.parse(JSON.stringify(scenario));
  }

  /**
   * Create custom scenario with validation
   */
  createCustomScenario(customConfig: Partial<DemoScenario>): DemoScenario {
    const baseScenario = this.scenarios.get('database-outage')!;
    
    const customScenario: DemoScenario = {
      ...baseScenario,
      ...customConfig,
      // Ensure required fields are present
      type: customConfig.type || 'database-outage',
      name: customConfig.name || 'Custom Scenario',
      description: customConfig.description || 'Custom demo scenario',
      complexity: customConfig.complexity || 'moderate',
      estimatedDuration: customConfig.estimatedDuration || '10-15 minutes'
    };

    // Validate custom scenario structure
    this.validateScenarioStructure(customScenario);

    return customScenario;
  }

  /**
   * Get all available scenarios with metadata
   */
  getAvailableScenarios(): Array<{
    type: string;
    name: string;
    description: string;
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedDuration: string;
  }> {
    return Array.from(this.scenarios.values()).map(scenario => ({
      type: scenario.type,
      name: scenario.name,
      description: scenario.description,
      complexity: scenario.complexity,
      estimatedDuration: scenario.estimatedDuration
    }));
  }

  /**
   * Initialize predefined scenarios with structured data
   */
  private initializeScenarios(): void {
    // Database Outage Scenario
    this.scenarios.set('database-outage', {
      type: 'database-outage',
      name: 'Database Connection Pool Exhaustion',
      description: 'Primary database experiencing connection pool exhaustion causing application timeouts',
      complexity: 'moderate',
      estimatedDuration: '10-15 minutes',
      
      incidentTemplate: {
        severity: 'critical',
        affectedServices: ['user-service', 'order-service', 'payment-service', 'notification-service'],
        symptoms: [
          'Database connection timeouts',
          'Application response time degradation',
          'Increased error rates in user-facing services',
          'Connection pool exhaustion alerts'
        ],
        initialMetrics: {
          cpu: 85,
          memory: 92,
          errorRate: 15.7,
          responseTime: 8500,
          throughput: 45
        },
        timelineEvents: [
          {
            timestamp: '2024-01-15T14:30:00Z',
            event: 'Database connection pool utilization spike detected',
            impact: 'Initial performance degradation'
          },
          {
            timestamp: '2024-01-15T14:32:00Z',
            event: 'Connection timeout errors begin appearing',
            impact: 'User-facing service errors increase'
          },
          {
            timestamp: '2024-01-15T14:35:00Z',
            event: 'Connection pool exhaustion reached',
            impact: 'Critical service outage begins'
          }
        ]
      },
      
      expectedAnalysis: {
        sreFindings: [
          'Database connection pool exhausted',
          'High CPU utilization on database server',
          'Increased response times across dependent services',
          'Connection timeout patterns in application logs'
        ],
        securityFindings: [
          'No security indicators detected',
          'Normal authentication patterns',
          'No suspicious access attempts',
          'Database access logs show expected patterns'
        ],
        governanceFindings: [
          'Change management process followed',
          'No recent unauthorized deployments',
          'Database maintenance window compliance',
          'Incident response procedures activated'
        ],
        correlationPoints: [
          'Recent deployment correlation with connection spike',
          'Database maintenance window timing',
          'Application scaling event correlation'
        ]
      },
      
      governanceScenario: {
        defaultRiskLevel: 'high',
        policyConflicts: [
          'Database restart requires change approval',
          'Production access during business hours restricted'
        ],
        blastRadiusServices: ['user-service', 'order-service', 'payment-service', 'notification-service'],
        recommendedDecision: 'approve_with_restrictions'
      }
    });

    // API Service Failure Scenario
    this.scenarios.set('api-failure', {
      type: 'api-failure',
      name: 'API Gateway Rate Limiting Cascade',
      description: 'API Gateway experiencing rate limiting cascade causing downstream service failures',
      complexity: 'complex',
      estimatedDuration: '15-20 minutes',
      
      incidentTemplate: {
        severity: 'high',
        affectedServices: ['api-gateway', 'auth-service', 'user-service', 'mobile-app'],
        symptoms: [
          'API Gateway rate limiting triggered',
          'Downstream service cascade failures',
          'Mobile application connectivity issues',
          'Authentication service degradation'
        ],
        initialMetrics: {
          cpu: 78,
          memory: 85,
          errorRate: 22.3,
          responseTime: 12000,
          throughput: 25
        },
        timelineEvents: [
          {
            timestamp: '2024-01-15T16:15:00Z',
            event: 'API Gateway rate limiting threshold exceeded',
            impact: 'Request throttling begins'
          },
          {
            timestamp: '2024-01-15T16:17:00Z',
            event: 'Downstream service timeout cascade initiated',
            impact: 'Service degradation spreads'
          },
          {
            timestamp: '2024-01-15T16:20:00Z',
            event: 'Mobile application connectivity failures',
            impact: 'User-facing service outage'
          }
        ]
      },
      
      expectedAnalysis: {
        sreFindings: [
          'API Gateway rate limiting activated',
          'Downstream service timeout cascade',
          'Circuit breaker patterns triggered',
          'Load balancer health check failures'
        ],
        securityFindings: [
          'Potential DDoS attack indicators',
          'Unusual traffic patterns detected',
          'Geographic traffic anomalies',
          'Rate limiting effectiveness analysis'
        ],
        governanceFindings: [
          'Rate limiting policy compliance',
          'Incident escalation procedures followed',
          'Service level agreement impact assessment',
          'Customer communication requirements'
        ],
        correlationPoints: [
          'Traffic spike correlation with marketing campaign',
          'Geographic traffic pattern analysis',
          'Service dependency mapping validation'
        ]
      },
      
      governanceScenario: {
        defaultRiskLevel: 'high',
        policyConflicts: [
          'Rate limiting adjustment requires security approval',
          'Traffic rerouting impacts customer SLA'
        ],
        blastRadiusServices: ['api-gateway', 'auth-service', 'user-service', 'mobile-app'],
        recommendedDecision: 'approve'
      }
    });

    // Security Incident Scenario
    this.scenarios.set('security-incident', {
      type: 'security-incident',
      name: 'Unauthorized Access Attempt',
      description: 'Suspicious authentication patterns indicating potential unauthorized access attempt',
      complexity: 'complex',
      estimatedDuration: '20-25 minutes',
      
      incidentTemplate: {
        severity: 'critical',
        affectedServices: ['auth-service', 'user-service', 'admin-panel', 'audit-service'],
        symptoms: [
          'Unusual authentication patterns',
          'Failed login attempt spikes',
          'Privilege escalation attempts',
          'Suspicious admin panel access'
        ],
        initialMetrics: {
          cpu: 65,
          memory: 70,
          errorRate: 8.9,
          responseTime: 3200,
          throughput: 120
        },
        timelineEvents: [
          {
            timestamp: '2024-01-15T22:45:00Z',
            event: 'Unusual authentication pattern detected',
            impact: 'Security monitoring alerts triggered'
          },
          {
            timestamp: '2024-01-15T22:47:00Z',
            event: 'Failed login attempt spike from multiple IPs',
            impact: 'Potential brute force attack identified'
          },
          {
            timestamp: '2024-01-15T22:50:00Z',
            event: 'Privilege escalation attempt detected',
            impact: 'Critical security incident declared'
          }
        ]
      },
      
      expectedAnalysis: {
        sreFindings: [
          'Authentication service performance normal',
          'No infrastructure anomalies detected',
          'System resources within normal parameters',
          'Application logs show security events'
        ],
        securityFindings: [
          'Coordinated attack pattern identified',
          'Multiple IP addresses involved',
          'Privilege escalation attempts detected',
          'Potential credential stuffing attack'
        ],
        governanceFindings: [
          'Security incident response activated',
          'Compliance notification requirements',
          'Data breach assessment required',
          'Customer notification obligations'
        ],
        correlationPoints: [
          'Attack pattern correlation with known threats',
          'Geographic IP distribution analysis',
          'Timing correlation with recent data breaches'
        ]
      },
      
      governanceScenario: {
        defaultRiskLevel: 'critical',
        policyConflicts: [
          'Immediate access revocation required',
          'Compliance reporting within 24 hours mandatory',
          'Customer notification may be required'
        ],
        blastRadiusServices: ['auth-service', 'user-service', 'admin-panel', 'audit-service'],
        recommendedDecision: 'approve'
      }
    });

    // Infrastructure Issue Scenario
    this.scenarios.set('infrastructure-issue', {
      type: 'infrastructure-issue',
      name: 'Container Orchestration Resource Exhaustion',
      description: 'Kubernetes cluster experiencing resource exhaustion causing pod scheduling failures',
      complexity: 'moderate',
      estimatedDuration: '12-18 minutes',
      
      incidentTemplate: {
        severity: 'high',
        affectedServices: ['kubernetes-cluster', 'web-service', 'worker-service', 'cache-service'],
        symptoms: [
          'Pod scheduling failures',
          'Resource quota exhaustion',
          'Container restart loops',
          'Service discovery issues'
        ],
        initialMetrics: {
          cpu: 95,
          memory: 98,
          errorRate: 18.5,
          responseTime: 15000,
          throughput: 15
        },
        timelineEvents: [
          {
            timestamp: '2024-01-15T10:20:00Z',
            event: 'Kubernetes node resource exhaustion detected',
            impact: 'Pod scheduling begins failing'
          },
          {
            timestamp: '2024-01-15T10:23:00Z',
            event: 'Container restart loops initiated',
            impact: 'Service stability degradation'
          },
          {
            timestamp: '2024-01-15T10:25:00Z',
            event: 'Service discovery failures cascade',
            impact: 'Inter-service communication breakdown'
          }
        ]
      },
      
      expectedAnalysis: {
        sreFindings: [
          'Kubernetes cluster resource exhaustion',
          'Pod scheduling failures across nodes',
          'Container memory limits exceeded',
          'Node capacity planning insufficient'
        ],
        securityFindings: [
          'No security implications identified',
          'Resource exhaustion not attack-related',
          'Container security policies intact',
          'Network security unaffected'
        ],
        governanceFindings: [
          'Capacity planning process review required',
          'Resource allocation policy compliance',
          'Infrastructure scaling procedures',
          'Cost impact assessment needed'
        ],
        correlationPoints: [
          'Traffic growth correlation with resource usage',
          'Deployment frequency impact on resources',
          'Seasonal usage pattern analysis'
        ]
      },
      
      governanceScenario: {
        defaultRiskLevel: 'medium',
        policyConflicts: [
          'Infrastructure scaling requires budget approval',
          'Node addition impacts cost allocation'
        ],
        blastRadiusServices: ['kubernetes-cluster', 'web-service', 'worker-service', 'cache-service'],
        recommendedDecision: 'approve_with_restrictions'
      }
    });

    // Deployment Problem Scenario
    this.scenarios.set('deployment-problem', {
      type: 'deployment-problem',
      name: 'Failed Deployment Rollback Required',
      description: 'Recent deployment causing application errors requiring immediate rollback',
      complexity: 'simple',
      estimatedDuration: '8-12 minutes',
      
      incidentTemplate: {
        severity: 'medium',
        affectedServices: ['web-service', 'api-service'],
        symptoms: [
          'Application errors post-deployment',
          'Configuration validation failures',
          'Service health check failures',
          'User-reported functionality issues'
        ],
        initialMetrics: {
          cpu: 60,
          memory: 75,
          errorRate: 12.1,
          responseTime: 6500,
          throughput: 80
        },
        timelineEvents: [
          {
            timestamp: '2024-01-15T09:00:00Z',
            event: 'Deployment v2.1.3 completed',
            impact: 'New version deployed to production'
          },
          {
            timestamp: '2024-01-15T09:05:00Z',
            event: 'Application error rate spike detected',
            impact: 'Service degradation begins'
          },
          {
            timestamp: '2024-01-15T09:08:00Z',
            event: 'Health check failures reported',
            impact: 'Service marked unhealthy'
          }
        ]
      },
      
      expectedAnalysis: {
        sreFindings: [
          'Deployment correlation with error spike',
          'Configuration validation failures',
          'Service health degradation',
          'Rollback procedure available'
        ],
        securityFindings: [
          'No security vulnerabilities in new version',
          'Deployment process security maintained',
          'Access controls functioning normally',
          'No security-related configuration changes'
        ],
        governanceFindings: [
          'Deployment process followed correctly',
          'Change management approval obtained',
          'Rollback procedures documented',
          'Impact assessment completed'
        ],
        correlationPoints: [
          'Deployment timing correlation with errors',
          'Configuration change impact analysis',
          'Version compatibility assessment'
        ]
      },
      
      governanceScenario: {
        defaultRiskLevel: 'low',
        policyConflicts: [
          'Rollback during business hours requires approval'
        ],
        blastRadiusServices: ['web-service', 'api-service'],
        recommendedDecision: 'approve'
      }
    });
  }

  /**
   * Validate scenario structure for safety and completeness
   */
  private validateScenarioStructure(scenario: DemoScenario): void {
    const requiredFields = [
      'type', 'name', 'description', 'complexity', 'estimatedDuration',
      'incidentTemplate', 'expectedAnalysis', 'governanceScenario'
    ];

    for (const field of requiredFields) {
      if (!(field in scenario)) {
        throw new Error(`Missing required field in scenario: ${field}`);
      }
    }

    // Validate incident template structure
    const incidentRequiredFields = ['severity', 'affectedServices', 'symptoms', 'initialMetrics', 'timelineEvents'];
    for (const field of incidentRequiredFields) {
      if (!(field in scenario.incidentTemplate)) {
        throw new Error(`Missing required field in incident template: ${field}`);
      }
    }

    // Validate expected analysis structure
    const analysisRequiredFields = ['sreFindings', 'securityFindings', 'governanceFindings', 'correlationPoints'];
    for (const field of analysisRequiredFields) {
      if (!(field in scenario.expectedAnalysis)) {
        throw new Error(`Missing required field in expected analysis: ${field}`);
      }
    }

    // Validate governance scenario structure
    const governanceRequiredFields = ['defaultRiskLevel', 'policyConflicts', 'blastRadiusServices', 'recommendedDecision'];
    for (const field of governanceRequiredFields) {
      if (!(field in scenario.governanceScenario)) {
        throw new Error(`Missing required field in governance scenario: ${field}`);
      }
    }
  }
}