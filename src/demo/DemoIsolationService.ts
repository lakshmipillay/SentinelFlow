/**
 * SentinelFlow Demo Isolation Service
 * Enforces strict isolation for demo mode operations
 * **Property 30: Demo Mode Isolation**
 * **Validates: Requirements 11.4**
 * 
 * This service ensures:
 * 1. Clear simulation status indicators
 * 2. Prevention of real system interactions during demo mode
 * 3. Maintenance of safety constraints in demo environment
 * 4. All safety constraints from 11.1, 11.2, 11.5 apply in demo mode
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Types of external calls that should be blocked in demo mode
 */
export type ExternalCallType = 
  | 'http_request'
  | 'websocket_connection'
  | 'database_query'
  | 'cloud_api'
  | 'credential_access'
  | 'file_system'
  | 'process_spawn'
  | 'network_socket';

/**
 * Blocked call record for audit trail
 */
export interface BlockedCallRecord {
  id: string;
  timestamp: string;
  callType: ExternalCallType;
  targetUrl?: string;
  targetService?: string;
  reason: string;
  stackTrace?: string;
  demoSessionId?: string;
}

/**
 * Isolation status for monitoring
 */
export interface IsolationStatus {
  isActive: boolean;
  demoModeEnabled: boolean;
  blockedCallsCount: number;
  lastBlockedCall?: BlockedCallRecord;
  safetyConstraints: {
    noExternalActions: boolean;
    noCredentialAccess: boolean;
    noInfrastructureMutation: boolean;
    noRealWebSocketConnections: boolean;
    noRealApiCalls: boolean;
  };
  simulationIndicators: {
    clearlyMarked: boolean;
    uiIndicatorActive: boolean;
    auditTrailActive: boolean;
  };
}

/**
 * Mock service interface for simulated external services
 */
export interface MockServiceResponse {
  success: boolean;
  data: any;
  simulatedLatencyMs: number;
  mockServiceName: string;
  timestamp: string;
}

/**
 * Demo Isolation Service
 * Provides comprehensive isolation for demo mode operations
 */
export class DemoIsolationService extends EventEmitter {
  private isIsolationActive: boolean = false;
  private currentSessionId: string | null = null;
  private blockedCalls: BlockedCallRecord[] = [];
  private mockServices: Map<string, (request: any) => MockServiceResponse> = new Map();

  constructor() {
    super();
    // Increase max listeners to handle multiple demo sessions in tests
    this.setMaxListeners(50);
    this.initializeMockServices();
  }
  
  // Patterns that indicate real system interactions
  private readonly BLOCKED_URL_PATTERNS = [
    /^https?:\/\/(?!localhost|127\.0\.0\.1|mock\.|demo\.|test\.)/i,
    /amazonaws\.com/i,
    /googleapis\.com/i,
    /azure\.com/i,
    /datadog\.com/i,
    /splunk\.com/i,
    /pagerduty\.com/i,
    /slack\.com\/api/i,
    /api\.github\.com/i,
    /mongodb\.net/i,
    /redis\.io/i,
  ];

  // Patterns that indicate credential access
  private readonly CREDENTIAL_PATTERNS = [
    /api[_-]?key/i,
    /secret[_-]?key/i,
    /access[_-]?token/i,
    /bearer[_-]?token/i,
    /password/i,
    /private[_-]?key/i,
    /aws[_-]?access/i,
    /aws[_-]?secret/i,
    /database[_-]?url/i,
    /connection[_-]?string/i,
  ];

  // Dangerous command patterns
  private readonly DANGEROUS_COMMAND_PATTERNS = [
    /kubectl/i,
    /docker/i,
    /systemctl/i,
    /service\s+\w+\s+(start|stop|restart)/i,
    /rm\s+-rf/i,
    /sudo/i,
    /chmod/i,
    /chown/i,
    /ssh\s+/i,
    /scp\s+/i,
    /curl\s+.*-X\s+(POST|PUT|DELETE|PATCH)/i,
    /wget\s+/i,
  ];

