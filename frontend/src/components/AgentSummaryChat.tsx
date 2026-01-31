'use client';

/**
 * AgentSummaryChat Component
 * 
 * Displays agent findings in a chat-style message bubble format with:
 * - Plain-English summary of findings
 * - RCA summary and correlation explanations
 * - Risk assessment and recommendations
 * - Framer Motion animations for message appearance
 * 
 * Requirements: 8.4 - Display plain-English summary of findings including 
 * RCA summary, correlation explanation, and risk assessment
 * 
 * Task 12.1: Create agent summary chat interface
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Shield, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  Link2, 
  Lightbulb,
  TrendingUp,
  Clock
} from 'lucide-react';
import { AgentOutput, AgentType, RiskLevel } from '@/types/workflow';

/**
 * Props for the AgentSummaryChat component
 */
export interface AgentSummaryChatProps {
  /** Array of agent outputs to display */
  agentOutputs: AgentOutput[];
  /** Optional RCA summary text */
  rcaSummary?: string;
  /** Overall risk level assessment */
  riskLevel?: RiskLevel;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Agent configuration for display
 */
interface AgentDisplayConfig {
  displayName: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgColorClass: string;
  borderColorClass: string;
}

const AGENT_DISPLAY_CONFIG: Record<AgentType, AgentDisplayConfig> = {
  'sre-agent': {
    displayName: 'SRE Agent',
    icon: Activity,
    colorClass: 'text-agent-sre',
    bgColorClass: 'bg-agent-sre/10',
    borderColorClass: 'border-agent-sre/30'
  },
  'security-agent': {
    displayName: 'Security Agent',
    icon: Lock,
    colorClass: 'text-agent-security',
    bgColorClass: 'bg-agent-security/10',
    borderColorClass: 'border-agent-security/30'
  },
  'governance-agent': {
    displayName: 'Governance Agent',
    icon: Shield,
    colorClass: 'text-agent-governance',
    bgColorClass: 'bg-agent-governance/10',
    borderColorClass: 'border-agent-governance/30'
  }
};

/**
 * Get risk level styling
 */
function getRiskLevelConfig(level: RiskLevel): { colorClass: string; bgClass: string; label: string } {
  switch (level) {
    case 'critical':
      return { colorClass: 'text-status-error', bgClass: 'bg-status-error/20', label: 'Critical Risk' };
    case 'high':
      return { colorClass: 'text-status-warning', bgClass: 'bg-status-warning/20', label: 'High Risk' };
    case 'medium':
      return { colorClass: 'text-status-pending', bgClass: 'bg-status-pending/20', label: 'Medium Risk' };
    case 'low':
      return { colorClass: 'text-status-success', bgClass: 'bg-status-success/20', label: 'Low Risk' };
    default:
      return { colorClass: 'text-muted', bgClass: 'bg-muted/20', label: 'Unknown Risk' };
  }
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return '';
  }
}

/**
 * Animation variants for message bubbles
 */
const messageVariants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    scale: 0.95
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 25
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2 }
  }
};

const listItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.3
    }
  })
};

/**
 * MessageBubble - Individual chat message bubble
 */
interface MessageBubbleProps {
  agentOutput: AgentOutput;
  index: number;
}

