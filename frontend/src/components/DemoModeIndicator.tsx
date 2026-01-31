'use client';

/**
 * Demo Mode Indicator Component
 * Displays clear simulation status indicators when demo mode is active
 * **Property 30: Demo Mode Isolation**
 * **Validates: Requirements 11.4**
 * 
 * This component ensures:
 * 1. Clear visual indication that demo mode is active
 * 2. Shows that all data is simulated
 * 3. Indicates that no real system interactions occur
 * 4. Provides safety constraint status
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, Lock, Database, Wifi, Key } from 'lucide-react';

export interface DemoModeIndicatorProps {
  /** Whether demo mode is currently active */
  isDemoMode: boolean;
  /** Status text to display */
  statusText?: string;
  /** Color indicator for status */
  statusColor?: 'green' | 'yellow' | 'red';
  /** Warning message to display */
  warningMessage?: string;
  /** Number of blocked external actions */
  blockedActionsCount?: number;
  /** Safety score (0-100) */
  safetyScore?: number;
  /** Whether isolation is active */
  isolationActive?: boolean;
  /** Compact mode for header display */
  compact?: boolean;
  /** Show detailed safety constraints */
  showDetails?: boolean;
}

/**
 * Safety constraint status display
 */
interface SafetyConstraint {
  name: string;
  icon: React.ReactNode;
  active: boolean;
  description: string;
}

/**
 * Demo Mode Indicator Component
 * Provides clear visual feedback about demo mode status and safety constraints
 */
export function DemoModeIndicator({
  isDemoMode,
  statusText = 'DEMO MODE',
  statusColor = 'yellow',
  warningMessage = 'All data is simulated. No real system interactions.',
  blockedActionsCount = 0,
  safetyScore = 100,
  isolationActive = true,
  compact = false,
  showDetails = false,
}: DemoModeIndicatorProps) {
  if (!isDemoMode) {
    return null;
  }

  const safetyConstraints: SafetyConstraint[] = [
    {
      name: 'No External Actions',
      icon: <Shield className="w-3 h-3" />,
      active: true,
      description: 'All external API calls are blocked',
    },
    {
      name: 'No Credential Access',
      icon: <Key className="w-3 h-3" />,
      active: true,
      description: 'Credential usage is prevented',
    },
    {
      name: 'No Infrastructure Mutation',
      icon: <Database className="w-3 h-3" />,
      active: true,
      description: 'Infrastructure changes are blocked',
    },
    {
      name: 'Simulated WebSocket',
      icon: <Wifi className="w-3 h-3" />,
      active: true,
      description: 'WebSocket connections are simulated',
    },
  ];

  const getStatusColorClass = () => {
    switch (statusColor) {
      case 'green':
        return 'bg-status-success/20 border-status-success/40 text-status-success';
      case 'red':
        return 'bg-status-error/20 border-status-error/40 text-status-error';
      case 'yellow':
      default:
        return 'bg-status-warning/20 border-status-warning/40 text-status-warning';
    }
  };

  // Compact mode for header
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2"
      >
        {/* Primary Badge */}
        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full border-2 ${getStatusColorClass()}`}
        >
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            {statusText}
          </span>
        </span>

        {/* Simulated Data Indicator */}
        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-panel-secondary rounded border border-border">
          Simulated Data
        </span>

        {/* Blocked Actions Counter */}
        {blockedActionsCount > 0 && (
          <span className="text-xs text-status-warning px-2 py-0.5 bg-status-warning/10 rounded">
            {blockedActionsCount} blocked
          </span>
        )}
      </motion.div>
    );
  }

  // Full mode with details
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-panel-secondary border border-status-warning/30 rounded-lg p-4 shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${getStatusColorClass()}`}>
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{statusText}</h3>
              <p className="text-xs text-muted-foreground">{warningMessage}</p>
            </div>
          </div>

          {/* Safety Score */}
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Safety Score</div>
            <div
              className={`text-lg font-bold ${
                safetyScore >= 80
                  ? 'text-status-success'
                  : safetyScore >= 50
                  ? 'text-status-warning'
                  : 'text-status-error'
              }`}
            >
              {safetyScore}%
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="flex items-center gap-2 p-2 bg-status-warning/10 rounded border border-status-warning/20 mb-3">
          <AlertTriangle className="w-4 h-4 text-status-warning flex-shrink-0" />
          <span className="text-xs text-status-warning">
            Demo mode is active. All data is simulated and no real system interactions will occur.
          </span>
        </div>

        {/* Safety Constraints */}
        {showDetails && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium">Safety Constraints</div>
            <div className="grid grid-cols-2 gap-2">
              {safetyConstraints.map((constraint) => (
                <div
                  key={constraint.name}
                  className="flex items-center gap-2 p-2 bg-panel rounded border border-border"
                >
                  <div
                    className={`p-1 rounded ${
                      constraint.active
                        ? 'bg-status-success/20 text-status-success'
                        : 'bg-status-error/20 text-status-error'
                    }`}
                  >
                    {constraint.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">
                      {constraint.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {constraint.description}
                    </div>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      constraint.active ? 'bg-status-success' : 'bg-status-error'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blocked Actions */}
        {blockedActionsCount > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">External Actions Blocked</span>
              <span className="font-medium text-status-warning">{blockedActionsCount}</span>
            </div>
          </div>
        )}

        {/* Isolation Status */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Isolation Status</span>
            <span
              className={`font-medium ${
                isolationActive ? 'text-status-success' : 'text-status-error'
              }`}
            >
              {isolationActive ? '✓ Active' : '✗ Inactive'}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Inline demo mode badge for use in various UI locations
 */
export function DemoModeBadge({
  isDemoMode,
  size = 'sm',
}: {
  isDemoMode: boolean;
  size?: 'xs' | 'sm' | 'md';
}) {
  if (!isDemoMode) {
    return null;
  }

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium text-status-warning bg-status-warning/20 border border-status-warning/30 rounded ${sizeClasses[size]}`}
    >
      <Lock className={size === 'xs' ? 'w-2 h-2' : size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      DEMO
    </span>
  );
}

/**
 * Simulated data indicator for data displays
 */
export function SimulatedDataIndicator({
  isDemoMode,
  dataType = 'data',
}: {
  isDemoMode: boolean;
  dataType?: string;
}) {
  if (!isDemoMode) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <AlertTriangle className="w-3 h-3 text-status-warning" />
      <span>Simulated {dataType}</span>
    </div>
  );
}

export default DemoModeIndicator;
