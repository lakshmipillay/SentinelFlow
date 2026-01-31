'use client';

/**
 * BlastRadiusVisualization Component
 * 
 * Displays an interactive service dependency graph showing affected system components
 * with health status color-coding and impact level indicators.
 * 
 * Requirements: 7.1 - Generate blast radius graphs showing affected system components with relationships
 * Requirements: 7.2 - Color-code component health status (Healthy, Warning, Critical) and show dependency chains
 * Requirements: 7.3 - Update blast radius visualization based on proposed remediation actions
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Server, 
  Globe, 
  Shield, 
  AlertTriangle, 
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Zap
} from 'lucide-react';
import { BlastRadiusNode, HealthStatus } from '@/types/workflow';

export interface BlastRadiusVisualizationProps {
  nodes: BlastRadiusNode[];
  className?: string;
  showDependencies?: boolean;
  animated?: boolean;
}

/**
 * Health status configuration for color-coding
 * Requirements: 7.2 - Color-code component health status
 */
interface HealthConfig {
  bgColor: string;
  borderColor: string;
  textColor: string;
  glowColor: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const HEALTH_CONFIG: Record<HealthStatus, HealthConfig> = {
  healthy: {
    bgColor: 'bg-status-success/10',
    borderColor: 'border-status-success',
    textColor: 'text-status-success',
    glowColor: 'rgba(34, 197, 94, 0.2)',
    icon: CheckCircle2,
    label: 'Healthy'
  },
  warning: {
    bgColor: 'bg-status-warning/10',
    borderColor: 'border-status-warning',
    textColor: 'text-status-warning',
    glowColor: 'rgba(251, 191, 36, 0.2)',
    icon: AlertTriangle,
    label: 'Warning'
  },
  critical: {
    bgColor: 'bg-status-error/10',
    borderColor: 'border-status-error',
    textColor: 'text-status-error',
    glowColor: 'rgba(239, 68, 68, 0.3)',
    icon: AlertCircle,
    label: 'Critical'
  }
};

/**
 * Impact level configuration
 */
interface ImpactConfig {
  bgColor: string;
  textColor: string;
  label: string;
}

const IMPACT_CONFIG: Record<'low' | 'medium' | 'high', ImpactConfig> = {
  low: {
    bgColor: 'bg-status-success/20',
    textColor: 'text-status-success',
    label: 'Low Impact'
  },
  medium: {
    bgColor: 'bg-status-warning/20',
    textColor: 'text-status-warning',
    label: 'Medium Impact'
  },
  high: {
    bgColor: 'bg-status-error/20',
    textColor: 'text-status-error',
    label: 'High Impact'
  }
};

/**
 * Get service icon based on service name
 */
function getServiceIcon(serviceName: string): React.ComponentType<{ className?: string }> {
  const name = serviceName.toLowerCase();
  if (name.includes('database') || name.includes('db') || name.includes('postgres') || name.includes('mysql')) {
    return Database;
  }
  if (name.includes('api') || name.includes('gateway') || name.includes('service')) {
    return Server;
  }
  if (name.includes('frontend') || name.includes('web') || name.includes('ui')) {
    return Globe;
  }
  if (name.includes('auth') || name.includes('security')) {
    return Shield;
  }
  return Zap;
}

/**
 * ServiceNode - Individual service node in the blast radius graph
 */
interface ServiceNodeProps {
  node: BlastRadiusNode;
  index: number;
  animated: boolean;
}

function ServiceNode({ node, index, animated }: ServiceNodeProps) {
  const healthConfig = HEALTH_CONFIG[node.healthStatus];
  const impactConfig = IMPACT_CONFIG[node.impactLevel];
  const Icon = getServiceIcon(node.serviceName);
  const HealthIcon = healthConfig.icon;

  return (
    <motion.div
      initial={animated ? { opacity: 0, scale: 0.8, y: 20 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay: animated ? index * 0.1 : 0,
        ease: 'easeOut'
      }}
      className={`
        relative p-3 rounded-lg border-2 
        ${healthConfig.bgColor} ${healthConfig.borderColor}
        transition-all duration-300 hover:scale-105
      `}
      style={{
        boxShadow: node.healthStatus !== 'healthy' 
          ? `0 4px 20px ${healthConfig.glowColor}` 
          : 'none'
      }}
    >
      {/* Service Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded ${healthConfig.bgColor}`}>
          <Icon className={`w-4 h-4 ${healthConfig.textColor}`} />
        </div>
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {node.serviceName}
        </span>
        <HealthIcon className={`w-4 h-4 ${healthConfig.textColor}`} />
      </div>

      {/* Health Status Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`
          text-xs px-2 py-0.5 rounded-full 
          ${healthConfig.bgColor} ${healthConfig.textColor}
          border ${healthConfig.borderColor}
        `}>
          {healthConfig.label}
        </span>
        <span className={`
          text-xs px-2 py-0.5 rounded-full 
          ${impactConfig.bgColor} ${impactConfig.textColor}
        `}>
          {impactConfig.label}
        </span>
      </div>

      {/* Dependencies Count */}
      {node.dependencies.length > 0 && (
        <div className="text-xs text-muted mt-2 pt-2 border-t border-border/50">
          <span className="text-muted-foreground">Dependencies: </span>
          <span className="text-foreground font-medium">{node.dependencies.length}</span>
        </div>
      )}

      {/* Critical/Warning Pulse Animation */}
      {node.healthStatus === 'critical' && (
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-status-error"
          animate={{ opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

/**
 * DependencyArrow - Visual connection between dependent services
 * Note: This component is available for future use when implementing
 * more complex graph layouts with visual arrows between nodes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DependencyArrow({ fromIndex, toIndex, animated }: { fromIndex: number; toIndex: number; animated: boolean }) {
  // Calculate relative positions for the arrow
  const isDownward = toIndex > fromIndex;
  
  return (
    <motion.div
      initial={animated ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ delay: animated ? 0.5 + (fromIndex * 0.1) : 0, duration: 0.3 }}
      className="flex items-center justify-center py-1"
    >
      <div className="flex items-center gap-1 text-muted">
        <div className="w-8 h-px bg-border" />
        <ArrowRight className={`w-3 h-3 ${isDownward ? 'rotate-90' : ''}`} />
        <div className="w-8 h-px bg-border" />
      </div>
    </motion.div>
  );
}

/**
 * DependencyChain - Shows the dependency chain between services
 * Requirements: 7.2 - Show dependency chains
 */
interface DependencyChainProps {
  nodes: BlastRadiusNode[];
  animated: boolean;
}

function DependencyChain({ nodes, animated }: DependencyChainProps) {
  // Build dependency relationships
  const nodeMap = useMemo(() => {
    const map = new Map<string, BlastRadiusNode>();
    nodes.forEach(node => map.set(node.serviceName, node));
    return map;
  }, [nodes]);

  // Find root nodes (nodes that are dependencies of others but have no dependencies themselves)
  const dependencyPairs = useMemo(() => {
    const pairs: Array<{ from: BlastRadiusNode; to: BlastRadiusNode }> = [];
    nodes.forEach(node => {
      node.dependencies.forEach(depName => {
        const depNode = nodeMap.get(depName);
        if (depNode) {
          pairs.push({ from: node, to: depNode });
        }
      });
    });
    return pairs;
  }, [nodes, nodeMap]);

  if (dependencyPairs.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={animated ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ delay: animated ? 0.8 : 0, duration: 0.3 }}
      className="mt-4 pt-4 border-t border-border"
    >
      <div className="text-xs text-muted mb-2">Dependency Chain</div>
      <div className="space-y-2">
        {dependencyPairs.map((pair, index) => {
          const fromConfig = HEALTH_CONFIG[pair.from.healthStatus];
          const toConfig = HEALTH_CONFIG[pair.to.healthStatus];
          
          return (
            <motion.div
              key={`${pair.from.serviceName}-${pair.to.serviceName}`}
              initial={animated ? { opacity: 0, x: -10 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: animated ? 0.9 + (index * 0.1) : 0 }}
              className="flex items-center gap-2 text-xs bg-panel-secondary rounded p-2"
            >
              <span className={`px-2 py-0.5 rounded ${fromConfig.bgColor} ${fromConfig.textColor}`}>
                {pair.from.serviceName}
              </span>
              <ArrowRight className="w-3 h-3 text-muted" />
              <span className={`px-2 py-0.5 rounded ${toConfig.bgColor} ${toConfig.textColor}`}>
                {pair.to.serviceName}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/**
 * BlastRadiusSummary - Summary statistics for the blast radius
 */
interface BlastRadiusSummaryProps {
  nodes: BlastRadiusNode[];
  animated: boolean;
}

function BlastRadiusSummary({ nodes, animated }: BlastRadiusSummaryProps) {
  const stats = useMemo(() => {
    const healthCounts = { healthy: 0, warning: 0, critical: 0 };
    const impactCounts = { low: 0, medium: 0, high: 0 };
    
    nodes.forEach(node => {
      healthCounts[node.healthStatus]++;
      impactCounts[node.impactLevel]++;
    });
    
    return { healthCounts, impactCounts, total: nodes.length };
  }, [nodes]);

  return (
    <motion.div
      initial={animated ? { opacity: 0, y: -10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center justify-between gap-4 mb-4 p-3 bg-panel-secondary rounded-lg border border-border"
    >
      <div className="flex items-center gap-4">
        <div className="text-xs">
          <span className="text-muted">Services Affected: </span>
          <span className="text-foreground font-medium">{stats.total}</span>
        </div>
        
        {/* Health Status Counts */}
        <div className="flex items-center gap-2">
          {stats.healthCounts.critical > 0 && (
            <span className="flex items-center gap-1 text-xs text-status-error">
              <AlertCircle className="w-3 h-3" />
              {stats.healthCounts.critical}
            </span>
          )}
          {stats.healthCounts.warning > 0 && (
            <span className="flex items-center gap-1 text-xs text-status-warning">
              <AlertTriangle className="w-3 h-3" />
              {stats.healthCounts.warning}
            </span>
          )}
          {stats.healthCounts.healthy > 0 && (
            <span className="flex items-center gap-1 text-xs text-status-success">
              <CheckCircle2 className="w-3 h-3" />
              {stats.healthCounts.healthy}
            </span>
          )}
        </div>
      </div>

      {/* Impact Summary */}
      <div className="flex items-center gap-2 text-xs">
        {stats.impactCounts.high > 0 && (
          <span className="px-2 py-0.5 rounded bg-status-error/20 text-status-error">
            {stats.impactCounts.high} High
          </span>
        )}
        {stats.impactCounts.medium > 0 && (
          <span className="px-2 py-0.5 rounded bg-status-warning/20 text-status-warning">
            {stats.impactCounts.medium} Med
          </span>
        )}
        {stats.impactCounts.low > 0 && (
          <span className="px-2 py-0.5 rounded bg-status-success/20 text-status-success">
            {stats.impactCounts.low} Low
          </span>
        )}
      </div>
    </motion.div>
  );
}

/**
 * EmptyState - Displayed when no blast radius data is available
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 rounded-full bg-panel-secondary mb-3">
        <Zap className="w-6 h-6 text-muted-foreground" />
      </div>
      <div className="text-sm text-muted">No blast radius data available</div>
      <div className="text-xs text-muted-foreground mt-1">
        Blast radius will be calculated when remediation is proposed
      </div>
    </div>
  );
}

/**
 * BlastRadiusVisualization Component
 * 
 * Main component that displays the interactive service dependency graph
 * with health status color-coding and impact level indicators.
 * 
 * Requirements: 7.1, 7.2, 7.3
 */
export function BlastRadiusVisualization({ 
  nodes, 
  className = '',
  showDependencies = true,
  animated = true
}: BlastRadiusVisualizationProps) {
  // Sort nodes by impact level (high first) and health status (critical first)
  const sortedNodes = useMemo(() => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    const healthOrder = { critical: 0, warning: 1, healthy: 2 };
    
    return [...nodes].sort((a, b) => {
      // First sort by impact level
      const impactDiff = impactOrder[a.impactLevel] - impactOrder[b.impactLevel];
      if (impactDiff !== 0) return impactDiff;
      
      // Then by health status
      return healthOrder[a.healthStatus] - healthOrder[b.healthStatus];
    });
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className={`bg-panel-secondary rounded-lg border border-border p-4 ${className}`}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={`bg-panel-secondary rounded-lg border border-border p-4 ${className}`}>
      {/* Summary Statistics */}
      <BlastRadiusSummary nodes={nodes} animated={animated} />

      {/* Service Nodes Grid */}
      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedNodes.map((node, index) => (
            <ServiceNode 
              key={node.serviceName} 
              node={node} 
              index={index}
              animated={animated}
            />
          ))}
        </div>
      </AnimatePresence>

      {/* Dependency Chain Visualization */}
      {showDependencies && (
        <DependencyChain nodes={nodes} animated={animated} />
      )}
    </div>
  );
}

export default BlastRadiusVisualization;
