/**
 * SentinelFlow Orchestrator Service
 * Implements orchestrator agent coordination while maintaining strict role separation
 * 
 * ARCHITECTURAL CONSTRAINTS:
 * - Orchestrator coordinates but NEVER performs domain analysis
 * - Maintains separation between orchestration, analysis, and approval
 * - Enforces governance gates and workflow sequencing
 * - Produces audit artifacts as first-class outputs
 * - Agent configurations loaded from .kiro/agents/ YAML files
 */

import { WorkflowStateManager } from '../core/WorkflowStateManager';
import { WorkflowState, AgentOutput } from '../types/workflow';
import { AgentName } from '../types/agent-skills';
import { AgentOutputFactory } from './AgentOutputFactory';
import { GovernanceGateService, GovernanceRequest } from './GovernanceGateService';
import { 
  AgentConfigurationService, 
  getAgentConfigurationService,
  AgentConfiguration 
} from './AgentConfigurationService';

export interface IncidentContext {
  incidentId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: string[];
  timestamp: string;
  source: string;
  alertData?: Record<string, any>;
}

export interface AgentCoordinationTask {
  agentName: AgentName;
  taskId: string;
  context: IncidentContext & { focus: string };
  expectedSkills: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
}

export interface ParallelAnalysisSession {
  sessionId: string;
  workflowId: string;
  incidentContext: IncidentContext;
  agentTasks: AgentCoordinationTask[];
  startedAt: string;
  status: 'initiated' | 'in-progress' | 'completed' | 'failed';
  completedAt?: string;
}

/**
 * Orchestrator Service - Coordinates specialist agents without domain analysis
 * Implements Requirements 2.1, 2.2, 3.4 - Agent coordination and role separation
 * 
 * Agent configurations are loaded from .kiro/agents/ YAML files at runtime,
 * ensuring the system behavior matches the documented agent specifications.
 */
export class OrchestratorService {
  private stateManager: WorkflowStateManager;
  private governanceGate: GovernanceGateService;
  private agentConfigService: AgentConfigurationService;
  private activeSessions: Map<string, ParallelAnalysisSession> = new Map();

  constructor(stateManager: WorkflowStateManager, governanceGate?: GovernanceGateService) {
    this.stateManager = stateManager;
    this.governanceGate = governanceGate || new GovernanceGateService(stateManager);
    this.agentConfigService = getAgentConfigurationService();
  }

  /**
   * Initialize the orchestrator with agent configurations
   * Loads agent definitions from .kiro/agents/ YAML files
   */
  async initialize(): Promise<void> {
    if (!this.agentConfigService.isLoaded()) {
      await this.agentConfigService.loadConfigurations();
    }
    
    // Validate orchestrator configuration
    const orchestratorConfig = this.agentConfigService.getConfiguration('orchestrator-agent');
    if (orchestratorConfig) {
      console.log(`[Orchestrator] Loaded configuration: ${orchestratorConfig.role}`);
      console.log(`[Orchestrator] Capabilities: ${orchestratorConfig.capabilities.join(', ')}`);
      console.log(`[Orchestrator] Constraints: ${orchestratorConfig.constraints.join(', ')}`);
    }
  }

  /**
   * Get loaded agent configurations
   */
  getAgentConfigurations(): AgentConfiguration[] {
    return this.agentConfigService.getAllConfigurations();
  }

  /**
   * Validate an action against orchestrator constraints
   */
  validateOrchestratorAction(action: string): { allowed: boolean; reason?: string } {
    return this.agentConfigService.validateAction('orchestrator-agent', action);
  }

  /**
   * Coordinate parallel agent analysis (orchestration only, no domain analysis)
   * Implements Requirements 2.1, 2.2 - Orchestrator coordination and parallel execution
   */
  async coordinateParallelAnalysis(
    workflowId: string, 
    incidentContext: IncidentContext
  ): Promise<ParallelAnalysisSession> {
    // Validate workflow state
    const workflow = this.stateManager.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.currentState !== WorkflowState.ANALYZING) {
      throw new Error(
        `Cannot coordinate analysis - workflow is in ${workflow.currentState} state, expected ANALYZING`
      );
    }

    // Create coordination session (orchestrator role: structure, not analyze)
    const sessionId = `session-${workflowId}-${Date.now()}`;
    const agentTasks = this.createAgentCoordinationTasks(incidentContext);

    const session: ParallelAnalysisSession = {
      sessionId,
      workflowId,
      incidentContext,
      agentTasks,
      startedAt: new Date().toISOString(),
      status: 'initiated'
    };

