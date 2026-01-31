/**
 * Property-Based Tests for Log Stream Visualization
 * **Property 35: Log Stream Visualization**
 * **Validates: Requirements 14.2, 14.3**
 * 
 * Tests that:
 * - All log entries must have required fields (timestamp, level, message)
 * - Log level must be one of: error, warning, info, debug
 * - Timestamp must be a valid ISO8601 string
 * - Error logs must be visually distinguishable (different styling)
 * - Log ordering must be preserved (chronological)
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Log level types - must be one of these four values
 * Requirements 14.2: Stream live terminal logs with syntax highlighting
 */
export type LogLevel = 'error' | 'warning' | 'info' | 'debug';

/**
 * Log entry interface matching frontend requirements
 * Requirements 14.2, 14.3: Display logs with timestamps, levels, and messages
 */
export interface LogEntry {
  timestamp: string; // ISO8601
  level: LogLevel;
  message: string;
  source?: string;
}

/**
 * Valid log levels for terminal display
 */
export const VALID_LOG_LEVELS: readonly LogLevel[] = ['error', 'warning', 'info', 'debug'] as const;

/**
 * Log styling configuration for visual distinction
 * Requirements 14.3: Error logs must be visually distinguishable
 */
export interface LogStyling {
  textColor: string;
  backgroundColor: string;
  fontWeight: string;
  hasHighlight: boolean;
}

/**
 * Log styling map for different log levels
 */
export const LOG_LEVEL_STYLING: Record<LogLevel, LogStyling> = {
  error: {
    textColor: 'text-status-error',
    backgroundColor: 'bg-status-error/20',
    fontWeight: 'font-medium',
    hasHighlight: true
  },
  warning: {
    textColor: 'text-status-warning',
    backgroundColor: 'bg-status-warning/20',
    fontWeight: 'font-normal',
    hasHighlight: false
  },
  info: {
    textColor: 'text-status-analyzing',
    backgroundColor: 'bg-status-analyzing/20',
    fontWeight: 'font-normal',
    hasHighlight: false
  },
  debug: {
    textColor: 'text-muted',
    backgroundColor: 'bg-muted/20',
    fontWeight: 'font-normal',
    hasHighlight: false
  }
};

/**
 * Validates that a string is a valid ISO8601 timestamp
 */
export function isValidISO8601(timestamp: string): boolean {
  if (typeof timestamp !== 'string' || timestamp.length === 0) {
    return false;
  }
  
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return false;
  }
  
  // Check if it's a valid ISO8601 format
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/;
  return iso8601Regex.test(timestamp);
}

/**
 * Validates that a log level is one of the allowed values
 */
export function isValidLogLevel(level: string): level is LogLevel {
  return VALID_LOG_LEVELS.includes(level as LogLevel);
}

/**
 * Validates that a message is a non-empty string
 */
export function isNonEmptyString(str: string): boolean {
  return typeof str === 'string' && str.trim().length > 0;
}

/**
 * Validates a log entry has all required fields with correct types
 */
export function validateLogEntry(log: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!log || typeof log !== 'object') {
    return { isValid: false, errors: ['Log entry must be a non-null object'] };
  }
  
  const logObj = log as Record<string, unknown>;
  
  // Validate timestamp field (required)
  if (!('timestamp' in logObj)) {
    errors.push('Missing required field: timestamp');
  } else if (!isValidISO8601(logObj.timestamp as string)) {
    errors.push('Field "timestamp" must be a valid ISO8601 string');
  }
  
  // Validate level field (required)
  if (!('level' in logObj)) {
    errors.push('Missing required field: level');
  } else if (!isValidLogLevel(logObj.level as string)) {
    errors.push(`Field "level" must be one of: ${VALID_LOG_LEVELS.join(', ')}`);
  }
  
  // Validate message field (required)
  if (!('message' in logObj)) {
    errors.push('Missing required field: message');
  } else if (!isNonEmptyString(logObj.message as string)) {
    errors.push('Field "message" must be a non-empty string');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Gets the styling for a log level
 * Requirements 14.3: Error logs must be visually distinguishable
 */
export function getLogStyling(level: LogLevel): LogStyling {
  return LOG_LEVEL_STYLING[level];
}

/**
 * Checks if error logs are visually distinguishable from other levels
 */
export function isErrorVisuallyDistinguishable(errorStyling: LogStyling, otherStyling: LogStyling): boolean {
  // Error logs must have different styling from other levels
  return (
    errorStyling.textColor !== otherStyling.textColor ||
    errorStyling.backgroundColor !== otherStyling.backgroundColor ||
    errorStyling.hasHighlight !== otherStyling.hasHighlight
  );
}

/**
 * Validates that log entries are in chronological order
 */
export function areLogsChronological(logs: LogEntry[]): boolean {
  if (logs.length <= 1) {
    return true;
  }
  
  for (let i = 1; i < logs.length; i++) {
    const prevTime = new Date(logs[i - 1].timestamp).getTime();
    const currTime = new Date(logs[i].timestamp).getTime();
    
    if (currTime < prevTime) {
      return false;
    }
  }
  
  return true;
}

/**
 * Creates a valid log entry for testing
 */
export function createValidLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Test log message',
    ...overrides
  };
}

