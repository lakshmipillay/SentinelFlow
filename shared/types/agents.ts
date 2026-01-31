/**
 * SentinelFlow Agent Configuration Types
 * 
 * These types define the structure of agent YAML configurations
 * and enable runtime loading of agent definitions from .kiro/agents/
 */

import { AgentType } from './workflow';

// ============================================================================
// AGENT CONFIGURATION TYPES
// ============================================================================

/** Agent capability types */
export type AgentCapability = 
  // Orchestrator capabilities
  | 'workflow_sequencing'
  | 'parallel_agent_invocation'
  | 'decision_synthesis'
  | 'audit_generation'
  // SRE capabilities
  | 'reliability_analysis'
  | 'failure_mode_identification'
  | 'signal_correlation'
  // Security capabilities
  | 'security_signal_analysis'
  | 'risk_identification'
  | 'anomaly_detection'
  // Governance capabilities
  | 'policy_evaluation'
  | 'compliance_analysis'
  | 'blast_radius_assessment'
  | 'risk_classification';

/** Agent constraint types */
export type AgentConstraint =
  | 'analysis_only'
  | 'no_domain_analysis'
  | 'no_workflow_control'
  | 'no_remediation_proposal'
  | 'no_remediation_execution'
  | 'no_policy_override'
  | 'no_execution'
  | 'no_external_side_effects';

/** Agent authority configuration */
export interface AgentAuthority {
  can_spawn_agents?: boolean;
  can_decide_flow?: boolean;
  can_execute?: boolean;
  can_bypass_governance?: boolean;
  can_veto?: boolean;
  can_approve?: boolean;
}

/** Agent governance configuration */
export interface AgentGovernance {
  mandatory_for_remediation?: boolean;
  bypass_allowed?: boolean;
}

/** Agent output schema configuration */
export interface AgentOutputSchema {
  format: 'json' | 'yaml';
  schema: {
    findings?: string;
    confidence?: string;
    decision?: string;
    rationale?: string;
    restrictions?: string;
    risk_assessment?: string;
  };
}

/**
 * Complete agent configuration loaded from YAML
 * Matches the structure in .kiro/agents/*.yaml
 */
export interface AgentConfiguration {
  name: string;
  role: string;
  description: string;
  capabilities: AgentCapability[];
  constraints: AgentConstraint[];
  authority?: AgentAuthority;
  governance?: AgentGovernance;
  inputs?: string[];
  outputs?: AgentOutputSchema | string[];
}

/**
 * Runtime agent registry - loaded from .kiro/agents/
 */
export interface AgentRegistry {
  orchestrator: AgentConfiguration;
  'sre-agent': AgentConfiguration;
  'security-agent': AgentConfiguration;
  'governance-agent': AgentConfiguration;
}

// ============================================================================
// AGENT RUNTIME STATE
// ============================================================================

/** Agent runtime state during workflow execution */
export interface AgentRuntimeState {
  agentName: AgentType | 'orchestrator';
  configuration: AgentConfiguration;
  status: 'idle' | 'active' | 'complete' | 'error';
  currentTask?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/** Orchestrator coordination state */
export interface OrchestratorState {
  activeAgents: AgentRuntimeState[];
  pendingTasks: string[];
  completedTasks: string[];
  governanceGateActive: boolean;
}
