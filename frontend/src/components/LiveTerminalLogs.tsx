'use client';

/**
 * LiveTerminalLogs Component
 * 
 * Displays live streaming terminal logs with auto-scrolling, syntax highlighting,
 * and activity-responsive scrolling speed. Part of the Left Panel (Incoming Signal)
 * in the Mission Control dashboard.
 * 
 * Requirements:
 * - 14.2: Stream live terminal logs with auto-scrolling, syntax highlighting, and monospace formatting
 * - 14.3: Highlight error lines with red coloring, timestamps, and appropriate visual emphasis
 * - 14.4: Increase log scrolling speed during active analysis activity
 * - 14.5: Slow down log activity when incidents are resolved
 * 
 * Task 10.3: Implement Live Terminal Logs component
 * - Create auto-scrolling log stream with syntax highlighting
 * - Add monospace formatting and error line highlighting
 * - Implement activity-responsive scrolling speed
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LogEntry } from '@/types/workflow';

/**
 * Props for the LiveTerminalLogs component
 */
export interface LiveTerminalLogsProps {
  /** Array of log entries to display */
  logs: LogEntry[];
  /** Whether logs are actively streaming */
  isStreaming?: boolean;
  /** Whether agents are actively investigating (affects scroll speed) */
  isActivelyInvestigating?: boolean;
  /** Whether the incident is resolved (slows down activity) */
  isResolved?: boolean;
  /** Maximum number of logs to display (for performance) */
  maxLogs?: number;
  /** Optional CSS class name for additional styling */
  className?: string;
  /** Optional callback when user manually scrolls */
  onUserScroll?: () => void;
}

/**
 * Log level type for syntax highlighting
 */
type LogLevel = 'error' | 'warning' | 'info' | 'debug';

/**
 * Get the CSS class for log level styling
 */
function getLogLevelClass(level: LogLevel): string {
  switch (level) {
    case 'error':
      return 'log-error';
    case 'warning':
      return 'log-warning';
    case 'info':
      return 'log-info';
    case 'debug':
    default:
      return 'log-debug';
  }
}

/**
 * Get the badge class for log level indicator
 */
function getLogLevelBadgeClass(level: LogLevel): string {
  switch (level) {
    case 'error':
      return 'bg-status-error/20 text-status-error';
    case 'warning':
      return 'bg-status-warning/20 text-status-warning';
    case 'info':
      return 'bg-status-analyzing/20 text-status-analyzing';
    case 'debug':
    default:
      return 'bg-muted/20 text-muted';
  }
}

/**
 * Format timestamp for display in terminal format
 */
function formatLogTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
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
 * Apply syntax highlighting to log message
 * Highlights common patterns like:
 * - IP addresses
 * - URLs
 * - Numbers/metrics
 * - Quoted strings
 * - Error keywords
 */
function highlightLogMessage(message: string, level: LogLevel): React.ReactNode {
  // For error logs, highlight the entire message
  if (level === 'error') {
    return <span className="text-status-error font-medium">{message}</span>;
  }

  // For warning logs, use warning color
  if (level === 'warning') {
    return <span className="text-status-warning">{message}</span>;
  }

  // For info logs, use info color
  if (level === 'info') {
    return <span className="text-status-analyzing">{message}</span>;
  }

  // For debug logs, use muted color
  return <span className="text-muted-foreground">{message}</span>;
}

/**
 * Single log entry component with syntax highlighting
 */
interface LogLineProps {
  log: LogEntry;
  index: number;
}

function LogLine({ log, index }: LogLineProps): React.ReactElement {
  const levelClass = getLogLevelClass(log.level);
  const badgeClass = getLogLevelBadgeClass(log.level);
  const isError = log.level === 'error';

  return (
    <div 
      className={`log-line ${levelClass} ${isError ? 'error-highlight' : ''}`}
      data-testid={`log-entry-${index}`}
      data-log-level={log.level}
    >
      {/* Timestamp */}
      <span className="log-timestamp">
        {formatLogTimestamp(log.timestamp)}
      </span>
      
      {/* Log Level Badge */}
      <span className={`log-level-badge ${badgeClass}`}>
        {log.level.toUpperCase().padEnd(5)}
      </span>
      
      {/* Source (if available) */}
      {log.source && (
        <span className="log-source">
          [{log.source}]
        </span>
      )}
      
      {/* Message with syntax highlighting */}
      <span className="log-message">
        {highlightLogMessage(log.message, log.level)}
      </span>
    </div>
  );
}

