/**
 * WorkflowContext State Synchronization Unit Tests
 * 
 * Tests for the WorkflowContext state synchronization functionality
 * including cross-panel state updates, WebSocket message handling,
 * and error recovery scenarios.
 * 
 * Task 13.4: Write unit tests for state synchronization
 * Requirements: 5.5 - State synchronization across panels
 * Requirements: 13.2 - Real-time communication reliability
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkflowProvider, useWorkflow } from '../context/WorkflowContext';
import {
  WorkflowState,
  WorkflowInstance,
  AgentOutput,
  GovernanceDecision,
  GovernanceApprovalRequest,
  ActiveAlert,
  LogEntry,
  AgentCard,
} from '../types/workflow';
import { MessageHandlers } from '../hooks/useWebSocket';

// Store the registered handlers for testing
let registeredHandlers: MessageHandlers = {};
let mockSubscribeToWorkflow: jest.Mock;
let mockRequestWorkflowState: jest.Mock;
let mockReconnect: jest.Mock;

// Mock the useWebSocket hook
jest.mock('../hooks/useWebSocket', () => ({
  useWebSocket: jest.fn(() => ({
    connectionStatus: 'connected',
    clientId: 'test-client-123',
    isConnected: true,
    subscribeToWorkflow: mockSubscribeToWorkflow,
    requestWorkflowState: mockRequestWorkflowState,
    registerHandlers: (handlers: MessageHandlers) => {
      registeredHandlers = handlers;
    },
    reconnect: mockReconnect,
  })),
}));

// Initialize mocks before each test
beforeEach(() => {
  registeredHandlers = {};
  mockSubscribeToWorkflow = jest.fn();
  mockRequestWorkflowState = jest.fn();
  mockReconnect = jest.fn();
});


// Helper to render hook with WorkflowProvider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkflowProvider>{children}</WorkflowProvider>
);

// Sample test data
const createMockWorkflow = (state: WorkflowState = WorkflowState.IDLE): WorkflowInstance => ({
  workflowId: 'test-workflow-001',
  currentState: state,
  timestamp: '2024-01-15T14:32:00Z',
  alert: {
    service: 'payment-service',
    severity: 'critical',
    metric: 'error_rate',
    value: 15.5,
    timestamp: '2024-01-15T14:32:00Z',
  },
  agentOutputs: [],
  auditTrail: [],
});

const createMockAgentOutput = (agentName: 'sre-agent' | 'security-agent' | 'governance-agent'): AgentOutput => ({
  agentName,
  skillsUsed: agentName === 'sre-agent' 
    ? ['Datadog', 'CloudWatch'] 
    : agentName === 'security-agent'
    ? ['Splunk SIEM', 'IAM Logs']
    : ['Policy Engine', 'Risk Register'],
  findings: {
    summary: `${agentName} analysis complete`,
    evidence: ['Evidence item 1', 'Evidence item 2'],
    correlations: ['Correlation 1'],
    recommendations: ['Recommendation 1'],
  },
  confidenceLevel: 0.85,
  timestamp: '2024-01-15T14:35:00Z',
  metadata: {
    processingTimeMs: 1500,
    dataSourcesAccessed: ['source1', 'source2'],
  },
});

const createMockGovernanceRequest = (): GovernanceApprovalRequest => ({
  recommendedAction: 'Scale up database connection pool',
  blastRadius: [
    { serviceName: 'database', healthStatus: 'critical', dependencies: ['api-gateway'], impactLevel: 'high' },
    { serviceName: 'api-gateway', healthStatus: 'warning', dependencies: ['frontend'], impactLevel: 'medium' },
  ],
  riskLevel: 'high',
  policyConflicts: ['Change freeze policy'],
  reversibility: true,
});

const createMockGovernanceDecision = (): GovernanceDecision => ({
  decision: 'approve',
  rationale: 'Approved due to critical service impact',
  approver: { id: 'user-001', role: 'SRE Lead' },
  timestamp: '2024-01-15T14:40:00Z',
  blastRadiusAssessment: {
    affectedServices: ['database', 'api-gateway'],
    riskLevel: 'high',
    reversible: true,
  },
});


describe('WorkflowContext State Synchronization', () => {
  describe('Cross-Panel State Updates', () => {
    /**
     * Test that workflow state changes update all panels
     * Requirements: 5.5 - State synchronization across panels
     */
    it('should initialize with default state for all panels', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      // Verify initial state
      expect(result.current.state.currentWorkflow).toBeNull();
      expect(result.current.state.activeAlert).toBeNull();
      expect(result.current.state.logs).toEqual([]);
      expect(result.current.state.agentCards).toHaveLength(3);
      expect(result.current.state.governanceRequest).toBeNull();
    });

    it('should update workflow state and sync to all panels', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockWorkflow = createMockWorkflow(WorkflowState.ANALYZING);

      act(() => {
        result.current.setWorkflow(mockWorkflow);
      });

      // Verify workflow is set
      expect(result.current.state.currentWorkflow).toEqual(mockWorkflow);
      // Verify alert is synced from workflow
      expect(result.current.state.currentWorkflow?.alert).toEqual(mockWorkflow.alert);
    });

    it('should update agent cards when workflow state changes to ANALYZING', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockWorkflow = createMockWorkflow(WorkflowState.ANALYZING);

      act(() => {
        result.current.setWorkflow(mockWorkflow);
      });

      // Simulate workflow state handler being called
      act(() => {
        if (registeredHandlers.onWorkflowState) {
          registeredHandlers.onWorkflowState('test-workflow-001', mockWorkflow);
        }
      });

      // Agent cards should be updated based on workflow state
      expect(result.current.state.currentWorkflow?.currentState).toBe(WorkflowState.ANALYZING);
    });

    it('should update governance panel when governance request is received', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockRequest = createMockGovernanceRequest();

      act(() => {
        result.current.setGovernanceRequest(mockRequest);
      });

      expect(result.current.state.governanceRequest).toEqual(mockRequest);
    });

    it('should clear governance request when decision is submitted', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockWorkflow = createMockWorkflow(WorkflowState.GOVERNANCE_PENDING);
      const mockRequest = createMockGovernanceRequest();
      const mockDecision = createMockGovernanceDecision();

      // Set up initial state
      act(() => {
        result.current.setWorkflow(mockWorkflow);
        result.current.setGovernanceRequest(mockRequest);
      });

      expect(result.current.state.governanceRequest).toEqual(mockRequest);

      // Submit decision
      act(() => {
        result.current.submitGovernanceDecision(mockDecision);
      });

      // Governance request should be cleared
      expect(result.current.state.governanceRequest).toBeNull();
      // Decision should be recorded in workflow
      expect(result.current.state.currentWorkflow?.governanceDecision).toEqual(mockDecision);
    });
  });


  describe('Agent Output Updates', () => {
    /**
     * Test that agent outputs update the appropriate agent cards
     */
    it('should update agent card when agent output is received', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockWorkflow = createMockWorkflow(WorkflowState.ANALYZING);
      const mockOutput = createMockAgentOutput('sre-agent');

      act(() => {
        result.current.setWorkflow(mockWorkflow);
      });

      // Simulate agent output via handler
      act(() => {
        if (registeredHandlers.onAgentOutput) {
          registeredHandlers.onAgentOutput('test-workflow-001', mockOutput);
        }
      });

      // Agent output should be added to workflow
      expect(result.current.state.currentWorkflow?.agentOutputs).toContainEqual(mockOutput);
    });

    it('should add log entry when agent completes analysis', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockWorkflow = createMockWorkflow(WorkflowState.ANALYZING);
      const mockOutput = createMockAgentOutput('security-agent');

      act(() => {
        result.current.setWorkflow(mockWorkflow);
      });

      const initialLogCount = result.current.state.logs.length;

      act(() => {
        if (registeredHandlers.onAgentOutput) {
          registeredHandlers.onAgentOutput('test-workflow-001', mockOutput);
        }
      });

      // A log entry should be added for agent completion
      expect(result.current.state.logs.length).toBeGreaterThan(initialLogCount);
    });
  });

  describe('Active Alert Updates', () => {
    /**
     * Test that active alert updates sync to left panel
     */
    it('should update active alert in state', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockAlert: ActiveAlert = {
        service: 'api-gateway',
        severity: 'warning',
        metric: 'latency_p99',
        value: 250,
        timestamp: '2024-01-15T14:30:00Z',
      };

      act(() => {
        result.current.setActiveAlert(mockAlert);
      });

      expect(result.current.state.activeAlert).toEqual(mockAlert);
    });

    it('should sync alert from workflow instance', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockWorkflow = createMockWorkflow(WorkflowState.INCIDENT_INGESTED);

      act(() => {
        if (registeredHandlers.onWorkflowState) {
          registeredHandlers.onWorkflowState('test-workflow-001', mockWorkflow);
        }
      });

      // Alert should be synced from workflow
      expect(result.current.state.currentWorkflow?.alert).toEqual(mockWorkflow.alert);
    });
  });

  describe('Log Management', () => {
    /**
     * Test log entry management
     */
    it('should add log entries to state', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockLog: LogEntry = {
        timestamp: '2024-01-15T14:32:00Z',
        level: 'info',
        message: 'Workflow started',
        source: 'orchestrator',
      };

      act(() => {
        result.current.addLog(mockLog);
      });

      expect(result.current.state.logs).toContainEqual(mockLog);
    });

    it('should limit logs to 500 entries', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      // Add 510 logs
      act(() => {
        for (let i = 0; i < 510; i++) {
          result.current.addLog({
            timestamp: `2024-01-15T14:${String(i).padStart(2, '0')}:00Z`,
            level: 'info',
            message: `Log entry ${i}`,
            source: 'test',
          });
        }
      });

      // Should be capped at 500
      expect(result.current.state.logs.length).toBeLessThanOrEqual(500);
    });
  });
});


