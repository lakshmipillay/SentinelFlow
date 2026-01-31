'use client';

/**
 * WorkflowStepTracker Component
 * 
 * Displays an animated horizontal progress indicator showing all 9 workflow states.
 * Uses Framer Motion for smooth state transition animations.
 * 
 * Requirements: 6.2 - Framer Motion animations for smooth visual feedback
 * Requirements: 6.3 - Visual indicators for workflow stages and transitions
 * 
 * Task 11.1: Create animated workflow step tracker
 * - Implement horizontal progress indicator with 9 workflow states
 * - Add Framer Motion animations for state transitions
 * - Create visual indicators for current workflow stage
 * 
 * Workflow States (in order):
 * 1. IDLE
 * 2. INCIDENT_INGESTED
 * 3. ANALYZING
 * 4. RCA_COMPLETE
 * 5. GOVERNANCE_PENDING
 * 6. ACTION_PROPOSED
 * 7. VERIFIED
 * 8. RESOLVED
 * 9. TERMINATED
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Circle, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  FileCheck, 
  Shield, 
  Zap, 
  CheckSquare, 
  XCircle 
} from 'lucide-react';
import { WorkflowState } from '@/types/workflow';

/**
 * Props for the WorkflowStepTracker component
 */
export interface WorkflowStepTrackerProps {
  /** Current workflow state */
  currentState: WorkflowState;
  /** Optional CSS class name for additional styling */
  className?: string;
  /** Whether to show compact view (icons only) */
  compact?: boolean;
}

/**
 * Configuration for each workflow step
 */
interface StepConfig {
  state: WorkflowState;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

/**
 * Ordered list of workflow steps with their configurations
 */
const WORKFLOW_STEPS: StepConfig[] = [
  {
    state: WorkflowState.IDLE,
    label: 'Idle',
    shortLabel: 'IDLE',
    icon: Circle,
    description: 'System ready for incident'
  },
  {
    state: WorkflowState.INCIDENT_INGESTED,
    label: 'Ingested',
    shortLabel: 'INGEST',
    icon: AlertCircle,
    description: 'Incident received and validated'
  },
  {
    state: WorkflowState.ANALYZING,
    label: 'Analyzing',
    shortLabel: 'ANALYZE',
    icon: Search,
    description: 'Agents performing analysis'
  },
  {
    state: WorkflowState.RCA_COMPLETE,
    label: 'RCA Complete',
    shortLabel: 'RCA',
    icon: FileCheck,
    description: 'Root cause analysis complete'
  },
  {
    state: WorkflowState.GOVERNANCE_PENDING,
    label: 'Governance',
    shortLabel: 'GOV',
    icon: Shield,
    description: 'Awaiting human approval'
  },
  {
    state: WorkflowState.ACTION_PROPOSED,
    label: 'Proposed',
    shortLabel: 'ACTION',
    icon: Zap,
    description: 'Remediation action proposed'
  },
  {
    state: WorkflowState.VERIFIED,
    label: 'Verified',
    shortLabel: 'VERIFY',
    icon: CheckSquare,
    description: 'Action verified successfully'
  },
  {
    state: WorkflowState.RESOLVED,
    label: 'Resolved',
    shortLabel: 'DONE',
    icon: CheckCircle2,
    description: 'Incident resolved'
  },
  {
    state: WorkflowState.TERMINATED,
    label: 'Terminated',
    shortLabel: 'END',
    icon: XCircle,
    description: 'Workflow terminated'
  }
];

/**
 * Get the index of a workflow state in the ordered list
 */
function getStateIndex(state: WorkflowState): number {
  return WORKFLOW_STEPS.findIndex(step => step.state === state);
}

/**
 * Determine the status of a step relative to the current state
 */
type StepStatus = 'completed' | 'current' | 'pending';

function getStepStatus(stepState: WorkflowState, currentState: WorkflowState): StepStatus {
  const stepIndex = getStateIndex(stepState);
  const currentIndex = getStateIndex(currentState);
  
  if (stepIndex < currentIndex) {
    return 'completed';
  } else if (stepIndex === currentIndex) {
    return 'current';
  } else {
    return 'pending';
  }
}

/**
 * Get the color classes for a step based on its status
 */
function getStepColors(status: StepStatus, stepState: WorkflowState): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} {
  // Special handling for TERMINATED state
  if (stepState === WorkflowState.TERMINATED && status === 'current') {
    return {
      bg: 'bg-status-error/20',
      border: 'border-status-error',
      text: 'text-status-error',
      icon: 'text-status-error'
    };
  }
  
  // Special handling for GOVERNANCE_PENDING state
  if (stepState === WorkflowState.GOVERNANCE_PENDING && status === 'current') {
    return {
      bg: 'bg-status-pending/20',
      border: 'border-status-pending',
      text: 'text-status-pending',
      icon: 'text-status-pending'
    };
  }
  
  switch (status) {
    case 'completed':
      return {
        bg: 'bg-status-success/20',
        border: 'border-status-success',
        text: 'text-status-success',
        icon: 'text-status-success'
      };
    case 'current':
      return {
        bg: 'bg-status-analyzing/20',
        border: 'border-status-analyzing',
        text: 'text-status-analyzing',
        icon: 'text-status-analyzing'
      };
    case 'pending':
    default:
      return {
        bg: 'bg-panel-secondary',
        border: 'border-border',
        text: 'text-muted-foreground',
        icon: 'text-muted-foreground'
      };
  }
}

/**
 * Animation variants for step icons
 */
const iconVariants = {
  completed: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' as const }
  },
  current: {
    scale: [1, 1.1, 1],
    opacity: 1,
    transition: { 
      scale: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const },
      opacity: { duration: 0.3 }
    }
  },
  pending: {
    scale: 1,
    opacity: 0.5,
    transition: { duration: 0.3 }
  }
};

