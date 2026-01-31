/**
 * SentinelFlow Human Decision Service
 * 
 * Implements human decision validation and capture for governance approval workflows.
 * This service ensures all human decisions are properly validated, recorded with
 * complete metadata, and integrated with the audit trail system.
 * 
 * ARCHITECTURAL CONSTRAINTS:
 * - All decisions require non-empty rationale
 * - Decision maker information (id, role) is mandatory
 * - Timestamps are recorded in ISO8601 format
 * - All decisions generate audit artifacts
 * - No decision can bypass validation
 * 
 * Validates Requirements 8.3 - Human decision validation and capture
 * Implements Property 22: Human Decision Validation
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  GovernanceDecision, 
  AuditEvent, 
  WorkflowState 
} from '../types/workflow';

/**
 * Decision maker information - required for all governance decisions
 */
export interface DecisionMaker {
  id: string;
  role: string;
  name?: string;
  department?: string;
}

/**
 * Human decision input - raw input from the approval interface
 */
export interface HumanDecisionInput {
  decision: 'approve' | 'approve_with_restrictions' | 'block';
  rationale: string;
  decisionMaker: DecisionMaker;
  restrictions?: string[];
  blastRadiusAssessment: {
    affectedServices: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reversible: boolean;
  };
}

/**
 * Validation result for human decision input
 */
export interface DecisionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedAt: string;
}

/**
 * Captured human decision with full metadata
 */
export interface CapturedHumanDecision {
  decisionId: string;
  workflowId: string;
  governanceDecision: GovernanceDecision;
  capturedAt: string;
  validationResult: DecisionValidationResult;
  metadata: {
    inputSource: 'ui' | 'api' | 'cli';
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

/**
 * Decision submission result
 */
export interface DecisionSubmissionResult {
  success: boolean;
  decisionId?: string;
  governanceDecision?: GovernanceDecision;
  validationResult: DecisionValidationResult;
  auditEventId?: string;
  workflowTerminated?: boolean;
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  minRationaleLength: number;
  maxRationaleLength: number;
  requireDecisionMakerId: boolean;
  requireDecisionMakerRole: boolean;
  allowedRoles: string[];
  requireRestrictionsForConditionalApproval: boolean;
}

const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  minRationaleLength: 10,
  maxRationaleLength: 2000,
  requireDecisionMakerId: true,
  requireDecisionMakerRole: true,
  allowedRoles: ['admin', 'sre', 'security', 'governance', 'manager', 'engineer', 'operator'],
  requireRestrictionsForConditionalApproval: true
};

/**
 * Human Decision Service - Validates and captures human governance decisions
 * Implements mandatory validation and audit trail integration
 */
export class HumanDecisionService extends EventEmitter {
  private capturedDecisions: Map<string, CapturedHumanDecision> = new Map();
  private decisionsByWorkflow: Map<string, string[]> = new Map();
  private validationConfig: ValidationConfig;

  constructor(config?: Partial<ValidationConfig>) {
    super();
    this.validationConfig = { ...DEFAULT_VALIDATION_CONFIG, ...config };
  }

  /**
   * Validate human decision input
   * Implements Requirements 8.3 - Required rationale input validation
   * 
   * @param input - The human decision input to validate
   * @returns Validation result with errors and warnings
   */
  validateDecisionInput(input: HumanDecisionInput): DecisionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedAt = new Date().toISOString();

    // 1. Validate decision type
    const validDecisionTypes = ['approve', 'approve_with_restrictions', 'block'];
    if (!input.decision || !validDecisionTypes.includes(input.decision)) {
      errors.push(`Invalid decision type. Must be one of: ${validDecisionTypes.join(', ')}`);
    }

