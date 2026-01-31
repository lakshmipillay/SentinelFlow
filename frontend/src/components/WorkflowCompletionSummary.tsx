'use client';

/**
 * WorkflowCompletionSummary Component
 * 
 * Displays the final decision summary, audit confirmation, and resolution status
 * when a workflow completes (either RESOLVED or TERMINATED).
 * 
 * Implements Requirements 8.5:
 * - Final decision summary presentation (decision type, rationale, approver)
 * - Audit confirmation and resolution status display
 * - Resolution timestamp
 * 
 * Task 16.4: Add workflow completion and audit display
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Shield,
  User,
  Clock,
  FileText,
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronUp,
  Network,
  RotateCcw
} from 'lucide-react';
import {
  WorkflowState,
  WorkflowInstance,
  GovernanceDecision,
  AuditEvent,
  RiskLevel
} from '@/types/workflow';

/**
 * Props for WorkflowCompletionSummary component
 */
export interface WorkflowCompletionSummaryProps {
  /** The completed workflow instance */
  workflow: WorkflowInstance;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show expanded audit trail by default */
  defaultExpanded?: boolean;
}

/**
 * Animation variants for the component
 */
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 }
  }
};

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Format duration between two timestamps
 */
function formatDuration(startIso: string, endIso: string): string {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const durationMs = end - start;
  
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
  if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`;
  return `${Math.round(durationMs / 3600000)}h`;
}

/**
 * Get risk level styling
 */
function getRiskLevelStyle(level: RiskLevel): { bg: string; text: string; border: string } {
  switch (level) {
    case 'critical':
      return { bg: 'bg-status-error/20', text: 'text-status-error', border: 'border-status-error/50' };
    case 'high':
      return { bg: 'bg-status-warning/20', text: 'text-status-warning', border: 'border-status-warning/50' };
    case 'medium':
      return { bg: 'bg-status-pending/20', text: 'text-status-pending', border: 'border-status-pending/50' };
    case 'low':
      return { bg: 'bg-status-success/20', text: 'text-status-success', border: 'border-status-success/50' };
    default:
      return { bg: 'bg-muted/20', text: 'text-muted', border: 'border-muted/50' };
  }
}

/**
 * DecisionSummarySection - Displays the governance decision details
 */
function DecisionSummarySection({ decision }: { decision: GovernanceDecision }) {
  const decisionConfig = {
    approve: {
      label: 'Approved',
      icon: CheckCircle2,
      colorClass: 'text-status-success',
      bgClass: 'bg-status-success/20',
      borderClass: 'border-status-success/50'
    },
    approve_with_restrictions: {
      label: 'Approved with Restrictions',
      icon: AlertTriangle,
      colorClass: 'text-status-warning',
      bgClass: 'bg-status-warning/20',
      borderClass: 'border-status-warning/50'
    },
    block: {
      label: 'Blocked',
      icon: XCircle,
      colorClass: 'text-status-error',
      bgClass: 'bg-status-error/20',
      borderClass: 'border-status-error/50'
    }
  }[decision.decision];

  const Icon = decisionConfig.icon;
  const riskStyle = getRiskLevelStyle(decision.blastRadiusAssessment.riskLevel);

  return (
    <motion.div
      variants={itemVariants}
      className={`rounded-lg border ${decisionConfig.borderClass} ${decisionConfig.bgClass} p-4`}
    >
      {/* Decision Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${decisionConfig.colorClass}`} />
          <span className={`text-sm font-semibold ${decisionConfig.colorClass}`}>
            {decisionConfig.label}
          </span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}>
          {decision.blastRadiusAssessment.riskLevel.toUpperCase()} Risk
        </span>
      </div>

      {/* Decision Details */}
      <div className="space-y-3">
        {/* Approver Info */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-muted" />
            <span className="text-muted">Approver:</span>
            <span className="text-foreground font-medium">{decision.approver.id}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-muted" />
            <span className="text-muted">Role:</span>
            <span className="text-foreground font-medium capitalize">{decision.approver.role}</span>
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1.5 text-xs">
          <Clock className="w-3.5 h-3.5 text-muted" />
          <span className="text-muted">Decision Time:</span>
          <span className="text-foreground">{formatTimestamp(decision.timestamp)}</span>
        </div>

        {/* Rationale */}
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-muted" />
            <span className="text-xs text-muted font-medium">Rationale:</span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed bg-panel/50 rounded p-2">
            {decision.rationale}
          </p>
        </div>

        {/* Restrictions (if any) */}
        {decision.restrictions && decision.restrictions.length > 0 && (
          <div className="pt-2 border-t border-border/30">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-status-warning" />
              <span className="text-xs text-status-warning font-medium">Restrictions Applied:</span>
            </div>
            <ul className="space-y-1">
              {decision.restrictions.map((restriction, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-foreground/80">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-status-warning flex-shrink-0" />
                  <span>{restriction}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Blast Radius Summary */}
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Network className="w-3.5 h-3.5 text-agent-sre" />
            <span className="text-xs text-muted font-medium">Blast Radius:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2 py-0.5 rounded bg-panel border border-border">
              {decision.blastRadiusAssessment.affectedServices.length} services affected
            </span>
            <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
              decision.blastRadiusAssessment.reversible 
                ? 'bg-status-success/20 text-status-success border border-status-success/30' 
                : 'bg-status-error/20 text-status-error border border-status-error/30'
            }`}>
              <RotateCcw className="w-3 h-3" />
              {decision.blastRadiusAssessment.reversible ? 'Reversible' : 'Not Reversible'}
            </span>
          </div>
          {decision.blastRadiusAssessment.affectedServices.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {decision.blastRadiusAssessment.affectedServices.slice(0, 5).map((service, idx) => (
                <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-panel-secondary text-muted">
                  {service}
                </span>
              ))}
              {decision.blastRadiusAssessment.affectedServices.length > 5 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-panel-secondary text-muted">
                  +{decision.blastRadiusAssessment.affectedServices.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * AuditConfirmationSection - Displays audit trail confirmation
 */
function AuditConfirmationSection({ 
  auditTrail, 
  expanded, 
  onToggle 
}: { 
  auditTrail: AuditEvent[];
  expanded: boolean;
  onToggle: () => void;
}) {
  // Group events by type for summary
  const eventSummary = useMemo(() => {
    const summary = {
      state_transition: 0,
      agent_output: 0,
      governance_decision: 0,
      workflow_termination: 0
    };
    auditTrail.forEach(event => {
      summary[event.eventType]++;
    });
    return summary;
  }, [auditTrail]);

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-lg border border-status-success/50 bg-status-success/10 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-status-success/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-status-success" />
          <span className="text-sm font-medium text-status-success">Audit Trail Confirmed</span>
          <span className="text-xs text-status-success/80 bg-status-success/20 px-2 py-0.5 rounded-full">
            {auditTrail.length} events recorded
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-status-success" />
        ) : (
          <ChevronDown className="w-4 h-4 text-status-success" />
        )}
      </button>

      {/* Event Summary */}
      <div className="px-3 pb-3 flex flex-wrap gap-2">
        {eventSummary.state_transition > 0 && (
          <span className="text-xs text-muted bg-panel px-2 py-0.5 rounded">
            {eventSummary.state_transition} state transitions
          </span>
        )}
        {eventSummary.agent_output > 0 && (
          <span className="text-xs text-muted bg-panel px-2 py-0.5 rounded">
            {eventSummary.agent_output} agent outputs
          </span>
        )}
        {eventSummary.governance_decision > 0 && (
          <span className="text-xs text-muted bg-panel px-2 py-0.5 rounded">
            {eventSummary.governance_decision} governance decision
          </span>
        )}
        {eventSummary.workflow_termination > 0 && (
          <span className="text-xs text-muted bg-panel px-2 py-0.5 rounded">
            {eventSummary.workflow_termination} termination
          </span>
        )}
      </div>

      {/* Expanded Event List */}
      {expanded && (
        <div className="border-t border-status-success/30 p-3 max-h-60 overflow-y-auto">
          <div className="space-y-2">
            {auditTrail.map((event, idx) => (
              <div 
                key={event.eventId || idx}
                className="flex items-start gap-2 text-xs p-2 rounded bg-panel/50"
              >
                <span className="text-muted-foreground whitespace-nowrap">
                  {formatTimestamp(event.timestamp)}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  event.eventType === 'governance_decision' ? 'bg-agent-governance/20 text-agent-governance' :
                  event.eventType === 'agent_output' ? 'bg-status-analyzing/20 text-status-analyzing' :
                  event.eventType === 'workflow_termination' ? 'bg-status-error/20 text-status-error' :
                  'bg-accent/20 text-accent'
                }`}>
                  {event.eventType.replace('_', ' ')}
                </span>
                <span className="text-foreground/80 flex-1">
                  {event.actor}
                  {event.details.fromState && event.details.toState && (
                    <span className="text-muted"> ({event.details.fromState} → {event.details.toState})</span>
                  )}
                  {event.details.terminationReason && (
                    <span className="text-status-error"> - {event.details.terminationReason}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * ResolutionStatusSection - Displays the final resolution status
 */
function ResolutionStatusSection({ 
  workflow 
}: { 
  workflow: WorkflowInstance;
}) {
  const isResolved = workflow.currentState === WorkflowState.RESOLVED;
  const isTerminated = workflow.currentState === WorkflowState.TERMINATED;

  // Calculate workflow duration if we have audit trail
  const workflowDuration = useMemo(() => {
    if (workflow.auditTrail.length < 2) return null;
    const firstEvent = workflow.auditTrail[0];
    const lastEvent = workflow.auditTrail[workflow.auditTrail.length - 1];
    return formatDuration(firstEvent.timestamp, lastEvent.timestamp);
  }, [workflow.auditTrail]);

  // Get termination reason if terminated
  const terminationReason = useMemo(() => {
    if (!isTerminated) return null;
    const terminationEvent = workflow.auditTrail.find(
      e => e.eventType === 'workflow_termination'
    );
    return terminationEvent?.details.terminationReason || 
           (workflow.governanceDecision?.decision === 'block' ? 'Blocked by governance decision' : 'Unknown');
  }, [isTerminated, workflow.auditTrail, workflow.governanceDecision]);

  return (
    <motion.div
      variants={itemVariants}
      className={`rounded-lg border p-4 ${
        isResolved 
          ? 'border-status-success/50 bg-status-success/10' 
          : 'border-status-error/50 bg-status-error/10'
      }`}
    >
      {/* Status Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isResolved ? (
            <CheckCircle2 className="w-5 h-5 text-status-success" />
          ) : (
            <XCircle className="w-5 h-5 text-status-error" />
          )}
          <span className={`text-sm font-semibold ${
            isResolved ? 'text-status-success' : 'text-status-error'
          }`}>
            Workflow {isResolved ? 'Resolved' : 'Terminated'}
          </span>
        </div>
        {workflowDuration && (
          <span className="text-xs text-muted bg-panel px-2 py-0.5 rounded">
            Duration: {workflowDuration}
          </span>
        )}
      </div>

      {/* Status Details */}
      <div className="space-y-2">
        {/* Workflow ID */}
        <div className="flex items-center gap-2 text-xs">
          <Activity className="w-3.5 h-3.5 text-muted" />
          <span className="text-muted">Workflow ID:</span>
          <span className="text-foreground font-mono">{workflow.workflowId}</span>
        </div>

        {/* Resolution Timestamp */}
        <div className="flex items-center gap-2 text-xs">
          <Clock className="w-3.5 h-3.5 text-muted" />
          <span className="text-muted">Completed At:</span>
          <span className="text-foreground">{formatTimestamp(workflow.timestamp)}</span>
        </div>

        {/* Final State */}
        <div className="flex items-center gap-2 text-xs">
          <Shield className="w-3.5 h-3.5 text-muted" />
          <span className="text-muted">Final State:</span>
          <span className={`px-2 py-0.5 rounded font-medium ${
            isResolved 
              ? 'bg-status-success/20 text-status-success' 
              : 'bg-status-error/20 text-status-error'
          }`}>
            {workflow.currentState}
          </span>
        </div>

        {/* Termination Reason (if terminated) */}
        {isTerminated && terminationReason && (
          <div className="pt-2 border-t border-border/30">
            <div className="flex items-start gap-2 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-status-error mt-0.5" />
              <div>
                <span className="text-status-error font-medium">Termination Reason:</span>
                <p className="text-foreground/80 mt-0.5">{terminationReason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Agent Outputs Summary */}
        {workflow.agentOutputs.length > 0 && (
          <div className="pt-2 border-t border-border/30">
            <div className="flex items-center gap-2 text-xs mb-1.5">
              <Activity className="w-3.5 h-3.5 text-status-analyzing" />
              <span className="text-muted font-medium">Agent Analysis Completed:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {workflow.agentOutputs.map((output, idx) => (
                <span 
                  key={idx}
                  className="text-[10px] px-2 py-0.5 rounded bg-panel-secondary text-foreground/80 flex items-center gap-1"
                >
                  {output.agentName}
                  <span className="text-muted">
                    ({Math.round(output.confidenceLevel * 100)}%)
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * WorkflowCompletionSummary Component
 * 
 * Main component that displays the complete workflow summary including:
 * - Final decision summary (decision type, rationale, approver)
 * - Audit confirmation and event summary
 * - Resolution status with timestamp and duration
 * 
 * Requirements: 8.5 - Display final decision summary, audit confirmation, and resolution status
 * Task 16.4: Add workflow completion and audit display
 */
export function WorkflowCompletionSummary({
  workflow,
  className = '',
  defaultExpanded = false
}: WorkflowCompletionSummaryProps) {
  const [auditExpanded, setAuditExpanded] = React.useState(defaultExpanded);

  // Only render for completed workflows
  const isCompleted = workflow.currentState === WorkflowState.RESOLVED ||
                      workflow.currentState === WorkflowState.TERMINATED;

  if (!isCompleted) {
    return null;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`space-y-4 ${className}`}
    >
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground">Workflow Completion Summary</h3>
      </div>

      {/* Resolution Status */}
      <ResolutionStatusSection workflow={workflow} />

      {/* Governance Decision Summary (if available) */}
      {workflow.governanceDecision && (
        <DecisionSummarySection decision={workflow.governanceDecision} />
      )}

      {/* Audit Trail Confirmation */}
      {workflow.auditTrail.length > 0 && (
        <AuditConfirmationSection
          auditTrail={workflow.auditTrail}
          expanded={auditExpanded}
          onToggle={() => setAuditExpanded(!auditExpanded)}
        />
      )}
    </motion.div>
  );
}

export default WorkflowCompletionSummary;
