/**
 * Property-Based Tests for Alert Display Format Compliance
 * **Property 34: Alert Display Format Compliance**
 * **Validates: Requirements 14.1**
 * 
 * Tests that all alerts have required fields (service, severity, metric, value, timestamp),
 * severity is one of: critical, warning, info, value is a number, and timestamp is valid ISO8601.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Alert severity levels - must be one of these three values
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Active alert interface matching frontend requirements
 * Requirements: 14.1 - Display active alert in JSON-style format with service,
 * severity, metric, and timestamp information
 */
export interface ActiveAlert {
  service: string;
  severity: AlertSeverity;
  metric: string;
  value: number;
  timestamp: string; // ISO8601
  description?: string;
}

/**
 * Valid severity values for alerts
 */
export const VALID_SEVERITIES: readonly AlertSeverity[] = ['critical', 'warning', 'info'] as const;

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
  // ISO8601 formats: YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, YYYY-MM-DDTHH:mm:ssZ, YYYY-MM-DDTHH:mm:ss.sssZ
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/;
  return iso8601Regex.test(timestamp);
}

/**
 * Validates that a severity value is one of the allowed values
 */
export function isValidSeverity(severity: string): severity is AlertSeverity {
  return VALID_SEVERITIES.includes(severity as AlertSeverity);
}

/**
 * Validates that a value is a valid number (not NaN, not Infinity)
 */