    // 2. Validate rationale - REQUIRED and non-empty
    if (!input.rationale) {
      errors.push('Rationale is required for all governance decisions');
    } else if (typeof input.rationale !== 'string') {
      errors.push('Rationale must be a string');
    } else {
      const trimmedRationale = input.rationale.trim();
      
      if (trimmedRationale.length === 0) {
        errors.push('Rationale cannot be empty or whitespace only');
      } else if (trimmedRationale.length < this.validationConfig.minRationaleLength) {
        errors.push(
          `Rationale must be at least ${this.validationConfig.minRationaleLength} characters long. ` +
          `Current length: ${trimmedRationale.length}`
        );
      } else if (trimmedRationale.length > this.validationConfig.maxRationaleLength) {
        errors.push(
          `Rationale must not exceed ${this.validationConfig.maxRationaleLength} characters. ` +
          `Current length: ${trimmedRationale.length}`
        );
      }
    }

    // 3. Validate decision maker information - REQUIRED
    if (!input.decisionMaker) {
      errors.push('Decision maker information is required');
    } else {
      // Validate decision maker ID
      if (this.validationConfig.requireDecisionMakerId) {
        if (!input.decisionMaker.id) {
          errors.push('Decision maker ID is required');
        } else if (typeof input.decisionMaker.id !== 'string' || input.decisionMaker.id.trim().length === 0) {
          errors.push('Decision maker ID must be a non-empty string');
        }
      }

      // Validate decision maker role
      if (this.validationConfig.requireDecisionMakerRole) {
        if (!input.decisionMaker.role) {
          errors.push('Decision maker role is required');
        } else if (typeof input.decisionMaker.role !== 'string' || input.decisionMaker.role.trim().length === 0) {
          errors.push('Decision maker role must be a non-empty string');
        } else if (
          this.validationConfig.allowedRoles.length > 0 &&
          !this.validationConfig.allowedRoles.includes(input.decisionMaker.role.toLowerCase())
        ) {
          warnings.push(
            `Decision maker role '${input.decisionMaker.role}' is not in the standard roles list. ` +
            `Standard roles: ${this.validationConfig.allowedRoles.join(', ')}`
          );
        }
      }
    }

    // 4. Validate restrictions for approve_with_restrictions
    if (input.decision === 'approve_with_restrictions') {
      if (this.validationConfig.requireRestrictionsForConditionalApproval) {
        if (!input.restrictions || !Array.isArray(input.restrictions) || input.restrictions.length === 0) {
          errors.push('Restrictions are required when approving with restrictions');
        } else {
          // Validate each restriction is non-empty
          const emptyRestrictions = input.restrictions.filter(r => !r || r.trim().length === 0);
          if (emptyRestrictions.length > 0) {
            errors.push('All restrictions must be non-empty strings');
          }
        }
      }
    }

    // 5. Validate blast radius assessment
    if (!input.blastRadiusAssessment) {
      errors.push('Blast radius assessment is required');
    } else {
      if (!Array.isArray(input.blastRadiusAssessment.affectedServices)) {
        errors.push('Blast radius affected services must be an array');
      }
      
      const validRiskLevels = ['low', 'medium', 'high', 'critical'];
      if (!validRiskLevels.includes(input.blastRadiusAssessment.riskLevel)) {
        errors.push(`Invalid risk level. Must be one of: ${validRiskLevels.join(', ')}`);
      }
      
      if (typeof input.blastRadiusAssessment.reversible !== 'boolean') {
        errors.push('Blast radius reversibility must be a boolean');
      }
    }

    // 6. Add warnings for high-risk decisions
    if (input.decision === 'approve' && input.blastRadiusAssessment?.riskLevel === 'critical') {
      warnings.push('Approving a critical risk action - ensure thorough review has been completed');
    }

    if (input.decision === 'approve' && input.blastRadiusAssessment?.reversible === false) {
      warnings.push('Approving an irreversible action - this cannot be undone');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedAt
    };
  }

