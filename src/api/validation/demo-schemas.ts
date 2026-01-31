/**
 * SentinelFlow Demo Mode Validation Schemas
 * Input validation schemas for demo mode API endpoints
 * Implements structured validation per coding standards
 */

import Joi from 'joi';

export const DemoSchemas = {
  /**
   * Schema for activating demo mode
   */
  activateDemo: Joi.object({
    scenarioType: Joi.string()
      .valid('database-outage', 'api-failure', 'security-incident', 'infrastructure-issue', 'deployment-problem')
      .optional()
      .description('Type of demo scenario to activate'),
    
    customScenario: Joi.object({
      type: Joi.string().required(),
      name: Joi.string().required(),
      description: Joi.string().required(),
      complexity: Joi.string().valid('simple', 'moderate', 'complex').required(),
      estimatedDuration: Joi.string().required()
    }).optional().description('Custom scenario configuration'),
    
    enableAutoProgression: Joi.boolean()
      .optional()
      .default(false)
      .description('Enable automatic workflow progression')
  }).options({ stripUnknown: true }),

  /**
   * Schema for simulating agent analysis
   */
  simulateAgentAnalysis: Joi.object({
    agentName: Joi.string()
      .valid('sre-agent', 'security-agent', 'governance-agent')
      .required()
      .description('Name of the agent to simulate analysis for')
  }).options({ stripUnknown: true }),

  /**
   * Schema for simulating governance scenarios
   */
  simulateGovernance: Joi.object({
    scenarioType: Joi.string()
      .valid('approve', 'approve_with_restrictions', 'block', 'realistic')
      .optional()
      .default('realistic')
      .description('Type of governance scenario to simulate')
  }).options({ stripUnknown: true }),

  /**
   * Schema for restoring demo state from snapshot
   */
  restoreSnapshot: Joi.object({
    snapshot: Joi.object({
      sessionId: Joi.string().required(),
      timestamp: Joi.string().isoDate().required(),
      scenario: Joi.object({
        type: Joi.string().required(),
        name: Joi.string().required(),
        description: Joi.string().required(),
        complexity: Joi.string().valid('simple', 'moderate', 'complex').required(),
        estimatedDuration: Joi.string().required()
      }).required(),
      workflows: Joi.array().items(
        Joi.object({
          workflowId: Joi.string().required(),
          workflow: Joi.object().required(),
          incident: Joi.object().required(),
          progressionStep: Joi.number().integer().min(0).required()
        })
      ).required(),
      progressionState: Joi.string().required(),
      config: Joi.object().required()
    }).required()
  }).options({ stripUnknown: true }),

  /**
   * Schema for updating demo configuration
   */
  updateConfig: Joi.object({
    config: Joi.object({
      maxConcurrentWorkflows: Joi.number()
        .integer()
        .min(1)
        .max(10)
        .optional()
        .description('Maximum number of concurrent demo workflows'),
      
      defaultScenarioType: Joi.string()
        .valid('database-outage', 'api-failure', 'security-incident', 'infrastructure-issue', 'deployment-problem')
        .optional()
        .description('Default scenario type for new demo sessions'),
      
      enableProgressiveDisclosure: Joi.boolean()
        .optional()
        .description('Enable progressive disclosure of information'),
      
      enableRealisticTiming: Joi.boolean()
        .optional()
        .description('Enable realistic timing delays for agent responses'),
      
      safetyConstraints: Joi.object({
        noExternalActions: Joi.boolean()
          .valid(true)
          .optional()
          .description('Must be true - external actions are prohibited in demo mode'),
        
        isolatedEnvironment: Joi.boolean()
          .valid(true)
          .optional()
          .description('Must be true - demo must run in isolated environment'),
        
        auditAllOperations: Joi.boolean()
          .valid(true)
          .optional()
          .description('Must be true - all operations must be audited'),
        
        clearIndicators: Joi.boolean()
          .optional()
          .description('Whether demo mode should be clearly indicated in UI')
      }).optional(),
      
      timingConfig: Joi.object({
        agentProcessingDelayMs: Joi.number()
          .integer()
          .min(500)
          .max(10000)
          .optional()
          .description('Delay in milliseconds for agent processing simulation'),
        
        stateTransitionDelayMs: Joi.number()
          .integer()
          .min(100)
          .max(5000)
          .optional()
          .description('Delay in milliseconds for state transitions'),
        
        progressiveDisclosureIntervalMs: Joi.number()
          .integer()
          .min(1000)
          .max(15000)
          .optional()
          .description('Interval in milliseconds for progressive disclosure')
      }).optional()
    }).required()
  }).options({ stripUnknown: true }),

  /**
   * Schema for creating custom demo scenarios
   */
  createCustomScenario: Joi.object({
    type: Joi.string()
      .pattern(/^[a-z-]+$/)
      .required()
      .description('Scenario type identifier (lowercase with hyphens)'),
    
    name: Joi.string()
      .min(5)
      .max(100)
      .required()
      .description('Human-readable scenario name'),
    
    description: Joi.string()
      .min(10)
      .max(500)
      .required()
      .description('Detailed scenario description'),
    
    complexity: Joi.string()
      .valid('simple', 'moderate', 'complex')
      .required()
      .description('Scenario complexity level'),
    
    estimatedDuration: Joi.string()
      .pattern(/^\d+-\d+ minutes$/)
      .required()
      .description('Estimated duration in format "X-Y minutes"'),
    
    incidentTemplate: Joi.object({
      severity: Joi.string()
        .valid('low', 'medium', 'high', 'critical')
        .required(),
      
      affectedServices: Joi.array()
        .items(Joi.string().min(1))
        .min(1)
        .max(10)
        .required(),
      
      symptoms: Joi.array()
        .items(Joi.string().min(5))
        .min(1)
        .max(10)
        .required(),
      
      initialMetrics: Joi.object({
        cpu: Joi.number().min(0).max(100).required(),
        memory: Joi.number().min(0).max(100).required(),
        errorRate: Joi.number().min(0).max(100).required(),
        responseTime: Joi.number().min(0).required(),
        throughput: Joi.number().min(0).required()
      }).required(),
      
      timelineEvents: Joi.array().items(
        Joi.object({
          timestamp: Joi.string().isoDate().required(),
          event: Joi.string().min(5).required(),
          impact: Joi.string().min(5).required()
        })
      ).min(1).max(10).required()
    }).required(),
    
    expectedAnalysis: Joi.object({
      sreFindings: Joi.array()
        .items(Joi.string().min(5))
        .min(1)
        .max(10)
        .required(),
      
      securityFindings: Joi.array()
        .items(Joi.string().min(5))
        .min(1)
        .max(10)
        .required(),
      
      governanceFindings: Joi.array()
        .items(Joi.string().min(5))
        .min(1)
        .max(10)
        .required(),
      
      correlationPoints: Joi.array()
        .items(Joi.string().min(5))
        .min(1)
        .max(5)
        .required()
    }).required(),
    
    governanceScenario: Joi.object({
      defaultRiskLevel: Joi.string()
        .valid('low', 'medium', 'high', 'critical')
        .required(),
      
      policyConflicts: Joi.array()
        .items(Joi.string().min(5))
        .max(10)
        .required(),
      
      blastRadiusServices: Joi.array()
        .items(Joi.string().min(1))
        .min(1)
        .max(10)
        .required(),
      
      recommendedDecision: Joi.string()
        .valid('approve', 'approve_with_restrictions', 'block')
        .required()
    }).required()
  }).options({ stripUnknown: true }),

  /**
   * Schema for demo workflow simulation parameters
   */
  simulateWorkflow: Joi.object({
    scenarioType: Joi.string()
      .valid('database-outage', 'api-failure', 'security-incident', 'infrastructure-issue', 'deployment-problem')
      .optional(),
    
    customIncident: Joi.object({
      type: Joi.string().required(),
      description: Joi.string().min(10).max(500).required(),
      severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
      affectedServices: Joi.array().items(Joi.string()).min(1).max(10).required()
    }).optional(),
    
    simulationOptions: Joi.object({
      enableRealisticTiming: Joi.boolean().optional().default(true),
      agentProcessingDelay: Joi.number().integer().min(500).max(10000).optional(),
      enableProgressiveDisclosure: Joi.boolean().optional().default(true),
      autoProgressWorkflow: Joi.boolean().optional().default(false)
    }).optional()
  }).options({ stripUnknown: true }),

  /**
   * Schema for demo metrics query parameters
   */
  demoMetricsQuery: Joi.object({
    sessionId: Joi.string().optional(),
    startDate: Joi.string().isoDate().optional(),
    endDate: Joi.string().isoDate().optional(),
    includeAuditEvents: Joi.boolean().optional().default(false),
    includeProgressionEvents: Joi.boolean().optional().default(false)
  }).options({ stripUnknown: true }),

  /**
   * Schema for demo safety validation
   */
  safetyValidation: Joi.object({
    checkIsolation: Joi.boolean().optional().default(true),
    checkExternalActions: Joi.boolean().optional().default(true),
    checkAuditTrail: Joi.boolean().optional().default(true),
    checkDemoIndicators: Joi.boolean().optional().default(true)
  }).options({ stripUnknown: true })
};

