'use client';

/**
 * GovernanceApprovalCard Component
 * 
 * Displays the governance approval interface with:
 * - Recommended action display
 * - Blast radius summary (affected services count, risk level)
 * - Policy conflicts display
 * - Reversibility status
 * - Three color-coded approval buttons (Green/Yellow/Red)
 * - Required rationale input field with validation
 * - Decision maker and timestamp recording
 * 
 * Wired to backend API for governance decision submission (Task 16.1).
 * 
 * Requirements: 8.1 - Display governance approval card with recommended action, 
 *               blast radius, risk level, and policy conflicts
 * Requirements: 8.2 - Three approval buttons with color coding
 * Requirements: 8.3 - Required rationale input validation, decision maker and timestamp recording
 * Requirements: 13.3 - Wire governance decision submission to backend
 * 
 * Task 12.2: Implement governance approval card
 * Task 12.4: Add human decision validation and capture
 * Task 16.1: Wire governance decision submission to backend
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Network,
  RotateCcw,
  FileWarning,
  ChevronDown,
  ChevronUp,
  Loader2,
  User
} from 'lucide-react';
import { 
  GovernanceApprovalRequest, 
  GovernanceDecisionType, 
  GovernanceDecision,
  RiskLevel,
  BlastRadiusNode 
} from '@/types/workflow';
import type { DecisionMaker } from '@/hooks/useHumanDecision';
import { useWorkflow } from '@/context/WorkflowContext';

/**
 * Props for the GovernanceApprovalCard component
 */
export interface GovernanceApprovalCardProps {
  /** Governance approval request data */
  request: GovernanceApprovalRequest;
  /** Callback when a decision is made - now receives full GovernanceDecision */
  onDecision: (decision: GovernanceDecisionType, rationale: string, fullDecision?: GovernanceDecision) => void;
  /** Whether the component is in a loading/submitting state */
  isSubmitting?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Decision maker information - required for proper audit trail */
  decisionMaker?: DecisionMaker;
  /** Whether to submit to backend API (default: true when connected) */
  submitToBackend?: boolean;
}

/**
 * Risk level configuration for styling
 */
interface RiskLevelConfig {
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

const RISK_LEVEL_CONFIG: Record<RiskLevel, RiskLevelConfig> = {
  critical: {
    label: 'Critical',
    colorClass: 'text-status-error',
    bgClass: 'bg-status-error/20',
    borderClass: 'border-status-error/50',
    icon: XCircle
  },
  high: {
    label: 'High',
    colorClass: 'text-status-warning',
    bgClass: 'bg-status-warning/20',
    borderClass: 'border-status-warning/50',
    icon: AlertTriangle
  },
  medium: {
    label: 'Medium',
    colorClass: 'text-status-pending',
    bgClass: 'bg-status-pending/20',
    borderClass: 'border-status-pending/50',
    icon: AlertCircle
  },
  low: {
    label: 'Low',
    colorClass: 'text-status-success',
    bgClass: 'bg-status-success/20',
    borderClass: 'border-status-success/50',
    icon: CheckCircle2
  }
};

/**
 * Animation variants
 */
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const }
  }
};

const buttonVariants = {
  idle: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 }
};

const expandVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { 
    height: 'auto', 
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' as const }
  }
};


/**
 * RiskLevelBadge - Displays the risk level with appropriate styling
 */
