/**
 * SentinelFlow Custom Hooks - Central Export
 * 
 * Custom React hooks for Mission Control functionality.
 */

// Re-export the workflow context hook
export { useWorkflow } from '@/context/WorkflowContext';

// Human decision validation and capture hook
export { 
  useHumanDecision,
  validateDecisionInput,
  createGovernanceDecision
} from './useHumanDecision';
export type { 
  DecisionMaker,
  ValidationResult,
  DecisionInput,
  SubmissionResult,
  ValidationConfig
} from './useHumanDecision';

// WebSocket connection management hook
export { 
  useWebSocket,
  calculateBackoffDelay
} from './useWebSocket';
export type {
  ServerMessageType,
  ServerMessage,
  ClientMessageType,
  ClientMessage,
  StateUpdateHandler,
  MessageHandlers,
  WebSocketConfig,
  UseWebSocketReturn
} from './useWebSocket';

/**
 * Re-export workflow synchronization utilities
 * These are used internally by WorkflowContext for state distribution
 */
export type {
  WorkflowState,
  WorkflowInstance,
  AgentOutput,
  GovernanceDecision,
  ActiveAlert,
  LogEntry,
  AgentCard,
  GovernanceApprovalRequest
} from '@/types/workflow';
