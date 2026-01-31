/**
 * SentinelFlow Workflow State Manager
 * Implements deterministic state transitions with validation and persistence
 * Enhanced with agent output validation and skills tracking
 */

import { v4 as uuidv4 } from 'uuid';
import { WorkflowState, WorkflowInstance, AuditEvent, StateUpdate, AgentOutput, GovernanceDecision } from '../types/workflow';
import { AgentOutputValidator, AgentOutputValidationResult } from '../services/AgentOutputValidator';
import { AuditArtifactService, EnhancedAuditEvent } from '../services/AuditArtifactService';
import { EventEmitter } from 'events';

export class WorkflowStateManager extends EventEmitter {
  private workflows: Map<string, WorkflowInstance> = new Map();
  private auditArtifactService: AuditArtifactService;
  
  // Define valid state transitions
  private readonly validTransitions: Map<WorkflowState, WorkflowState[]> = new Map([
    [WorkflowState.IDLE, [WorkflowState.INCIDENT_INGESTED]],
    [WorkflowState.INCIDENT_INGESTED, [WorkflowState.ANALYZING, WorkflowState.TERMINATED]],
    [WorkflowState.ANALYZING, [WorkflowState.RCA_COMPLETE, WorkflowState.TERMINATED]],
    [WorkflowState.RCA_COMPLETE, [WorkflowState.GOVERNANCE_PENDING, WorkflowState.TERMINATED]],
    [WorkflowState.GOVERNANCE_PENDING, [WorkflowState.ACTION_PROPOSED, WorkflowState.TERMINATED]],
    [WorkflowState.ACTION_PROPOSED, [WorkflowState.VERIFIED, WorkflowState.TERMINATED]],
    [WorkflowState.VERIFIED, [WorkflowState.RESOLVED, WorkflowState.TERMINATED]],
    [WorkflowState.RESOLVED, [WorkflowState.TERMINATED]],
    [WorkflowState.TERMINATED, []] // Terminal state
  ]);

  constructor(auditArtifactService?: AuditArtifactService) {
    super();
    this.auditArtifactService = auditArtifactService || new AuditArtifactService();
    
    // Forward audit events from the service
    this.auditArtifactService.on('auditEventGenerated', (event) => {
      this.emit('auditEventGenerated', event);
    });
    
    this.auditArtifactService.on('devlogUpdated', (event) => {
      this.emit('devlogUpdated', event);
    });
  }

  /**
   * Create a new workflow instance with comprehensive audit artifact generation
   */
  async createWorkflow(): Promise<WorkflowInstance> {
    const workflowId = uuidv4();
    const now = new Date().toISOString();
    
    const workflow: WorkflowInstance = {
      workflowId,
      currentState: WorkflowState.IDLE,
      timestamp: now,
      agentOutputs: [],
      auditTrail: [],
      createdAt: now,
      updatedAt: now
    };

    this.workflows.set(workflowId, workflow);
    
    // Generate comprehensive audit artifact for workflow creation
    const enhancedAuditEvent = await this.auditArtifactService.generateAuditEvent(
      workflowId,
      'state_transition',
      'orchestrator',
      { toState: WorkflowState.IDLE },
      { workflowInstance: workflow }
    );
    
    // Convert enhanced audit event to basic format for workflow storage
    const basicAuditEvent: AuditEvent = {
      eventId: enhancedAuditEvent.eventId,
      workflowId: enhancedAuditEvent.workflowId,
      eventType: enhancedAuditEvent.eventType,
      timestamp: enhancedAuditEvent.timestamp,
      actor: enhancedAuditEvent.actor,
      details: enhancedAuditEvent.details,
      immutable: enhancedAuditEvent.immutable
    };
    
    workflow.auditTrail.push(basicAuditEvent);
    
    return workflow;
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): WorkflowInstance | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get current state of a workflow
   */
  getCurrentState(workflowId: string): WorkflowState | undefined {
    const workflow = this.workflows.get(workflowId);
    return workflow?.currentState;
  }

  /**
   * Validate if a state transition is allowed
   */
  validateTransition(from: WorkflowState, to: WorkflowState): boolean {
    const allowedTransitions = this.validTransitions.get(from);
    return allowedTransitions?.includes(to) ?? false;
  }

