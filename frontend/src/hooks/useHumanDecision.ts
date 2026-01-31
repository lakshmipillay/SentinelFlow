/**
 * useHumanDecision Hook
 * 
 * React hook for handling human governance decision validation and submission.
 * Provides client-side validation matching the backend HumanDecisionService
 * and handles decision submission with proper error handling.
 * 
 * Requirements: 8.3 - Human decision validation and capture
 * Implements Property 22: Human Decision Validation
 */

import { useState, useCallback, useMemo } from 'react';
import { 
  GovernanceDecision, 
  GovernanceDecisionType, 
  RiskLevel 
} from '@/types/workflow';

/**
 * Decision maker information
 */
export interface DecisionMaker {
  id: string;
  role: string;
  name?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Decision input for validation
 */
export interface DecisionInput {
  decision: GovernanceDecisionType;
  rationale: string;
  decisionMaker: DecisionMaker;
  restrictions?: string[];
  blastRadiusAssessment: {
    affectedServices: string[];
    riskLevel: RiskLevel;
    reversible: boolean;
  };
}

/**
 * Submission result
 */
export interface SubmissionResult {
  success: boolean;
  decisionId?: string;
  governanceDecision?: GovernanceDecision;
  validationResult: ValidationResult;
  workflowTerminated?: boolean;
  error?: string;
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  minRationaleLength: number;
  maxRationaleLength: number;
  requireRestrictionsForConditionalApproval: boolean;
}

const DEFAULT_CONFIG: ValidationConfig = {
  minRationaleLength: 10,
  maxRationaleLength: 2000,
  requireRestrictionsForConditionalApproval: true
};

/**
 * Validate decision input
 * Matches backend HumanDecisionService validation logic
 */
export function validateDecisionInput(
  input: Partial<DecisionInput>,
  config: ValidationConfig = DEFAULT_CONFIG
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate decision type
  const validDecisionTypes: GovernanceDecisionType[] = ['approve', 'approve_with_restrictions', 'block'];
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
    } else if (trimmedRationale.length < config.minRationaleLength) {
      errors.push(
        `Rationale must be at least ${config.minRationaleLength} characters long. ` +
        `Current length: ${trimmedRationale.length}`
      );
    } else if (trimmedRationale.length > config.maxRationaleLength) {
      errors.push(
        `Rationale must not exceed ${config.maxRationaleLength} characters. ` +
        `Current length: ${trimmedRationale.length}`
      );
    }
  }

  // 3. Validate decision maker information - REQUIRED
  if (!input.decisionMaker) {
    errors.push('Decision maker information is required');
  } else {
    if (!input.decisionMaker.id || input.decisionMaker.id.trim().length === 0) {
      errors.push('Decision maker ID is required');
    }
    if (!input.decisionMaker.role || input.decisionMaker.role.trim().length === 0) {
      errors.push('Decision maker role is required');
    }
  }

  // 4. Validate restrictions for approve_with_restrictions
  if (input.decision === 'approve_with_restrictions') {
    if (config.requireRestrictionsForConditionalApproval) {
      if (!input.restrictions || !Array.isArray(input.restrictions) || input.restrictions.length === 0) {
        errors.push('Restrictions are required when approving with restrictions');
      } else {
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
    
    const validRiskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
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
    warnings
  };
}

/**
 * Create a governance decision object with timestamp
 */
export function createGovernanceDecision(
  input: DecisionInput
): GovernanceDecision {
  return {
    decision: input.decision,
    rationale: input.rationale.trim(),
    approver: {
      id: input.decisionMaker.id.trim(),
      role: input.decisionMaker.role.trim()
    },
    timestamp: new Date().toISOString(),
    restrictions: input.restrictions?.map(r => r.trim()).filter(r => r.length > 0),
    blastRadiusAssessment: {
      affectedServices: input.blastRadiusAssessment.affectedServices,
      riskLevel: input.blastRadiusAssessment.riskLevel,
      reversible: input.blastRadiusAssessment.reversible
    }
  };
}

/**
 * Hook state interface
 */
interface UseHumanDecisionState {
  rationale: string;
  restrictions: string[];
  validationResult: ValidationResult | null;
  isSubmitting: boolean;
  submissionResult: SubmissionResult | null;
  error: string | null;
}

/**
 * Hook return interface
 */
interface UseHumanDecisionReturn {
  // State
  rationale: string;
  restrictions: string[];
  validationResult: ValidationResult | null;
  isSubmitting: boolean;
  submissionResult: SubmissionResult | null;
  error: string | null;
  
  // Actions
  setRationale: (rationale: string) => void;
  setRestrictions: (restrictions: string[]) => void;
  addRestriction: (restriction: string) => void;
  removeRestriction: (index: number) => void;
  validateInput: (decision: GovernanceDecisionType) => ValidationResult;
  submitDecision: (
    decision: GovernanceDecisionType,
    decisionMaker: DecisionMaker,
    blastRadiusAssessment: DecisionInput['blastRadiusAssessment']
  ) => Promise<SubmissionResult>;
  reset: () => void;
  
  // Computed
  isRationaleValid: boolean;
  rationaleError: string | null;
  canSubmit: boolean;
}

/**
 * useHumanDecision Hook
 * 
 * Manages human decision state, validation, and submission for governance approvals.
 * 
 * @param config - Optional validation configuration
 * @param onDecisionSubmitted - Optional callback when decision is submitted
 * @returns Hook state and actions
 */
export function useHumanDecision(
  config: Partial<ValidationConfig> = {},
  onDecisionSubmitted?: (decision: GovernanceDecision) => void
): UseHumanDecisionReturn {
  const validationConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  );

  const [state, setState] = useState<UseHumanDecisionState>({
    rationale: '',
    restrictions: [],
    validationResult: null,
    isSubmitting: false,
    submissionResult: null,
    error: null
  });

  // Set rationale
  const setRationale = useCallback((rationale: string) => {
    setState(prev => ({
      ...prev,
      rationale,
      validationResult: null, // Clear validation on change
      error: null
    }));
  }, []);

  // Set restrictions
  const setRestrictions = useCallback((restrictions: string[]) => {
    setState(prev => ({
      ...prev,
      restrictions,
      validationResult: null,
      error: null
    }));
  }, []);

  // Add restriction
  const addRestriction = useCallback((restriction: string) => {
    setState(prev => ({
      ...prev,
      restrictions: [...prev.restrictions, restriction],
      validationResult: null,
      error: null
    }));
  }, []);

  // Remove restriction
  const removeRestriction = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      restrictions: prev.restrictions.filter((_, i) => i !== index),
      validationResult: null,
      error: null
    }));
  }, []);

  // Validate input
  const validateInput = useCallback(
    (decision: GovernanceDecisionType): ValidationResult => {
      // Create a minimal input for validation
      const input: Partial<DecisionInput> = {
        decision,
        rationale: state.rationale,
        restrictions: state.restrictions,
        decisionMaker: { id: 'temp', role: 'temp' }, // Will be provided at submission
        blastRadiusAssessment: {
          affectedServices: [],
          riskLevel: 'low',
          reversible: true
        }
      };

      const result = validateDecisionInput(input, validationConfig);
      
      // Filter out decision maker errors for pre-submission validation
      const filteredErrors = result.errors.filter(
        e => !e.includes('Decision maker') && !e.includes('Blast radius')
      );

      const filteredResult = {
        ...result,
        errors: filteredErrors,
        isValid: filteredErrors.length === 0
      };

      setState(prev => ({ ...prev, validationResult: filteredResult }));
      return filteredResult;
    },
    [state.rationale, state.restrictions, validationConfig]
  );

  // Submit decision
  const submitDecision = useCallback(
    async (
      decision: GovernanceDecisionType,
      decisionMaker: DecisionMaker,
      blastRadiusAssessment: DecisionInput['blastRadiusAssessment']
    ): Promise<SubmissionResult> => {
      setState(prev => ({ ...prev, isSubmitting: true, error: null }));

      try {
        // Build complete input
        const input: DecisionInput = {
          decision,
          rationale: state.rationale,
          decisionMaker,
          restrictions: decision === 'approve_with_restrictions' ? state.restrictions : undefined,
          blastRadiusAssessment
        };

        // Validate
        const validationResult = validateDecisionInput(input, validationConfig);

        if (!validationResult.isValid) {
          const result: SubmissionResult = {
            success: false,
            validationResult
          };
          setState(prev => ({
            ...prev,
            isSubmitting: false,
            validationResult,
            submissionResult: result
          }));
          return result;
        }

        // Create governance decision
        const governanceDecision = createGovernanceDecision(input);

        // Generate decision ID (in real implementation, this would come from backend)
        const decisionId = `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const result: SubmissionResult = {
          success: true,
          decisionId,
          governanceDecision,
          validationResult,
          workflowTerminated: decision === 'block'
        };

        setState(prev => ({
          ...prev,
          isSubmitting: false,
          validationResult,
          submissionResult: result
        }));

        // Call callback if provided
        if (onDecisionSubmitted) {
          onDecisionSubmitted(governanceDecision);
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const result: SubmissionResult = {
          success: false,
          validationResult: {
            isValid: false,
            errors: [errorMessage],
            warnings: []
          },
          error: errorMessage
        };

        setState(prev => ({
          ...prev,
          isSubmitting: false,
          error: errorMessage,
          submissionResult: result
        }));

        return result;
      }
    },
    [state.rationale, state.restrictions, validationConfig, onDecisionSubmitted]
  );

  // Reset state
  const reset = useCallback(() => {
    setState({
      rationale: '',
      restrictions: [],
      validationResult: null,
      isSubmitting: false,
      submissionResult: null,
      error: null
    });
  }, []);

  // Computed: is rationale valid
  const isRationaleValid = useMemo(() => {
    const trimmed = state.rationale.trim();
    return trimmed.length >= validationConfig.minRationaleLength;
  }, [state.rationale, validationConfig.minRationaleLength]);

  // Computed: rationale error
  const rationaleError = useMemo(() => {
    const trimmed = state.rationale.trim();
    if (trimmed.length === 0) {
      return null; // Don't show error for empty field until submission
    }
    if (trimmed.length < validationConfig.minRationaleLength) {
      return `Rationale must be at least ${validationConfig.minRationaleLength} characters`;
    }
    if (trimmed.length > validationConfig.maxRationaleLength) {
      return `Rationale must not exceed ${validationConfig.maxRationaleLength} characters`;
    }
    return null;
  }, [state.rationale, validationConfig]);

  // Computed: can submit
  const canSubmit = useMemo(() => {
    return isRationaleValid && !state.isSubmitting;
  }, [isRationaleValid, state.isSubmitting]);

  return {
    // State
    rationale: state.rationale,
    restrictions: state.restrictions,
    validationResult: state.validationResult,
    isSubmitting: state.isSubmitting,
    submissionResult: state.submissionResult,
    error: state.error,
    
    // Actions
    setRationale,
    setRestrictions,
    addRestriction,
    removeRestriction,
    validateInput,
    submitDecision,
    reset,
    
    // Computed
    isRationaleValid,
    rationaleError,
    canSubmit
  };
}

export default useHumanDecision;