function RiskLevelBadge({ level }: { level: RiskLevel }) {
  const config = RISK_LEVEL_CONFIG[level];
  const Icon = config.icon;

  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
      ${config.bgClass} ${config.colorClass} ${config.borderClass} border
    `}>
      <Icon className="w-3.5 h-3.5" />
      {config.label} Risk
    </span>
  );
}

/**
 * BlastRadiusSummary - Shows affected services count and health breakdown
 */
function BlastRadiusSummary({ 
  blastRadius, 
  expanded, 
  onToggle 
}: { 
  blastRadius: BlastRadiusNode[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const totalServices = blastRadius.length;
  const criticalCount = blastRadius.filter(n => n.healthStatus === 'critical').length;
  const warningCount = blastRadius.filter(n => n.healthStatus === 'warning').length;
  const healthyCount = blastRadius.filter(n => n.healthStatus === 'healthy').length;

  const highImpactCount = blastRadius.filter(n => n.impactLevel === 'high').length;

  return (
    <div className="rounded-lg border border-border bg-panel-secondary/50 overflow-hidden">
      {/* Summary Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-panel-secondary/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-agent-sre" />
          <span className="text-sm font-medium text-foreground">Blast Radius</span>
          <span className="text-xs text-muted bg-panel px-2 py-0.5 rounded-full">
            {totalServices} service{totalServices !== 1 ? 's' : ''} affected
          </span>
        </div>
        <div className="flex items-center gap-2">
          {highImpactCount > 0 && (
            <span className="text-xs text-status-error bg-status-error/20 px-2 py-0.5 rounded-full">
              {highImpactCount} high impact
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted" />
          )}
        </div>
      </button>

      {/* Health Status Summary */}
      <div className="px-3 pb-3 flex items-center gap-3">
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-status-error">
            <span className="w-2 h-2 rounded-full bg-status-error" />
            {criticalCount} critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-status-warning">
            <span className="w-2 h-2 rounded-full bg-status-warning" />
            {warningCount} warning
          </span>
        )}
        {healthyCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-status-success">
            <span className="w-2 h-2 rounded-full bg-status-success" />
            {healthyCount} healthy
          </span>
        )}
      </div>

      {/* Expanded Service List */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            variants={expandVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="border-t border-border"
          >
            <div className="p-3 space-y-2 max-h-40 overflow-y-auto">
              {blastRadius.map((node) => (
                <div 
                  key={node.serviceName}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      node.healthStatus === 'critical' ? 'bg-status-error' :
                      node.healthStatus === 'warning' ? 'bg-status-warning' :
                      'bg-status-success'
                    }`} />
                    <span className="text-foreground">{node.serviceName}</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    node.impactLevel === 'high' ? 'bg-status-error/20 text-status-error' :
                    node.impactLevel === 'medium' ? 'bg-status-warning/20 text-status-warning' :
                    'bg-status-success/20 text-status-success'
                  }`}>
                    {node.impactLevel} impact
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * PolicyConflicts - Displays any policy conflicts
 */
function PolicyConflicts({ conflicts }: { conflicts: string[] }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="rounded-lg border border-status-warning/50 bg-status-warning/10 p-3">
      <div className="flex items-center gap-2 mb-2">
        <FileWarning className="w-4 h-4 text-status-warning" />
        <span className="text-sm font-medium text-status-warning">Policy Conflicts</span>
      </div>
      <ul className="space-y-1.5">
        {conflicts.map((conflict, index) => (
          <li key={index} className="flex items-start gap-2 text-xs text-foreground/80">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-status-warning flex-shrink-0" />
            <span>{conflict}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ReversibilityIndicator - Shows whether the action is reversible
 */
function ReversibilityIndicator({ reversible }: { reversible: boolean }) {
  return (
    <div className={`
      flex items-center gap-2 px-3 py-2 rounded-lg border
      ${reversible 
        ? 'border-status-success/50 bg-status-success/10' 
        : 'border-status-error/50 bg-status-error/10'
      }
    `}>
      <RotateCcw className={`w-4 h-4 ${reversible ? 'text-status-success' : 'text-status-error'}`} />
      <span className={`text-sm ${reversible ? 'text-status-success' : 'text-status-error'}`}>
        {reversible ? 'Action is reversible' : 'Action is NOT reversible'}
      </span>
    </div>
  );
}


/**
 * RationaleInput - Required input field for decision rationale
 * Implements Requirements 8.3 - Required rationale input validation
 */
function RationaleInput({ 
  value, 
  onChange, 
  error,
  disabled,
  minLength = 10,
  maxLength = 2000
}: { 
  value: string; 
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  minLength?: number;
  maxLength?: number;
}) {
  const currentLength = value.trim().length;
  const isValid = currentLength >= minLength && currentLength <= maxLength;
  const showLengthWarning = currentLength > 0 && currentLength < minLength;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1 text-sm font-medium text-foreground">
          Decision Rationale
          <span className="text-status-error">*</span>
        </label>
        <span className={`text-xs ${
          showLengthWarning ? 'text-status-warning' : 
          isValid ? 'text-status-success' : 'text-muted'
        }`}>
          {currentLength}/{minLength} min
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Provide your rationale for this decision (minimum 10 characters)..."
        className={`
          w-full px-3 py-2 rounded-lg border bg-panel text-sm text-foreground
          placeholder:text-muted-foreground resize-none
          focus:outline-none focus:ring-2 focus:ring-accent/50
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-status-error' : 'border-border'}
        `}
        rows={3}
        maxLength={maxLength}
      />
      {error && (
        <p className="text-xs text-status-error flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
      {showLengthWarning && !error && (
        <p className="text-xs text-status-warning flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {minLength - currentLength} more characters required
        </p>
      )}
    </div>
  );
}

/**
 * DecisionMakerInfo - Displays the current decision maker information
 * Implements Requirements 8.3 - Decision maker recording
 */
function DecisionMakerInfo({ decisionMaker }: { decisionMaker: DecisionMaker }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 rounded-lg border border-border/50 bg-panel-secondary/30">
      <div className="flex items-center gap-2 min-w-0">
        <User className="w-4 h-4 text-muted flex-shrink-0" />
        <span className="text-xs text-muted whitespace-nowrap">Maker:</span>
        <span className="text-xs text-foreground font-medium truncate">{decisionMaker.id}</span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <Shield className="w-4 h-4 text-muted flex-shrink-0" />
        <span className="text-xs text-muted whitespace-nowrap">Role:</span>
        <span className="text-xs text-foreground font-medium capitalize truncate">{decisionMaker.role}</span>
      </div>
    </div>
  );
}

/**
 * RestrictionsInput - Input for adding restrictions when approving with restrictions
 */
function RestrictionsInput({
  restrictions,
  newRestriction,
  onNewRestrictionChange,
  onAddRestriction,
  onRemoveRestriction,
  showInput,
  onToggleInput,
  disabled
}: {
  restrictions: string[];
  newRestriction: string;
  onNewRestrictionChange: (value: string) => void;
  onAddRestriction: () => void;
  onRemoveRestriction: (index: number) => void;
  showInput: boolean;
  onToggleInput: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggleInput}
        className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
        disabled={disabled}
      >
        {showInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        <span>Add restrictions for conditional approval ({restrictions.length} added)</span>
      </button>
      
      <AnimatePresence>
        {showInput && (
          <motion.div
            variants={expandVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="space-y-2"
          >
            {/* Existing restrictions */}
            {restrictions.length > 0 && (
              <div className="space-y-1">
                {restrictions.map((restriction, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-2 px-2 py-1 rounded bg-status-warning/10 border border-status-warning/30"
                  >
                    <span className="text-xs text-foreground flex-1">{restriction}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveRestriction(index)}
                      className="text-status-error hover:text-status-error/80"
                      disabled={disabled}
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add new restriction */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newRestriction}
                onChange={(e) => onNewRestrictionChange(e.target.value)}
                placeholder="Enter a restriction..."
                className="flex-1 px-2 py-1 rounded border border-border bg-panel text-xs text-foreground
                  placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50
                  disabled:opacity-50"
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddRestriction();
                  }
                }}
              />
              <button
                type="button"
                onClick={onAddRestriction}
                disabled={disabled || !newRestriction.trim()}
                className="px-2 py-1 rounded bg-status-warning text-gray-900 text-xs font-medium
                  hover:bg-status-warning/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * ApprovalButton - Color-coded approval button
 */
interface ApprovalButtonProps {
  type: GovernanceDecisionType;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

function ApprovalButton({ type, onClick, disabled, isLoading }: ApprovalButtonProps) {
  const config = {
    approve: {
      label: 'Approve',
      icon: CheckCircle2,
      bgClass: 'bg-status-success hover:bg-status-success/90',
      textClass: 'text-white',
      borderClass: 'border-status-success'
    },
    approve_with_restrictions: {
      label: 'Restrict',
      icon: AlertTriangle,
      bgClass: 'bg-status-warning hover:bg-status-warning/90',
      textClass: 'text-gray-900',
      borderClass: 'border-status-warning'
    },
    block: {
      label: 'Block',
      icon: XCircle,
      bgClass: 'bg-status-error hover:bg-status-error/90',
      textClass: 'text-white',
      borderClass: 'border-status-error'
    }
  }[type];

  const Icon = config.icon;

  return (
    <motion.button
      variants={buttonVariants}
      initial="idle"
      whileHover={disabled ? 'idle' : 'hover'}
      whileTap={disabled ? 'idle' : 'tap'}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg
        font-medium text-xs border transition-colors min-w-0
        disabled:opacity-50 disabled:cursor-not-allowed
        ${config.bgClass} ${config.textClass} ${config.borderClass}
      `}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
      ) : (
        <Icon className="w-4 h-4 flex-shrink-0" />
      )}
      <span className="truncate">{config.label}</span>
    </motion.button>
  );
}