  /**
   * Transition workflow to a new state with comprehensive audit artifact generation
   * Implements Requirements 4.1 - GOVERNANCE_PENDING state blocking
   */
  async transitionTo(workflowId: string, newState: WorkflowState): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const currentState = workflow.currentState;
    
    // Validate transition
    if (!this.validateTransition(currentState, newState)) {
      throw new Error(
        `Invalid state transition from ${currentState} to ${newState} for workflow ${workflowId}`
      );
    }

    // GOVERNANCE GATE ENFORCEMENT: Block transitions from GOVERNANCE_PENDING without approval
    if (currentState === WorkflowState.GOVERNANCE_PENDING && newState === WorkflowState.ACTION_PROPOSED) {
      // This transition is only allowed after explicit governance approval
      // The GovernanceGateService will handle this transition when decision is made
      if (!workflow.governanceDecision) {
        throw new Error(
          `Cannot transition from GOVERNANCE_PENDING to ACTION_PROPOSED without governance decision for workflow ${workflowId}`
        );
      }
      
      // Validate governance decision allows progression
      if (workflow.governanceDecision.decision === 'block') {
        throw new Error(
          `Cannot transition to ACTION_PROPOSED - governance decision was BLOCK for workflow ${workflowId}`
        );
      }
    }

    // Update workflow state
    const now = new Date().toISOString();
    workflow.currentState = newState;
    workflow.timestamp = now;
    workflow.updatedAt = now;

    // Generate comprehensive audit artifact for state transition
    const enhancedAuditEvent = await this.auditArtifactService.generateAuditEvent(
      workflowId,
      'state_transition',
      'orchestrator',
      { fromState: currentState, toState: newState },
      { workflowInstance: workflow }
    );

    // Convert enhanced audit event to basic format for workflow storage
    const basicAuditEvent: AuditEvent = {
      eventId: enhancedAuditEvent.eventId,
      workflowId: enhancedAuditEvent.workflowId,
      eventType: enhancedAuditEvent.eventType,
      timestamp: enhancedAuditEvent.timestamp,
      actor: enhancedAuditEvent.actor,
      details: enhancedAuditEvent.details,
      immutable: enhancedAuditEvent.immutable
    };
    
    workflow.auditTrail.push(basicAuditEvent);

    // Persist state
    await this.persistState(workflowId);

    // Broadcast state update
    this.broadcastStateUpdate(workflowId, newState);

