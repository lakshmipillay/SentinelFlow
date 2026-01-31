/**
 * Property-Based Tests for Demo Mode Isolation
 * **Property 30: Demo Mode Isolation**
 * **Validates: Requirements 11.4**
 * 
 * Tests that demo mode:
 * 1. Is clearly marked as simulation
 * 2. Prevents real system interactions
 * 3. Maintains all safety constraints
 * 4. Generates audit trail for blocked calls
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { 
  DemoIsolationService, 
  ExternalCallType,
  BlockedCallRecord,
  IsolationStatus 
} from '../DemoIsolationService';

/**
 * Test scenario types for isolation validation
 */
interface IsolationTestScenario {
  callType: ExternalCallType;
  target: string;
  method?: string;
  headers?: Record<string, string>;
  provider?: string;
  service?: string;
}

describe('Property 30: Demo Mode Isolation', () => {
  let isolationService: DemoIsolationService;

  beforeEach(() => {
    // Create fresh isolation service for each test
    isolationService = new DemoIsolationService();
  });

  afterEach(() => {
    // Cleanup isolation if active
    if (isolationService.isActive()) {
      isolationService.deactivateIsolation();
    }
    vi.clearAllMocks();
  });

  /**
   * Generators for isolation test scenarios
   */
  
  // Generator for external HTTP URLs that should be blocked
  const externalHttpUrlGenerator = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'https://api.amazonaws.com/ec2/instances',
      'https://api.datadog.com/v1/metrics',
      'https://api.splunk.com/services/search',
      'https://api.pagerduty.com/incidents',
      'https://slack.com/api/chat.postMessage',
      'https://api.github.com/repos/test/issues',
      'https://mongodb.net/cluster/query',
      'https://redis.io/commands',
      'https://googleapis.com/compute/v1/instances',
      'https://management.azure.com/subscriptions'
    );
  };

  // Generator for allowed localhost URLs
  const allowedUrlGenerator = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'http://localhost:3000/api/workflow',
      'http://127.0.0.1:8080/health',
      'https://mock.sentinelflow.local/api',
      'https://demo.sentinelflow.local/test',
      'https://test.internal.local/api',
      'ws://localhost:3001/ws'
    );
  };

  // Generator for credential patterns in headers
  const credentialHeaderGenerator = (): fc.Arbitrary<Record<string, string>> => {
    return fc.constantFrom(
      { 'Authorization': 'Bearer secret_token_12345' },
      { 'X-API-Key': 'api_key_secret_value' },
      { 'X-Access-Token': 'access_token_value' },
      { 'X-AWS-Access-Key': 'AKIAIOSFODNN7EXAMPLE' },
      { 'X-Database-URL': 'postgresql://user:password@host/db' },
      { 'X-Private-Key': 'private_key_content' }
    );
  };

  // Generator for dangerous commands
  const dangerousCommandGenerator = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'kubectl apply -f deployment.yaml',
      'docker run --rm nginx',
      'systemctl restart nginx',
      'service mysql restart',
      'rm -rf /var/log/*',
      'sudo apt-get update',
      'chmod 777 /etc/passwd',
      'ssh user@production-server',
      'scp file.txt user@server:/path',
      'curl -X POST https://api.example.com/deploy'
    );
  };

  // Generator for safe commands (still blocked in demo mode)
  const safeCommandGenerator = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'echo "hello world"',
      'ls -la',
      'cat /etc/hostname',
      'pwd',
      'date'
    );
  };

  // Generator for cloud API calls
  const cloudApiCallGenerator = (): fc.Arbitrary<{ provider: string; service: string; action: string }> => {
    return fc.constantFrom(
      { provider: 'aws', service: 'ec2', action: 'DescribeInstances' },
      { provider: 'aws', service: 's3', action: 'PutObject' },
      { provider: 'gcp', service: 'compute', action: 'instances.list' },
      { provider: 'azure', service: 'vm', action: 'restart' },
      { provider: 'aws', service: 'lambda', action: 'Invoke' },
      { provider: 'gcp', service: 'storage', action: 'objects.insert' }
    );
  };

  // Generator for database queries
  const databaseQueryGenerator = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'SELECT * FROM users',
      'INSERT INTO logs VALUES (...)',
      'UPDATE config SET value = ...',
      'DELETE FROM sessions WHERE ...',
      'DROP TABLE temp_data',
      'CREATE INDEX idx_name ON table'
    );
  };

  // Generator for WebSocket URLs
  const externalWebSocketUrlGenerator = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'wss://api.datadog.com/stream',
      'wss://realtime.splunk.com/events',
      'wss://stream.pagerduty.com/incidents',
      'wss://api.slack.com/rtm',
      'wss://production.example.com/ws'
    );
  };

  // Generator for credential types
  const credentialTypeGenerator = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'AWS_ACCESS_KEY',
      'DATABASE_PASSWORD',
      'API_SECRET_KEY',
      'PRIVATE_KEY',
      'BEARER_TOKEN',
      'CONNECTION_STRING'
    );
  };

  /**
   * Property Tests
   */

  test('Demo mode isolation blocks all external HTTP requests when active', async () => {
    await fc.assert(
      fc.asyncProperty(
        externalHttpUrlGenerator(),
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
        async (url: string, method: string) => {
          // Activate isolation
          isolationService.activateIsolation('test-session-http');
          
          // Validate HTTP request
          const result = isolationService.validateHttpRequest(url, method);
          
          // External URLs must be blocked
          expect(result.allowed).toBe(false);
          expect(result.reason).toBeDefined();
          expect(result.reason).toContain('Demo mode');
          
          // Mock response should be provided
          expect(result.mockResponse).toBeDefined();
          expect(result.mockResponse?.data?.simulated).toBe(true);
          
          // Blocked call should be recorded
          const blockedCalls = isolationService.getBlockedCalls();
          expect(blockedCalls.length).toBeGreaterThan(0);
          
          const lastBlockedCall = blockedCalls[blockedCalls.length - 1];
          expect(lastBlockedCall.callType).toBe('http_request');
          expect(lastBlockedCall.targetUrl).toBe(url);
          expect(lastBlockedCall.demoSessionId).toBe('test-session-http');
          
          // Cleanup for next iteration
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 25 }
    );
  });

  test('Demo mode isolation allows localhost and mock URLs', async () => {
    await fc.assert(
      fc.asyncProperty(
        allowedUrlGenerator(),
        async (url: string) => {
          // Activate isolation
          isolationService.activateIsolation('test-session-allowed');
          
          // Validate HTTP request to allowed URL
          const result = isolationService.validateHttpRequest(url, 'GET');
          
          // Localhost and mock URLs should be allowed
          expect(result.allowed).toBe(true);
          expect(result.reason).toBeUndefined();
          
          // No blocked calls should be recorded for allowed URLs
          const blockedCalls = isolationService.getBlockedCalls();
          const blockedForThisUrl = blockedCalls.filter(c => c.targetUrl === url);
          expect(blockedForThisUrl.length).toBe(0);
          
          // Cleanup for next iteration
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode isolation blocks WebSocket connections to external services', async () => {
    await fc.assert(
      fc.asyncProperty(
        externalWebSocketUrlGenerator(),
        async (url: string) => {
          // Activate isolation
          isolationService.activateIsolation('test-session-ws');
          
          // Validate WebSocket connection
          const result = isolationService.validateWebSocketConnection(url);
          
          // External WebSocket connections must be blocked
          expect(result.allowed).toBe(false);
          expect(result.reason).toBeDefined();
          expect(result.reason).toContain('Demo mode');
          expect(result.useMockWebSocket).toBe(true);
          
          // Blocked call should be recorded
          const blockedCalls = isolationService.getBlockedCalls();
          expect(blockedCalls.length).toBeGreaterThan(0);
          
          const lastBlockedCall = blockedCalls[blockedCalls.length - 1];
          expect(lastBlockedCall.callType).toBe('websocket_connection');
          expect(lastBlockedCall.targetUrl).toBe(url);
          
          // Cleanup for next iteration
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode isolation blocks all credential access attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        credentialTypeGenerator(),
        fc.constantFrom('environment', 'config', 'vault', 'secrets-manager'),
        async (credentialType: string, source: string) => {
          // Activate isolation
          isolationService.activateIsolation('test-session-creds');
          
          // Validate credential access
          const result = isolationService.validateCredentialAccess(credentialType, source);
          
          // All credential access must be blocked in demo mode
          expect(result.allowed).toBe(false);
          expect(result.reason).toBeDefined();
          expect(result.reason).toContain('Demo mode');
          expect(result.reason).toContain(credentialType);
          
          // Blocked call should be recorded
          const blockedCalls = isolationService.getBlockedCalls();
          expect(blockedCalls.length).toBeGreaterThan(0);
          
          const lastBlockedCall = blockedCalls[blockedCalls.length - 1];
          expect(lastBlockedCall.callType).toBe('credential_access');
          
          // Cleanup for next iteration
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode isolation blocks dangerous command execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        dangerousCommandGenerator(),
        async (command: string) => {
          // Activate isolation
          isolationService.activateIsolation('test-session-cmd');
          
          // Validate command execution
          const result = isolationService.validateCommandExecution(command);
          
          // Dangerous commands must be blocked
          expect(result.allowed).toBe(false);
          expect(result.reason).toBeDefined();
          expect(result.reason).toContain('Demo mode');
          expect(result.isDangerous).toBe(true);
          
          // Blocked call should be recorded
          const blockedCalls = isolationService.getBlockedCalls();
          expect(blockedCalls.length).toBeGreaterThan(0);
          
          const lastBlockedCall = blockedCalls[blockedCalls.length - 1];
          expect(lastBlockedCall.callType).toBe('process_spawn');
          
          // Cleanup for next iteration
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode isolation blocks all command execution (even safe commands)', async () => {
    await fc.assert(
      fc.asyncProperty(
        safeCommandGenerator(),
        async (command: string) => {
          // Activate isolation
          isolationService.activateIsolation('test-session-safe-cmd');
          
          // Validate command execution
          const result = isolationService.validateCommandExecution(command);
          
          // Even safe commands must be blocked in demo mode
          expect(result.allowed).toBe(false);
          expect(result.reason).toBeDefined();
          expect(result.reason).toContain('Demo mode');
          
          // Blocked call should be recorded
          const blockedCalls = isolationService.getBlockedCalls();
          expect(blockedCalls.length).toBeGreaterThan(0);
          
          // Cleanup for next iteration
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode isolation blocks all database queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        databaseQueryGenerator(),
        fc.constantFrom(
          'postgresql://localhost/db',
          'mongodb://cluster.mongodb.net/db',
          'mysql://user:pass@host/db'
        ),
        async (query: string, connectionString: string) => {
          // Activate isolation
          isolationService.activateIsolation('test-session-db');
          
          // Validate database query
          const result = isolationService.validateDatabaseQuery(query, connectionString);
          
          // All database queries must be blocked
          expect(result.allowed).toBe(false);
          expect(result.reason).toBeDefined();
          expect(result.reason).toContain('Demo mode');
          
          // Mock response should be provided
          expect(result.mockResponse).toBeDefined();
          expect(result.mockResponse.simulated).toBe(true);
          
          // Blocked call should be recorded
          const blockedCalls = isolationService.getBlockedCalls();
          expect(blockedCalls.length).toBeGreaterThan(0);
          
          const lastBlockedCall = blockedCalls[blockedCalls.length - 1];
          expect(lastBlockedCall.callType).toBe('database_query');
          
          // Cleanup for next iteration
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode isolation blocks all cloud API calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        cloudApiCallGenerator(),
        async ({ provider, service, action }) => {
          // Activate isolation
          isolationService.activateIsolation('test-session-cloud');
          
          // Validate cloud API call
          const result = isolationService.validateCloudApiCall(provider, service, action);
          
          // All cloud API calls must be blocked
          expect(result.allowed).toBe(false);
          expect(result.reason).toBeDefined();
          expect(result.reason).toContain('Demo mode');
          expect(result.reason).toContain(provider);
          
          // Mock response should be provided
          expect(result.mockResponse).toBeDefined();
          expect(result.mockResponse?.data?.simulated).toBe(true);
          expect(result.mockResponse?.data?.provider).toBe(provider);
          
          // Blocked call should be recorded
          const blockedCalls = isolationService.getBlockedCalls();
          expect(blockedCalls.length).toBeGreaterThan(0);
          
          const lastBlockedCall = blockedCalls[blockedCalls.length - 1];
          expect(lastBlockedCall.callType).toBe('cloud_api');
          
          // Cleanup for next iteration
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode maintains clear simulation indicators', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'demo-session-1',
          'demo-session-2',
          'test-session-abc',
          'simulation-xyz'
        ),
        async (sessionId: string) => {
          // Activate isolation
          isolationService.activateIsolation(sessionId);
          
          // Get simulation indicators
          const indicators = isolationService.getSimulationIndicators();
          
          // Demo mode must be clearly marked
          expect(indicators.isDemoMode).toBe(true);
          expect(indicators.statusText).toContain('DEMO');
          expect(indicators.statusText).toContain('SIMULATED');
          expect(indicators.statusColor).toBe('yellow');
          expect(indicators.warningMessage).toBeDefined();
          expect(indicators.warningMessage).toContain('simulated');
          
          // Get isolation status
          const status = isolationService.getIsolationStatus();
          
          // Simulation indicators must be active
          expect(status.simulationIndicators.clearlyMarked).toBe(true);
          expect(status.simulationIndicators.uiIndicatorActive).toBe(true);
          expect(status.simulationIndicators.auditTrailActive).toBe(true);
          
          // Safety constraints must be enforced
          expect(status.safetyConstraints.noExternalActions).toBe(true);
          expect(status.safetyConstraints.noCredentialAccess).toBe(true);
          expect(status.safetyConstraints.noInfrastructureMutation).toBe(true);
          expect(status.safetyConstraints.noRealWebSocketConnections).toBe(true);
          expect(status.safetyConstraints.noRealApiCalls).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode generates audit trail for all blocked calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<ExternalCallType>(
          'http_request',
          'websocket_connection',
          'credential_access',
          'cloud_api',
          'database_query',
          'process_spawn'
        ),
        async (callType: ExternalCallType) => {
          // Activate isolation
          const sessionId = `audit-test-${callType}`;
          isolationService.activateIsolation(sessionId);
          
          // Track audit events
          const auditEvents: any[] = [];
          isolationService.on('isolationAuditEvent', (event) => {
            auditEvents.push(event);
          });
          
          // Perform blocked operation based on call type
          switch (callType) {
            case 'http_request':
              isolationService.validateHttpRequest('https://api.amazonaws.com/test', 'GET');
              break;
            case 'websocket_connection':
              isolationService.validateWebSocketConnection('wss://api.datadog.com/stream');
              break;
            case 'credential_access':
              isolationService.validateCredentialAccess('API_KEY', 'environment');
              break;
            case 'cloud_api':
              isolationService.validateCloudApiCall('aws', 'ec2', 'DescribeInstances');
              break;
            case 'database_query':
              isolationService.validateDatabaseQuery('SELECT * FROM users');
              break;
            case 'process_spawn':
              isolationService.validateCommandExecution('kubectl get pods');
              break;
          }
          
          // Verify audit event was generated
          const callBlockedEvents = auditEvents.filter(e => e.eventType === 'call_blocked');
          expect(callBlockedEvents.length).toBeGreaterThan(0);
          
          // Verify audit event structure
          const lastAuditEvent = callBlockedEvents[callBlockedEvents.length - 1];
          expect(lastAuditEvent.eventId).toBeDefined();
          expect(lastAuditEvent.timestamp).toBeDefined();
          expect(lastAuditEvent.sessionId).toBe(sessionId);
          expect(lastAuditEvent.demoMode).toBe(true);
          expect(lastAuditEvent.immutable).toBe(true);
          expect(lastAuditEvent.details.callType).toBe(callType);
          
          // Verify blocked calls summary
          const summary = isolationService.getBlockedCallsSummary();
          expect(summary[callType]).toBeGreaterThan(0);
          
          // Cleanup
          isolationService.removeAllListeners('isolationAuditEvent');
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode blocks HTTP requests with credential headers to external URLs', async () => {
    await fc.assert(
      fc.asyncProperty(
        externalHttpUrlGenerator(),
        credentialHeaderGenerator(),
        async (url: string, headers: Record<string, string>) => {
          // Activate isolation
          isolationService.activateIsolation('test-session-cred-headers');
          
          // Validate HTTP request with credential headers to external URL
          const result = isolationService.validateHttpRequest(url, 'GET', headers);
          
          // External requests with credential headers must be blocked
          expect(result.allowed).toBe(false);
          expect(result.reason).toBeDefined();
          expect(result.reason).toContain('Demo mode');
          
          // Blocked call should be recorded
          const blockedCalls = isolationService.getBlockedCalls();
          expect(blockedCalls.length).toBeGreaterThan(0);
          
          // Cleanup for next iteration
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode isolation is inactive when not activated', async () => {
    await fc.assert(
      fc.asyncProperty(
        externalHttpUrlGenerator(),
        async (url: string) => {
          // Do NOT activate isolation
          expect(isolationService.isActive()).toBe(false);
          
          // Validate HTTP request without isolation
          const result = isolationService.validateHttpRequest(url, 'GET');
          
          // Requests should be allowed when isolation is not active
          expect(result.allowed).toBe(true);
          
          // No blocked calls should be recorded
          const blockedCalls = isolationService.getBlockedCalls();
          expect(blockedCalls.length).toBe(0);
          
          // Simulation indicators should show live mode
          const indicators = isolationService.getSimulationIndicators();
          expect(indicators.isDemoMode).toBe(false);
          expect(indicators.statusText).toBe('LIVE MODE');
          expect(indicators.statusColor).toBe('green');
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode isolation can be activated and deactivated safely', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('session-1', 'session-2', 'session-3'),
        fc.integer({ min: 1, max: 3 }),
        async (sessionId: string, operationCount: number) => {
          // Track events
          const activationEvents: any[] = [];
          const deactivationEvents: any[] = [];
          
          isolationService.on('isolationActivated', (event) => {
            activationEvents.push(event);
          });
          isolationService.on('isolationDeactivated', (event) => {
            deactivationEvents.push(event);
          });
          
          // Activate isolation
          isolationService.activateIsolation(sessionId);
          expect(isolationService.isActive()).toBe(true);
          
          // Perform some blocked operations
          for (let i = 0; i < operationCount; i++) {
            isolationService.validateHttpRequest('https://api.amazonaws.com/test', 'GET');
          }
          
          // Verify blocked calls were recorded
          const blockedCallsBeforeDeactivation = isolationService.getBlockedCalls().length;
          expect(blockedCallsBeforeDeactivation).toBe(operationCount);
          
          // Deactivate isolation
          isolationService.deactivateIsolation();
          expect(isolationService.isActive()).toBe(false);
          
          // Verify events were emitted
          expect(activationEvents.length).toBe(1);
          expect(activationEvents[0].sessionId).toBe(sessionId);
          expect(deactivationEvents.length).toBe(1);
          expect(deactivationEvents[0].sessionId).toBe(sessionId);
          expect(deactivationEvents[0].blockedCallsCount).toBe(operationCount);
          
          // Cleanup
          isolationService.removeAllListeners('isolationActivated');
          isolationService.removeAllListeners('isolationDeactivated');
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 15 }
    );
  });

  test('Demo mode isolation status reflects current state accurately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('status-test-1', 'status-test-2'),
        fc.integer({ min: 0, max: 5 }),
        async (sessionId: string, blockedCallCount: number) => {
          // Activate isolation
          isolationService.activateIsolation(sessionId);
          
          // Perform blocked operations
          for (let i = 0; i < blockedCallCount; i++) {
            isolationService.validateHttpRequest(`https://api.example${i}.com/test`, 'GET');
          }
          
          // Get isolation status
          const status = isolationService.getIsolationStatus();
          
          // Verify status reflects current state
          expect(status.isActive).toBe(true);
          expect(status.demoModeEnabled).toBe(true);
          expect(status.blockedCallsCount).toBe(blockedCallCount);
          
          // Verify safety constraints
          expect(status.safetyConstraints.noExternalActions).toBe(true);
          expect(status.safetyConstraints.noCredentialAccess).toBe(true);
          expect(status.safetyConstraints.noInfrastructureMutation).toBe(true);
          expect(status.safetyConstraints.noRealWebSocketConnections).toBe(true);
          expect(status.safetyConstraints.noRealApiCalls).toBe(true);
          
          // Verify simulation indicators
          expect(status.simulationIndicators.clearlyMarked).toBe(true);
          expect(status.simulationIndicators.uiIndicatorActive).toBe(true);
          expect(status.simulationIndicators.auditTrailActive).toBe(true);
          
          // Verify last blocked call if any
          if (blockedCallCount > 0) {
            expect(status.lastBlockedCall).toBeDefined();
            expect(status.lastBlockedCall?.callType).toBe('http_request');
          }
          
          // Cleanup
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Demo mode provides mock responses for blocked external calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        cloudApiCallGenerator(),
        async ({ provider, service, action }) => {
          // Activate isolation
          isolationService.activateIsolation('mock-response-test');
          
          // Validate cloud API call
          const result = isolationService.validateCloudApiCall(provider, service, action);
          
          // Verify mock response structure
          expect(result.mockResponse).toBeDefined();
          expect(result.mockResponse?.success).toBe(true);
          expect(result.mockResponse?.simulatedLatencyMs).toBeGreaterThan(0);
          expect(result.mockResponse?.mockServiceName).toContain(provider);
          expect(result.mockResponse?.timestamp).toBeDefined();
          
          // Verify mock response data
          expect(result.mockResponse?.data?.provider).toBe(provider);
          expect(result.mockResponse?.data?.service).toBe(service);
          expect(result.mockResponse?.data?.action).toBe(action);
          expect(result.mockResponse?.data?.simulated).toBe(true);
          
          // Cleanup
          isolationService.clearBlockedCalls();
        }
      ),
      { numRuns: 20 }
    );
  });
});