function MessageBubble({ agentOutput, index }: MessageBubbleProps) {
  const config = AGENT_DISPLAY_CONFIG[agentOutput.agentName];
  const Icon = config.icon;
  const { findings, confidenceLevel, timestamp, skillsUsed } = agentOutput;

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
      className={`
        rounded-lg border ${config.borderColorClass} ${config.bgColorClass}
        overflow-hidden
      `}
    >
      {/* Message Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${config.bgColorClass}`}>
            <Icon className={`w-3.5 h-3.5 ${config.colorClass}`} />
          </div>
          <span className={`text-sm font-medium ${config.colorClass}`}>
            {config.displayName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {Math.round(confidenceLevel * 100)}%
          </span>
          {timestamp && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Message Body */}
      <div className="p-3 space-y-3">
        {/* Summary */}
        <div>
          <p className="text-sm text-foreground leading-relaxed">
            {findings.summary}
          </p>
        </div>

        {/* Evidence */}
        {findings.evidence.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
              <span className="text-xs font-medium text-muted">Evidence</span>
            </div>
            <ul className="space-y-1 pl-5">
              {findings.evidence.map((item, i) => (
                <motion.li
                  key={i}
                  variants={listItemVariants}
                  initial="hidden"
                  animate="visible"
                  custom={i}
                  className="text-xs text-foreground/80 list-disc"
                >
                  {item}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {/* Correlations */}
        {findings.correlations.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Link2 className="w-3.5 h-3.5 text-agent-sre" />
              <span className="text-xs font-medium text-muted">Correlations</span>
            </div>
            <ul className="space-y-1 pl-5">
              {findings.correlations.map((item, i) => (
                <motion.li
                  key={i}
                  variants={listItemVariants}
                  initial="hidden"
                  animate="visible"
                  custom={i}
                  className="text-xs text-foreground/80 list-disc"
                >
                  {item}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {findings.recommendations && findings.recommendations.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-status-warning" />
              <span className="text-xs font-medium text-muted">Recommendations</span>
            </div>
            <ul className="space-y-1 pl-5">
              {findings.recommendations.map((item, i) => (
                <motion.li
                  key={i}
                  variants={listItemVariants}
                  initial="hidden"
                  animate="visible"
                  custom={i}
                  className="text-xs text-foreground/80 list-disc"
                >
                  {item}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {/* Skills Used */}
        {skillsUsed.length > 0 && (
          <div className="pt-2 border-t border-border/30">
            <div className="flex flex-wrap gap-1">
              {skillsUsed.map((skill) => (
                <span
                  key={skill}
                  className={`px-1.5 py-0.5 text-[10px] rounded ${config.bgColorClass} ${config.colorClass} border ${config.borderColorClass}`}
                >
                  {skill}
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
 * RCASummaryBubble - Displays the overall RCA summary
 */
interface RCASummaryBubbleProps {
  summary: string;
  riskLevel?: RiskLevel;
}

function RCASummaryBubble({ summary, riskLevel }: RCASummaryBubbleProps) {
  const riskConfig = riskLevel ? getRiskLevelConfig(riskLevel) : null;

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className="rounded-lg border border-accent/30 bg-accent/5 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-accent/10">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-accent/20">
            <AlertTriangle className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="text-sm font-medium text-accent">
            Root Cause Analysis
          </span>
        </div>
        {riskConfig && (
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${riskConfig.bgClass} ${riskConfig.colorClass}`}>
            {riskConfig.label}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        <p className="text-sm text-foreground leading-relaxed">
          {summary}
        </p>
      </div>
    </motion.div>
  );
}

/**
 * CorrelationSummary - Shows how agent findings correlate
 */
interface CorrelationSummaryProps {
  agentOutputs: AgentOutput[];
}

function CorrelationSummary({ agentOutputs }: CorrelationSummaryProps) {
  // Extract all correlations from all agents
  const allCorrelations = agentOutputs.flatMap(output => 
    output.findings.correlations.map(correlation => ({
      agent: output.agentName,
      correlation
    }))
  );

  if (allCorrelations.length === 0) return null;

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className="rounded-lg border border-agent-sre/30 bg-agent-sre/5 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-agent-sre/10">
        <div className="p-1 rounded bg-agent-sre/20">
          <Link2 className="w-3.5 h-3.5 text-agent-sre" />
        </div>
        <span className="text-sm font-medium text-agent-sre">
          Cross-Agent Correlations
        </span>
      </div>

      {/* Body */}
      <div className="p-3">
        <p className="text-xs text-muted mb-2">
          The following correlations were identified across agent analyses:
        </p>
        <ul className="space-y-2">
          {allCorrelations.map((item, i) => {
            const agentConfig = AGENT_DISPLAY_CONFIG[item.agent];
            return (
              <motion.li
                key={i}
                variants={listItemVariants}
                initial="hidden"
                animate="visible"
                custom={i}
                className="flex items-start gap-2 text-xs"
              >
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${agentConfig.bgColorClass} ${agentConfig.colorClass}`}>
                  {agentConfig.displayName.split(' ')[0]}
                </span>
                <span className="text-foreground/80">{item.correlation}</span>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </motion.div>
  );
}

/**
 * RiskAssessmentBubble - Shows overall risk assessment
 */
interface RiskAssessmentBubbleProps {
  riskLevel: RiskLevel;
  agentOutputs: AgentOutput[];
}

function RiskAssessmentBubble({ riskLevel, agentOutputs }: RiskAssessmentBubbleProps) {
  const riskConfig = getRiskLevelConfig(riskLevel);
  
  // Collect all recommendations
  const allRecommendations = agentOutputs.flatMap(output => 
    (output.findings.recommendations || []).map(rec => ({
      agent: output.agentName,
      recommendation: rec
    }))
  );

  // Calculate average confidence
  const avgConfidence = agentOutputs.length > 0
    ? agentOutputs.reduce((sum, o) => sum + o.confidenceLevel, 0) / agentOutputs.length
    : 0;

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={`rounded-lg border ${
        riskLevel === 'critical' ? 'border-status-error/30 bg-status-error/5' :
        riskLevel === 'high' ? 'border-status-warning/30 bg-status-warning/5' :
        riskLevel === 'medium' ? 'border-status-pending/30 bg-status-pending/5' :
        'border-status-success/30 bg-status-success/5'
      } overflow-hidden`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-border/30 ${riskConfig.bgClass}`}>
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${riskConfig.bgClass}`}>
            <Shield className={`w-3.5 h-3.5 ${riskConfig.colorClass}`} />
          </div>
          <span className={`text-sm font-medium ${riskConfig.colorClass}`}>
            Risk Assessment
          </span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${riskConfig.bgClass} ${riskConfig.colorClass}`}>
          {riskConfig.label}
        </span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* Confidence Summary */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Analysis Confidence</span>
          <span className={`font-medium ${
            avgConfidence >= 0.8 ? 'text-status-success' :
            avgConfidence >= 0.6 ? 'text-status-analyzing' :
            'text-status-warning'
          }`}>
            {Math.round(avgConfidence * 100)}%
          </span>
        </div>

        {/* Recommendations */}
        {allRecommendations.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-status-warning" />
              <span className="text-xs font-medium text-muted">Recommended Actions</span>
            </div>
            <ul className="space-y-1.5">
              {allRecommendations.map((item, i) => {
                const agentConfig = AGENT_DISPLAY_CONFIG[item.agent];
                return (
                  <motion.li
                    key={i}
                    variants={listItemVariants}
                    initial="hidden"
                    animate="visible"
                    custom={i}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${agentConfig.colorClass.replace('text-', 'bg-')}`} />
                    <span className="text-foreground/80">{item.recommendation}</span>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * EmptyState - Shown when no agent outputs are available
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 rounded-full bg-panel-secondary mb-3">
        <Activity className="w-6 h-6 text-muted-foreground opacity-50" />
      </div>
      <p className="text-sm text-muted">No agent summaries yet</p>
      <p className="text-xs text-muted-foreground mt-1">
        Agent findings will appear here as analysis completes
      </p>
    </div>
  );
}

/**
 * AgentSummaryChat Component
 * 
 * Main component that displays agent findings in a chat-style interface
 * with message bubbles, RCA summary, correlations, and risk assessment.
 * 
 * Requirements: 8.4 - Display plain-English summary of findings
 */
export function AgentSummaryChat({ 
  agentOutputs, 
  rcaSummary, 
  riskLevel,
  className = '' 
}: AgentSummaryChatProps) {
  // Filter to only completed agent outputs (those with findings)
  const completedOutputs = agentOutputs.filter(
    output => output.findings && output.findings.summary
  );

  const hasOutputs = completedOutputs.length > 0;
  const hasRCA = !!rcaSummary;
  const hasRisk = !!riskLevel;

  return (
    <div className={`flex flex-col space-y-3 ${className}`}>
      <AnimatePresence mode="popLayout">
        {/* Empty State */}
        {!hasOutputs && !hasRCA && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState />
          </motion.div>
        )}

        {/* RCA Summary (shown first if available) */}
        {hasRCA && (
          <motion.div key="rca" layout>
            <RCASummaryBubble summary={rcaSummary!} riskLevel={riskLevel} />
          </motion.div>
        )}

        {/* Agent Message Bubbles */}
        {completedOutputs.map((output, index) => (
          <motion.div key={`${output.agentName}-${output.timestamp}`} layout>
            <MessageBubble agentOutput={output} index={index} />
          </motion.div>
        ))}

        {/* Correlation Summary (if multiple agents have correlations) */}
        {completedOutputs.length > 1 && (
          <motion.div key="correlations" layout>
            <CorrelationSummary agentOutputs={completedOutputs} />
          </motion.div>
        )}

        {/* Risk Assessment (shown last if available) */}
        {hasRisk && hasOutputs && (
          <motion.div key="risk" layout>
            <RiskAssessmentBubble riskLevel={riskLevel!} agentOutputs={completedOutputs} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AgentSummaryChat;
