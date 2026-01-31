/**
 * SentinelFlow API Validation Schemas
 * Comprehensive validation schemas for all API endpoints
 */

import { WorkflowState } from '../../types/workflow';

/**
 * Base validation schema interface
 */
export interface ValidationSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  properties?: Record<string, ValidationSchema>;
  items?: ValidationSchema;
  enum?: any[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  format?: 'uuid' | 'email' | 'date' | 'url';
}

/**
 * UUID validation pattern
 */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  uuid: {
    type: 'string' as const,
    pattern: UUID_PATTERN,
    required: true
  },
  
  timestamp: {
    type: 'string' as const,
    format: 'date' as const,
    required: true
  },
  
  nonEmptyString: {
    type: 'string' as const,
    minLength: 1,
    maxLength: 1000,
    required: true
  },
  
  longText: {
    type: 'string' as const,
    minLength: 10,
    maxLength: 5000,
    required: true
  },
  
  workflowState: {
    type: 'string' as const,
    enum: Object.values(WorkflowState),
    required: true
  }
};

/**
 * Workflow endpoint schemas
 */
export const WorkflowSchemas = {
  createWorkflow: {
    body: {
      type: 'object' as const,
      properties: {
        description: {
          type: 'string' as const,
          minLength: 1,
          maxLength: 500,
          required: false
        },
        priority: {
          type: 'string' as const,
          enum: ['low', 'medium', 'high', 'critical'],
          required: false
        }
      }
    }
  },
  
  updateWorkflowState: {
    body: {
      type: 'object' as const,
      properties: {
        newState: CommonSchemas.workflowState,
        reason: {
          type: 'string' as const,
          minLength: 5,
          maxLength: 500,
          required: false
        }
      },
      required: true
    }
  },
  
  terminateWorkflow: {
    body: {
      type: 'object' as const,
      properties: {
        reason: CommonSchemas.longText
      },
      required: true
    }
  }
};

/**
 * Agent output endpoint schemas
 */
export const AgentOutputSchemas = {
  addAgentOutput: {
    params: {
      workflowId: CommonSchemas.uuid
    },
    body: {
      type: 'object' as const,
      properties: {
        agentName: {
          type: 'string' as const,
          enum: ['sre-agent', 'security-agent', 'governance-agent'],
          required: true
        },
        outputType: {
          type: 'string' as const,
          enum: ['analysis', 'recommendation', 'decision', 'validation'],
          required: true
        },
        content: {
          type: 'object' as const,
          required: true
        },
        confidence: {
          type: 'number' as const,
          min: 0,
          max: 1,
          required: false
        },
        metadata: {
          type: 'object' as const,
          required: false
        }
      },
      required: true
    }
  },
  
  getAgentOutputsByAgent: {
    params: {
      workflowId: CommonSchemas.uuid,
      agentName: {
        type: 'string' as const,
        enum: ['sre-agent', 'security-agent', 'governance-agent'],
        required: true
      }
    }
  }
};

/**
 * Governance endpoint schemas
 */
export const GovernanceSchemas = {
  submitDecision: {
    params: {
      workflowId: CommonSchemas.uuid
    },
    body: {
      type: 'object' as const,
      properties: {
        decision: {
          type: 'string' as const,
          enum: ['approve', 'approve_with_restrictions', 'block'],
          required: true
        },
        rationale: CommonSchemas.longText,
        approver: {
          type: 'object' as const,
          properties: {
            id: CommonSchemas.nonEmptyString,
            role: {
              type: 'string' as const,
              enum: ['senior-sre', 'security-lead', 'compliance-officer', 'engineering-manager'],
              required: true
            },
            name: {
              type: 'string' as const,
              minLength: 1,
              maxLength: 100,
              required: false
            }
          },
          required: true
        },
        restrictions: {
          type: 'array' as const,
          items: CommonSchemas.nonEmptyString,
          required: false
        },
        expiresAt: {
          type: 'string' as const,
          format: 'date' as const,
          required: false
        }
      },
      required: true
    }
  },
  
  submitDecisionByRequest: {
    params: {
      requestId: CommonSchemas.uuid
    },
    body: {
      type: 'object' as const,
      properties: {
        decision: {
          type: 'string' as const,
          enum: ['approve', 'approve_with_restrictions', 'block'],
          required: true
        },
        rationale: CommonSchemas.longText,
        approver: {
          type: 'object' as const,
          properties: {
            id: CommonSchemas.nonEmptyString,
            role: {
              type: 'string' as const,
              enum: ['senior-sre', 'security-lead', 'compliance-officer', 'engineering-manager'],
              required: true
            }
          },
          required: true
        },
        restrictions: {
          type: 'array' as const,
          items: CommonSchemas.nonEmptyString,
          required: false
        }
      },
      required: true
    }
  }
};

/**
 * Audit endpoint schemas
 */
export const AuditSchemas = {
  exportAudit: {
    params: {
      workflowId: CommonSchemas.uuid
    },
    body: {
      type: 'object' as const,
      properties: {
        format: {
          type: 'string' as const,
          enum: ['json', 'csv', 'pdf'],
          required: false
        },
        includeContext: {
          type: 'boolean' as const,
          required: false
        },
        dateRange: {
          type: 'object' as const,
          properties: {
            startDate: {
              type: 'string' as const,
              format: 'date' as const,
              required: false
            },
            endDate: {
              type: 'string' as const,
              format: 'date' as const,
              required: false
            }
          },
          required: false
        }
      },
      required: false
    }
  }
};

/**
 * Historical data endpoint schemas
 */
export const HistoricalSchemas = {
  getHistoricalWorkflows: {
    query: {
      type: 'object' as const,
      properties: {
        startDate: {
          type: 'string' as const,
          format: 'date' as const,
          required: false
        },
        endDate: {
          type: 'string' as const,
          format: 'date' as const,
          required: false
        },
        state: CommonSchemas.workflowState,
        limit: {
          type: 'number' as const,
          min: 1,
          max: 1000,
          required: false
        },
        offset: {
          type: 'number' as const,
          min: 0,
          required: false
        }
      },
      required: false
    }
  }
};

/**
 * Request size limits (in bytes)
 */
export const REQUEST_SIZE_LIMITS = {
  small: 1024,        // 1KB - for simple requests
  medium: 10240,      // 10KB - for agent outputs
  large: 102400,      // 100KB - for audit exports
  xlarge: 1048576     // 1MB - maximum allowed
};

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  default: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // requests per window
  },
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20 // requests per window
  },
  governance: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10 // governance decisions per hour
  }
};