/**
 * GovernanceApprovalCard Component
 * 
 * Main component that displays the governance approval interface with
 * recommended action, blast radius, risk level, policy conflicts,
 * reversibility status, and three color-coded approval buttons.
 * 
 * Implements human decision validation and capture with:
 * - Required rationale input validation (min 10 characters)
 * - Decision maker and timestamp recording
 * - Full governance decision creation with audit metadata
 * - Backend API submission for governance decisions (Task 16.1)
 * 
 * Requirements: 8.1, 8.2, 8.3, 13.3
 */
export function GovernanceApprovalCard({ 
  request, 
  onDecision, 
  isSubmitting: externalIsSubmitting = false,
  className = '',
  decisionMaker = { id: 'current-user', role: 'operator' }, // Default decision maker
  submitToBackend = true
}: GovernanceApprovalCardProps) {
  const [rationale, setRationale] = useState('');
  const [rationaleError, setRationaleError] = useState<string | undefined>();
  const [blastRadiusExpanded, setBlastRadiusExpanded] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<GovernanceDecisionType | null>(null);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [showRestrictionsInput, setShowRestrictionsInput] = useState(false);
  const [newRestriction, setNewRestriction] = useState('');
  const [backendError, setBackendError] = useState<string | null>(null);

  // Get workflow context for backend submission
  const { 
    submitGovernanceDecisionToBackend, 
    governanceSubmission,
    isConnected,
    state: workflowState
  } = useWorkflow();

  // Combine external and internal submitting states
  const isSubmitting = externalIsSubmitting || governanceSubmission.isSubmitting;

  /**
   * Validate rationale input
   * Implements Requirements 8.3 - Required rationale input validation
   */
  const validateRationale = useCallback((value: string): { isValid: boolean; error?: string } => {
    const trimmed = value.trim();
    
    if (!trimmed) {
      return { isValid: false, error: 'Rationale is required before submitting a decision' };
    }
    
    if (trimmed.length < 10) {
      return { 
        isValid: false, 
        error: `Rationale must be at least 10 characters long (current: ${trimmed.length})` 
      };
    }
    
    if (trimmed.length > 2000) {
      return { 
        isValid: false, 
        error: `Rationale must not exceed 2000 characters (current: ${trimmed.length})` 
      };
    }
    
    return { isValid: true };
  }, []);

  /**
   * Create blast radius assessment from request data
   */
  const createBlastRadiusAssessment = useCallback(() => {
    return {
      affectedServices: request.blastRadius.map(node => node.serviceName),
      riskLevel: request.riskLevel,
      reversible: request.reversibility
    };
  }, [request]);

  /**
   * Handle decision submission with full validation and capture
   * Implements Requirements 8.3 - Decision maker and timestamp recording
   * Implements Requirements 13.3 - Wire governance decision submission to backend
   */
  const handleDecision = useCallback(async (decision: GovernanceDecisionType) => {
    // Step 1: Validate rationale
    const rationaleValidation = validateRationale(rationale);
    if (!rationaleValidation.isValid) {
      setRationaleError(rationaleValidation.error);
      return;
    }

    // Step 2: Validate restrictions for approve_with_restrictions
    if (decision === 'approve_with_restrictions' && restrictions.length === 0) {
      setRationaleError('At least one restriction is required when approving with restrictions');
      return;
    }

    // Step 3: Create full governance decision with timestamp and approver info
    const timestamp = new Date().toISOString();
    const fullDecision: GovernanceDecision = {
      decision,
      rationale: rationale.trim(),
      approver: {
        id: decisionMaker.id,
        role: decisionMaker.role
      },
      timestamp,
      restrictions: decision === 'approve_with_restrictions' ? restrictions : undefined,
      blastRadiusAssessment: createBlastRadiusAssessment()
    };

    // Step 4: Clear any previous errors
    setRationaleError(undefined);
    setBackendError(null);
    setSelectedDecision(decision);

    // Step 5: Submit to backend if connected and enabled
    if (submitToBackend && isConnected && workflowState.currentWorkflow) {
      const result = await submitGovernanceDecisionToBackend(
        decision,
        rationale.trim(),
        { id: decisionMaker.id, role: decisionMaker.role },
        decision === 'approve_with_restrictions' ? restrictions : undefined
      );

      if (!result.success) {
        setBackendError(result.error || 'Failed to submit governance decision');
        setSelectedDecision(null);
        return;
      }
    }

    // Step 6: Call the onDecision callback with full decision data
    onDecision(decision, rationale.trim(), fullDecision);
  }, [
    rationale, 
    restrictions, 
    decisionMaker, 
    validateRationale, 
    createBlastRadiusAssessment, 
    onDecision,
    submitToBackend,
    isConnected,
    workflowState.currentWorkflow,
    submitGovernanceDecisionToBackend
  ]);

  /**
   * Handle rationale change with live validation feedback
   */
  const handleRationaleChange = useCallback((value: string) => {
    setRationale(value);
    // Clear error when user starts typing valid content
    if (rationaleError && value.trim().length >= 10) {
      setRationaleError(undefined);
    }
  }, [rationaleError]);

  /**
   * Add a restriction
   */
  const handleAddRestriction = useCallback(() => {
    const trimmed = newRestriction.trim();
    if (trimmed && !restrictions.includes(trimmed)) {
      setRestrictions(prev => [...prev, trimmed]);
      setNewRestriction('');
    }
  }, [newRestriction, restrictions]);

  /**
   * Remove a restriction
   */
  const handleRemoveRestriction = useCallback((index: number) => {
    setRestrictions(prev => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Check if submission is allowed
   */
  const canSubmit = useMemo(() => {
    const rationaleValid = rationale.trim().length >= 10;
    return rationaleValid && !isSubmitting;
  }, [rationale, isSubmitting]);

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`
        rounded-lg border border-agent-governance/30 bg-agent-governance/5
        overflow-hidden ${className}
      `}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-agent-governance/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-agent-governance/20">
            <Shield className="w-4 h-4 text-agent-governance" />
          </div>
          <h3 className="text-sm font-semibold text-agent-governance">
            Governance Approval Required
          </h3>
        </div>
        <RiskLevelBadge level={request.riskLevel} />
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-4 overflow-hidden">
        {/* Recommended Action */}
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">Recommended Action</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {request.recommendedAction}
          </p>
        </div>

        {/* Blast Radius Summary */}
        <BlastRadiusSummary 
          blastRadius={request.blastRadius}
          expanded={blastRadiusExpanded}
          onToggle={() => setBlastRadiusExpanded(!blastRadiusExpanded)}
        />

        {/* Policy Conflicts */}
        <PolicyConflicts conflicts={request.policyConflicts} />

        {/* Reversibility Indicator */}
        <ReversibilityIndicator reversible={request.reversibility} />

        {/* Decision Maker Info Display */}
        <DecisionMakerInfo decisionMaker={decisionMaker} />

        {/* Rationale Input */}
        <RationaleInput
          value={rationale}
          onChange={handleRationaleChange}
          error={rationaleError}
          disabled={isSubmitting}
          minLength={10}
          maxLength={2000}
        />

        {/* Restrictions Input (for approve_with_restrictions) */}
        <RestrictionsInput
          restrictions={restrictions}
          newRestriction={newRestriction}
          onNewRestrictionChange={setNewRestriction}
          onAddRestriction={handleAddRestriction}
          onRemoveRestriction={handleRemoveRestriction}
          showInput={showRestrictionsInput}
          onToggleInput={() => setShowRestrictionsInput(!showRestrictionsInput)}
          disabled={isSubmitting}
        />

        {/* Backend Error Display */}
        {backendError && (
          <div className="rounded-lg border border-status-error/50 bg-status-error/10 p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-status-error flex-shrink-0" />
              <span className="text-sm text-status-error">{backendError}</span>
            </div>
          </div>
        )}

        {/* Connection Status Warning */}
        {!isConnected && submitToBackend && (
          <div className="rounded-lg border border-status-warning/50 bg-status-warning/10 p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-warning flex-shrink-0" />
              <span className="text-sm text-status-warning">
                Not connected to backend. Decision will be processed locally only.
              </span>
            </div>
          </div>
        )}

        {/* Approval Buttons */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted mb-3">
            Select your decision. Rationale is required (minimum 10 characters).
          </p>
          <div className="flex gap-2">
            <ApprovalButton
              type="approve"
              onClick={() => handleDecision('approve')}
              disabled={!canSubmit}
              isLoading={isSubmitting && selectedDecision === 'approve'}
            />
            <ApprovalButton
              type="approve_with_restrictions"
              onClick={() => handleDecision('approve_with_restrictions')}
              disabled={!canSubmit}
              isLoading={isSubmitting && selectedDecision === 'approve_with_restrictions'}
            />
            <ApprovalButton
              type="block"
              onClick={() => handleDecision('block')}
              disabled={!canSubmit}
              isLoading={isSubmitting && selectedDecision === 'block'}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default GovernanceApprovalCard;