export function isValidNumericValue(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Validates that a string is non-empty
 */
export function isNonEmptyString(str: string): boolean {
  return typeof str === 'string' && str.trim().length > 0;
}

/**
 * Validates an alert object has all required fields with correct types
 */
export function validateAlertFormat(alert: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!alert || typeof alert !== 'object') {
    return { isValid: false, errors: ['Alert must be a non-null object'] };
  }
  
  const alertObj = alert as Record<string, unknown>;
  
  // Validate service field
  if (!('service' in alertObj)) {
    errors.push('Missing required field: service');
  } else if (!isNonEmptyString(alertObj.service as string)) {
    errors.push('Field "service" must be a non-empty string');
  }
  
  // Validate severity field
  if (!('severity' in alertObj)) {
    errors.push('Missing required field: severity');
  } else if (!isValidSeverity(alertObj.severity as string)) {
    errors.push(`Field "severity" must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }
  
  // Validate metric field
  if (!('metric' in alertObj)) {
    errors.push('Missing required field: metric');
  } else if (!isNonEmptyString(alertObj.metric as string)) {
    errors.push('Field "metric" must be a non-empty string');
  }
  
  // Validate value field
  if (!('value' in alertObj)) {
    errors.push('Missing required field: value');
  } else if (!isValidNumericValue(alertObj.value as number)) {
    errors.push('Field "value" must be a valid number (not NaN or Infinity)');
  }
  
  // Validate timestamp field
  if (!('timestamp' in alertObj)) {
    errors.push('Missing required field: timestamp');
  } else if (!isValidISO8601(alertObj.timestamp as string)) {
    errors.push('Field "timestamp" must be a valid ISO8601 string');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Creates a valid alert object for testing
 */
export function createValidAlert(overrides: Partial<ActiveAlert> = {}): ActiveAlert {
  return {
    service: 'payment-service',
    severity: 'critical',
    metric: 'error_rate',
    value: 15.5,
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

describe('Property 34: Alert Display Format Compliance', () => {
  
  /**
   * Generators for property-based testing
   */
  const generateValidService = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'payment-service',
      'api-gateway',
      'database-cluster',
      'auth-service',
      'monitoring-service',
      'cache-layer',
      'message-queue',
      'load-balancer'
    );
  };

  const generateValidSeverity = (): fc.Arbitrary<AlertSeverity> => {
    return fc.constantFrom('critical', 'warning', 'info');
  };

  const generateInvalidSeverity = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'error',
      'fatal',
      'debug',
      'notice',
      'CRITICAL',
      'WARNING',
      'INFO',
      '',
      'unknown'
    );
  };

  const generateValidMetric = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'error_rate',
      'latency_p99',
      'cpu_usage',
      'memory_usage',
      'connection_pool',
      'request_count',
      'response_time',
      'throughput'
    );
  };

  const generateValidValue = (): fc.Arbitrary<number> => {
    return fc.oneof(
      fc.integer({ min: 0, max: 1000 }),
      fc.float({ min: 0, max: 100, noNaN: true }),
      fc.constant(0),
      fc.constant(100)
    );
  };

  const generateInvalidValue = (): fc.Arbitrary<number> => {
    return fc.oneof(
      fc.constant(NaN),
      fc.constant(Infinity),
      fc.constant(-Infinity)
    );
  };

  const generateValidTimestamp = (): fc.Arbitrary<string> => {
    return fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map(date => date.toISOString());
  };

  const generateInvalidTimestamp = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      '',
      'invalid-date',
      '2024-13-45',
      '2024/01/15',
      'not-a-timestamp',
      '15-01-2024',
      'Jan 15, 2024'
    );
  };

  const generateValidAlert = (): fc.Arbitrary<ActiveAlert> => {
    return fc.record({
      service: generateValidService(),
      severity: generateValidSeverity(),
      metric: generateValidMetric(),
      value: generateValidValue(),
      timestamp: generateValidTimestamp()
    });
  };

  /**
   * Property Tests
   */
  test('All valid alerts must have required fields (service, severity, metric, value, timestamp)', async () => {
    await fc.assert(
      fc.property(
        generateValidAlert(),
        (alert: ActiveAlert) => {
          const result = validateAlertFormat(alert);
          
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
          
          // Verify all required fields are present
          expect(alert).toHaveProperty('service');
          expect(alert).toHaveProperty('severity');
          expect(alert).toHaveProperty('metric');
          expect(alert).toHaveProperty('value');
          expect(alert).toHaveProperty('timestamp');
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Severity must be one of: critical, warning, info', async () => {
    await fc.assert(
      fc.property(
        generateValidSeverity(),
        (severity: AlertSeverity) => {
          expect(isValidSeverity(severity)).toBe(true);
          expect(VALID_SEVERITIES).toContain(severity);
          
          const alert = createValidAlert({ severity });
          const result = validateAlertFormat(alert);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Invalid severity values must be rejected', async () => {
    await fc.assert(
      fc.property(
        generateInvalidSeverity(),
        (invalidSeverity: string) => {
          expect(isValidSeverity(invalidSeverity)).toBe(false);
          
          const alert = createValidAlert({ severity: invalidSeverity as AlertSeverity });
          const result = validateAlertFormat(alert);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('severity'))).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Value must be a valid number (not NaN or Infinity)', async () => {
    await fc.assert(
      fc.property(
        generateValidValue(),
        (value: number) => {
          expect(isValidNumericValue(value)).toBe(true);
          
          const alert = createValidAlert({ value });
          const result = validateAlertFormat(alert);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Invalid numeric values (NaN, Infinity) must be rejected', async () => {
    await fc.assert(
      fc.property(
        generateInvalidValue(),
        (invalidValue: number) => {
          expect(isValidNumericValue(invalidValue)).toBe(false);
          
          const alert = createValidAlert({ value: invalidValue });
          const result = validateAlertFormat(alert);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('value'))).toBe(true);
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
          
          const alert = createValidAlert({ timestamp });
          const result = validateAlertFormat(alert);
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
          
          const alert = createValidAlert({ timestamp: invalidTimestamp });
          const result = validateAlertFormat(alert);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('timestamp'))).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Service must be a non-empty string', async () => {
    await fc.assert(
      fc.property(
        generateValidService(),
        (service: string) => {
          expect(isNonEmptyString(service)).toBe(true);
          
          const alert = createValidAlert({ service });
          const result = validateAlertFormat(alert);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Empty service must be rejected', () => {
    const alertWithEmptyService = createValidAlert({ service: '' });
    const result = validateAlertFormat(alertWithEmptyService);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('service'))).toBe(true);
  });

  test('Metric must be a non-empty string', async () => {
    await fc.assert(
      fc.property(
        generateValidMetric(),
        (metric: string) => {
          expect(isNonEmptyString(metric)).toBe(true);
          
          const alert = createValidAlert({ metric });
          const result = validateAlertFormat(alert);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Empty metric must be rejected', () => {
    const alertWithEmptyMetric = createValidAlert({ metric: '' });
    const result = validateAlertFormat(alertWithEmptyMetric);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('metric'))).toBe(true);
  });

  test('Missing required fields must be detected', () => {
    // Test missing service
    const noService = { severity: 'critical', metric: 'error_rate', value: 10, timestamp: new Date().toISOString() };
    expect(validateAlertFormat(noService).errors.some(e => e.includes('service'))).toBe(true);
    
    // Test missing severity
    const noSeverity = { service: 'test', metric: 'error_rate', value: 10, timestamp: new Date().toISOString() };
    expect(validateAlertFormat(noSeverity).errors.some(e => e.includes('severity'))).toBe(true);
    
    // Test missing metric
    const noMetric = { service: 'test', severity: 'critical', value: 10, timestamp: new Date().toISOString() };
    expect(validateAlertFormat(noMetric).errors.some(e => e.includes('metric'))).toBe(true);
    
    // Test missing value
    const noValue = { service: 'test', severity: 'critical', metric: 'error_rate', timestamp: new Date().toISOString() };
    expect(validateAlertFormat(noValue).errors.some(e => e.includes('value'))).toBe(true);
    
    // Test missing timestamp
    const noTimestamp = { service: 'test', severity: 'critical', metric: 'error_rate', value: 10 };
    expect(validateAlertFormat(noTimestamp).errors.some(e => e.includes('timestamp'))).toBe(true);
  });

  test('Null and undefined alerts must be rejected', () => {
    expect(validateAlertFormat(null).isValid).toBe(false);
    expect(validateAlertFormat(undefined).isValid).toBe(false);
    expect(validateAlertFormat({}).isValid).toBe(false);
  });

  test('Alert format validation is consistent across multiple runs', async () => {
    await fc.assert(
      fc.property(
        generateValidAlert(),
        (alert: ActiveAlert) => {
          const result1 = validateAlertFormat(alert);
          const result2 = validateAlertFormat(alert);
          const result3 = validateAlertFormat(alert);
          
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

  test('Optional description field does not affect validation', async () => {
    await fc.assert(
      fc.property(
        generateValidAlert(),
        fc.option(fc.string({ minLength: 1, maxLength: 100 })),
        (alert: ActiveAlert, description: string | null) => {
          const alertWithDescription = description 
            ? { ...alert, description } 
            : alert;
          
          const result = validateAlertFormat(alertWithDescription);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('All three severity levels produce valid alerts', () => {
    for (const severity of VALID_SEVERITIES) {
      const alert = createValidAlert({ severity });
      const result = validateAlertFormat(alert);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  test('Numeric values including zero and negative numbers are valid', () => {
    const testValues = [0, -1, -100, 0.5, 100.5, 1000];
    
    for (const value of testValues) {
      const alert = createValidAlert({ value });
      const result = validateAlertFormat(alert);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });
});
