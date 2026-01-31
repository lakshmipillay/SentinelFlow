'use client';

/**
 * AgentCard Component
 * 
 * Displays agent information with current activity, skills badges, confidence levels,
 * and findings. Implements Framer Motion animations for status changes.
 * 
 * Requirements: 6.1 - Display agent cards showing current activity with skills badges
 * Requirements: 6.3 - Visual indicators for agent confidence levels
 * Requirements: 6.4 - Display structured findings when agents complete analysis
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Shield, Lock, CheckCircle2, Brain, Loader2 } from 'lucide-react';
import { AgentCard as AgentCardType, AgentType, AGENT_SKILLS } from '@/types/workflow';

export interface AgentCardProps {
  agent: AgentCardType;
  className?: string;
  compact?: boolean;
}

interface AgentConfig {
  displayName: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgColorClass: string;
  borderColorClass: string;
  glowColor: string;
}

const AGENT_CONFIG: Record<AgentType, AgentConfig> = {
  'sre-agent': {
    displayName: 'SRE Agent',
    icon: Activity,
    colorClass: 'text-agent-sre',
    bgColorClass: 'bg-agent-sre/10',
    borderColorClass: 'border-agent-sre',
    glowColor: 'rgba(34, 211, 238, 0.3)'
  },
  'security-agent': {
    displayName: 'Security Agent',
    icon: Lock,
    colorClass: 'text-agent-security',
    bgColorClass: 'bg-agent-security/10',
    borderColorClass: 'border-agent-security',
    glowColor: 'rgba(167, 139, 250, 0.3)'
  },
  'governance-agent': {
    displayName: 'Governance Agent',
    icon: Shield,
    colorClass: 'text-agent-governance',
    bgColorClass: 'bg-agent-governance/10',
    borderColorClass: 'border-agent-governance',
    glowColor: 'rgba(251, 191, 36, 0.3)'
  }
};


function ThinkingIndicator({ colorClass }: { colorClass: string }) {
  return (
    <div className="flex items-center gap-1">
      <Brain className={`w-3 h-3 ${colorClass}`} />
      <span className={`text-xs ${colorClass}`}>Analyzing</span>
      <span className={`flex gap-0.5 ${colorClass}`}>
        <span className="w-1 h-1 rounded-full bg-current animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 rounded-full bg-current animate-pulse" style={{ animationDelay: '200ms' }} />
        <span className="w-1 h-1 rounded-full bg-current animate-pulse" style={{ animationDelay: '400ms' }} />
      </span>
    </div>
  );
}

function ConfidenceBar({ level, colorClass }: { level: number; colorClass: string }) {
  const normalizedLevel = Math.max(0, Math.min(1, level));
  const percentage = Math.round(normalizedLevel * 100);
  
  const getConfidenceColor = () => {
    if (normalizedLevel >= 0.8) return 'bg-status-success';
    if (normalizedLevel >= 0.6) return 'bg-status-analyzing';
    if (normalizedLevel >= 0.4) return 'bg-status-warning';
    return 'bg-status-error';
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">Confidence:</span>
      <div className="flex-1 h-1.5 bg-panel rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${getConfidenceColor()} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className={`text-xs font-medium ${colorClass}`}>{percentage}%</span>
    </div>
  );
}

function SkillsBadges({ 
  agentType, 
  activeSkills,
  colorClass,
  bgColorClass
}: { 
  agentType: AgentType;
  activeSkills: string[];
  colorClass: string;
  bgColorClass: string;
}) {
  const allSkills = AGENT_SKILLS[agentType];
  
  return (
    <div className="flex flex-wrap gap-1.5">
      {allSkills.map((skill) => {
        const isActive = activeSkills.includes(skill);
        const activeClasses = `${bgColorClass} ${colorClass} border-current font-medium`;
        const inactiveClasses = 'bg-panel-secondary text-muted border-border';
        return (
          <motion.span
            key={skill}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: isActive ? 1.05 : 1, opacity: isActive ? 1 : 0.5 }}
            transition={{ duration: 0.2 }}
            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${isActive ? activeClasses : inactiveClasses}`}
          >
            {skill}
          </motion.span>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: AgentCardType['status'] }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'analyzing':
        return {
          text: 'Analyzing',
          bgClass: 'bg-status-analyzing/20',
          textClass: 'text-status-analyzing',
          icon: <Loader2 className="w-3 h-3 animate-spin" />
        };
      case 'complete':
        return {
          text: 'Complete',
          bgClass: 'bg-status-success/20',
          textClass: 'text-status-success',
          icon: <CheckCircle2 className="w-3 h-3" />
        };
      default:
        return {
          text: 'Idle',
          bgClass: 'bg-status-idle/20',
          textClass: 'text-status-idle',
          icon: null
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${config.bgClass} ${config.textClass}`}>
      {config.icon}
      {config.text}
    </span>
  );
}


export function AgentCard({ agent, className = '', compact = false }: AgentCardProps) {
  const config = AGENT_CONFIG[agent.agentName];
  const Icon = config.icon;
  
  const isAnalyzing = agent.status === 'analyzing';
  const isComplete = agent.status === 'complete';
  const hasFindings = agent.findings.length > 0;

  const borderClass = isAnalyzing ? `border-l-4 ${config.borderColorClass}` : 'border-border';
  const shadowStyle = isAnalyzing 
    ? { boxShadow: `0 4px 20px ${config.glowColor}` }
    : isComplete 
      ? { boxShadow: '0 2px 10px rgba(34, 197, 94, 0.15)' }
      : { boxShadow: 'none' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative rounded-lg border overflow-hidden ${borderClass} ${config.bgColorClass} ${className}`}
      style={shadowStyle}
    >
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${config.bgColorClass}`}>
            <Icon className={`w-4 h-4 ${config.colorClass}`} />
          </div>
          <h3 className={`text-sm font-medium ${config.colorClass}`}>{config.displayName}</h3>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <div className={`p-3 space-y-3 ${compact ? 'py-2' : ''}`}>
        <AnimatePresence>
          {agent.thinkingAnimation && isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-center py-2"
            >
              <ThinkingIndicator colorClass={config.colorClass} />
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <div className="text-xs text-muted mb-1.5">Skills</div>
          <SkillsBadges
            agentType={agent.agentName}
            activeSkills={agent.skillsActive}
            colorClass={config.colorClass}
            bgColorClass={config.bgColorClass}
          />
        </div>

        {(isAnalyzing || isComplete) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <ConfidenceBar level={agent.confidenceLevel} colorClass={config.colorClass} />
          </motion.div>
        )}

        <AnimatePresence>
          {isComplete && hasFindings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="pt-2 border-t border-border/50"
            >
              <div className="text-xs text-muted mb-1.5">Findings</div>
              <ul className="space-y-1">
                {agent.findings.map((finding, index) => {
                  const dotClass = config.colorClass.replace('text-', 'bg-');
                  return (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-2 text-xs text-foreground"
                    >
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
                      <span>{finding}</span>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {agent.status === 'idle' && !hasFindings && (
          <div className="text-xs text-muted-foreground text-center py-2">
            Waiting for incident analysis...
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default AgentCard;
