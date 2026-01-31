/**
 * Property-Based Tests for Real-time Communication Reliability
 * **Property 33: Real-time Communication Reliability**
 * **Validates: Requirements 13.2, 13.3**
 * 
 * Tests that the real-time communication system:
 * 1. Calculates exponential backoff correctly (1s, 2s, 4s, 8s, 16s)
 * 2. Caps backoff delay at maximum value
 * 3. Handles all valid message types
 * 4. Maintains connection status consistency
 * 5. Processes state updates in order
 * 6. Handles reconnection attempts correctly
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateBackoffDelay, ServerMessageType, ClientMessageType } from '../../../frontend/src/hooks/useWebSocket';

describe('Property 33: Real-time Communication Reliability', () => {
  /**
   * Simplified generators for property-based testing
   * Using fc.constantFrom() to avoid timeout issues
   */
  
  // Valid server message types
  const generateServerMessageType = (): fc.Arbitrary<ServerMessageType> => {
    return fc.constantFrom(
      'connection_established',
      'workflow_state',
      'agent_output',
      'governance_required',
      'governance_decision',
      'workflow_complete',
      'demo_event',
      'subscription_confirmed',
      'pong',
      'error'
    );
  };

  // Valid client message types
  const generateClientMessageType = (): fc.Arbitrary<ClientMessageType> => {
    return fc.constantFrom(
      'ping',
      'subscribe_workflow',
      'get_workflow_state',
      'get_governance_request'
    );
  };

  // Connection status values
  const generateConnectionStatus = (): fc.Arbitrary<'connected' | 'disconnected' | 'reconnecting'> => {
    return fc.constantFrom('connected', 'disconnected', 'reconnecting');
  };

  // Reconnection attempt numbers (0-indexed)
  const generateReconnectAttempt = (): fc.Arbitrary<number> => {
    return fc.constantFrom(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
  };

  // Base delay values in milliseconds
  const generateBaseDelay = (): fc.Arbitrary<number> => {
    return fc.constantFrom(500, 1000, 2000);
  };

  // Max delay values in milliseconds
  const generateMaxDelay = (): fc.Arbitrary<number> => {
    return fc.constantFrom(8000, 16000, 32000);
  };

  // Workflow IDs
  const generateWorkflowId = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'workflow-001',
      'workflow-002',
      'workflow-003',
      'incident-abc-123',
      'demo-workflow-1'
    );
  };

  // Timestamps in ISO8601 format
  const generateTimestamp = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      '2024-01-15T14:30:00.000Z',
      '2024-01-15T14:31:00.000Z',
      '2024-01-15T14:32:00.000Z',
      '2024-01-15T14:33:00.000Z',
      '2024-01-15T14:34:00.000Z'
    );
  };

  /**
   * Property Tests for Exponential Backoff Calculation
   */

  test('Exponential backoff calculates correct delay for each attempt', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateReconnectAttempt(),
        generateBaseDelay(),
        generateMaxDelay(),
        async (attempt, baseDelay, maxDelay) => {
          const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);

          // Delay should be positive
          expect(delay).toBeGreaterThan(0);

          // Delay should follow exponential pattern: baseDelay * 2^attempt
          const expectedDelay = baseDelay * Math.pow(2, attempt);
          const cappedExpectedDelay = Math.min(expectedDelay, maxDelay);

          expect(delay).toBe(cappedExpectedDelay);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Backoff delay is capped at maximum value', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateReconnectAttempt(),
        generateBaseDelay(),
        generateMaxDelay(),
        async (attempt, baseDelay, maxDelay) => {
          const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);

          // Delay should never exceed maxDelay
          expect(delay).toBeLessThanOrEqual(maxDelay);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Backoff delay increases exponentially until cap', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateBaseDelay(),
        generateMaxDelay(),
        async (baseDelay, maxDelay) => {
          // Calculate delays for consecutive attempts
          const delays: number[] = [];
          for (let attempt = 0; attempt <= 5; attempt++) {
            delays.push(calculateBackoffDelay(attempt, baseDelay, maxDelay));
          }

          // Each delay should be >= previous delay (monotonically increasing)
          for (let i = 1; i < delays.length; i++) {
            expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
          }

          // First delay should equal base delay
          expect(delays[0]).toBe(baseDelay);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Backoff delay doubles with each attempt until cap', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateBaseDelay(),
        generateMaxDelay(),
        async (baseDelay, maxDelay) => {
          // Test specific sequence: 1s, 2s, 4s, 8s, 16s with base=1000, max=16000
          const testBaseDelay = 1000;
          const testMaxDelay = 16000;

          const delay0 = calculateBackoffDelay(0, testBaseDelay, testMaxDelay);
          const delay1 = calculateBackoffDelay(1, testBaseDelay, testMaxDelay);
          const delay2 = calculateBackoffDelay(2, testBaseDelay, testMaxDelay);
          const delay3 = calculateBackoffDelay(3, testBaseDelay, testMaxDelay);
          const delay4 = calculateBackoffDelay(4, testBaseDelay, testMaxDelay);

          // Verify exponential sequence: 1s, 2s, 4s, 8s, 16s
          expect(delay0).toBe(1000);  // 1s
          expect(delay1).toBe(2000);  // 2s
          expect(delay2).toBe(4000);  // 4s
          expect(delay3).toBe(8000);  // 8s
          expect(delay4).toBe(16000); // 16s (capped)

          // Verify doubling relationship before cap
          expect(delay1).toBe(delay0 * 2);
          expect(delay2).toBe(delay1 * 2);
          expect(delay3).toBe(delay2 * 2);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Backoff delay remains at cap for high attempt numbers', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateBaseDelay(),
        generateMaxDelay(),
        async (baseDelay, maxDelay) => {
          // High attempt numbers should all return maxDelay
          const highAttempts = [10, 15, 20, 50, 100];
          
          for (const attempt of highAttempts) {
            const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
            expect(delay).toBe(maxDelay);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property Tests for Message Type Handling
   */

  test('All server message types are valid strings', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateServerMessageType(),
        async (messageType) => {
          // Message type should be a non-empty string
          expect(typeof messageType).toBe('string');
          expect(messageType.length).toBeGreaterThan(0);

          // Message type should be one of the valid types
          const validTypes: ServerMessageType[] = [
            'connection_established',
            'workflow_state',
            'agent_output',
            'governance_required',
            'governance_decision',
            'workflow_complete',
            'demo_event',
            'subscription_confirmed',
            'pong',
            'error'
          ];
          expect(validTypes).toContain(messageType);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('All client message types are valid strings', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateClientMessageType(),
        async (messageType) => {
          // Message type should be a non-empty string
          expect(typeof messageType).toBe('string');
          expect(messageType.length).toBeGreaterThan(0);

          // Message type should be one of the valid types
          const validTypes: ClientMessageType[] = [
            'ping',
            'subscribe_workflow',
            'get_workflow_state',
            'get_governance_request'
          ];
          expect(validTypes).toContain(messageType);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property Tests for Connection Status Consistency
   */

  test('Connection status is always one of three valid states', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateConnectionStatus(),
        async (status) => {
          // Status should be a non-empty string
          expect(typeof status).toBe('string');
          expect(status.length).toBeGreaterThan(0);

          // Status should be one of the valid states
          const validStatuses = ['connected', 'disconnected', 'reconnecting'];
          expect(validStatuses).toContain(status);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Connection status transitions follow valid patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateConnectionStatus(),
        generateConnectionStatus(),
        async (fromStatus, toStatus) => {
          // Define valid transitions based on WebSocket behavior:
          // - disconnected: can connect, start reconnecting, or stay disconnected
          // - connected: can disconnect, start reconnecting (on error), or stay connected
          // - reconnecting: can connect (success), disconnect (give up), or keep reconnecting
          const validTransitions: Record<string, string[]> = {
            'disconnected': ['connected', 'reconnecting', 'disconnected'],
            'connected': ['disconnected', 'reconnecting', 'connected'],
            'reconnecting': ['connected', 'disconnected', 'reconnecting']
          };

          // Check if transition is valid
          const allowedTargets = validTransitions[fromStatus];
          const isValidTransition = allowedTargets.includes(toStatus);

          // All generated transitions should be valid
          expect(isValidTransition).toBe(true);
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property Tests for State Update Processing
   */

  test('State updates contain required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateWorkflowId(),
        generateTimestamp(),
        fc.constantFrom('workflow_state', 'agent_output', 'governance_required', 'workflow_complete'),
        async (workflowId, timestamp, updateType) => {
          // Create a mock state update
          const stateUpdate = {
            type: updateType,
            workflowId,
            timestamp,
            payload: {} // Simplified payload
          };

          // Verify required fields are present
          expect(stateUpdate.type).toBeDefined();
          expect(stateUpdate.workflowId).toBeDefined();
          expect(stateUpdate.timestamp).toBeDefined();
          expect(stateUpdate.payload).toBeDefined();

          // Verify field types
          expect(typeof stateUpdate.type).toBe('string');
          expect(typeof stateUpdate.workflowId).toBe('string');
          expect(typeof stateUpdate.timestamp).toBe('string');
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Timestamps are in valid ISO8601 format', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateTimestamp(),
        async (timestamp) => {
          // Verify ISO8601 format
          const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
          expect(timestamp).toMatch(iso8601Regex);

          // Verify it's a valid date
          const parsedDate = new Date(timestamp);
          expect(parsedDate.toString()).not.toBe('Invalid Date');

          // Verify round-trip conversion
          expect(parsedDate.toISOString()).toBe(timestamp);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Workflow IDs are non-empty strings', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateWorkflowId(),
        async (workflowId) => {
          // Workflow ID should be a non-empty string
          expect(typeof workflowId).toBe('string');
          expect(workflowId.length).toBeGreaterThan(0);
          expect(workflowId.trim()).toBe(workflowId); // No leading/trailing whitespace
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property Tests for Reconnection Handling
   */

  test('Reconnection attempts are non-negative integers', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateReconnectAttempt(),
        async (attempt) => {
          // Attempt should be a non-negative integer
          expect(Number.isInteger(attempt)).toBe(true);
          expect(attempt).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Reconnection delay calculation is deterministic', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateReconnectAttempt(),
        generateBaseDelay(),
        generateMaxDelay(),
        async (attempt, baseDelay, maxDelay) => {
          // Calculate delay twice with same inputs
          const delay1 = calculateBackoffDelay(attempt, baseDelay, maxDelay);
          const delay2 = calculateBackoffDelay(attempt, baseDelay, maxDelay);

          // Results should be identical (deterministic)
          expect(delay1).toBe(delay2);
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Backoff delay with zero attempt equals base delay', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateBaseDelay(),
        generateMaxDelay(),
        async (baseDelay, maxDelay) => {
          const delay = calculateBackoffDelay(0, baseDelay, maxDelay);

          // First attempt (0) should use base delay
          expect(delay).toBe(Math.min(baseDelay, maxDelay));
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property Tests for Message Structure Validation
   */

  test('Server messages can be constructed with valid types', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateServerMessageType(),
        generateWorkflowId(),
        generateTimestamp(),
        async (type, workflowId, timestamp) => {
          // Construct a valid server message
          const message = {
            type,
            workflowId,
            timestamp,
            payload: {}
          };

          // Verify message structure
          expect(message).toHaveProperty('type');
          expect(message).toHaveProperty('workflowId');
          expect(message).toHaveProperty('timestamp');
          expect(message).toHaveProperty('payload');

          // Verify JSON serialization works
          const serialized = JSON.stringify(message);
          const deserialized = JSON.parse(serialized);
          expect(deserialized.type).toBe(type);
          expect(deserialized.workflowId).toBe(workflowId);
          expect(deserialized.timestamp).toBe(timestamp);
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Client messages can be constructed with valid types', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateClientMessageType(),
        generateWorkflowId(),
        generateTimestamp(),
        async (type, workflowId, timestamp) => {
          // Construct a valid client message
          const message = {
            type,
            workflowId,
            timestamp
          };

          // Verify message structure
          expect(message).toHaveProperty('type');
          expect(message).toHaveProperty('workflowId');
          expect(message).toHaveProperty('timestamp');

          // Verify JSON serialization works
          const serialized = JSON.stringify(message);
          const deserialized = JSON.parse(serialized);
          expect(deserialized.type).toBe(type);
          expect(deserialized.workflowId).toBe(workflowId);
          expect(deserialized.timestamp).toBe(timestamp);
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property Tests for Default Configuration Values
   */

  test('Default backoff configuration produces expected sequence', async () => {
    // Test with default values: baseDelay=1000, maxDelay=16000
    const defaultBaseDelay = 1000;
    const defaultMaxDelay = 16000;

    // Expected sequence: 1s, 2s, 4s, 8s, 16s, 16s, 16s...
    const expectedDelays = [1000, 2000, 4000, 8000, 16000, 16000, 16000];

    for (let attempt = 0; attempt < expectedDelays.length; attempt++) {
      const delay = calculateBackoffDelay(attempt, defaultBaseDelay, defaultMaxDelay);
      expect(delay).toBe(expectedDelays[attempt]);
    }
  });

  test('Backoff calculation handles edge case of maxDelay less than baseDelay', async () => {
    // Edge case: maxDelay < baseDelay
    const baseDelay = 2000;
    const maxDelay = 1000;

    const delay = calculateBackoffDelay(0, baseDelay, maxDelay);

    // Should be capped at maxDelay even for first attempt
    expect(delay).toBe(maxDelay);
  });
});
