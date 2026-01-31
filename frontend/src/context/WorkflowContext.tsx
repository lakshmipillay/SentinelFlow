'use client';

/**
 * WorkflowContext - Central state management for SentinelFlow Mission Control
 * 
 * Provides workflow state, agent outputs, and governance decisions to all
 * dashboard components via React Context.
 * 
 * Enhanced with WebSocket integration for real-time state synchronization
 * across all three panels (Task 13.3).
 * 
 * Integrated with API client for governance decision submission (Task 16.1).
 * 
 * Requirements: 5.5 - State synchronization across panels
 * Requirements: 13.2 - Real-time communication reliability
 * Requirements: 13.3 - Governance decision submission to backend
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef, ReactNode } from 'react';
import {
  WorkflowState,
  WorkflowInstance,
  AgentOutput,
  GovernanceDecision,
  ActiveAlert,
  LogEntry,
  ConnectionStatus,
  UIMode,
  AgentCard,
  GovernanceApprovalRequest,
  AgentType,
  AGENT_SKILLS,
  GovernanceDecisionType
} from '@/types/workflow';
import { useWebSocket, MessageHandlers } from '@/hooks/useWebSocket';
import { getApiClient, ApiError } from '@/services/api';

/**
 * Dashboard state interface
 */
interface DashboardState {
  // Current workflow
  currentWorkflow: WorkflowInstance | null;
  
  // Connection status
  connectionStatus: ConnectionStatus;
  
  // WebSocket client ID
  clientId: string | null;
  
  // UI mode
  uiMode: UIMode;
  
  // Left panel state
  activeAlert: ActiveAlert | null;
  logs: LogEntry[];
  isLogStreaming: boolean;
  
  // Center panel state
  agentCards: AgentCard[];
  
  // Right panel state
  governanceRequest: GovernanceApprovalRequest | null;
  
  // Demo mode
  isDemoMode: boolean;
  
  // Last sync timestamp
  lastSyncTimestamp: string | null;
}

/**
 * Action types for state reducer
 */
type DashboardAction =
  | { type: 'SET_WORKFLOW'; payload: WorkflowInstance }
  | { type: 'UPDATE_WORKFLOW_STATE'; payload: WorkflowState }
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionStatus }
  | { type: 'SET_CLIENT_ID'; payload: string | null }
  | { type: 'SET_UI_MODE'; payload: UIMode }
  | { type: 'SET_ACTIVE_ALERT'; payload: ActiveAlert }
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'SET_LOGS'; payload: LogEntry[] }
  | { type: 'SET_LOG_STREAMING'; payload: boolean }
  | { type: 'UPDATE_AGENT_CARD'; payload: AgentCard }
  | { type: 'SET_AGENT_CARDS'; payload: AgentCard[] }
  | { type: 'ADD_AGENT_OUTPUT'; payload: AgentOutput }
  | { type: 'SET_GOVERNANCE_REQUEST'; payload: GovernanceApprovalRequest | null }
  | { type: 'SET_GOVERNANCE_DECISION'; payload: GovernanceDecision }
  | { type: 'SET_DEMO_MODE'; payload: boolean }
  | { type: 'SET_LAST_SYNC'; payload: string }
  | { type: 'SYNC_WORKFLOW_STATE'; payload: { workflow: WorkflowInstance; alert?: ActiveAlert } }
  | { type: 'RESET_WORKFLOW' };

/**
 * Initial state
 */
const initialState: DashboardState = {
  currentWorkflow: null,
  connectionStatus: 'disconnected',
  clientId: null,
  uiMode: 'demo',
  activeAlert: null,
  logs: [],
  isLogStreaming: false,
  agentCards: [
    { agentName: 'sre-agent', status: 'idle', skillsActive: [], findings: [], confidenceLevel: 0, thinkingAnimation: false },
    { agentName: 'security-agent', status: 'idle', skillsActive: [], findings: [], confidenceLevel: 0, thinkingAnimation: false },
    { agentName: 'governance-agent', status: 'idle', skillsActive: [], findings: [], confidenceLevel: 0, thinkingAnimation: false }
  ],
  governanceRequest: null,
  isDemoMode: true,
  lastSyncTimestamp: null
};