  /**
   * Activate isolation for demo mode
   * @param sessionId - The demo session ID
   */
  activateIsolation(sessionId: string): void {
    if (this.isIsolationActive) {
      this.emit('isolationWarning', {
        message: 'Isolation already active, updating session ID',
        previousSessionId: this.currentSessionId,
        newSessionId: sessionId
      });
    }

    this.isIsolationActive = true;
    this.currentSessionId = sessionId;
    this.blockedCalls = [];

    this.emit('isolationActivated', {
      sessionId,
      timestamp: new Date().toISOString(),
      safetyConstraints: this.getSafetyConstraints()
    });

    this.logIsolationEvent('isolation_activated', {
      sessionId,
      safetyConstraints: this.getSafetyConstraints()
    });
  }

  /**
   * Deactivate isolation when demo mode ends
   */
  deactivateIsolation(): void {
    const sessionId = this.currentSessionId;
    const blockedCallsCount = this.blockedCalls.length;

    this.emit('isolationDeactivated', {
      sessionId,
      timestamp: new Date().toISOString(),
      blockedCallsCount,
      blockedCalls: this.blockedCalls
    });

    this.logIsolationEvent('isolation_deactivated', {
      sessionId,
      blockedCallsCount,
      summary: this.getBlockedCallsSummary()
    });

    this.isIsolationActive = false;
    this.currentSessionId = null;
    // Keep blocked calls for audit purposes
  }

  /**
   * Check if isolation is currently active
   */
  isActive(): boolean {
    return this.isIsolationActive;
  }

  /**
   * Get current isolation status
   */
  getIsolationStatus(): IsolationStatus {
    return {
      isActive: this.isIsolationActive,
      demoModeEnabled: this.isIsolationActive,
      blockedCallsCount: this.blockedCalls.length,
      lastBlockedCall: this.blockedCalls[this.blockedCalls.length - 1],
      safetyConstraints: this.getSafetyConstraints(),
      simulationIndicators: {
        clearlyMarked: this.isIsolationActive,
        uiIndicatorActive: this.isIsolationActive,
        auditTrailActive: true
      }
    };
  }

