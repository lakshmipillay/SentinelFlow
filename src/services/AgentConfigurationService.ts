/**
 * SentinelFlow Agent Configuration Service
 * 
 * Loads and manages agent configurations from .kiro/agents/ YAML files.
 * This bridges the gap between declarative agent definitions and runtime behavior.
 * 
 * ARCHITECTURAL PRINCIPLE:
 * Agent configurations define capabilities and constraints that are enforced at runtime.
 * This ensures the system behavior matches the documented agent specifications.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// ============================================================================
// TYPES (inline to avoid circular dependencies)
// ============================================================================

export type AgentCapability = 
  | 'workflow_sequencing' | 'parallel_agent_invocation' | 'decision_synthesis' | 'audit_generation'
  | 'reliability_analysis' | 'failure_mode_identification' | 'signal_correlation'
  | 'security_signal_analysis' | 'risk_identification' | 'anomaly_detection'
  | 'policy_evaluation' | 'compliance_analysis' | 'blast_radius_assessment' | 'risk_classification';

export type AgentConstraint =
  | 'analysis_only' | 'no_domain_analysis' | 'no_workflow_control' | 'no_remediation_proposal'
  | 'no_remediation_execution' | 'no_policy_override' | 'no_execution' | 'no_external_side_effects';

export interface AgentAuthority {
  can_spawn_agents?: boolean;
  can_decide_flow?: boolean;
  can_execute?: boolean;
  can_bypass_governance?: boolean;
  can_veto?: boolean;
  can_approve?: boolean;
}

export interface AgentConfiguration {
  name: string;
  role: string;
  description: string;
  capabilities: AgentCapability[];
  constraints: AgentConstraint[];
  authority?: AgentAuthority;
  governance?: { mandatory_for_remediation?: boolean; bypass_allowed?: boolean };
  inputs?: string[];
  outputs?: { format: string; schema: Record<string, string> } | string[];
}

export interface AgentRuntimeState {
  agentName: string;
  configuration: AgentConfiguration;
  status: 'idle' | 'active' | 'complete' | 'error';
  currentTask?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ============================================================================
// AGENT CONFIGURATION SERVICE
// ============================================================================

/**
 * AgentConfigurationService - Loads and enforces agent configurations
 * 
 * This service:
 * 1. Loads agent YAML definitions from .kiro/agents/
 * 2. Validates agent actions against their declared constraints
 * 3. Provides runtime access to agent capabilities and authority
 * 4. Emits events for agent state changes
 */
export class AgentConfigurationService extends EventEmitter {
  private configurations: Map<string, AgentConfiguration> = new Map();
  private runtimeStates: Map<string, AgentRuntimeState> = new Map();
  private configPath: string;
  private loaded: boolean = false;

  constructor(configPath: string = '.kiro/agents') {
    super();
    this.configPath = configPath;
  }

  /**
   * Load all agent configurations from YAML files
   */
  async loadConfigurations(): Promise<void> {
    const agentFiles = [
      'orchestrator-agent.yaml',
      'sre-agent.yaml',
      'security-agent.yaml',
      'governance-agent.yaml'
    ];

    for (const file of agentFiles) {
      try {
        const config = await this.loadAgentConfig(file);
        this.configurations.set(config.name, config);
        
        // Initialize runtime state
        this.runtimeStates.set(config.name, {
          agentName: config.name,
          configuration: config,
          status: 'idle'
        });
      } catch (error) {
        console.warn(`Failed to load agent config ${file}:`, error);
        // Use default configuration if file not found
        const defaultConfig = this.getDefaultConfiguration(file);
        if (defaultConfig) {
          this.configurations.set(defaultConfig.name, defaultConfig);
          this.runtimeStates.set(defaultConfig.name, {
            agentName: defaultConfig.name,
            configuration: defaultConfig,
            status: 'idle'
          });
        }
      }
    }

    this.loaded = true;
    this.emit('configurationsLoaded', Array.from(this.configurations.values()));
  }

