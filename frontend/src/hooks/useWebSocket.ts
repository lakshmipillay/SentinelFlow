/**
 * useWebSocket Hook
 * 
 * React hook for managing WebSocket connection to SentinelFlow backend.
 * Provides automatic reconnection with exponential backoff, connection status
 * tracking, and real-time state update handling.
 * 
 * Requirements: 13.2 - Real-time communication reliability
 * Implements Property 33: Real-time Communication Reliability
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ConnectionStatus,
  StateUpdate,
  WorkflowState,
  AgentOutput,
  GovernanceApprovalRequest,
  WorkflowInstance
} from '@/types/workflow';

/**
 * WebSocket message types from server
 */
export type ServerMessageType = 
  | 'connection_established'
  | 'workflow_state'
  | 'agent_output'
  | 'governance_required'
  | 'governance_decision'
  | 'workflow_complete'
  | 'demo_event'
  | 'subscription_confirmed'
  | 'pong'
  | 'error';

/**
 * Server message structure
 */
export interface ServerMessage {
  type: ServerMessageType;
  clientId?: string;
  workflowId?: string;
  timestamp: string;
  serverTimestamp?: string;
  payload?: WorkflowState | AgentOutput | GovernanceApprovalRequest | WorkflowInstance | unknown;
  error?: string;
  eventType?: string;
  data?: unknown;
}

/**
 * Client message types to server
 */
export type ClientMessageType = 
  | 'ping'
  | 'subscribe_workflow'
  | 'get_workflow_state'
  | 'get_governance_request';

/**
 * Client message structure
 */
export interface ClientMessage {
  type: ClientMessageType;
  workflowId?: string;
  requestId?: string;
  timestamp?: string;
}

/**
 * State update handler function type
 */
export type StateUpdateHandler = (update: StateUpdate) => void;

/**
 * Message handler registry
 */
export interface MessageHandlers {
  onWorkflowState?: (workflowId: string, state: WorkflowState | WorkflowInstance) => void;
  onAgentOutput?: (workflowId: string, output: AgentOutput) => void;
  onGovernanceRequired?: (workflowId: string, request: GovernanceApprovalRequest) => void;
  onGovernanceDecision?: (workflowId: string, decision: unknown) => void;
  onWorkflowComplete?: (workflowId: string, result: WorkflowInstance) => void;
  onDemoEvent?: (eventType: string, data: unknown) => void;
  onError?: (error: string) => void;
  onConnectionEstablished?: (clientId: string) => void;
}

/**
 * WebSocket configuration options
 */
export interface WebSocketConfig {
  /** WebSocket server URL */
  url: string;
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseReconnectDelay?: number;
  /** Maximum reconnect delay in ms (default: 16000) */
  maxReconnectDelay?: number;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
  /** Heartbeat timeout in ms (default: 5000) */
  heartbeatTimeout?: number;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

/**
 * WebSocket hook state
 */
interface WebSocketState {
  connectionStatus: ConnectionStatus;
  clientId: string | null;
  lastError: string | null;
  reconnectAttempts: number;
  lastMessageTimestamp: string | null;
}

/**
 * WebSocket hook return interface
 */
export interface UseWebSocketReturn {
  // Connection state
  connectionStatus: ConnectionStatus;
  clientId: string | null;
  lastError: string | null;
  reconnectAttempts: number;
  isConnected: boolean;
  isReconnecting: boolean;
  lastMessageTimestamp: string | null;
  
  // Connection actions
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  
  // Messaging actions
  sendMessage: (message: ClientMessage) => boolean;
  subscribeToWorkflow: (workflowId: string) => void;
  requestWorkflowState: (workflowId: string) => void;
  requestGovernanceDetails: (requestId: string) => void;
  
  // Handler registration
  registerHandlers: (handlers: MessageHandlers) => void;
}

/**
 * Get WebSocket URL from environment or derive from API URL
 */
function getDefaultWebSocketUrl(): string {
  // Check for explicit WebSocket URL
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  
  // Derive from API URL if available
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    // Convert http(s) to ws(s)
    return apiUrl.replace(/^http/, 'ws').replace(/\/api$/, '');
  }
  
  // Default to localhost
  return 'ws://localhost:3001';
}

const DEFAULT_CONFIG: Required<WebSocketConfig> = {
  url: getDefaultWebSocketUrl(),
  maxReconnectAttempts: 5,
  baseReconnectDelay: 1000,
  maxReconnectDelay: 16000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 5000,
  autoConnect: true
};