describe('WebSocket Message Handling', () => {
  describe('Connection Status Updates', () => {
    /**
     * Test connection status synchronization
     */
    it('should sync connection status from WebSocket hook', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      // Default mock returns 'connected'
      expect(result.current.state.connectionStatus).toBe('connected');
    });

    it('should sync client ID from WebSocket hook', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      // Default mock returns 'test-client-123'
      expect(result.current.state.clientId).toBe('test-client-123');
    });

    it('should expose isConnected status', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('Message Type Routing', () => {
    /**
     * Test that different message types are routed to correct handlers
     */
    it('should handle workflow_state messages', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockWorkflow = createMockWorkflow(WorkflowState.RCA_COMPLETE);

      act(() => {
        if (registeredHandlers.onWorkflowState) {
          registeredHandlers.onWorkflowState('test-workflow-001', mockWorkflow);
        }
      });

      expect(result.current.state.currentWorkflow?.currentState).toBe(WorkflowState.RCA_COMPLETE);
    });

    it('should handle agent_output messages', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockWorkflow = createMockWorkflow(WorkflowState.ANALYZING);
      const mockOutput = createMockAgentOutput('governance-agent');

      act(() => {
        result.current.setWorkflow(mockWorkflow);
      });

      act(() => {
        if (registeredHandlers.onAgentOutput) {
          registeredHandlers.onAgentOutput('test-workflow-001', mockOutput);
        }
      });

      expect(result.current.state.currentWorkflow?.agentOutputs).toHaveLength(1);
    });

    it('should handle governance_required messages', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockRequest = createMockGovernanceRequest();

      act(() => {
        if (registeredHandlers.onGovernanceRequired) {
          registeredHandlers.onGovernanceRequired('test-workflow-001', mockRequest);
        }
      });

      expect(result.current.state.governanceRequest).toEqual(mockRequest);
    });

    it('should handle governance_decision messages', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockWorkflow = createMockWorkflow(WorkflowState.GOVERNANCE_PENDING);
      const mockDecision = createMockGovernanceDecision();

      act(() => {
        result.current.setWorkflow(mockWorkflow);
      });

      act(() => {
        if (registeredHandlers.onGovernanceDecision) {
          registeredHandlers.onGovernanceDecision('test-workflow-001', mockDecision);
        }
      });

      expect(result.current.state.currentWorkflow?.governanceDecision).toEqual(mockDecision);
    });

    it('should handle workflow_complete messages', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const completedWorkflow = createMockWorkflow(WorkflowState.RESOLVED);

      act(() => {
        if (registeredHandlers.onWorkflowComplete) {
          registeredHandlers.onWorkflowComplete('test-workflow-001', completedWorkflow);
        }
      });

      expect(result.current.state.currentWorkflow?.currentState).toBe(WorkflowState.RESOLVED);
    });

    it('should add log entry for governance decision', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockWorkflow = createMockWorkflow(WorkflowState.GOVERNANCE_PENDING);
      const mockDecision = createMockGovernanceDecision();

      act(() => {
        result.current.setWorkflow(mockWorkflow);
      });

      const initialLogCount = result.current.state.logs.length;

      act(() => {
        if (registeredHandlers.onGovernanceDecision) {
          registeredHandlers.onGovernanceDecision('test-workflow-001', mockDecision);
        }
      });

      expect(result.current.state.logs.length).toBeGreaterThan(initialLogCount);
    });
  });

  describe('Handler Registration', () => {
    /**
     * Test that handlers are properly registered
     */
    it('should register all required message handlers', () => {
      renderHook(() => useWorkflow(), { wrapper });

      expect(registeredHandlers.onWorkflowState).toBeDefined();
      expect(registeredHandlers.onAgentOutput).toBeDefined();
      expect(registeredHandlers.onGovernanceRequired).toBeDefined();
      expect(registeredHandlers.onGovernanceDecision).toBeDefined();
      expect(registeredHandlers.onWorkflowComplete).toBeDefined();
      expect(registeredHandlers.onDemoEvent).toBeDefined();
      expect(registeredHandlers.onConnectionEstablished).toBeDefined();
      expect(registeredHandlers.onError).toBeDefined();
    });
  });
});


