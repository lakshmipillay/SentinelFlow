'use client';

/**
 * ActiveAlertCard Component
 * 
 * Displays active alert information in JSON-style format with red border emphasis.
 * Part of the Left Panel (Incoming Signal) in the Mission Control dashboard.
 * 
 * Requirements: 14.1 - Display active alert in JSON-style format with service, 
 * severity, metric, and timestamp information
 * 
 * Task 10.1: Create Active Alert Card component
 * - Implement JSON-style alert display with red border
 * - Add service, severity, metric, and timestamp display
 * - Create alert data formatting and validation
 */

import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { ActiveAlert, AlertSeverity } from '@/types/workflow';

/**
 * Props for the ActiveAlertCard component
 */
interface ActiveAlertCardProps {
  /** The active alert to display, or null if no alert */
  alert: ActiveAlert | null;
  /** Optional CSS class name for additional styling */
  className?: string;
}

/**
 * Get the appropriate icon for the alert severity
 */
function getSeverityIcon(severity: AlertSeverity): React.ReactNode {
  switch (severity) {
    case 'critical':
      return <AlertTriangle className="w-4 h-4 text-status-error" />;
    case 'warning':
      return <AlertCircle className="w-4 h-4 text-status-warning" />;
    case 'info':
    default:
      return <Info className="w-4 h-4 text-status-analyzing" />;
  }
}

/**
 * Get the border color class based on severity
 */
function getSeverityBorderClass(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical':
      return 'border-status-error/50 shadow-status-error/10';
    case 'warning':
      return 'border-status-warning/50 shadow-status-warning/10';
    case 'info':
    default:
      return 'border-status-analyzing/50 shadow-status-analyzing/10';
  }
}

/**
 * Get the severity badge color class
 */
function getSeverityBadgeClass(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-status-error/20 text-status-error';
    case 'warning':
      return 'bg-status-warning/20 text-status-warning';
    case 'info':
    default:
      return 'bg-status-analyzing/20 text-status-analyzing';
  }
}

/**
 * Format the timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch {
    return timestamp;
  }
}

/**
 * Validate alert data structure
 */
function isValidAlert(alert: ActiveAlert | null): alert is ActiveAlert {
  if (!alert) return false;
  
  return (
    typeof alert.service === 'string' &&
    alert.service.length > 0 &&
    ['critical', 'warning', 'info'].includes(alert.severity) &&
    typeof alert.metric === 'string' &&
    alert.metric.length > 0 &&
    typeof alert.value === 'number' &&
    typeof alert.timestamp === 'string' &&
    alert.timestamp.length > 0
  );
}

/**
 * Format alert data for JSON display with syntax highlighting
 */
function formatAlertJson(alert: ActiveAlert): React.ReactNode {
  return (
    <div className="font-mono text-xs leading-relaxed">
      <span className="text-muted-foreground">{'{'}</span>
      <div className="pl-4">
        <div>
          <span className="text-agent-security">"service"</span>
          <span className="text-muted-foreground">: </span>
          <span className="text-status-success">"{alert.service}"</span>
          <span className="text-muted-foreground">,</span>
        </div>
        <div>
          <span className="text-agent-security">"severity"</span>
          <span className="text-muted-foreground">: </span>
          <span className={`${
            alert.severity === 'critical' ? 'text-status-error' :
            alert.severity === 'warning' ? 'text-status-warning' :
            'text-status-analyzing'
          }`}>"{alert.severity}"</span>
          <span className="text-muted-foreground">,</span>
        </div>
        <div>
          <span className="text-agent-security">"metric"</span>
          <span className="text-muted-foreground">: </span>
          <span className="text-status-success">"{alert.metric}"</span>
          <span className="text-muted-foreground">,</span>
        </div>
        <div>
          <span className="text-agent-security">"value"</span>
          <span className="text-muted-foreground">: </span>
          <span className="text-accent">{alert.value}</span>
          <span className="text-muted-foreground">,</span>
        </div>
        <div>
          <span className="text-agent-security">"timestamp"</span>
          <span className="text-muted-foreground">: </span>
          <span className="text-status-success">"{alert.timestamp}"</span>
        </div>
        {alert.description && (
          <div>
            <span className="text-muted-foreground">,</span>
            <span className="text-agent-security">"description"</span>
            <span className="text-muted-foreground">: </span>
            <span className="text-status-success">"{alert.description}"</span>
          </div>
        )}
      </div>
      <span className="text-muted-foreground">{'}'}</span>
    </div>
  );
}

/**
 * ActiveAlertCard Component
 * 
 * Displays active alert information in a JSON-style format with:
 * - Red border emphasis for critical alerts
 * - Service, severity, metric, value, and timestamp display
 * - Syntax highlighting for JSON structure
 * - Empty state handling when no alert is present
 */
export function ActiveAlertCard({ alert, className = '' }: ActiveAlertCardProps): React.ReactElement {
  // Handle empty state
  if (!alert) {
    return (
      <div className={`bg-panel-secondary rounded p-4 text-center border border-border ${className}`}>
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
        <div className="text-sm text-muted">No active alerts</div>
        <div className="text-xs mt-1 text-muted-foreground">
          System is operating normally
        </div>
      </div>
    );
  }

  // Validate alert data
  if (!isValidAlert(alert)) {
    return (
      <div className={`bg-panel-secondary rounded p-4 text-center border border-status-warning/50 ${className}`}>
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-status-warning" />
        <div className="text-sm text-status-warning">Invalid alert data</div>
        <div className="text-xs mt-1 text-muted-foreground">
          Alert data is malformed or incomplete
        </div>
      </div>
    );
  }

  const borderClass = getSeverityBorderClass(alert.severity);
  const badgeClass = getSeverityBadgeClass(alert.severity);

  return (
    <div 
      className={`bg-panel-secondary border-2 ${borderClass} rounded-lg shadow-lg overflow-hidden ${className}`}
      role="alert"
      aria-live="polite"
    >
      {/* Alert Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-panel border-b border-border">
        <div className="flex items-center gap-2">
          {getSeverityIcon(alert.severity)}
          <span className="text-sm font-medium text-foreground">
            {alert.service}
          </span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium uppercase ${badgeClass}`}>
          {alert.severity}
        </span>
      </div>

      {/* Alert Body - JSON Display */}
      <div className="p-3">
        {formatAlertJson(alert)}
      </div>

      {/* Alert Footer - Formatted Timestamp */}
      <div className="px-3 py-2 bg-panel border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted">Triggered</span>
        <span className="text-xs text-muted-foreground font-mono">
          {formatTimestamp(alert.timestamp)}
        </span>
      </div>
    </div>
  );
}

export default ActiveAlertCard;