/**
 * Validation helper functions for demo mode
 */
export const DemoValidationHelpers = {
  /**
   * Validate that a scenario type is supported
   */
  isValidScenarioType(scenarioType: string): boolean {
    const validTypes = ['database-outage', 'api-failure', 'security-incident', 'infrastructure-issue', 'deployment-problem'];
    return validTypes.includes(scenarioType);
  },

  /**
   * Validate that agent name is valid for demo simulation
   */
  isValidAgentName(agentName: string): boolean {
    const validAgents = ['sre-agent', 'security-agent', 'governance-agent'];
    return validAgents.includes(agentName);
  },

  /**
   * Validate that governance scenario type is valid
   */
  isValidGovernanceScenario(scenarioType: string): boolean {
    const validScenarios = ['approve', 'approve_with_restrictions', 'block', 'realistic'];
    return validScenarios.includes(scenarioType);
  },

  /**
   * Validate demo safety constraints
   */
  validateSafetyConstraints(constraints: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (constraints.noExternalActions !== true) {
      errors.push('noExternalActions must be true for demo mode');
    }
    
    if (constraints.isolatedEnvironment !== true) {
      errors.push('isolatedEnvironment must be true for demo mode');
    }
    
    if (constraints.auditAllOperations !== true) {
      errors.push('auditAllOperations must be true for demo mode');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate demo session structure
   */
  validateSessionStructure(session: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!session.sessionId) {
      errors.push('sessionId is required');
    }
    
    if (!session.scenario) {
      errors.push('scenario is required');
    }
    
    if (!session.startTime) {
      errors.push('startTime is required');
    }
    
    if (!session.safetyStatus) {
      errors.push('safetyStatus is required');
    } else {
      const safetyValidation = this.validateSafetyConstraints(session.safetyStatus);
      if (!safetyValidation.valid) {
        errors.push(...safetyValidation.errors);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Sanitize demo input to prevent production references
   */
  sanitizeDemoInput(input: any): any {
    const sanitized = JSON.parse(JSON.stringify(input));
    
    // Remove any production-related references
    const productionKeywords = ['prod', 'production', 'live', 'real', 'actual'];
    
    function sanitizeObject(obj: any): any {
      if (typeof obj === 'string') {
        let sanitizedString = obj;
        productionKeywords.forEach(keyword => {
          const regex = new RegExp(keyword, 'gi');
          sanitizedString = sanitizedString.replace(regex, 'demo');
        });
        return sanitizedString;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      if (obj && typeof obj === 'object') {
        const sanitizedObj: any = {};
        Object.keys(obj).forEach(key => {
          sanitizedObj[key] = sanitizeObject(obj[key]);
        });
        return sanitizedObj;
      }
      
      return obj;
    }
    
    return sanitizeObject(sanitized);
  }
};