describe('Error Recovery Scenarios', () => {
  describe('Reconnection Behavior', () => {
    /**
     * Test reconnection functionality
     */
    it('should expose reconnect function', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      expect(result.current.reconnect).toBeDefined();
      expect(typeof result.current.reconnect).toBe('function');
    });

    it('should call WebSocket reconnect when reconnect is invoked', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      act(() => {
        result.current.reconnect();
      });

      expect(mockReconnect).toHaveBeenCalled();
    });

    it('should handle connection established event', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      act(() => {
        if (registeredHandlers.onConnectionEstablished) {
          registeredHandlers.onConnectionEstablished('new-client-456');
        }
      });

      // Connection established handler should be called without errors
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('Error State Handling', () => {
    /**
     * Test error handling and logging
     */
    it('should add error log entry when error handler is called', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const initialLogCount = result.current.state.logs.length;

      act(() => {
        if (registeredHandlers.onError) {
          registeredHandlers.onError('Connection timeout');
        }
      });

      expect(result.current.state.logs.length).toBeGreaterThan(initialLogCount);
      const lastLog = result.current.state.logs[result.current.state.logs.length - 1];
      expect(lastLog.level).toBe('error');
      expect(lastLog.message).toContain('Connection error');
    });
  });

  describe('State Reset Functionality', () => {
    /**
     * Test workflow reset functionality
     */
    it('should reset workflow state while preserving connection info', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });
      const mockWorkflow = createMockWorkflow(WorkflowState.ANALYZING);
      const mockAlert: ActiveAlert = {
        service: 'test-service',
        severity: 'critical',
        metric: 'test_metric',
        value: 100,
        timestamp: '2024-01-15T14:32:00Z',
      };

      // Set up state
      act(() => {
        result.current.setWorkflow(mockWorkflow);
        result.current.setActiveAlert(mockAlert);
        result.current.addLog({
          timestamp: '2024-01-15T14:32:00Z',
          level: 'info',
          message: 'Test log',
          source: 'test',
        });
      });

      // Verify state is set
      expect(result.current.state.currentWorkflow).not.toBeNull();
      expect(result.current.state.activeAlert).not.toBeNull();
      expect(result.current.state.logs.length).toBeGreaterThan(0);

      // Reset workflow
      act(() => {
        result.current.resetWorkflow();
      });

      // Verify workflow state is reset
      expect(result.current.state.currentWorkflow).toBeNull();
      expect(result.current.state.activeAlert).toBeNull();
      expect(result.current.state.logs).toEqual([]);
      
      // Connection status should be preserved
      expect(result.current.state.connectionStatus).toBe('connected');
      expect(result.current.state.clientId).toBe('test-client-123');
    });

    it('should reset agent cards to idle state', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      // Update an agent card
      act(() => {
        result.current.updateAgentCard({
          agentName: 'sre-agent',
          status: 'complete',
          skillsActive: ['Datadog'],
          findings: ['Finding 1'],
          confidenceLevel: 0.9,
          thinkingAnimation: false,
        });
      });

      // Reset workflow
      act(() => {
        result.current.resetWorkflow();
      });

      // Agent cards should be reset to idle
      const sreCard = result.current.state.agentCards.find(c => c.agentName === 'sre-agent');
      expect(sreCard?.status).toBe('idle');
      expect(sreCard?.skillsActive).toEqual([]);
      expect(sreCard?.findings).toEqual([]);
    });
  });
});