/**
 * Creates a sequence of chronologically ordered log entries
 */
export function createChronologicalLogs(count: number, baseTime: Date = new Date()): LogEntry[] {
  const logs: LogEntry[] = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(baseTime.getTime() + i * 1000);
    logs.push({
      timestamp: timestamp.toISOString(),
      level: VALID_LOG_LEVELS[i % VALID_LOG_LEVELS.length],
      message: `Log message ${i + 1}`
    });
  }
  
  return logs;
}

describe('Property 35: Log Stream Visualization', () => {
  
  /**
   * Generators for property-based testing
   */
  const generateValidLogLevel = (): fc.Arbitrary<LogLevel> => {
    return fc.constantFrom('error', 'warning', 'info', 'debug');
  };

  const generateInvalidLogLevel = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'ERROR',
      'WARNING',
      'INFO',
      'DEBUG',
      'fatal',
      'trace',
      'notice',
      'critical',
      '',
      'unknown'
    );
  };

  const generateValidTimestamp = (): fc.Arbitrary<string> => {
    return fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map(date => date.toISOString());
  };

  const generateInvalidTimestamp = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      '',
      'invalid-timestamp',
      '2024-13-45',
      '2024/01/15',
      'not-a-date',
      '15-01-2024',
      'Jan 15, 2024'
    );
  };

  const generateValidMessage = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'Connection established to database',
      'Error: Connection timeout after 30s',
      'Warning: High memory usage detected',
      'Processing request from 192.168.1.1',
      'Query executed in 150ms',
      'Authentication failed for user admin',
      'Service health check passed',
      'Cache miss for key: user_session_123'
    );
  };

  const generateValidSource = (): fc.Arbitrary<string | undefined> => {
    return fc.option(
      fc.constantFrom(
        'api-gateway',
        'database',
        'auth-service',
        'cache-layer',
        'load-balancer',
        'monitoring'
      ),
      { nil: undefined }
    );
  };

  const generateValidLogEntry = (): fc.Arbitrary<LogEntry> => {
    return fc.record({
      timestamp: generateValidTimestamp(),
      level: generateValidLogLevel(),
      message: generateValidMessage(),
      source: generateValidSource()
    });
  };

  const generateChronologicalLogs = (): fc.Arbitrary<LogEntry[]> => {
    return fc.integer({ min: 2, max: 10 }).chain(count => {
      return fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
        .chain(baseDate => {
          return fc.array(
            fc.record({
              level: generateValidLogLevel(),
              message: generateValidMessage(),
              source: generateValidSource()
            }),
            { minLength: count, maxLength: count }
          ).map(entries => {
            return entries.map((entry, index) => ({
              ...entry,
              timestamp: new Date(baseDate.getTime() + index * 1000).toISOString()
            }));
          });
        });
    });
  };

  /**
   * Property Tests
   */
  test('All valid log entries must have required fields (timestamp, level, message)', async () => {
    await fc.assert(
      fc.property(
        generateValidLogEntry(),
        (log: LogEntry) => {
          const result = validateLogEntry(log);
          
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
          
          // Verify all required fields are present
          expect(log).toHaveProperty('timestamp');
          expect(log).toHaveProperty('level');
          expect(log).toHaveProperty('message');
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Log level must be one of: error, warning, info, debug', async () => {
    await fc.assert(
      fc.property(
        generateValidLogLevel(),
        (level: LogLevel) => {
          expect(isValidLogLevel(level)).toBe(true);
          expect(VALID_LOG_LEVELS).toContain(level);
          
          const log = createValidLogEntry({ level });
          const result = validateLogEntry(log);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Invalid log levels must be rejected', async () => {
    await fc.assert(
      fc.property(
        generateInvalidLogLevel(),
        (invalidLevel: string) => {
          expect(isValidLogLevel(invalidLevel)).toBe(false);
          
          const log = createValidLogEntry({ level: invalidLevel as LogLevel });
          const result = validateLogEntry(log);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('level'))).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Timestamp must be a valid ISO8601 string', async () => {
    await fc.assert(
      fc.property(
        generateValidTimestamp(),
        (timestamp: string) => {
          expect(isValidISO8601(timestamp)).toBe(true);
          
          const log = createValidLogEntry({ timestamp });
          const result = validateLogEntry(log);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Invalid timestamps must be rejected', async () => {
    await fc.assert(
      fc.property(
        generateInvalidTimestamp(),
        (invalidTimestamp: string) => {
          expect(isValidISO8601(invalidTimestamp)).toBe(false);
          
          const log = createValidLogEntry({ timestamp: invalidTimestamp });
          const result = validateLogEntry(log);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('timestamp'))).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Error logs must be visually distinguishable from other log levels', async () => {
    await fc.assert(
      fc.property(
        fc.constantFrom('warning', 'info', 'debug') as fc.Arbitrary<LogLevel>,
        (otherLevel: LogLevel) => {
          const errorStyling = getLogStyling('error');
          const otherStyling = getLogStyling(otherLevel);
          
          // Error logs must have different styling
          expect(isErrorVisuallyDistinguishable(errorStyling, otherStyling)).toBe(true);
          
          // Error logs must have highlight enabled
          expect(errorStyling.hasHighlight).toBe(true);
          
          // Other levels should not have highlight
          expect(otherStyling.hasHighlight).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Log ordering must be preserved (chronological)', async () => {
    await fc.assert(
      fc.property(
        generateChronologicalLogs(),
        (logs: LogEntry[]) => {
          expect(areLogsChronological(logs)).toBe(true);
          
          // Verify each log entry is valid
          for (const log of logs) {
            const result = validateLogEntry(log);
            expect(result.isValid).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Message must be a non-empty string', async () => {
    await fc.assert(
      fc.property(
        generateValidMessage(),
        (message: string) => {
          expect(isNonEmptyString(message)).toBe(true);
          
          const log = createValidLogEntry({ message });
          const result = validateLogEntry(log);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Empty message must be rejected', () => {
    const logWithEmptyMessage = createValidLogEntry({ message: '' });
    const result = validateLogEntry(logWithEmptyMessage);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('message'))).toBe(true);
  });

  test('Missing required fields must be detected', () => {
    // Test missing timestamp
    const noTimestamp = { level: 'info', message: 'test' };
    expect(validateLogEntry(noTimestamp).errors.some(e => e.includes('timestamp'))).toBe(true);
    
    // Test missing level
    const noLevel = { timestamp: new Date().toISOString(), message: 'test' };
    expect(validateLogEntry(noLevel).errors.some(e => e.includes('level'))).toBe(true);
    
    // Test missing message
    const noMessage = { timestamp: new Date().toISOString(), level: 'info' };
    expect(validateLogEntry(noMessage).errors.some(e => e.includes('message'))).toBe(true);
  });

  test('Null and undefined log entries must be rejected', () => {
    expect(validateLogEntry(null).isValid).toBe(false);
    expect(validateLogEntry(undefined).isValid).toBe(false);
    expect(validateLogEntry({}).isValid).toBe(false);
  });

  test('Log entry validation is consistent across multiple runs', async () => {
    await fc.assert(
      fc.property(
        generateValidLogEntry(),
        (log: LogEntry) => {
          const result1 = validateLogEntry(log);
          const result2 = validateLogEntry(log);
          const result3 = validateLogEntry(log);
          
          // Validation should be deterministic
          expect(result1.isValid).toBe(result2.isValid);
          expect(result2.isValid).toBe(result3.isValid);
          expect(result1.errors).toEqual(result2.errors);
          expect(result2.errors).toEqual(result3.errors);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Optional source field does not affect validation', async () => {
    await fc.assert(
      fc.property(
        generateValidLogEntry(),
        (log: LogEntry) => {
          // Test with source
          const logWithSource = { ...log, source: 'api-gateway' };
          const resultWithSource = validateLogEntry(logWithSource);
          expect(resultWithSource.isValid).toBe(true);
          
          // Test without source
          const { source, ...logWithoutSource } = log;
          const resultWithoutSource = validateLogEntry(logWithoutSource);
          expect(resultWithoutSource.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('All four log levels produce valid log entries', () => {
    for (const level of VALID_LOG_LEVELS) {
      const log = createValidLogEntry({ level });
      const result = validateLogEntry(log);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  test('Each log level has distinct styling', () => {
    const stylings = VALID_LOG_LEVELS.map(level => getLogStyling(level));
    
    // Check that each level has unique text color
    const textColors = stylings.map(s => s.textColor);
    const uniqueTextColors = new Set(textColors);
    expect(uniqueTextColors.size).toBe(VALID_LOG_LEVELS.length);
    
    // Check that each level has unique background color
    const bgColors = stylings.map(s => s.backgroundColor);
    const uniqueBgColors = new Set(bgColors);
    expect(uniqueBgColors.size).toBe(VALID_LOG_LEVELS.length);
  });

  test('Error styling has highlight enabled while others do not', () => {
    const errorStyling = getLogStyling('error');
    expect(errorStyling.hasHighlight).toBe(true);
    
    const nonErrorLevels: LogLevel[] = ['warning', 'info', 'debug'];
    for (const level of nonErrorLevels) {
      const styling = getLogStyling(level);
      expect(styling.hasHighlight).toBe(false);
    }
  });

  test('Chronological ordering detection works correctly', () => {
    // Test with properly ordered logs
    const orderedLogs = createChronologicalLogs(5);
    expect(areLogsChronological(orderedLogs)).toBe(true);
    
    // Test with single log (always chronological)
    const singleLog = createChronologicalLogs(1);
    expect(areLogsChronological(singleLog)).toBe(true);
    
    // Test with empty array (always chronological)
    expect(areLogsChronological([])).toBe(true);
    
    // Test with out-of-order logs
    const outOfOrderLogs = [
      createValidLogEntry({ timestamp: '2024-01-15T10:00:00Z' }),
      createValidLogEntry({ timestamp: '2024-01-15T09:00:00Z' }) // Earlier than previous
    ];
    expect(areLogsChronological(outOfOrderLogs)).toBe(false);
  });

  test('Log entries with same timestamp are considered chronological', () => {
    const sameTimestamp = '2024-01-15T10:00:00Z';
    const logs = [
      createValidLogEntry({ timestamp: sameTimestamp, message: 'First' }),
      createValidLogEntry({ timestamp: sameTimestamp, message: 'Second' }),
      createValidLogEntry({ timestamp: sameTimestamp, message: 'Third' })
    ];
    
    expect(areLogsChronological(logs)).toBe(true);
  });

  test('ISO8601 timestamps with different formats are all valid', () => {
    const validFormats = [
      '2024-01-15',
      '2024-01-15T10:30:00',
      '2024-01-15T10:30:00Z',
      '2024-01-15T10:30:00.000Z',
      '2024-01-15T10:30:00+00:00',
      '2024-01-15T10:30:00-05:00'
    ];
    
    for (const timestamp of validFormats) {
      expect(isValidISO8601(timestamp)).toBe(true);
      
      const log = createValidLogEntry({ timestamp });
      const result = validateLogEntry(log);
      expect(result.isValid).toBe(true);
    }
  });
});