    return true;
  }

  /**
   * Persist workflow state (in-memory for MVP, can be extended to database)
   */
  async persistState(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found for persistence`);
    }

    // For MVP: In-memory persistence
    // In production: This would write to database
    // For now, we just ensure the workflow is in our Map
    this.workflows.set(workflowId, { ...workflow });
  }

  /**
   * Broadcast state update to connected clients
   */
  broadcastStateUpdate(workflowId: string, newState: WorkflowState): void {
    const stateUpdate: StateUpdate = {
      type: 'workflow_state',
      workflowId,
      timestamp: new Date().toISOString(),
      payload: newState
    };

    // Emit event for WebSocket broadcasting
    this.emit('stateUpdate', stateUpdate);
  }

  /**
   * Get all workflows (for debugging/admin purposes)
   */
  getAllWorkflows(): WorkflowInstance[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get comprehensive audit chain for workflow
   */
  getAuditChain(workflowId: string): readonly EnhancedAuditEvent[] {
    return this.auditArtifactService.getAuditChain(workflowId);
  }

  /**
   * Get audit metrics for workflow
   */
  getAuditMetrics(workflowId: string) {
    return this.auditArtifactService.getAuditMetrics(workflowId);
  }

  /**
   * Verify audit chain integrity for workflow
   */
  verifyAuditChainIntegrity(workflowId: string) {
    return this.auditArtifactService.verifyAuditChainIntegrity(workflowId);
  }

  /**
   * Export comprehensive audit artifacts for compliance review
   */
  async exportAuditArtifacts(workflowId: string) {
    return await this.auditArtifactService.exportAuditArtifacts(workflowId);
  }

  /**
   * Terminate workflow with comprehensive audit artifact generation
   */
  async terminateWorkflow(workflowId: string, reason: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Transition to TERMINATED state
    await this.transitionTo(workflowId, WorkflowState.TERMINATED);

    // Generate comprehensive audit artifact for workflow termination
    const enhancedAuditEvent = await this.auditArtifactService.generateAuditEvent(
      workflowId,
      'workflow_termination',
      'orchestrator',
      { terminationReason: reason },
      { 
        workflowInstance: workflow,
        terminationReason: reason
      }
    );

    // Convert enhanced audit event to basic format for workflow storage
    const basicAuditEvent: AuditEvent = {
      eventId: enhancedAuditEvent.eventId,
      workflowId: enhancedAuditEvent.workflowId,
      eventType: enhancedAuditEvent.eventType,
      timestamp: enhancedAuditEvent.timestamp,
      actor: enhancedAuditEvent.actor,
      details: enhancedAuditEvent.details,
      immutable: enhancedAuditEvent.immutable
    };
    
    workflow.auditTrail.push(basicAuditEvent);
    
    await this.persistState(workflowId);
  }

  /**
   * Add validated agent output to workflow with comprehensive audit artifact generation
   * @param workflowId - The workflow to add output to
   * @param agentOutput - The agent output to add (will be validated)
   * @returns Promise<boolean> - Success status
   */
  async addAgentOutput(workflowId: string, agentOutput: AgentOutput): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Validate the agent output
    const validationResult = AgentOutputValidator.validateAgentOutput(agentOutput);
    if (!validationResult.isValid) {
      throw new Error(`Invalid agent output: ${validationResult.errors.join(', ')}`);
    }

    // Add the validated output to the workflow
    workflow.agentOutputs.push(validationResult.validatedOutput!);
    workflow.updatedAt = new Date().toISOString();

    // Generate comprehensive audit artifact for agent output
    const enhancedAuditEvent = await this.auditArtifactService.generateAuditEvent(
      workflowId,
      'agent_output',
      agentOutput.agentName,
      { agentOutput: validationResult.validatedOutput! },
      { 
        agentOutput: validationResult.validatedOutput!,
        workflowInstance: workflow
      }
    );

    // Convert enhanced audit event to basic format for workflow storage
    const basicAuditEvent: AuditEvent = {
      eventId: enhancedAuditEvent.eventId,
      workflowId: enhancedAuditEvent.workflowId,
      eventType: enhancedAuditEvent.eventType,
      timestamp: enhancedAuditEvent.timestamp,
      actor: enhancedAuditEvent.actor,
      details: enhancedAuditEvent.details,
      immutable: enhancedAuditEvent.immutable
    };
    
    workflow.auditTrail.push(basicAuditEvent);

    // Persist state
    await this.persistState(workflowId);

    // Broadcast agent output update
    this.broadcastAgentOutput(workflowId, validationResult.validatedOutput!);

    return true;
  }

  /**
   * Get agent outputs for a workflow, optionally filtered by agent name
   * @param workflowId - The workflow ID
   * @param agentName - Optional agent name filter
   * @returns Array of agent outputs
   */
  getAgentOutputs(workflowId: string, agentName?: string): AgentOutput[] {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return [];
    }

    if (agentName) {
      return workflow.agentOutputs.filter(output => output.agentName === agentName);
    }

    return workflow.agentOutputs;
  }

  /**
   * Check if all required agents have provided outputs for current workflow state
   * @param workflowId - The workflow ID
   * @returns boolean indicating if analysis is complete
   */
  isAnalysisComplete(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.currentState !== WorkflowState.ANALYZING) {
      return false;
    }

    // Check if we have outputs from all three specialist agents
    const requiredAgents = ['sre-agent', 'security-agent', 'governance-agent'];
    const agentNames = workflow.agentOutputs.map(output => output.agentName);
    
    return requiredAgents.every(agent => agentNames.includes(agent as any));
  }

  /**
   * Get analysis summary for all agent outputs in a workflow
   * @param workflowId - The workflow ID
   * @returns Analysis summary object
   */
  getAnalysisSummary(workflowId: string): {
    totalOutputs: number;
    agentBreakdown: Record<string, number>;
    averageConfidence: number;
    skillsUsed: string[];
    validationStatus: {
      allValid: boolean;
      invalidCount: number;
    };
  } {
    const outputs = this.getAgentOutputs(workflowId);
    
    if (outputs.length === 0) {
      return {
        totalOutputs: 0,
        agentBreakdown: {},
        averageConfidence: 0,
        skillsUsed: [],
        validationStatus: { allValid: true, invalidCount: 0 }
      };
    }

    // Calculate agent breakdown
    const agentBreakdown: Record<string, number> = {};
    outputs.forEach(output => {
      agentBreakdown[output.agentName] = (agentBreakdown[output.agentName] || 0) + 1;
    });

    // Calculate average confidence
    const totalConfidence = outputs.reduce((sum, output) => sum + output.confidenceLevel, 0);
    const averageConfidence = totalConfidence / outputs.length;

    // Collect all skills used
    const allSkills = outputs.flatMap(output => output.skillsUsed);
    const skillsUsed = [...new Set(allSkills)];

    // Check validation status
    const invalidOutputs = outputs.filter(output => 
      !output.validation.skillsValid || 
      !output.validation.confidenceLevelValid || 
      !output.validation.schemaCompliant
    );

    return {
      totalOutputs: outputs.length,
      agentBreakdown,
      averageConfidence,
      skillsUsed,
      validationStatus: {
        allValid: invalidOutputs.length === 0,
        invalidCount: invalidOutputs.length
      }
    };
  }

  /**
   * Broadcast agent output update to connected clients
   */
  private broadcastAgentOutput(workflowId: string, agentOutput: AgentOutput): void {
    const stateUpdate: StateUpdate = {
      type: 'agent_output',
      workflowId,
      timestamp: new Date().toISOString(),
      payload: agentOutput
    };

    // Emit event for WebSocket broadcasting
    this.emit('stateUpdate', stateUpdate);
  }

  /**
   * Validate workflow can transition to RCA_COMPLETE state
   * Ensures all required agent outputs are present and valid
   */
  canTransitionToRCAComplete(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.currentState !== WorkflowState.ANALYZING) {
      return false;
    }

    // Must have analysis complete and all outputs valid
    const analysisComplete = this.isAnalysisComplete(workflowId);
    const summary = this.getAnalysisSummary(workflowId);
    
    return analysisComplete && summary.validationStatus.allValid;
  }

  /**
   * Enhanced orchestrator coordination methods for parallel agent execution
   * Maintains role separation - orchestrator coordinates but doesn't analyze
   */

  /**
   * Initiate parallel agent analysis for a workflow with comprehensive audit artifact generation
   * Orchestrator coordinates but doesn't perform domain analysis
   * @param workflowId - The workflow to start analysis for
   * @param incidentContext - Context for agents to analyze
   * @returns Promise<boolean> - Success status
   */
  async initiateParallelAnalysis(workflowId: string, incidentContext: {
    incidentId: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedServices: string[];
    timestamp: string;
  }): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.currentState !== WorkflowState.ANALYZING) {
      throw new Error(`Cannot initiate analysis - workflow is in ${workflow.currentState} state`);
    }

    // Orchestrator role: Coordinate agent execution without domain analysis
    const agentTasks = this.createAgentAnalysisTasks(incidentContext);
    
    // Generate comprehensive audit artifact for analysis initiation
    const enhancedAuditEvent = await this.auditArtifactService.generateAuditEvent(
      workflowId,
      'agent_output',
      'orchestrator',
      { 
        analysisInitiated: true,
        agentTasksCreated: agentTasks.length,
        incidentContext 
      },
      { workflowInstance: workflow }
    );

    // Convert enhanced audit event to basic format for workflow storage
    const basicAuditEvent: AuditEvent = {
      eventId: enhancedAuditEvent.eventId,
      workflowId: enhancedAuditEvent.workflowId,
      eventType: enhancedAuditEvent.eventType,
      timestamp: enhancedAuditEvent.timestamp,
      actor: enhancedAuditEvent.actor,
      details: enhancedAuditEvent.details,
      immutable: enhancedAuditEvent.immutable
    };
    
    workflow.auditTrail.push(basicAuditEvent);
    await this.persistState(workflowId);

    // Broadcast analysis initiation
    this.broadcastAnalysisInitiation(workflowId, agentTasks);

    return true;
  }

  /**
   * Create analysis tasks for specialist agents (orchestrator coordination only)
   * Does NOT perform domain analysis - only creates task structure
   */
  private createAgentAnalysisTasks(incidentContext: any): Array<{
    agentName: string;
    taskId: string;
    context: any;
    expectedSkills: string[];
  }> {
    // Orchestrator role: Define what agents should analyze, not how
    return [
      {
        agentName: 'sre-agent',
        taskId: `sre-${Date.now()}`,
        context: {
          ...incidentContext,
          focus: 'operational-analysis'
        },
        expectedSkills: ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry']
      },
      {
        agentName: 'security-agent', 
        taskId: `security-${Date.now()}`,
        context: {
          ...incidentContext,
          focus: 'security-analysis'
        },
        expectedSkills: ['Splunk SIEM', 'IAM Logs', 'CSPM']
      },
      {
        agentName: 'governance-agent',
        taskId: `governance-${Date.now()}`,
        context: {
          ...incidentContext,
          focus: 'policy-analysis'
        },
        expectedSkills: ['Policy Engine', 'Change Management', 'Risk Register']
      }
    ];
  }

  /**
   * Correlate agent outputs without performing domain analysis
   * Orchestrator role: Structure correlation, don't interpret findings
   */
  correlateAgentOutputs(workflowId: string): {
    correlationId: string;
    timestamp: string;
    agentOutputSummary: {
      totalAgents: number;
      completedAgents: string[];
      pendingAgents: string[];
      averageConfidence: number;
    };
    structuredCorrelations: {
      crossAgentFindings: Array<{
        finding: string;
        reportedBy: string[];
        confidenceRange: { min: number; max: number };
      }>;
      skillsUtilization: {
        totalSkillsUsed: number;
        skillsByAgent: Record<string, string[]>;
        utilizationRate: number;
      };
      evidenceCorrelation: Array<{
        evidenceType: string;
        sources: string[];
        frequency: number;
      }>;
    };
    readyForRCA: boolean;
  } {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const outputs = workflow.agentOutputs;
    const requiredAgents = ['sre-agent', 'security-agent', 'governance-agent'];
    const completedAgents = [...new Set(outputs.map(o => o.agentName))];
    const pendingAgents = requiredAgents.filter(agent => !completedAgents.includes(agent as any));

    // Orchestrator correlation: Structure data without domain interpretation
    const crossAgentFindings = this.identifySharedFindings(outputs);
    const skillsUtilization = this.calculateSkillsUtilization(outputs);
    const evidenceCorrelation = this.correlateEvidence(outputs);

    const averageConfidence = outputs.length > 0 
      ? outputs.reduce((sum, o) => sum + o.confidenceLevel, 0) / outputs.length 
      : 0;

    return {
      correlationId: `correlation-${workflowId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentOutputSummary: {
        totalAgents: requiredAgents.length,
        completedAgents,
        pendingAgents,
        averageConfidence
      },
      structuredCorrelations: {
        crossAgentFindings,
        skillsUtilization,
        evidenceCorrelation
      },
      readyForRCA: completedAgents.length === requiredAgents.length && 
                   outputs.every(o => o.validation.skillsValid && o.validation.schemaCompliant)
    };
  }

  /**
   * Identify shared findings across agents (structural correlation only)
   */
  private identifySharedFindings(outputs: any[]): Array<{
    finding: string;
    reportedBy: string[];
    confidenceRange: { min: number; max: number };
  }> {
    const findingMap = new Map<string, { agents: string[]; confidences: number[] }>();

    // Group similar findings by keyword matching (not semantic analysis)
    outputs.forEach(output => {
      const keywords = this.extractKeywords(output.findings.summary);
      keywords.forEach(keyword => {
        if (!findingMap.has(keyword)) {
          findingMap.set(keyword, { agents: [], confidences: [] });
        }
        const entry = findingMap.get(keyword)!;
        if (!entry.agents.includes(output.agentName)) {
          entry.agents.push(output.agentName);
          entry.confidences.push(output.confidenceLevel);
        }
      });
    });

    // Return only findings reported by multiple agents
    return Array.from(findingMap.entries())
      .filter(([_, data]) => data.agents.length > 1)
      .map(([finding, data]) => ({
        finding,
        reportedBy: data.agents,
        confidenceRange: {
          min: Math.min(...data.confidences),
          max: Math.max(...data.confidences)
        }
      }));
  }

  /**
   * Extract keywords for structural correlation (not semantic analysis)
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - orchestrator doesn't interpret meaning
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.includes(word))
      .slice(0, 5); // Limit to prevent over-correlation
  }

  /**
   * Calculate skills utilization across all agents
   */
  private calculateSkillsUtilization(outputs: any[]): {
    totalSkillsUsed: number;
    skillsByAgent: Record<string, string[]>;
    utilizationRate: number;
  } {
    const skillsByAgent: Record<string, string[]> = {};
    const allSkillsUsed = new Set<string>();

    outputs.forEach(output => {
      skillsByAgent[output.agentName] = output.skillsUsed;
      output.skillsUsed.forEach((skill: string) => allSkillsUsed.add(skill));
    });

    // Total available skills across all agent types
    const totalAvailableSkills = 4 + 3 + 3; // SRE + Security + Governance skills

    return {
      totalSkillsUsed: allSkillsUsed.size,
      skillsByAgent,
      utilizationRate: allSkillsUsed.size / totalAvailableSkills
    };
  }

  /**
   * Correlate evidence across agent outputs (structural only)
   */
  private correlateEvidence(outputs: any[]): Array<{
    evidenceType: string;
    sources: string[];
    frequency: number;
  }> {
    const evidenceMap = new Map<string, string[]>();

    outputs.forEach(output => {
      output.findings.evidence.forEach((evidence: string) => {
        const evidenceType = this.categorizeEvidence(evidence);
        if (!evidenceMap.has(evidenceType)) {
          evidenceMap.set(evidenceType, []);
        }
        evidenceMap.get(evidenceType)!.push(output.agentName);
      });
    });

    return Array.from(evidenceMap.entries()).map(([evidenceType, sources]) => ({
      evidenceType,
      sources: [...new Set(sources)],
      frequency: sources.length
    }));
  }

  /**
   * Categorize evidence by type (structural categorization only)
   */
  private categorizeEvidence(evidence: string): string {
    const lowerEvidence = evidence.toLowerCase();
    
    if (lowerEvidence.includes('cpu') || lowerEvidence.includes('memory') || lowerEvidence.includes('disk')) {
      return 'performance-metrics';
    }
    if (lowerEvidence.includes('error') || lowerEvidence.includes('exception') || lowerEvidence.includes('fail')) {
      return 'error-indicators';
    }
    if (lowerEvidence.includes('login') || lowerEvidence.includes('auth') || lowerEvidence.includes('access')) {
      return 'access-patterns';
    }
    if (lowerEvidence.includes('policy') || lowerEvidence.includes('compliance') || lowerEvidence.includes('approval')) {
      return 'governance-indicators';
    }
    
    return 'general-evidence';
  }

  /**
   * Broadcast analysis initiation to connected clients
   */
  private broadcastAnalysisInitiation(workflowId: string, agentTasks: any[]): void {
    const stateUpdate: StateUpdate = {
      type: 'agent_output',
      workflowId,
      timestamp: new Date().toISOString(),
      payload: {
        analysisInitiated: true,
        agentTasks,
        parallelExecution: true
      } as any
    };

    this.emit('stateUpdate', stateUpdate);
  }

  /**
   * Check if parallel analysis is ready to transition to RCA
   * Enhanced version that includes correlation readiness
   */
  isParallelAnalysisComplete(workflowId: string): {
    complete: boolean;
    correlation: any | null;
    readyForRCA: boolean;
  } {
    const analysisComplete = this.isAnalysisComplete(workflowId);
    
    if (!analysisComplete) {
      return {
        complete: false,
        correlation: null,
        readyForRCA: false
      };
    }

    const correlation = this.correlateAgentOutputs(workflowId);
    
    return {
      complete: true,
      correlation,
      readyForRCA: correlation.readyForRCA
    };
  }

  /**
   * Recovery method to restore workflows from persistence
   */
  async recoverWorkflows(): Promise<void> {
    // For MVP: No-op since we're using in-memory storage
    // In production: This would load workflows from database
    console.log('Workflow recovery completed (in-memory mode)');
  }

  /**
   * Add governance decision to workflow with comprehensive audit artifact generation
   * Implements Requirements 4.3, 4.4 - Governance decision validation and storage
   */
  async addGovernanceDecision(workflowId: string, governanceDecision: GovernanceDecision): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Validate workflow is in GOVERNANCE_PENDING state
    if (workflow.currentState !== WorkflowState.GOVERNANCE_PENDING) {
      throw new Error(
        `Cannot add governance decision - workflow is in ${workflow.currentState} state, expected GOVERNANCE_PENDING`
      );
    }

    // Add governance decision to workflow
    workflow.governanceDecision = governanceDecision;
    workflow.updatedAt = new Date().toISOString();

    // Generate comprehensive audit artifact for governance decision
    const enhancedAuditEvent = await this.auditArtifactService.generateAuditEvent(
      workflowId,
      'governance_decision',
      'human',
      { governanceDecision },
      { 
        governanceDecision,
        workflowInstance: workflow
      }
    );

    // Convert enhanced audit event to basic format for workflow storage
    const basicAuditEvent: AuditEvent = {
      eventId: enhancedAuditEvent.eventId,
      workflowId: enhancedAuditEvent.workflowId,
      eventType: enhancedAuditEvent.eventType,
      timestamp: enhancedAuditEvent.timestamp,
      actor: enhancedAuditEvent.actor,
      details: enhancedAuditEvent.details,
      immutable: enhancedAuditEvent.immutable
    };
    
    workflow.auditTrail.push(basicAuditEvent);

    // Persist state
    await this.persistState(workflowId);

    // Broadcast governance decision update
    this.broadcastGovernanceDecision(workflowId, governanceDecision);

    return true;
  }

  /**
   * Check if workflow can transition from GOVERNANCE_PENDING
   * Validates governance decision exists and allows progression
   */
  canTransitionFromGovernancePending(workflowId: string): {
    canTransition: boolean;
    reason?: string;
    decision?: GovernanceDecision;
  } {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { canTransition: false, reason: 'Workflow not found' };
    }

    if (workflow.currentState !== WorkflowState.GOVERNANCE_PENDING) {
      return { canTransition: false, reason: 'Workflow not in GOVERNANCE_PENDING state' };
    }

    if (!workflow.governanceDecision) {
      return { canTransition: false, reason: 'No governance decision recorded' };
    }

    if (workflow.governanceDecision.decision === 'block') {
      return { 
        canTransition: false, 
        reason: 'Governance decision blocks workflow progression',
        decision: workflow.governanceDecision
      };
    }

    return { 
      canTransition: true, 
      decision: workflow.governanceDecision 
    };
  }

  /**
   * Force transition to TERMINATED state with comprehensive audit artifact generation
   * Bypasses normal transition validation for governance veto authority
   */
  async forceTerminateWorkflow(workflowId: string, reason: string, actor: 'orchestrator' | 'human' = 'orchestrator'): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const currentState = workflow.currentState;
    const now = new Date().toISOString();

    // Force transition to TERMINATED (bypasses validation)
    workflow.currentState = WorkflowState.TERMINATED;
    workflow.timestamp = now;
    workflow.updatedAt = now;

    // Generate comprehensive audit artifacts for forced termination
    const stateTransitionEvent = await this.auditArtifactService.generateAuditEvent(
      workflowId,
      'state_transition',
      actor,
      { fromState: currentState, toState: WorkflowState.TERMINATED },
      { workflowInstance: workflow }
    );

    const terminationEvent = await this.auditArtifactService.generateAuditEvent(
      workflowId,
      'workflow_termination',
      actor,
      { terminationReason: reason },
      { 
        workflowInstance: workflow,
        terminationReason: reason
      }
    );

    // Convert enhanced audit events to basic format for workflow storage
    const basicStateTransitionEvent: AuditEvent = {
      eventId: stateTransitionEvent.eventId,
      workflowId: stateTransitionEvent.workflowId,
      eventType: stateTransitionEvent.eventType,
      timestamp: stateTransitionEvent.timestamp,
      actor: stateTransitionEvent.actor,
      details: stateTransitionEvent.details,
      immutable: stateTransitionEvent.immutable
    };

    const basicTerminationEvent: AuditEvent = {
      eventId: terminationEvent.eventId,
      workflowId: terminationEvent.workflowId,
      eventType: terminationEvent.eventType,
      timestamp: terminationEvent.timestamp,
      actor: terminationEvent.actor,
      details: terminationEvent.details,
      immutable: terminationEvent.immutable
    };
    
    workflow.auditTrail.push(basicStateTransitionEvent);
    workflow.auditTrail.push(basicTerminationEvent);
    
    await this.persistState(workflowId);

    // Broadcast termination
    this.broadcastStateUpdate(workflowId, WorkflowState.TERMINATED);
  }

  /**
   * Broadcast governance decision update to connected clients
   */
  private broadcastGovernanceDecision(workflowId: string, governanceDecision: GovernanceDecision): void {
    const stateUpdate: StateUpdate = {
      type: 'governance_required',
      workflowId,
      timestamp: new Date().toISOString(),
      payload: governanceDecision
    };

    // Emit event for WebSocket broadcasting
    this.emit('stateUpdate', stateUpdate);
  }
}