/**
 * Calculate exponential backoff delay
 * Implements exponential backoff: 1s, 2s, 4s, 8s, 16s
 * 
 * @param attempt - Current reconnection attempt (0-indexed)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay cap in milliseconds (default: 16000)
 * @returns Calculated delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  const delay = baseDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * useWebSocket Hook
 * 
 * Manages WebSocket connection lifecycle with automatic reconnection,
 * heartbeat monitoring, and message handling.
 * 
 * @param config - WebSocket configuration options
 * @returns Hook state and actions
 */
export function useWebSocket(
  config: Partial<WebSocketConfig> = {}
): UseWebSocketReturn {
  const mergedConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  );

  // State
  const [state, setState] = useState<WebSocketState>({
    connectionStatus: 'disconnected',
    clientId: null,
    lastError: null,
    reconnectAttempts: 0,
    lastMessageTimestamp: null
  });

  // Refs for WebSocket and intervals
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handlersRef = useRef<MessageHandlers>({});
  const isManualDisconnectRef = useRef(false);
  const mountedRef = useRef(true);
  // Ref to hold the connect function to avoid circular dependency
  const connectRef = useRef<() => void>(() => {});

  /**
   * Clear all timers
   */
  const clearTimers = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Start heartbeat monitoring
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Send ping
        const pingMessage: ClientMessage = {
          type: 'ping',
          timestamp: new Date().toISOString()
        };
        wsRef.current.send(JSON.stringify(pingMessage));

        // Set timeout for pong response
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn('[WebSocket] Heartbeat timeout - connection may be stale');
          // Connection might be stale, trigger reconnect
          if (wsRef.current) {
            wsRef.current.close(4000, 'Heartbeat timeout');
          }
        }, mergedConfig.heartbeatTimeout);
      }
    }, mergedConfig.heartbeatInterval);
  }, [mergedConfig.heartbeatInterval, mergedConfig.heartbeatTimeout]);

  /**
   * Handle incoming messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: ServerMessage = JSON.parse(event.data);
      
      if (!mountedRef.current) return;

      // Update last message timestamp
      setState(prev => ({
        ...prev,
        lastMessageTimestamp: message.timestamp || new Date().toISOString()
      }));

      // Clear heartbeat timeout on any message (including pong)
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }

      // Handle message by type
      switch (message.type) {
        case 'connection_established':
          setState(prev => ({
            ...prev,
            clientId: message.clientId || null,
            connectionStatus: 'connected',
            reconnectAttempts: 0,
            lastError: null
          }));
          handlersRef.current.onConnectionEstablished?.(message.clientId || '');
          break;

        case 'workflow_state':
          if (message.workflowId && message.payload) {
            handlersRef.current.onWorkflowState?.(
              message.workflowId,
              message.payload as WorkflowState | WorkflowInstance
            );
          }
          break;

        case 'agent_output':
          if (message.workflowId && message.payload) {
            handlersRef.current.onAgentOutput?.(
              message.workflowId,
              message.payload as AgentOutput
            );
          }
          break;

        case 'governance_required':
          if (message.workflowId && message.payload) {
            handlersRef.current.onGovernanceRequired?.(
              message.workflowId,
              message.payload as GovernanceApprovalRequest
            );
          }
          break;

        case 'governance_decision':
          if (message.workflowId && message.payload) {
            handlersRef.current.onGovernanceDecision?.(
              message.workflowId,
              message.payload
            );
          }
          break;

        case 'workflow_complete':
          if (message.workflowId && message.payload) {
            handlersRef.current.onWorkflowComplete?.(
              message.workflowId,
              message.payload as WorkflowInstance
            );
          }
          break;

        case 'demo_event':
          if (message.eventType && message.data) {
            handlersRef.current.onDemoEvent?.(message.eventType, message.data);
          }
          break;

        case 'pong':
          // Heartbeat response - already cleared timeout above
          break;

        case 'subscription_confirmed':
          console.log(`[WebSocket] Subscribed to workflow: ${message.workflowId}`);
          break;

        case 'error':
          console.error('[WebSocket] Server error:', message.error);
          setState(prev => ({ ...prev, lastError: message.error || 'Unknown error' }));
          handlersRef.current.onError?.(message.error || 'Unknown error');
          break;

        default:
          console.warn('[WebSocket] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse message';
      setState(prev => ({ ...prev, lastError: errorMessage }));
      handlersRef.current.onError?.(errorMessage);
    }
  }, []);

  /**
   * Attempt reconnection with exponential backoff
   */
  const attemptReconnect = useCallback(() => {
    if (!mountedRef.current || isManualDisconnectRef.current) return;

    setState(prev => {
      const newAttempts = prev.reconnectAttempts + 1;
      
      if (newAttempts > mergedConfig.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
        return {
          ...prev,
          connectionStatus: 'disconnected',
          lastError: `Failed to reconnect after ${mergedConfig.maxReconnectAttempts} attempts`
        };
      }

      const delay = calculateBackoffDelay(
        prev.reconnectAttempts,
        mergedConfig.baseReconnectDelay,
        mergedConfig.maxReconnectDelay
      );

      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${newAttempts}/${mergedConfig.maxReconnectAttempts})`);

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && !isManualDisconnectRef.current) {
          // Use ref to call connect to avoid circular dependency
          connectRef.current();
        }
      }, delay);

      return {
        ...prev,
        connectionStatus: 'reconnecting',
        reconnectAttempts: newAttempts
      };
    });
  }, [mergedConfig.maxReconnectAttempts, mergedConfig.baseReconnectDelay, mergedConfig.maxReconnectDelay]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    clearTimers();
    isManualDisconnectRef.current = false;

    try {
      console.log(`[WebSocket] Connecting to ${mergedConfig.url}`);
      
      const ws = new WebSocket(mergedConfig.url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        console.log('[WebSocket] Connection established');
        setState(prev => ({
          ...prev,
          connectionStatus: 'connected',
          lastError: null
        }));
        startHeartbeat();
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        
        console.log(`[WebSocket] Connection closed: ${event.code} - ${event.reason}`);
        clearTimers();

        if (!isManualDisconnectRef.current && event.code !== 1000) {
          // Abnormal closure - attempt reconnect
          attemptReconnect();
        } else {
          setState(prev => ({
            ...prev,
            connectionStatus: 'disconnected',
            clientId: null
          }));
        }
      };

      ws.onerror = (error) => {
        if (!mountedRef.current) return;
        console.error('[WebSocket] Connection error:', error);
        setState(prev => ({
          ...prev,
          lastError: 'WebSocket connection error'
        }));
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      setState(prev => ({
        ...prev,
        connectionStatus: 'disconnected',
        lastError: errorMessage
      }));
    }
  }, [mergedConfig.url, clearTimers, startHeartbeat, handleMessage, attemptReconnect]);

  // Update connectRef whenever connect changes
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setState(prev => ({
      ...prev,
      connectionStatus: 'disconnected',
      clientId: null,
      reconnectAttempts: 0
    }));
  }, [clearTimers]);

  /**
   * Force reconnection
   */
  const reconnect = useCallback(() => {
    disconnect();
    isManualDisconnectRef.current = false;
    setState(prev => ({ ...prev, reconnectAttempts: 0 }));
    
    // Small delay before reconnecting
    setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, 100);
  }, [disconnect, connect]);

  /**
   * Send message to server
   */
  const sendMessage = useCallback((message: ClientMessage): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send message - not connected');
      return false;
    }

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      };
      wsRef.current.send(JSON.stringify(messageWithTimestamp));
      return true;
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error);
      return false;
    }
  }, []);

  /**
   * Subscribe to workflow updates
   */
  const subscribeToWorkflow = useCallback((workflowId: string) => {
    sendMessage({
      type: 'subscribe_workflow',
      workflowId
    });
  }, [sendMessage]);

  /**
   * Request current workflow state
   */
  const requestWorkflowState = useCallback((workflowId: string) => {
    sendMessage({
      type: 'get_workflow_state',
      workflowId
    });
  }, [sendMessage]);

  /**
   * Request governance request details
   */
  const requestGovernanceDetails = useCallback((requestId: string) => {
    sendMessage({
      type: 'get_governance_request',
      requestId
    });
  }, [sendMessage]);

  /**
   * Register message handlers
   */
  const registerHandlers = useCallback((handlers: MessageHandlers) => {
    handlersRef.current = { ...handlersRef.current, ...handlers };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;

    if (mergedConfig.autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      clearTimers();
      
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
        wsRef.current = null;
      }
    };
  }, [mergedConfig.autoConnect, connect, clearTimers]);

  // Computed values
  const isConnected = state.connectionStatus === 'connected';
  const isReconnecting = state.connectionStatus === 'reconnecting';

  return {
    // Connection state
    connectionStatus: state.connectionStatus,
    clientId: state.clientId,
    lastError: state.lastError,
    reconnectAttempts: state.reconnectAttempts,
    isConnected,
    isReconnecting,
    lastMessageTimestamp: state.lastMessageTimestamp,
    
    // Connection actions
    connect,
    disconnect,
    reconnect,
    
    // Messaging actions
    sendMessage,
    subscribeToWorkflow,
    requestWorkflowState,
    requestGovernanceDetails,
    
    // Handler registration
    registerHandlers
  };
}

export default useWebSocket;