  /**
   * Capture and record a human governance decision
   * Implements Requirements 8.3 - Decision maker and timestamp recording
   * 
   * @param workflowId - The workflow ID this decision applies to
   * @param input - The validated human decision input
   * @param metadata - Optional metadata about the decision source
   * @returns The captured decision with full metadata
   */
  captureDecision(
    workflowId: string,
    input: HumanDecisionInput,
    metadata?: {
      inputSource?: 'ui' | 'api' | 'cli';
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): CapturedHumanDecision {
    // Validate input first
    const validationResult = this.validateDecisionInput(input);
    
    if (!validationResult.isValid) {
      throw new Error(
        `Cannot capture invalid decision: ${validationResult.errors.join('; ')}`
      );
    }

    const decisionId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create the governance decision with complete metadata
    const governanceDecision: GovernanceDecision = {
      decision: input.decision,
      rationale: input.rationale.trim(),
      approver: {
        id: input.decisionMaker.id.trim(),
        role: input.decisionMaker.role.trim()
      },
      timestamp,
      restrictions: input.restrictions?.map(r => r.trim()).filter(r => r.length > 0),
      blastRadiusAssessment: {
        affectedServices: input.blastRadiusAssessment.affectedServices,
        riskLevel: input.blastRadiusAssessment.riskLevel,
        reversible: input.blastRadiusAssessment.reversible
      }
    };

    // Create captured decision record
    const capturedDecision: CapturedHumanDecision = {
      decisionId,
      workflowId,
      governanceDecision,
      capturedAt: timestamp,
      validationResult,
      metadata: {
        inputSource: metadata?.inputSource || 'ui',
        sessionId: metadata?.sessionId,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent
      }
    };

    // Store the captured decision
    this.capturedDecisions.set(decisionId, capturedDecision);

    // Track decisions by workflow
    const workflowDecisions = this.decisionsByWorkflow.get(workflowId) || [];
    workflowDecisions.push(decisionId);
    this.decisionsByWorkflow.set(workflowId, workflowDecisions);

    // Emit decision captured event
    this.emit('decisionCaptured', {
      type: 'decision_captured',
      decisionId,
      workflowId,
      timestamp,
      decision: governanceDecision.decision
    });

    return capturedDecision;
  }

  /**
   * Submit a governance decision with full validation and audit trail integration
   * This is the main entry point for processing human approval decisions
   * 
   * @param workflowId - The workflow ID
   * @param input - The human decision input
   * @param metadata - Optional metadata
   * @returns Submission result with validation status and audit event ID
   */
  async submitDecision(
    workflowId: string,
    input: HumanDecisionInput,
    metadata?: {
      inputSource?: 'ui' | 'api' | 'cli';
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<DecisionSubmissionResult> {
    // Step 1: Validate the input
    const validationResult = this.validateDecisionInput(input);

    if (!validationResult.isValid) {
      return {
        success: false,
        validationResult
      };
    }

    // Step 2: Capture the decision
    let capturedDecision: CapturedHumanDecision;
    try {
      capturedDecision = this.captureDecision(workflowId, input, metadata);
    } catch (error) {
      return {
        success: false,
        validationResult: {
          ...validationResult,
          isValid: false,
          errors: [...validationResult.errors, `Failed to capture decision: ${error}`]
        }
      };
    }

    // Step 3: Generate audit event for the decision
    const auditEvent = this.generateAuditEvent(workflowId, capturedDecision);

    // Step 4: Emit submission event for integration with workflow
    this.emit('decisionSubmitted', {
      type: 'decision_submitted',
      decisionId: capturedDecision.decisionId,
      workflowId,
      timestamp: capturedDecision.capturedAt,
      governanceDecision: capturedDecision.governanceDecision,
      auditEventId: auditEvent.eventId
    });

    // Step 5: Determine if workflow should be terminated (block decision)
    const workflowTerminated = input.decision === 'block';

    if (workflowTerminated) {
      this.emit('workflowBlocked', {
        type: 'workflow_blocked',
        workflowId,
        decisionId: capturedDecision.decisionId,
        rationale: input.rationale,
        timestamp: capturedDecision.capturedAt
      });
    }

    return {
      success: true,
      decisionId: capturedDecision.decisionId,
      governanceDecision: capturedDecision.governanceDecision,
      validationResult,
      auditEventId: auditEvent.eventId,
      workflowTerminated
    };
  }

  /**
   * Generate audit event for a captured decision
   * Implements audit trail integration
   */
  private generateAuditEvent(
    workflowId: string,
    capturedDecision: CapturedHumanDecision
  ): AuditEvent {
    const auditEvent: AuditEvent = {
      eventId: uuidv4(),
      workflowId,
      eventType: 'governance_decision',
      timestamp: capturedDecision.capturedAt,
      actor: 'human',
      details: {
        governanceDecision: capturedDecision.governanceDecision
      },
      immutable: true
    };

    // Emit audit event for integration with AuditArtifactService
    this.emit('auditEventGenerated', auditEvent);

    return auditEvent;
  }

  /**
   * Get a captured decision by ID
   */
  getDecision(decisionId: string): CapturedHumanDecision | undefined {
    return this.capturedDecisions.get(decisionId);
  }

  /**
   * Get all decisions for a workflow
   */
  getDecisionsByWorkflow(workflowId: string): CapturedHumanDecision[] {
    const decisionIds = this.decisionsByWorkflow.get(workflowId) || [];
    return decisionIds
      .map(id => this.capturedDecisions.get(id))
      .filter((d): d is CapturedHumanDecision => d !== undefined);
  }

  /**
   * Get decision statistics
   */
  getDecisionStats(): {
    totalDecisions: number;
    approvedCount: number;
    approvedWithRestrictionsCount: number;
    blockedCount: number;
    averageRationaleLength: number;
  } {
    const decisions = Array.from(this.capturedDecisions.values());
    
    const approvedCount = decisions.filter(
      d => d.governanceDecision.decision === 'approve'
    ).length;
    
    const approvedWithRestrictionsCount = decisions.filter(
      d => d.governanceDecision.decision === 'approve_with_restrictions'
    ).length;
    
    const blockedCount = decisions.filter(
      d => d.governanceDecision.decision === 'block'
    ).length;

    const totalRationaleLength = decisions.reduce(
      (sum, d) => sum + d.governanceDecision.rationale.length, 
      0
    );

    return {
      totalDecisions: decisions.length,
      approvedCount,
      approvedWithRestrictionsCount,
      blockedCount,
      averageRationaleLength: decisions.length > 0 
        ? Math.round(totalRationaleLength / decisions.length) 
        : 0
    };
  }

  /**
   * Clear all captured decisions (for testing purposes)
   */
  clearDecisions(): void {
    this.capturedDecisions.clear();
    this.decisionsByWorkflow.clear();
  }

  /**
   * Update validation configuration
   */
  updateValidationConfig(config: Partial<ValidationConfig>): void {
    this.validationConfig = { ...this.validationConfig, ...config };
  }

  /**
   * Get current validation configuration
   */
  getValidationConfig(): ValidationConfig {
    return { ...this.validationConfig };
  }
}

/**
 * Factory function to create HumanDecisionService with default configuration
 */
export function createHumanDecisionService(
  config?: Partial<ValidationConfig>
): HumanDecisionService {
  return new HumanDecisionService(config);
}

/**
 * Utility function to validate decision input without creating a service instance
 */
export function validateHumanDecisionInput(
  input: HumanDecisionInput,
  config?: Partial<ValidationConfig>
): DecisionValidationResult {
  const service = new HumanDecisionService(config);
  return service.validateDecisionInput(input);
}

/**
 * Type guard to check if a decision is valid
 */
export function isValidDecisionInput(input: unknown): input is HumanDecisionInput {
  if (!input || typeof input !== 'object') return false;
  
  const obj = input as Record<string, unknown>;
  
  return (
    typeof obj.decision === 'string' &&
    ['approve', 'approve_with_restrictions', 'block'].includes(obj.decision) &&
    typeof obj.rationale === 'string' &&
    obj.decisionMaker !== null &&
    typeof obj.decisionMaker === 'object' &&
    obj.blastRadiusAssessment !== null &&
    typeof obj.blastRadiusAssessment === 'object'
  );
}