/**
 * State reducer
 */
function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_WORKFLOW':
      return { ...state, currentWorkflow: action.payload };
    
    case 'UPDATE_WORKFLOW_STATE':
      if (!state.currentWorkflow) return state;
      return {
        ...state,
        currentWorkflow: {
          ...state.currentWorkflow,
          currentState: action.payload,
          timestamp: new Date().toISOString()
        }
      };
    
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    
    case 'SET_CLIENT_ID':
      return { ...state, clientId: action.payload };
    
    case 'SET_UI_MODE':
      return { ...state, uiMode: action.payload };
    
    case 'SET_ACTIVE_ALERT':
      return { ...state, activeAlert: action.payload };
    
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs, action.payload].slice(-500) }; // Keep last 500 logs
    
    case 'SET_LOGS':
      return { ...state, logs: action.payload };
    
    case 'SET_LOG_STREAMING':
      return { ...state, isLogStreaming: action.payload };
    
    case 'UPDATE_AGENT_CARD':
      return {
        ...state,
        agentCards: state.agentCards.map(card =>
          card.agentName === action.payload.agentName ? action.payload : card
        )
      };
    
    case 'SET_AGENT_CARDS':
      return { ...state, agentCards: action.payload };
    
    case 'ADD_AGENT_OUTPUT':
      if (!state.currentWorkflow) return state;
      return {
        ...state,
        currentWorkflow: {
          ...state.currentWorkflow,
          agentOutputs: [...state.currentWorkflow.agentOutputs, action.payload]
        }
      };
    
    case 'SET_GOVERNANCE_REQUEST':
      return { ...state, governanceRequest: action.payload };
    
    case 'SET_GOVERNANCE_DECISION':
      if (!state.currentWorkflow) return state;
      // Determine next state based on decision
      // If blocked, terminate. If approved, move to RESOLVED (simplified for demo)
      const nextState = action.payload.decision === 'block' 
        ? WorkflowState.TERMINATED 
        : WorkflowState.RESOLVED;
      return {
        ...state,
        currentWorkflow: {
          ...state.currentWorkflow,
          governanceDecision: action.payload,
          currentState: nextState,
          timestamp: new Date().toISOString()
        },
        governanceRequest: null
      };
    
    case 'SET_DEMO_MODE':
      return { ...state, isDemoMode: action.payload, uiMode: action.payload ? 'demo' : 'live' };
    
    case 'SET_LAST_SYNC':
      return { ...state, lastSyncTimestamp: action.payload };
    
    case 'SYNC_WORKFLOW_STATE':
      // Full workflow state synchronization from WebSocket
      return {
        ...state,
        currentWorkflow: action.payload.workflow,
        activeAlert: action.payload.alert ?? state.activeAlert,
        lastSyncTimestamp: new Date().toISOString()
      };
    
    case 'RESET_WORKFLOW':
      return {
        ...initialState,
        connectionStatus: state.connectionStatus,
        clientId: state.clientId,
        isDemoMode: state.isDemoMode,
        uiMode: state.uiMode
      };
    
    default:
      return state;
  }
}

/**
 * Governance submission state
 */
interface GovernanceSubmissionState {
  isSubmitting: boolean;
  error: string | null;
  lastSubmissionTime: string | null;
}

/**
 * Context interface
 */
interface WorkflowContextType {
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
  
  // Convenience actions
  setWorkflow: (workflow: WorkflowInstance) => void;
  updateWorkflowState: (newState: WorkflowState) => void;
  setActiveAlert: (alert: ActiveAlert) => void;
  addLog: (log: LogEntry) => void;
  updateAgentCard: (card: AgentCard) => void;
  setGovernanceRequest: (request: GovernanceApprovalRequest | null) => void;
  submitGovernanceDecision: (decision: GovernanceDecision) => void;
  resetWorkflow: () => void;
  setDemoMode: (enabled: boolean) => void;
  
  // WebSocket actions
  subscribeToWorkflow: (workflowId: string) => void;
  requestWorkflowState: (workflowId: string) => void;
  isConnected: boolean;
  reconnect: () => void;
  