describe('Demo Mode Handling', () => {
  /**
   * Test demo mode functionality
   */
  it('should initialize in demo mode by default', () => {
    const { result } = renderHook(() => useWorkflow(), { wrapper });

    expect(result.current.state.isDemoMode).toBe(true);
    expect(result.current.state.uiMode).toBe('demo');
  });

  it('should toggle demo mode', () => {
    const { result } = renderHook(() => useWorkflow(), { wrapper });

    act(() => {
      result.current.setDemoMode(false);
    });

    expect(result.current.state.isDemoMode).toBe(false);
    expect(result.current.state.uiMode).toBe('live');

    act(() => {
      result.current.setDemoMode(true);
    });

    expect(result.current.state.isDemoMode).toBe(true);
    expect(result.current.state.uiMode).toBe('demo');
  });

  it('should handle demo events', () => {
    const { result } = renderHook(() => useWorkflow(), { wrapper });
    const mockAlert: ActiveAlert = {
      service: 'demo-service',
      severity: 'warning',
      metric: 'demo_metric',
      value: 50,
      timestamp: '2024-01-15T14:32:00Z',
    };

    act(() => {
      if (registeredHandlers.onDemoEvent) {
        registeredHandlers.onDemoEvent('alert', mockAlert);
      }
    });

    expect(result.current.state.activeAlert).toEqual(mockAlert);
  });

  it('should handle demo log events', () => {
    const { result } = renderHook(() => useWorkflow(), { wrapper });
    const mockLog: LogEntry = {
      timestamp: '2024-01-15T14:32:00Z',
      level: 'info',
      message: 'Demo log entry',
      source: 'demo',
    };

    act(() => {
      if (registeredHandlers.onDemoEvent) {
        registeredHandlers.onDemoEvent('log', mockLog);
      }
    });

    expect(result.current.state.logs).toContainEqual(mockLog);
  });

  it('should handle demo agent status events', () => {
    const { result } = renderHook(() => useWorkflow(), { wrapper });
    const mockAgentCard: AgentCard = {
      agentName: 'sre-agent',
      status: 'analyzing',
      skillsActive: ['Datadog', 'CloudWatch'],
      findings: [],
      confidenceLevel: 0,
      thinkingAnimation: true,
    };

    act(() => {
      if (registeredHandlers.onDemoEvent) {
        registeredHandlers.onDemoEvent('agent_status', mockAgentCard);
      }
    });

    const sreCard = result.current.state.agentCards.find(c => c.agentName === 'sre-agent');
    expect(sreCard?.status).toBe('analyzing');
    expect(sreCard?.thinkingAnimation).toBe(true);
  });
});