  /**
   * Load a single agent configuration from YAML
   */
  private async loadAgentConfig(filename: string): Promise<AgentConfiguration> {
    const filePath = path.join(process.cwd(), this.configPath, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Agent configuration file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseYamlConfig(content);
  }

  /**
   * Simple YAML parser for agent configurations
   * (Avoids adding yaml dependency for simple structure)
   */
  private parseYamlConfig(content: string): AgentConfiguration {
    const lines = content.split('\n');
    const config: Partial<AgentConfiguration> = {
      capabilities: [],
      constraints: []
    };

    let currentKey = '';
    let currentList: string[] = [];
    let inAuthority = false;
    let authority: AgentAuthority = {};

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Handle list items
      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim();
        if (currentKey === 'capabilities') {
          config.capabilities!.push(value as AgentCapability);
        } else if (currentKey === 'constraints') {
          config.constraints!.push(value as AgentConstraint);
        } else if (currentKey === 'inputs') {
          if (!config.inputs) config.inputs = [];
          config.inputs.push(value);
        } else if (currentKey === 'outputs' && Array.isArray(config.outputs)) {
          config.outputs.push(value);
        }
        continue;
      }

      // Handle key-value pairs
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        // Handle authority section
        if (key === 'authority') {
          inAuthority = true;
          currentKey = 'authority';
          continue;
        }

        if (inAuthority && line.startsWith('  ')) {
          // Parse authority properties
          if (value === 'true') {
            (authority as any)[key] = true;
          } else if (value === 'false') {
            (authority as any)[key] = false;
          }
          continue;
        } else if (inAuthority && !line.startsWith('  ')) {
          // End of authority section
          inAuthority = false;
          config.authority = authority;
        }

        // Handle top-level keys
        if (key === 'name') config.name = value;
        else if (key === 'role') config.role = value;
        else if (key === 'description') config.description = value.replace(/^>?\s*/, '');
        else if (key === 'capabilities') currentKey = 'capabilities';
        else if (key === 'constraints') currentKey = 'constraints';
        else if (key === 'inputs') currentKey = 'inputs';
        else if (key === 'outputs') {
          currentKey = 'outputs';
          config.outputs = [];
        }
      }
    }

    // Finalize authority if still in section
    if (inAuthority && Object.keys(authority).length > 0) {
      config.authority = authority;
    }

    return config as AgentConfiguration;
  }

  /**
   * Get default configuration for an agent if YAML not found
   */
  private getDefaultConfiguration(filename: string): AgentConfiguration | null {
    const defaults: Record<string, AgentConfiguration> = {
      'orchestrator-agent.yaml': {
        name: 'orchestrator-agent',
        role: 'Workflow orchestration and control',
        description: 'Owns end-to-end workflow sequencing. Coordinates specialist agents, enforces governance gates, and terminates unsafe workflows.',
        capabilities: ['workflow_sequencing', 'parallel_agent_invocation', 'decision_synthesis', 'audit_generation'],
        constraints: ['no_domain_analysis', 'no_remediation_execution', 'no_policy_override', 'no_external_side_effects'],
        authority: { can_spawn_agents: true, can_decide_flow: true, can_execute: false, can_bypass_governance: false }
      },
      'sre-agent.yaml': {
        name: 'sre-agent',
        role: 'Reliability and operational analysis',
        description: 'Analyzes availability, latency, error rates, and operational failure modes.',
        capabilities: ['reliability_analysis', 'failure_mode_identification', 'signal_correlation'],
        constraints: ['analysis_only', 'no_workflow_control', 'no_remediation_proposal', 'no_execution']
      },
      'security-agent.yaml': {
        name: 'security-agent',
        role: 'Security and risk analysis',
        description: 'Analyzes authentication signals, access patterns, anomaly indicators, and security impact.',
        capabilities: ['security_signal_analysis', 'risk_identification', 'anomaly_detection'],
        constraints: ['analysis_only', 'no_workflow_control', 'no_remediation_proposal', 'no_execution']
      },
      'governance-agent.yaml': {
        name: 'governance-agent',
        role: 'Governance and policy analysis',
        description: 'Evaluates policy compliance, blast radius, security impact, and reversibility of proposed actions.',
        capabilities: ['policy_evaluation', 'compliance_analysis', 'blast_radius_assessment', 'risk_classification'],
        constraints: ['analysis_only', 'no_workflow_control', 'no_remediation_proposal', 'no_execution', 'no_external_side_effects'],
        authority: { can_veto: true, can_approve: true, can_execute: false },
        governance: { mandatory_for_remediation: true, bypass_allowed: false }
      }
    };

    return defaults[filename] || null;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get configuration for a specific agent
   */
  getConfiguration(agentName: string): AgentConfiguration | undefined {
    return this.configurations.get(agentName);
  }

  /**
   * Get all loaded configurations
   */
  getAllConfigurations(): AgentConfiguration[] {
    return Array.from(this.configurations.values());
  }

  /**
   * Get runtime state for an agent
   */
  getRuntimeState(agentName: string): AgentRuntimeState | undefined {
    return this.runtimeStates.get(agentName);
  }

  /**
   * Check if an agent has a specific capability
   */
  hasCapability(agentName: string, capability: AgentCapability): boolean {
    const config = this.configurations.get(agentName);
    return config?.capabilities.includes(capability) ?? false;
  }

  /**
   * Check if an agent has a specific constraint
   */
  hasConstraint(agentName: string, constraint: AgentConstraint): boolean {
    const config = this.configurations.get(agentName);
    return config?.constraints.includes(constraint) ?? false;
  }

  /**
   * Validate an action against agent constraints
   * Returns true if action is allowed, false if blocked by constraints
   */
  validateAction(agentName: string, action: string): { allowed: boolean; reason?: string } {
    const config = this.configurations.get(agentName);
    if (!config) {
      return { allowed: false, reason: `Agent ${agentName} not found` };
    }

    // Check constraints
    if (action === 'execute' && config.constraints.includes('no_execution')) {
      return { allowed: false, reason: `Agent ${agentName} has no_execution constraint` };
    }
    if (action === 'remediate' && config.constraints.includes('no_remediation_execution')) {
      return { allowed: false, reason: `Agent ${agentName} has no_remediation_execution constraint` };
    }
    if (action === 'control_workflow' && config.constraints.includes('no_workflow_control')) {
      return { allowed: false, reason: `Agent ${agentName} has no_workflow_control constraint` };
    }
    if (action === 'bypass_governance' && config.authority?.can_bypass_governance === false) {
      return { allowed: false, reason: `Agent ${agentName} cannot bypass governance` };
    }

    return { allowed: true };
  }

  /**
   * Start an agent task - updates runtime state
   */
  startAgentTask(agentName: string, task: string): void {
    const state = this.runtimeStates.get(agentName);
    if (state) {
      state.status = 'active';
      state.currentTask = task;
      state.startedAt = new Date().toISOString();
      this.emit('agentStarted', { agentName, task });
    }
  }

  /**
   * Complete an agent task - updates runtime state
   */
  completeAgentTask(agentName: string): void {
    const state = this.runtimeStates.get(agentName);
    if (state) {
      state.status = 'complete';
      state.completedAt = new Date().toISOString();
      this.emit('agentCompleted', { agentName, task: state.currentTask });
    }
  }

  /**
   * Mark agent as errored
   */
  setAgentError(agentName: string, error: string): void {
    const state = this.runtimeStates.get(agentName);
    if (state) {
      state.status = 'error';
      state.error = error;
      this.emit('agentError', { agentName, error });
    }
  }

  /**
   * Reset all agents to idle state
   */
  resetAllAgents(): void {
    for (const state of this.runtimeStates.values()) {
      state.status = 'idle';
      state.currentTask = undefined;
      state.startedAt = undefined;
      state.completedAt = undefined;
      state.error = undefined;
    }
    this.emit('agentsReset');
  }

  /**
   * Get orchestrator state summary
   */
  getOrchestratorState(): {
    activeAgents: AgentRuntimeState[];
    idleAgents: AgentRuntimeState[];
    completedAgents: AgentRuntimeState[];
    erroredAgents: AgentRuntimeState[];
  } {
    const states = Array.from(this.runtimeStates.values());
    return {
      activeAgents: states.filter(s => s.status === 'active'),
      idleAgents: states.filter(s => s.status === 'idle'),
      completedAgents: states.filter(s => s.status === 'complete'),
      erroredAgents: states.filter(s => s.status === 'error')
    };
  }

  /**
   * Check if configurations are loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: AgentConfigurationService | null = null;

/**
 * Get the singleton AgentConfigurationService instance
 */
export function getAgentConfigurationService(): AgentConfigurationService {
  if (!instance) {
    instance = new AgentConfigurationService();
  }
  return instance;
}

/**
 * Initialize the agent configuration service
 * Call this at application startup
 */
export async function initializeAgentConfigurations(): Promise<AgentConfigurationService> {
  const service = getAgentConfigurationService();
  if (!service.isLoaded()) {
    await service.loadConfigurations();
  }
  return service;
}