    this.activeSessions.set(sessionId, session);

    // Initiate parallel analysis through state manager
    await this.stateManager.initiateParallelAnalysis(workflowId, incidentContext);

    // Update session status
    session.status = 'in-progress';
    this.activeSessions.set(sessionId, session);

    return session;
  }

  /**
   * Create agent coordination tasks using loaded agent configurations
   * Maintains role separation - orchestrator defines WHAT to analyze, not HOW
   * Agent capabilities and constraints are loaded from .kiro/agents/ YAML files
   */
  private createAgentCoordinationTasks(incidentContext: IncidentContext): AgentCoordinationTask[] {
    const now = new Date().toISOString();
    const tasks: AgentCoordinationTask[] = [];

    // Get agent configurations from loaded YAML files
    const sreConfig = this.agentConfigService.getConfiguration('sre-agent');
    const securityConfig = this.agentConfigService.getConfiguration('security-agent');
    const governanceConfig = this.agentConfigService.getConfiguration('governance-agent');

    // Create SRE agent task using loaded configuration
    if (sreConfig) {
      this.agentConfigService.startAgentTask('sre-agent', 'operational-reliability-analysis');
      tasks.push({
        agentName: 'sre-agent',
        taskId: `sre-task-${Date.now()}`,
        context: {
          ...incidentContext,
          focus: 'operational-reliability-analysis'
        },
        expectedSkills: ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry'],
        status: 'pending'
      });
    }

    // Create Security agent task using loaded configuration
    if (securityConfig) {
      this.agentConfigService.startAgentTask('security-agent', 'security-risk-analysis');
      tasks.push({
        agentName: 'security-agent',
        taskId: `security-task-${Date.now()}`,
        context: {
          ...incidentContext,
          focus: 'security-risk-analysis'
        },
        expectedSkills: ['Splunk SIEM', 'IAM Logs', 'CSPM'],
        status: 'pending'
      });
    }

    // Create Governance agent task using loaded configuration
    if (governanceConfig) {
      this.agentConfigService.startAgentTask('governance-agent', 'policy-compliance-analysis');
      tasks.push({
        agentName: 'governance-agent',
        taskId: `governance-task-${Date.now()}`,
        context: {
          ...incidentContext,
          focus: 'policy-compliance-analysis'
        },
        expectedSkills: ['Policy Engine', 'Change Management', 'Risk Register'],
        status: 'pending'
      });
    }

    return tasks;
  }

  /**
   * Process agent output completion (orchestrator coordination only)
   * Updates coordination state and agent runtime state without interpreting domain findings
   */
  async processAgentOutputCompletion(
    workflowId: string,
    agentOutput: AgentOutput
  ): Promise<{
    sessionUpdated: boolean;
    allAgentsComplete: boolean;
    readyForCorrelation: boolean;
  }> {
    // Find active session for this workflow
    const session = Array.from(this.activeSessions.values())
      .find(s => s.workflowId === workflowId && s.status === 'in-progress');

    if (!session) {
      return {
        sessionUpdated: false,
        allAgentsComplete: false,
        readyForCorrelation: false
      };
    }

    // Update task status (orchestrator role: track completion, not interpret results)
    const agentTask = session.agentTasks.find(task => task.agentName === agentOutput.agentName);
    if (agentTask) {
      agentTask.status = 'completed';
      agentTask.completedAt = new Date().toISOString();
      
      // Update agent runtime state from configuration service
      this.agentConfigService.completeAgentTask(agentOutput.agentName);
    }

    // Check if all agents have completed
    const allAgentsComplete = session.agentTasks.every(task => task.status === 'completed');
    
    if (allAgentsComplete) {
      session.status = 'completed';
      session.completedAt = new Date().toISOString();
    }

    this.activeSessions.set(session.sessionId, session);

    // Check if ready for correlation (orchestrator role: coordinate, not correlate)
    const analysisStatus = this.stateManager.isParallelAnalysisComplete(workflowId);

    return {
      sessionUpdated: true,
      allAgentsComplete,
      readyForCorrelation: analysisStatus.readyForRCA
    };
  }

  /**
   * Coordinate transition to RCA phase (orchestrator role: sequence, not analyze)
   * Validates all agents completed and correlation is ready
   */
  async coordinateRCATransition(workflowId: string): Promise<{
    canTransition: boolean;
    correlation: any;
    blockers: string[];
  }> {
    const workflow = this.stateManager.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const blockers: string[] = [];

    // Orchestrator validation: Check structural requirements, not domain content
    if (workflow.currentState !== WorkflowState.ANALYZING) {
      blockers.push(`Workflow not in ANALYZING state (current: ${workflow.currentState})`);
    }

    const analysisStatus = this.stateManager.isParallelAnalysisComplete(workflowId);
    if (!analysisStatus.complete) {
      blockers.push('Not all required agents have completed analysis');
    }

    if (!analysisStatus.readyForRCA) {
      blockers.push('Agent outputs failed validation or correlation requirements');
    }

    // Get correlation data (orchestrator role: retrieve, not interpret)
    const correlation = analysisStatus.correlation;

    return {
      canTransition: blockers.length === 0,
      correlation,
      blockers
    };
  }

  /**
   * Simulate parallel agent execution for demo purposes
   * Maintains role separation - orchestrator coordinates timing, not content
   */
  async simulateParallelAgentExecution(
    workflowId: string,
    scenario: 'database-issue' | 'security-breach' | 'policy-violation' = 'database-issue'
  ): Promise<{
    sessionId: string;
    simulatedOutputs: AgentOutput[];
    completionOrder: string[];
  }> {
    // Create mock incident context for simulation
    const incidentContext: IncidentContext = {
      incidentId: `incident-${Date.now()}`,
      description: this.getScenarioDescription(scenario),
      severity: this.getScenarioSeverity(scenario),
      affectedServices: this.getScenarioServices(scenario),
      timestamp: new Date().toISOString(),
      source: 'demo-simulation'
    };

    // Coordinate parallel analysis
    const session = await this.coordinateParallelAnalysis(workflowId, incidentContext);

    // Simulate realistic agent execution timing (orchestrator role: coordinate timing)
    const simulatedOutputs: AgentOutput[] = [];
    const completionOrder: string[] = [];

    // Simulate agents completing at different times (realistic parallel execution)
    const agentDelays = [
      { agent: 'sre-agent', delay: 1000 },      // SRE completes first (1s)
      { agent: 'governance-agent', delay: 2000 }, // Governance second (2s)  
      { agent: 'security-agent', delay: 3000 }   // Security last (3s)
    ];

    for (const { agent, delay } of agentDelays) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Generate mock output (using factory, not orchestrator analysis)
      const outputResult = AgentOutputFactory.createMockAgentOutput(agent as AgentName, scenario);
      if (outputResult.success && outputResult.agentOutput) {
        // Add to workflow through state manager
        await this.stateManager.addAgentOutput(workflowId, outputResult.agentOutput);
        
        // Update coordination session
        await this.processAgentOutputCompletion(workflowId, outputResult.agentOutput);
        
        simulatedOutputs.push(outputResult.agentOutput);
        completionOrder.push(agent);
      }
    }

    return {
      sessionId: session.sessionId,
      simulatedOutputs,
      completionOrder
    };
  }

  /**
   * Get active coordination sessions
   */
  getActiveSessions(): ParallelAnalysisSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ParallelAnalysisSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get session by workflow ID
   */
  getSessionByWorkflow(workflowId: string): ParallelAnalysisSession | undefined {
    return Array.from(this.activeSessions.values())
      .find(session => session.workflowId === workflowId);
  }

  /**
   * Coordinate transition to governance gate (orchestrator role: initiate governance process)
   * Creates governance request when workflow reaches GOVERNANCE_PENDING state
   */
  async coordinateGovernanceGate(workflowId: string): Promise<{
    governanceRequired: boolean;
    governanceRequest?: GovernanceRequest;
    blockers: string[];
  }> {
    const workflow = this.stateManager.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const blockers: string[] = [];

    // Orchestrator validation: Check workflow is ready for governance
    if (workflow.currentState !== WorkflowState.GOVERNANCE_PENDING) {
      blockers.push(`Workflow not in GOVERNANCE_PENDING state (current: ${workflow.currentState})`);
    }

    // Check if governance request already exists
    const existingRequest = this.governanceGate.getRequestByWorkflow(workflowId);
    if (existingRequest && existingRequest.status === 'pending') {
      return {
        governanceRequired: true,
        governanceRequest: existingRequest,
        blockers: []
      };
    }

    if (blockers.length > 0) {
      return {
        governanceRequired: false,
        blockers
      };
    }

    // Generate context data for governance decision
    const contextData = this.generateGovernanceContext(workflowId);
    
    // Generate recommended action based on analysis
    const recommendedAction = this.generateRecommendedAction(contextData);

    // Create governance request
    const governanceRequest = await this.governanceGate.createGovernanceRequest(
      workflowId,
      recommendedAction,
      contextData
    );

    return {
      governanceRequired: true,
      governanceRequest,
      blockers: []
    };
  }

  /**
   * Generate governance context from workflow analysis
   * Orchestrator role: Structure data for governance, don't interpret findings
   */
  private generateGovernanceContext(workflowId: string): {
    incidentSummary: string;
    agentFindings: string[];
    correlationSummary: string;
    confidenceLevel: number;
  } {
    const workflow = this.stateManager.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Extract agent findings (orchestrator role: collect, don't analyze)
    const agentFindings = workflow.agentOutputs.map(output => 
      `${output.agentName}: ${output.findings.summary}`
    );

    // Generate correlation summary using existing correlation method
    const correlation = this.stateManager.correlateAgentOutputs(workflowId);
    const correlationSummary = `${correlation.structuredCorrelations.crossAgentFindings.length} cross-agent findings identified`;

    // Calculate average confidence
    const confidenceLevel = workflow.agentOutputs.length > 0
      ? workflow.agentOutputs.reduce((sum, output) => sum + output.confidenceLevel, 0) / workflow.agentOutputs.length
      : 0;

    // Generate incident summary (orchestrator role: structure, don't diagnose)
    const incidentSummary = this.generateIncidentSummary(workflow.agentOutputs);

    return {
      incidentSummary,
      agentFindings,
      correlationSummary,
      confidenceLevel
    };
  }

  /**
   * Generate incident summary from agent outputs (structural only)
   */
  private generateIncidentSummary(agentOutputs: AgentOutput[]): string {
    if (agentOutputs.length === 0) {
      return 'No agent analysis available';
    }

    // Extract common themes without domain interpretation
    const allEvidence = agentOutputs.flatMap(output => output.findings.evidence);
    const commonTerms = this.extractCommonTerms(allEvidence);
    
    return `Incident involving ${commonTerms.slice(0, 3).join(', ')} based on ${agentOutputs.length} agent analysis`;
  }

  /**
   * Extract common terms from evidence (structural analysis only)
   */
  private extractCommonTerms(evidence: string[]): string[] {
    const termCounts = new Map<string, number>();
    
    evidence.forEach(item => {
      const words = item.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      words.forEach(word => {
        termCounts.set(word, (termCounts.get(word) || 0) + 1);
      });
    });

    return Array.from(termCounts.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([term, _]) => term);
  }

  /**
   * Generate recommended action based on context (orchestrator coordination only)
   */
  private generateRecommendedAction(contextData: {
    incidentSummary: string;
    agentFindings: string[];
    correlationSummary: string;
    confidenceLevel: number;
  }): string {
    // Orchestrator role: Generate action structure, not domain-specific remediation
    const summary = contextData.incidentSummary.toLowerCase();
    const allFindings = contextData.agentFindings.join(' ').toLowerCase();
    
    if (summary.includes('database') || allFindings.includes('database') || allFindings.includes('connection')) {
      return 'Restart database connection pool and monitor connection metrics';
    } else if (summary.includes('security') || summary.includes('auth') || allFindings.includes('security') || allFindings.includes('auth')) {
      return 'Review authentication logs and reset affected user sessions';
    } else if (summary.includes('performance') || summary.includes('cpu') || allFindings.includes('performance') || allFindings.includes('cpu')) {
      return 'Scale application instances and optimize resource allocation';
    } else {
      return 'Investigate system metrics and apply targeted remediation based on findings';
    }
  }

  /**
   * Get governance gate service instance
   */
  getGovernanceGate(): GovernanceGateService {
    return this.governanceGate;
  }

  /**
   * Helper methods for demo scenarios (orchestrator role: provide context structure)
   */
  private getScenarioDescription(scenario: string): string {
    switch (scenario) {
      case 'database-issue':
        return 'Database connection pool exhaustion causing application timeouts';
      case 'security-breach':
        return 'Suspicious authentication patterns detected from unusual IP ranges';
      case 'policy-violation':
        return 'Production deployment without required approval process';
      default:
        return 'System incident requiring analysis';
    }
  }

  private getScenarioSeverity(scenario: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (scenario) {
      case 'database-issue':
        return 'high';
      case 'security-breach':
        return 'critical';
      case 'policy-violation':
        return 'medium';
      default:
        return 'medium';
    }
  }

  private getScenarioServices(scenario: string): string[] {
    switch (scenario) {
      case 'database-issue':
        return ['user-service', 'database', 'api-gateway'];
      case 'security-breach':
        return ['auth-service', 'user-accounts', 'admin-panel'];
      case 'policy-violation':
        return ['deployment-pipeline', 'production-environment'];
      default:
        return ['system'];
    }
  }
}