  /**
   * Validate and potentially block an external HTTP request
   * @param url - The target URL
   * @param method - HTTP method
   * @param headers - Request headers
   * @returns Whether the request should be allowed
   */
  validateHttpRequest(url: string, method: string = 'GET', headers?: Record<string, string>): {
    allowed: boolean;
    reason?: string;
    mockResponse?: MockServiceResponse;
  } {
    if (!this.isIsolationActive) {
      return { allowed: true };
    }

    // Check for blocked URL patterns
    for (const pattern of this.BLOCKED_URL_PATTERNS) {
      if (pattern.test(url)) {
        const blockedCall = this.recordBlockedCall('http_request', {
          targetUrl: url,
          reason: `URL matches blocked pattern: ${pattern.toString()}`
        });

        this.emit('externalCallBlocked', blockedCall);

        // Return mock response if available
        const mockResponse = this.getMockResponse('http', url, method);
        return {
          allowed: false,
          reason: `Demo mode: External HTTP requests to ${url} are blocked`,
          mockResponse
        };
      }
    }

    // Check headers for credential patterns
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        for (const pattern of this.CREDENTIAL_PATTERNS) {
          if (pattern.test(key) || pattern.test(value)) {
            const blockedCall = this.recordBlockedCall('credential_access', {
              targetUrl: url,
              reason: `Header contains credential pattern: ${key}`
            });

            this.emit('credentialAccessBlocked', blockedCall);

            return {
              allowed: false,
              reason: `Demo mode: Credential access in headers is blocked`
            };
          }
        }
      }
    }

    // Allow localhost and mock URLs
    if (this.isAllowedUrl(url)) {
      return { allowed: true };
    }

    // Default: block unknown external URLs
    const blockedCall = this.recordBlockedCall('http_request', {
      targetUrl: url,
      reason: 'Unknown external URL blocked in demo mode'
    });

    this.emit('externalCallBlocked', blockedCall);

    return {
      allowed: false,
      reason: `Demo mode: External requests to ${url} are not allowed`,
      mockResponse: this.getMockResponse('http', url, method)
    };
  }

  /**
   * Validate WebSocket connection attempt
   * @param url - WebSocket URL
   * @returns Whether the connection should be allowed
   */
  validateWebSocketConnection(url: string): {
    allowed: boolean;
    reason?: string;
    useMockWebSocket: boolean;
  } {
    if (!this.isIsolationActive) {
      return { allowed: true, useMockWebSocket: false };
    }

    // Allow localhost WebSocket connections
    if (this.isAllowedUrl(url)) {
      return { allowed: true, useMockWebSocket: false };
    }

    // Block external WebSocket connections
    const blockedCall = this.recordBlockedCall('websocket_connection', {
      targetUrl: url,
      reason: 'External WebSocket connections blocked in demo mode'
    });

    this.emit('webSocketBlocked', blockedCall);

    return {
      allowed: false,
      reason: `Demo mode: WebSocket connections to ${url} are blocked. Using simulated WebSocket.`,
      useMockWebSocket: true
    };
  }

  /**
   * Validate credential access attempt
   * @param credentialType - Type of credential being accessed
   * @param source - Source of the credential request
   * @returns Whether the access should be allowed
   */
  validateCredentialAccess(credentialType: string, source: string): {
    allowed: boolean;
    reason?: string;
  } {
    if (!this.isIsolationActive) {
      return { allowed: true };
    }

    // Always block credential access in demo mode
    const blockedCall = this.recordBlockedCall('credential_access', {
      targetService: credentialType,
      reason: `Credential access blocked in demo mode: ${credentialType} from ${source}`
    });

    this.emit('credentialAccessBlocked', blockedCall);

    return {
      allowed: false,
      reason: `Demo mode: Access to ${credentialType} credentials is blocked`
    };
  }

  /**
   * Validate command execution attempt
   * @param command - Command to be executed
   * @returns Whether the command should be allowed
   */
  validateCommandExecution(command: string): {
    allowed: boolean;
    reason?: string;
    isDangerous: boolean;
  } {
    if (!this.isIsolationActive) {
      return { allowed: true, isDangerous: false };
    }

    // Check for dangerous command patterns
    for (const pattern of this.DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(command)) {
        const blockedCall = this.recordBlockedCall('process_spawn', {
          targetService: command.substring(0, 50),
          reason: `Dangerous command pattern detected: ${pattern.toString()}`
        });

        this.emit('dangerousCommandBlocked', blockedCall);

        return {
          allowed: false,
          reason: `Demo mode: Command execution is blocked: ${command.substring(0, 50)}...`,
          isDangerous: true
        };
      }
    }

    // Block all command execution in demo mode
    const blockedCall = this.recordBlockedCall('process_spawn', {
      targetService: command.substring(0, 50),
      reason: 'All command execution blocked in demo mode'
    });

    this.emit('commandBlocked', blockedCall);

    return {
      allowed: false,
      reason: `Demo mode: Command execution is not allowed`,
      isDangerous: false
    };
  }

  /**
   * Validate database query attempt
   * @param query - Database query
   * @param connectionString - Database connection string
   * @returns Whether the query should be allowed
   */
  validateDatabaseQuery(query: string, connectionString?: string): {
    allowed: boolean;
    reason?: string;
    mockResponse?: any;
  } {
    if (!this.isIsolationActive) {
      return { allowed: true };
    }

    // Block all database queries in demo mode
    const blockedCall = this.recordBlockedCall('database_query', {
      targetService: connectionString ? 'database' : 'unknown',
      reason: 'Database queries blocked in demo mode'
    });

    this.emit('databaseQueryBlocked', blockedCall);

    return {
      allowed: false,
      reason: `Demo mode: Database queries are blocked`,
      mockResponse: this.getMockDatabaseResponse(query)
    };
  }

  /**
   * Validate cloud API call
   * @param provider - Cloud provider (aws, gcp, azure)
   * @param service - Service being called
   * @param action - Action being performed
   * @returns Whether the call should be allowed
   */
  validateCloudApiCall(provider: string, service: string, action: string): {
    allowed: boolean;
    reason?: string;
    mockResponse?: MockServiceResponse;
  } {
    if (!this.isIsolationActive) {
      return { allowed: true };
    }

    // Block all cloud API calls in demo mode
    const blockedCall = this.recordBlockedCall('cloud_api', {
      targetService: `${provider}:${service}:${action}`,
      reason: `Cloud API call blocked in demo mode: ${provider}/${service}/${action}`
    });

    this.emit('cloudApiBlocked', blockedCall);

    return {
      allowed: false,
      reason: `Demo mode: Cloud API calls to ${provider}/${service} are blocked`,
      mockResponse: this.getMockCloudResponse(provider, service, action)
    };
  }

  /**
   * Get all blocked calls for audit
   */
  getBlockedCalls(): BlockedCallRecord[] {
    return [...this.blockedCalls];
  }

  /**
   * Get summary of blocked calls by type
   */
  getBlockedCallsSummary(): Record<ExternalCallType, number> {
    const summary: Record<string, number> = {};
    
    for (const call of this.blockedCalls) {
      summary[call.callType] = (summary[call.callType] || 0) + 1;
    }

    return summary as Record<ExternalCallType, number>;
  }

  /**
   * Clear blocked calls history (for testing)
   */
  clearBlockedCalls(): void {
    this.blockedCalls = [];
  }

  /**
   * Register a mock service for simulated responses
   * @param serviceName - Name of the service to mock
   * @param handler - Handler function for mock responses
   */
  registerMockService(serviceName: string, handler: (request: any) => MockServiceResponse): void {
    this.mockServices.set(serviceName, handler);
  }

  /**
   * Get simulation status indicators for UI
   */
  getSimulationIndicators(): {
    isDemoMode: boolean;
    statusText: string;
    statusColor: 'green' | 'yellow' | 'red';
    warningMessage?: string;
    blockedActionsCount: number;
    safetyScore: number;
  } {
    if (!this.isIsolationActive) {
      return {
        isDemoMode: false,
        statusText: 'LIVE MODE',
        statusColor: 'green',
        blockedActionsCount: 0,
        safetyScore: 100
      };
    }

    const blockedCount = this.blockedCalls.length;
    const safetyScore = Math.max(0, 100 - (blockedCount * 2));

    return {
      isDemoMode: true,
      statusText: 'DEMO MODE - SIMULATED DATA',
      statusColor: 'yellow',
      warningMessage: 'All data is simulated. No real system interactions.',
      blockedActionsCount: blockedCount,
      safetyScore
    };
  }

  // Private helper methods

  private getSafetyConstraints() {
    return {
      noExternalActions: true,
      noCredentialAccess: true,
      noInfrastructureMutation: true,
      noRealWebSocketConnections: true,
      noRealApiCalls: true
    };
  }

  private isAllowedUrl(url: string): boolean {
    const allowedPatterns = [
      /^https?:\/\/localhost/i,
      /^https?:\/\/127\.0\.0\.1/i,
      /^https?:\/\/\[::1\]/i,
      /^https?:\/\/mock\./i,
      /^https?:\/\/demo\./i,
      /^https?:\/\/test\./i,
      /^wss?:\/\/localhost/i,
      /^wss?:\/\/127\.0\.0\.1/i,
    ];

    return allowedPatterns.some(pattern => pattern.test(url));
  }

  private recordBlockedCall(
    callType: ExternalCallType,
    details: { targetUrl?: string; targetService?: string; reason: string }
  ): BlockedCallRecord {
    const record: BlockedCallRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      callType,
      targetUrl: details.targetUrl,
      targetService: details.targetService,
      reason: details.reason,
      demoSessionId: this.currentSessionId || undefined
    };

    this.blockedCalls.push(record);

    this.logIsolationEvent('call_blocked', record);

    return record;
  }

  private logIsolationEvent(eventType: string, details: any): void {
    this.emit('isolationAuditEvent', {
      eventId: uuidv4(),
      eventType,
      timestamp: new Date().toISOString(),
      sessionId: this.currentSessionId,
      details,
      demoMode: true,
      immutable: true
    });
  }

  private initializeMockServices(): void {
    // Register default mock services
    this.registerMockService('datadog', () => ({
      success: true,
      data: { metrics: [], alerts: [] },
      simulatedLatencyMs: 150,
      mockServiceName: 'datadog-mock',
      timestamp: new Date().toISOString()
    }));

    this.registerMockService('cloudwatch', () => ({
      success: true,
      data: { metrics: [], alarms: [] },
      simulatedLatencyMs: 200,
      mockServiceName: 'cloudwatch-mock',
      timestamp: new Date().toISOString()
    }));

    this.registerMockService('splunk', () => ({
      success: true,
      data: { events: [], searches: [] },
      simulatedLatencyMs: 300,
      mockServiceName: 'splunk-mock',
      timestamp: new Date().toISOString()
    }));
  }

  private getMockResponse(type: string, url: string, method: string): MockServiceResponse {
    return {
      success: true,
      data: {
        message: 'Simulated response in demo mode',
        originalUrl: url,
        originalMethod: method,
        simulated: true
      },
      simulatedLatencyMs: 100,
      mockServiceName: 'demo-mock-service',
      timestamp: new Date().toISOString()
    };
  }

  private getMockDatabaseResponse(query: string): any {
    return {
      rows: [],
      rowCount: 0,
      simulated: true,
      message: 'Database query simulated in demo mode'
    };
  }

  private getMockCloudResponse(provider: string, service: string, action: string): MockServiceResponse {
    return {
      success: true,
      data: {
        provider,
        service,
        action,
        result: 'Simulated cloud API response',
        simulated: true
      },
      simulatedLatencyMs: 250,
      mockServiceName: `${provider}-${service}-mock`,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Singleton instance for global isolation enforcement
 */
let isolationServiceInstance: DemoIsolationService | null = null;

export function getDemoIsolationService(): DemoIsolationService {
  if (!isolationServiceInstance) {
    isolationServiceInstance = new DemoIsolationService();
  }
  return isolationServiceInstance;
}

/**
 * Helper function to check if demo mode is active
 */
export function isDemoModeActive(): boolean {
  return getDemoIsolationService().isActive();
}

/**
 * Helper function to validate external calls
 */
export function validateExternalCall(
  callType: ExternalCallType,
  target: string,
  options?: any
): { allowed: boolean; reason?: string; mockResponse?: any } {
  const service = getDemoIsolationService();
  
  if (!service.isActive()) {
    return { allowed: true };
  }

  switch (callType) {
    case 'http_request':
      return service.validateHttpRequest(target, options?.method, options?.headers);
    case 'websocket_connection':
      return service.validateWebSocketConnection(target);
    case 'credential_access':
      return service.validateCredentialAccess(target, options?.source || 'unknown');
    case 'database_query':
      return service.validateDatabaseQuery(target, options?.connectionString);
    case 'cloud_api':
      return service.validateCloudApiCall(
        options?.provider || 'unknown',
        options?.service || 'unknown',
        target
      );
    case 'process_spawn':
      return service.validateCommandExecution(target);
    default:
      return { allowed: false, reason: `Demo mode: ${callType} operations are blocked` };
  }
}