  // API actions for governance submission (Task 16.1)
  submitGovernanceDecisionToBackend: (
    decision: GovernanceDecisionType,
    rationale: string,
    approver: { id: string; role: string },
    restrictions?: string[]
  ) => Promise<{ success: boolean; error?: string; workflowTerminated?: boolean }>;
  governanceSubmission: GovernanceSubmissionState;
}

/**
 * Create context
 */
const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

/**
 * Convert AgentOutput to AgentCard update
 * Distributes agent output to the appropriate agent card component
 */
function agentOutputToCardUpdate(output: AgentOutput): AgentCard {
  const agentName = output.agentName as AgentType;
  return {
    agentName,
    status: 'complete',
    skillsActive: output.skillsUsed,
    findings: [
      output.findings.summary,
      ...output.findings.evidence.slice(0, 2) // Include first 2 evidence items
    ],
    confidenceLevel: output.confidenceLevel,
    thinkingAnimation: false
  };
}

/**
 * Update agent cards based on workflow state
 * Sets agents to analyzing state when workflow is in ANALYZING state
 */
function getAgentCardsForState(
  currentCards: AgentCard[],
  workflowState: WorkflowState,
  agentOutputs: AgentOutput[]
): AgentCard[] {
  // Create a map of completed agent outputs
  const completedAgents = new Map<AgentType, AgentOutput>();
  agentOutputs.forEach(output => {
    completedAgents.set(output.agentName, output);
  });

  return currentCards.map(card => {
    const completedOutput = completedAgents.get(card.agentName);
    
    if (completedOutput) {
      // Agent has completed analysis
      return agentOutputToCardUpdate(completedOutput);
    }
    
    if (workflowState === WorkflowState.ANALYZING) {
      // Workflow is analyzing, set agent to analyzing state
      return {
        ...card,
        status: 'analyzing' as const,
        skillsActive: AGENT_SKILLS[card.agentName] || [],
        thinkingAnimation: true
      };
    }
    
    if (workflowState === WorkflowState.IDLE) {
      // Reset to idle state
      return {
        agentName: card.agentName,
        status: 'idle' as const,
        skillsActive: [],
        findings: [],
        confidenceLevel: 0,
        thinkingAnimation: false
      };
    }
    
    return card;
  });
}