/**
 * Animation variants for the progress line
 */
const lineVariants = {
  completed: {
    scaleX: 1,
    backgroundColor: 'var(--status-success)',
    transition: { duration: 0.4, ease: 'easeOut' as const }
  },
  pending: {
    scaleX: 1,
    backgroundColor: 'var(--border)',
    transition: { duration: 0.3 }
  }
};

/**
 * Animation variants for step labels
 */
const labelVariants = {
  completed: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 }
  },
  current: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 }
  },
  pending: {
    opacity: 0.5,
    y: 0,
    transition: { duration: 0.3 }
  }
};

/**
 * Pulsing animation for current step indicator
 */
const pulseVariants = {
  animate: {
    scale: [1, 1.5, 1],
    opacity: [0.5, 0, 0.5],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut' as const
    }
  }
};

/**
 * Individual Step Component
 */
interface StepProps {
  step: StepConfig;
  status: StepStatus;
  isLast: boolean;
  compact?: boolean;
}

function Step({ step, status, isLast, compact = false }: StepProps) {
  const colors = getStepColors(status, step.state);
  const Icon = step.icon;
  
  return (
    <div className="flex items-center flex-1 min-w-0">
      {/* Step Circle with Icon */}
      <div className="relative flex flex-col items-center">
        {/* Pulse ring for current step */}
        {status === 'current' && (
          <motion.div
            className={`absolute inset-0 rounded-full ${colors.border} border-2`}
            variants={pulseVariants}
            animate="animate"
            style={{ 
              width: compact ? '28px' : '36px', 
              height: compact ? '28px' : '36px',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />
        )}
        
        {/* Step Icon Container */}
        <motion.div
          className={`relative z-10 flex items-center justify-center rounded-full border-2 ${colors.bg} ${colors.border} ${
            compact ? 'w-7 h-7' : 'w-9 h-9'
          }`}
          variants={iconVariants}
          animate={status}
          initial={false}
        >
          <AnimatePresence mode="wait">
            {status === 'completed' ? (
              <motion.div
                key="check"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <CheckCircle2 className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${colors.icon}`} />
              </motion.div>
            ) : (
              <motion.div
                key="icon"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Icon className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${colors.icon}`} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        
        {/* Step Label */}
        {!compact && (
          <motion.div
            className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
            variants={labelVariants}
            animate={status}
            initial={false}
          >
            <span className={`text-xs font-medium ${colors.text}`}>
              {step.shortLabel}
            </span>
          </motion.div>
        )}
      </div>
      
      {/* Connecting Line */}
      {!isLast && (
        <div className="flex-1 h-0.5 mx-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-border" />
          <motion.div
            className="absolute inset-0 origin-left"
            variants={lineVariants}
            animate={status === 'completed' ? 'completed' : 'pending'}
            initial={false}
          />
        </div>
      )}
    </div>
  );
}

/**
 * WorkflowStepTracker Component
 * 
 * Displays an animated horizontal progress indicator showing all 9 workflow states.
 * Visual indicators:
 * - Completed states: Green checkmark with filled background
 * - Current state: Blue pulsing indicator with step icon
 * - Pending states: Gray dimmed appearance
 * 
 * Special states:
 * - GOVERNANCE_PENDING: Yellow/amber to indicate human action required
 * - TERMINATED: Red to indicate workflow ended (possibly blocked)
 */
export function WorkflowStepTracker({ 
  currentState, 
  className = '',
  compact = false 
}: WorkflowStepTrackerProps): React.ReactElement {
  const currentIndex = getStateIndex(currentState);
  const currentStep = WORKFLOW_STEPS[currentIndex];
  
  return (
    <div className={`${className}`}>
      {/* Current State Description */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            key={currentState}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2"
          >
            <span className="text-xs text-muted">Current Stage:</span>
            <span className={`text-sm font-medium ${
              currentState === WorkflowState.TERMINATED ? 'text-status-error' :
              currentState === WorkflowState.GOVERNANCE_PENDING ? 'text-status-pending' :
              currentState === WorkflowState.RESOLVED ? 'text-status-success' :
              'text-status-analyzing'
            }`}>
              {currentStep?.label || currentState}
            </span>
          </motion.div>
        </div>
        
        <motion.span
          key={`desc-${currentState}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-xs text-muted-foreground"
        >
          {currentStep?.description}
        </motion.span>
      </div>
      
      {/* Progress Steps */}
      <div 
        className={`flex items-center ${compact ? 'gap-0' : 'gap-0 pb-6'}`}
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={WORKFLOW_STEPS.length}
        aria-label={`Workflow progress: ${currentStep?.label}`}
      >
        {WORKFLOW_STEPS.map((step, index) => (
          <Step
            key={step.state}
            step={step}
            status={getStepStatus(step.state, currentState)}
            isLast={index === WORKFLOW_STEPS.length - 1}
            compact={compact}
          />
        ))}
      </div>
      
      {/* Progress Percentage */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {currentState === WorkflowState.RESOLVED 
            ? 'Incident resolved' 
            : currentState === WorkflowState.TERMINATED 
              ? 'Workflow terminated'
              : `Step ${currentIndex + 1} of ${WORKFLOW_STEPS.length}`}
        </span>
        {/* Show 100% for RESOLVED (successful completion) or TERMINATED states */}
        <span>
          {(currentState === WorkflowState.RESOLVED || currentState === WorkflowState.TERMINATED) 
            ? '100% Complete' 
            : `${Math.round(((currentIndex + 1) / WORKFLOW_STEPS.length) * 100)}% Complete`}
        </span>
      </div>
    </div>
  );
}

export default WorkflowStepTracker;