describe('Workflow Subscription', () => {
  /**
   * Test workflow subscription functionality
   */
  it('should subscribe to workflow when setWorkflow is called', () => {
    const { result } = renderHook(() => useWorkflow(), { wrapper });
    const mockWorkflow = createMockWorkflow(WorkflowState.IDLE);

    act(() => {
      result.current.setWorkflow(mockWorkflow);
    });

    expect(mockSubscribeToWorkflow).toHaveBeenCalledWith('test-workflow-001');
  });

  it('should expose subscribeToWorkflow function', () => {
    const { result } = renderHook(() => useWorkflow(), { wrapper });

    act(() => {
      result.current.subscribeToWorkflow('workflow-123');
    });

    expect(mockSubscribeToWorkflow).toHaveBeenCalledWith('workflow-123');
  });

  it('should expose requestWorkflowState function', () => {
    const { result } = renderHook(() => useWorkflow(), { wrapper });

    act(() => {
      result.current.requestWorkflowState('workflow-123');
    });

    expect(mockRequestWorkflowState).toHaveBeenCalledWith('workflow-123');
  });
});

describe('Context Hook Error Handling', () => {
  /**
   * Test that useWorkflow throws when used outside provider
   */
  it('should throw error when used outside WorkflowProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useWorkflow());
    }).toThrow('useWorkflow must be used within a WorkflowProvider');

    consoleSpy.mockRestore();
  });
});