/**
 * Provider component with WebSocket integration
 * 
 * Implements state synchronization across all three panels:
 * - Left panel: Alert and logs based on workflow state
 * - Center panel: Workflow tracker, agent cards, blast radius
 * - Right panel: Agent summary chat, governance approval card
 * 
 * Integrated with API client for governance decision submission (Task 16.1).
 * 
 * Requirements: 5.5 - State synchronization across panels
 * Requirements: 13.3 - Governance decision submission to backend
 */
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  
  // Governance submission state
  const [governanceSubmission, setGovernanceSubmission] = React.useState<GovernanceSubmissionState>({
    isSubmitting: false,
    error: null,
    lastSubmissionTime: null
  });
  
  // Track current workflow ID for subscription management
  const currentWorkflowIdRef = useRef<string | null>(null);
  
  // API client reference
  const apiClientRef = useRef(getApiClient());

  // Initialize WebSocket connection
  const {
    connectionStatus,
    clientId,
    isConnected,
    subscribeToWorkflow: wsSubscribe,
    requestWorkflowState: wsRequestState,
    registerHandlers,
    reconnect: wsReconnect
  } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
    autoConnect: true
  });

  // Sync connection status to state
  useEffect(() => {
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: connectionStatus });
  }, [connectionStatus]);

  // Sync client ID to state
  useEffect(() => {
    dispatch({ type: 'SET_CLIENT_ID', payload: clientId });
  }, [clientId]);

  /**
   * Handle workflow state updates from WebSocket
   * Synchronizes state across all panels
   */
  const handleWorkflowState = useCallback((_workflowId: string, workflowData: WorkflowState | WorkflowInstance) => {
    // Handle full workflow instance
    if (typeof workflowData === 'object' && 'workflowId' in workflowData) {
      const workflow = workflowData as WorkflowInstance;
      
      // Update workflow and sync to all panels
      dispatch({ 
        type: 'SYNC_WORKFLOW_STATE', 
        payload: { 
          workflow,
          alert: workflow.alert
        } 
      });
      
      // Update agent cards based on workflow state and outputs
      const updatedCards = getAgentCardsForState(
        state.agentCards,
        workflow.currentState,
        workflow.agentOutputs
      );
      dispatch({ type: 'SET_AGENT_CARDS', payload: updatedCards });
      
      // Update log streaming based on workflow state
      const isAnalyzing = workflow.currentState === WorkflowState.ANALYZING;
      dispatch({ type: 'SET_LOG_STREAMING', payload: isAnalyzing });
      
      return;
    }
    
    // Handle simple state update
    const newState = workflowData as WorkflowState;
    dispatch({ type: 'UPDATE_WORKFLOW_STATE', payload: newState });
    
    // Update agent cards for state change
    const updatedCards = getAgentCardsForState(
      state.agentCards,
      newState,
      state.currentWorkflow?.agentOutputs || []
    );
    dispatch({ type: 'SET_AGENT_CARDS', payload: updatedCards });
    
    // Update log streaming
    dispatch({ type: 'SET_LOG_STREAMING', payload: newState === WorkflowState.ANALYZING });
  }, [state.agentCards, state.currentWorkflow?.agentOutputs]);

  /**
   * Handle agent output from WebSocket
   * Distributes output to appropriate agent card in center panel
   * and updates agent summary in right panel
   */
  const handleAgentOutput = useCallback((_workflowId: string, output: AgentOutput) => {
    // Add to workflow's agent outputs
    dispatch({ type: 'ADD_AGENT_OUTPUT', payload: output });
    
    // Update the corresponding agent card
    const cardUpdate = agentOutputToCardUpdate(output);
    dispatch({ type: 'UPDATE_AGENT_CARD', payload: cardUpdate });
    
    // Add log entry for agent completion
    const logEntry: LogEntry = {
      timestamp: output.timestamp,
      level: 'info',
      message: `${output.agentName} completed analysis with ${Math.round(output.confidenceLevel * 100)}% confidence`,
      source: output.agentName
    };
    dispatch({ type: 'ADD_LOG', payload: logEntry });
  }, []);

  /**
   * Handle governance required message from WebSocket
   * Updates governance panel in right panel
   */
  const handleGovernanceRequired = useCallback((_workflowId: string, request: GovernanceApprovalRequest) => {
    dispatch({ type: 'SET_GOVERNANCE_REQUEST', payload: request });
    
    // Add log entry for governance gate
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warning',
      message: `Governance approval required - Risk Level: ${request.riskLevel}`,
      source: 'governance-agent'
    };
    dispatch({ type: 'ADD_LOG', payload: logEntry });
  }, []);

  /**
   * Handle governance decision from WebSocket
   * Clears governance request and updates workflow
   */
  const handleGovernanceDecision = useCallback((_workflowId: string, decision: unknown) => {
    const governanceDecision = decision as GovernanceDecision;
    dispatch({ type: 'SET_GOVERNANCE_DECISION', payload: governanceDecision });
    
    // Add log entry for decision
    const logEntry: LogEntry = {
      timestamp: governanceDecision.timestamp,
      level: governanceDecision.decision === 'block' ? 'error' : 'info',
      message: `Governance decision: ${governanceDecision.decision.toUpperCase()} - ${governanceDecision.rationale}`,
      source: 'governance-agent'
    };
    dispatch({ type: 'ADD_LOG', payload: logEntry });
  }, []);

  /**
   * Handle workflow completion from WebSocket
   * Updates all panels with final state
   */
  const handleWorkflowComplete = useCallback((_workflowId: string, result: WorkflowInstance) => {
    dispatch({ 
      type: 'SYNC_WORKFLOW_STATE', 
      payload: { workflow: result, alert: result.alert } 
    });
    
    // Update all agent cards to complete state
    const finalCards = getAgentCardsForState(
      state.agentCards,
      result.currentState,
      result.agentOutputs
    );
    dispatch({ type: 'SET_AGENT_CARDS', payload: finalCards });
    
    // Stop log streaming
    dispatch({ type: 'SET_LOG_STREAMING', payload: false });
    
    // Add completion log
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: result.currentState === WorkflowState.RESOLVED ? 'info' : 'warning',
      message: `Workflow ${result.currentState === WorkflowState.RESOLVED ? 'resolved' : 'terminated'}`,
      source: 'orchestrator'
    };
    dispatch({ type: 'ADD_LOG', payload: logEntry });
  }, [state.agentCards]);

  /**
   * Handle demo events from WebSocket
   * Used for demo mode simulation
   */
  const handleDemoEvent = useCallback((eventType: string, data: unknown) => {
    switch (eventType) {
      case 'alert':
        dispatch({ type: 'SET_ACTIVE_ALERT', payload: data as ActiveAlert });
        break;
      case 'log':
        dispatch({ type: 'ADD_LOG', payload: data as LogEntry });
        break;
      case 'agent_status':
        dispatch({ type: 'UPDATE_AGENT_CARD', payload: data as AgentCard });
        break;
      default:
        console.log(`[WorkflowContext] Unknown demo event: ${eventType}`);
    }
  }, []);

  /**
   * Handle connection established
   */
  const handleConnectionEstablished = useCallback((newClientId: string) => {
    console.log(`[WorkflowContext] Connected with client ID: ${newClientId}`);
    
    // Re-subscribe to current workflow if any
    if (currentWorkflowIdRef.current) {
      wsSubscribe(currentWorkflowIdRef.current);
    }
  }, [wsSubscribe]);

  /**
   * Handle WebSocket errors
   */
  const handleError = useCallback((error: string) => {
    console.error(`[WorkflowContext] WebSocket error: ${error}`);
    
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: `Connection error: ${error}`,
      source: 'system'
    };
    dispatch({ type: 'ADD_LOG', payload: logEntry });
  }, []);

  // Register WebSocket message handlers
  useEffect(() => {
    const handlers: MessageHandlers = {
      onWorkflowState: handleWorkflowState,
      onAgentOutput: handleAgentOutput,
      onGovernanceRequired: handleGovernanceRequired,
      onGovernanceDecision: handleGovernanceDecision,
      onWorkflowComplete: handleWorkflowComplete,
      onDemoEvent: handleDemoEvent,
      onConnectionEstablished: handleConnectionEstablished,
      onError: handleError
    };
    
    registerHandlers(handlers);
  }, [
    registerHandlers,
    handleWorkflowState,
    handleAgentOutput,
    handleGovernanceRequired,
    handleGovernanceDecision,
    handleWorkflowComplete,
    handleDemoEvent,
    handleConnectionEstablished,
    handleError
  ]);

  // Convenience action creators
  const setWorkflow = useCallback((workflow: WorkflowInstance) => {
    dispatch({ type: 'SET_WORKFLOW', payload: workflow });
    currentWorkflowIdRef.current = workflow.workflowId;
    
    // Subscribe to workflow updates
    if (isConnected) {
      wsSubscribe(workflow.workflowId);
    }
  }, [isConnected, wsSubscribe]);

  const updateWorkflowState = useCallback((newState: WorkflowState) => {
    dispatch({ type: 'UPDATE_WORKFLOW_STATE', payload: newState });
  }, []);

  const setActiveAlert = useCallback((alert: ActiveAlert) => {
    dispatch({ type: 'SET_ACTIVE_ALERT', payload: alert });
  }, []);

  const addLog = useCallback((log: LogEntry) => {
    dispatch({ type: 'ADD_LOG', payload: log });
  }, []);

  const updateAgentCard = useCallback((card: AgentCard) => {
    dispatch({ type: 'UPDATE_AGENT_CARD', payload: card });
  }, []);

  const setGovernanceRequest = useCallback((request: GovernanceApprovalRequest | null) => {
    dispatch({ type: 'SET_GOVERNANCE_REQUEST', payload: request });
  }, []);

  const submitGovernanceDecision = useCallback((decision: GovernanceDecision) => {
    dispatch({ type: 'SET_GOVERNANCE_DECISION', payload: decision });
  }, []);

  const resetWorkflow = useCallback(() => {
    dispatch({ type: 'RESET_WORKFLOW' });
    currentWorkflowIdRef.current = null;
  }, []);

  const setDemoMode = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_DEMO_MODE', payload: enabled });
  }, []);

  // WebSocket action wrappers
  const subscribeToWorkflow = useCallback((workflowId: string) => {
    currentWorkflowIdRef.current = workflowId;
    if (isConnected) {
      wsSubscribe(workflowId);
    }
  }, [isConnected, wsSubscribe]);

  const requestWorkflowState = useCallback((workflowId: string) => {
    if (isConnected) {
      wsRequestState(workflowId);
    }
  }, [isConnected, wsRequestState]);

  const reconnect = useCallback(() => {
    wsReconnect();
  }, [wsReconnect]);

  /**
   * Submit governance decision to backend API
   * Implements Requirements 13.3 - Governance decision submission to backend
   * Task 16.1: Wire governance decision submission to backend
   */
  const submitGovernanceDecisionToBackend = useCallback(async (
    decision: GovernanceDecisionType,
    rationale: string,
    approver: { id: string; role: string },
    restrictions?: string[]
  ): Promise<{ success: boolean; error?: string; workflowTerminated?: boolean }> => {
    const workflowId = currentWorkflowIdRef.current || state.currentWorkflow?.workflowId;
    
    if (!workflowId) {
      const error = 'No active workflow to submit governance decision';
      setGovernanceSubmission(prev => ({ ...prev, error }));
      return { success: false, error };
    }

    // Skip backend submission for demo workflows (created locally in frontend)
    // Demo workflows have IDs starting with "demo-"
    if (workflowId.startsWith('demo-')) {
      console.log('[WorkflowContext] Skipping backend submission for demo workflow:', workflowId);
      setGovernanceSubmission({
        isSubmitting: false,
        error: null,
        lastSubmissionTime: new Date().toISOString()
      });
      return { success: true, workflowTerminated: decision === 'block' };
    }

    // Set submitting state
    setGovernanceSubmission({
      isSubmitting: true,
      error: null,
      lastSubmissionTime: null
    });

    try {
      // Submit to backend API
      const response = await apiClientRef.current.submitGovernanceDecision(
        workflowId,
        decision,
        rationale,
        approver,
        restrictions
      );

      // Update local state with the decision
      if (response.success && response.governanceDecision) {
        dispatch({ type: 'SET_GOVERNANCE_DECISION', payload: response.governanceDecision });
        
        // Add log entry for successful submission
        const logEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: decision === 'block' ? 'warning' : 'info',
          message: `Governance decision submitted: ${decision.toUpperCase()} - ${rationale}`,
          source: 'governance-agent'
        };
        dispatch({ type: 'ADD_LOG', payload: logEntry });
      }

      // Update submission state
      setGovernanceSubmission({
        isSubmitting: false,
        error: null,
        lastSubmissionTime: new Date().toISOString()
      });

      return {
        success: response.success,
        workflowTerminated: response.workflowTerminated
      };
    } catch (error) {
      // Handle API errors
      let errorMessage = 'Failed to submit governance decision';
      
      if (error instanceof ApiError) {
        errorMessage = error.message;
        console.error(`[WorkflowContext] API Error: ${error.code} - ${error.message}`);
      } else if (error instanceof Error) {
        errorMessage = error.message;
        console.error(`[WorkflowContext] Error: ${error.message}`);
      }

      // Add error log entry
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Governance submission failed: ${errorMessage}`,
        source: 'system'
      };
      dispatch({ type: 'ADD_LOG', payload: logEntry });

      // Update submission state with error
      setGovernanceSubmission({
        isSubmitting: false,
        error: errorMessage,
        lastSubmissionTime: null
      });

      return { success: false, error: errorMessage };
    }
  }, [state.currentWorkflow?.workflowId]);

  const value: WorkflowContextType = {
    state,
    dispatch,
    setWorkflow,
    updateWorkflowState,
    setActiveAlert,
    addLog,
    updateAgentCard,
    setGovernanceRequest,
    submitGovernanceDecision,
    resetWorkflow,
    setDemoMode,
    subscribeToWorkflow,
    requestWorkflowState,
    isConnected,
    reconnect,
    // API integration for governance submission (Task 16.1)
    submitGovernanceDecisionToBackend,
    governanceSubmission
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

/**
 * Custom hook to use workflow context
 */
export function useWorkflow(): WorkflowContextType {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}

export { WorkflowContext };