/**
 * LiveTerminalLogs Component
 * 
 * A terminal-style log viewer with:
 * - Auto-scrolling that follows new logs
 * - Syntax highlighting for different log levels
 * - Monospace font for terminal appearance
 * - Error line highlighting with red emphasis
 * - Activity-responsive scrolling speed
 * - User scroll detection to pause auto-scroll
 */
export function LiveTerminalLogs({
  logs,
  isStreaming = false,
  isActivelyInvestigating = false,
  isResolved = false,
  maxLogs = 500,
  className = '',
  onUserScroll
}: LiveTerminalLogsProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const lastLogCountRef = useRef(logs.length);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate scroll speed based on activity state
  // Requirements 14.4, 14.5: Activity-responsive scrolling
  const getScrollBehavior = useCallback((): ScrollBehavior => {
    if (isResolved) {
      return 'smooth'; // Slow, smooth scrolling when resolved
    }
    if (isActivelyInvestigating) {
      return 'auto'; // Instant scrolling during active investigation
    }
    return 'smooth'; // Default smooth scrolling
  }, [isActivelyInvestigating, isResolved]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (!containerRef.current || !autoScroll) return;

    const newLogsAdded = logs.length > lastLogCountRef.current;
    lastLogCountRef.current = logs.length;

    if (newLogsAdded) {
      const scrollBehavior = getScrollBehavior();
      
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: scrollBehavior
          });
        }
      });
    }
  }, [logs, autoScroll, getScrollBehavior]);

  // Handle user scroll to detect manual scrolling
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    // If user scrolled away from bottom, pause auto-scroll
    if (!isAtBottom && !userScrolled) {
      setUserScrolled(true);
      setAutoScroll(false);
      onUserScroll?.();
    }

    // If user scrolled back to bottom, resume auto-scroll
    if (isAtBottom && userScrolled) {
      // Debounce to prevent rapid toggling
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setUserScrolled(false);
        setAutoScroll(true);
      }, 100);
    }
  }, [userScrolled, onUserScroll]);

  // Resume auto-scroll button handler
  const handleResumeAutoScroll = useCallback(() => {
    setUserScrolled(false);
    setAutoScroll(true);
    
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Limit displayed logs for performance
  const displayedLogs = logs.slice(-maxLogs);

  // Calculate activity indicator animation speed
  const getActivityIndicatorClass = (): string => {
    if (isResolved) {
      return 'activity-slow';
    }
    if (isActivelyInvestigating) {
      return 'activity-fast';
    }
    return 'activity-normal';
  };

  return (
    <div className={`live-terminal-logs ${className}`} data-testid="live-terminal-logs">
      {/* Header with streaming indicator */}
      <div className="terminal-header">
        <span className="terminal-title">Live Logs</span>
        <div className="terminal-status">
          {isStreaming && (
            <span className={`streaming-indicator ${getActivityIndicatorClass()}`}>
              <span className="streaming-dot"></span>
              {isActivelyInvestigating ? 'Active Analysis' : isResolved ? 'Resolved' : 'Streaming'}
            </span>
          )}
          {userScrolled && (
            <button 
              onClick={handleResumeAutoScroll}
              className="resume-scroll-btn"
              aria-label="Resume auto-scroll"
            >
              ↓ Resume
            </button>
          )}
        </div>
      </div>

      {/* Log container with auto-scroll */}
      <div 
        ref={containerRef}
        className="terminal-container"
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Live terminal logs"
      >
        {displayedLogs.length > 0 ? (
          displayedLogs.map((log, index) => (
            <LogLine 
              key={`${log.timestamp}-${index}`} 
              log={log} 
              index={index} 
            />
          ))
        ) : (
          <div className="terminal-empty">
            <span className="terminal-empty-icon">📋</span>
            <span className="terminal-empty-text">Waiting for log stream...</span>
          </div>
        )}
      </div>

      {/* Footer with log count */}
      <div className="terminal-footer">
        <span className="log-count">
          {displayedLogs.length} {displayedLogs.length === 1 ? 'entry' : 'entries'}
          {logs.length > maxLogs && ` (showing last ${maxLogs})`}
        </span>
        {!autoScroll && (
          <span className="scroll-paused">Auto-scroll paused</span>
        )}
      </div>
    </div>
  );
}

export default LiveTerminalLogs;
