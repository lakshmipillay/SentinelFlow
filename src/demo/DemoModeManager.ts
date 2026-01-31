/**
 * SentinelFlow Demo Mode Manager
 * Core demo mode management with simulation controls and safety constraints
 * Implements Requirements 9.1, 9.3 - Demo mode infrastructure and safety
 * **Property 30: Demo Mode Isolation**
 * **Validates: Requirements 11.4**
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowState, WorkflowInstance, AgentOutput, GovernanceDecision } from '../types/workflow';
import { DemoScenario, DemoSession, DemoConfig, DemoStateSnapshot, DemoWorkflowData } from './types/demo-types';
import { DemoScenarioGenerator } from './scenarios/DemoScenarioGenerator';
import { DemoDataGenerator } from './data-generators/DemoDataGenerator';
import { DemoStateManager } from './DemoStateManager';
import { DemoIsolationService, getDemoIsolationService, BlockedCallRecord } from './DemoIsolationService';

export class DemoModeManager extends EventEmitter {
  private isActive: boolean = false;
  private currentSession: DemoSession | null = null;
  private scenarioGenerator: DemoScenarioGenerator;
  private dataGenerator: DemoDataGenerator;
  private stateManager: DemoStateManager;
  private isolationService: DemoIsolationService;
  private config: DemoConfig;

  constructor(config?: Partial<DemoConfig>) {
    super();
    
    this.config = {
      maxConcurrentWorkflows: 3,
      defaultScenarioType: 'database-outage',
      enableProgressiveDisclosure: true,
      enableRealisticTiming: true,
      safetyConstraints: {
        noExternalActions: true,
        isolatedEnvironment: true,
        auditAllOperations: true,
        clearIndicators: true
      },
      timingConfig: {
        agentProcessingDelayMs: 2000,
        stateTransitionDelayMs: 1000,
        progressiveDisclosureIntervalMs: 3000
      },
      ...config
    };

    this.scenarioGenerator = new DemoScenarioGenerator();
    this.dataGenerator = new DemoDataGenerator();
    this.stateManager = new DemoStateManager();
    this.isolationService = getDemoIsolationService();

    // Forward events from isolation service
    this.isolationService.on('externalCallBlocked', (blockedCall: BlockedCallRecord) => {
      this.emit('externalCallBlocked', blockedCall);
      this.generateDemoAuditEvent('external_call_blocked', {
        callType: blockedCall.callType,
        targetUrl: blockedCall.targetUrl,
        targetService: blockedCall.targetService,
        reason: blockedCall.reason
      });
    });

    this.isolationService.on('isolationAuditEvent', (event) => {
      this.emit('isolationAuditEvent', event);
    });

    // Forward events from state manager
    this.stateManager.on('demoStateChanged', (state) => {
      this.emit('demoStateChanged', state);
    });

    this.stateManager.on('demoWorkflowUpdate', (update) => {
      this.emit('demoWorkflowUpdate', update);
    });
  }

  /**
   * Activate demo mode with comprehensive safety constraints
   * Implements Requirements 9.1 - Demo mode activation with safety
   * Implements Requirements 11.4 - Demo mode isolation
   */
  async activateDemoMode(sessionConfig?: {
    scenarioType?: string;
    customScenario?: Partial<DemoScenario>;
    enableAutoProgression?: boolean;
  }): Promise<DemoSession> {
    if (this.isActive) {
      throw new Error('Demo mode is already active. Reset current session first.');
    }

    // Create new demo session
    const sessionId = uuidv4();
    const scenario = sessionConfig?.customScenario 
      ? this.scenarioGenerator.createCustomScenario(sessionConfig.customScenario)
      : this.scenarioGenerator.generateScenario(
          sessionConfig?.scenarioType || this.config.defaultScenarioType
        );

    this.currentSession = {
      sessionId,
      scenario,
      startTime: new Date().toISOString(),
      isActive: true,
      workflows: new Map(),
      progressionState: 'initialized',
      autoProgression: sessionConfig?.enableAutoProgression ?? false,
      safetyStatus: {
        isolated: true,
        noExternalActions: true,
        auditTrailActive: true,
        clearlyMarked: true
      }
    };

    this.isActive = true;

    // Activate isolation service to prevent real system interactions
    this.isolationService.activateIsolation(sessionId);

    // Initialize demo state manager
    await this.stateManager.initializeSession(this.currentSession);

    // Generate audit event for demo activation
    this.generateDemoAuditEvent('demo_activated', {
      sessionId,
      scenarioType: scenario.type,
      safetyConstraints: this.config.safetyConstraints,
      isolationActive: true,
      simulationIndicators: this.getSimulationIndicators()
    });

    this.emit('demoModeActivated', this.currentSession);

    return this.currentSession;
  }

  /**
   * Deactivate demo mode and cleanup resources
   * Implements Requirements 9.3 - Demo reset functionality
   * Implements Requirements 11.4 - Demo mode isolation cleanup
   */
  async deactivateDemoMode(): Promise<void> {
    if (!this.isActive || !this.currentSession) {
      return;
    }

    const sessionId = this.currentSession.sessionId;

    // Get isolation statistics before deactivating
    const blockedCalls = this.isolationService.getBlockedCalls();
    const blockedCallsSummary = this.isolationService.getBlockedCallsSummary();

    // Generate audit event for demo deactivation
    this.generateDemoAuditEvent('demo_deactivated', {
      sessionId,
      duration: Date.now() - new Date(this.currentSession.startTime).getTime(),
      workflowsProcessed: this.currentSession.workflows.size,
      isolationStats: {
        blockedCallsCount: blockedCalls.length,
        blockedCallsSummary
      }
    });

    // Deactivate isolation service
    this.isolationService.deactivateIsolation();

    // Cleanup demo state
    await this.stateManager.cleanupSession(sessionId);

    // Reset state
    this.currentSession = null;
    this.isActive = false;

    this.emit('demoModeDeactivated', { sessionId });
  }

  /**
   * Reset demo mode to initial state while preserving configuration
   * Implements Requirements 9.3 - Demo reset functionality
   */
  async resetDemoMode(): Promise<DemoSession | null> {
    if (!this.isActive || !this.currentSession) {
      return null;
    }

    const currentScenario = this.currentSession.scenario;
    const autoProgression = this.currentSession.autoProgression;

    // Deactivate current session
    await this.deactivateDemoMode();

    // Reactivate with same configuration
    return await this.activateDemoMode({
      scenarioType: currentScenario.type,
      enableAutoProgression: autoProgression
    });
  }

  /**
   * Simulate incident ingestion with realistic scenario data
   * Implements Requirements 9.2 - Mocked data generation
   */
  async simulateIncident(): Promise<{
    workflowId: string;
    incident: any;
    expectedProgression: string[];
  }> {
    if (!this.isActive || !this.currentSession) {
      throw new Error('Demo mode is not active');
    }

    if (this.currentSession.workflows.size >= this.config.maxConcurrentWorkflows) {
      throw new Error(`Maximum concurrent workflows (${this.config.maxConcurrentWorkflows}) reached`);
    }

    const workflowId = uuidv4();
    const incident = this.dataGenerator.generateIncident(this.currentSession.scenario);

    // Create demo workflow instance
    const demoWorkflow: WorkflowInstance = {
      workflowId,
      currentState: WorkflowState.IDLE,
      timestamp: new Date().toISOString(),
      agentOutputs: [],
      auditTrail: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add to session
    this.currentSession.workflows.set(workflowId, {
      workflow: demoWorkflow,
      incident,
      progressionPlan: this.generateProgressionPlan(this.currentSession.scenario),
      currentStep: 0,
      lastUpdate: new Date().toISOString()
    });

    // Update state manager
    await this.stateManager.addWorkflow(workflowId, demoWorkflow, incident);

    // Generate audit event
    this.generateDemoAuditEvent('incident_simulated', {
      workflowId,
      incidentType: incident.type,
      severity: incident.severity
    });

    this.emit('incidentSimulated', {
      workflowId,
      incident,
      scenario: this.currentSession.scenario.type
    });

    return {
      workflowId,
      incident,
      expectedProgression: this.generateProgressionPlan(this.currentSession.scenario)
    };
  }

  /**
   * Simulate agent analysis with realistic timing and progressive disclosure
   * Implements Requirements 9.4 - Realistic timing delays and progressive disclosure
   */
  async simulateAgentAnalysis(workflowId: string, agentName: string): Promise<AgentOutput> {
    if (!this.isActive || !this.currentSession) {
      throw new Error('Demo mode is not active');
    }

    const workflowData = this.currentSession.workflows.get(workflowId);
    if (!workflowData) {
      throw new Error(`Demo workflow ${workflowId} not found`);
    }

    // Emit analysis started event
    this.emit('agentAnalysisStarted', {
      workflowId,
      agentName,
      estimatedDuration: this.config.timingConfig.agentProcessingDelayMs,
      isDemo: true
    });

    // Progressive disclosure simulation
    if (this.config.enableProgressiveDisclosure) {
      await this.simulateProgressiveAnalysis(workflowId, agentName, workflowData);
    }

    // Apply realistic processing delay
    if (this.config.enableRealisticTiming) {
      await this.delay(this.config.timingConfig.agentProcessingDelayMs);
    }

    // Generate agent output based on scenario
    const agentOutput = this.dataGenerator.generateAgentOutput(
      agentName as any,
      workflowData.incident,
      this.currentSession.scenario
    );

    // Add to workflow
    workflowData.workflow.agentOutputs.push(agentOutput);
    workflowData.lastUpdate = new Date().toISOString();

    // Update state manager
    await this.stateManager.updateWorkflow(workflowId, workflowData.workflow);

    // Generate audit event
    this.generateDemoAuditEvent('agent_analysis_simulated', {
      workflowId,
      agentName,
      skillsUsed: agentOutput.skillsUsed,
      confidenceLevel: agentOutput.confidenceLevel,
      processingTimeMs: agentOutput.metadata?.processingTimeMs,
      skillsUtilization: agentOutput.metadata?.skillsMetadata?.skillsUtilizationRate
    });

    this.emit('agentAnalysisCompleted', {
      workflowId,
      agentName,
      agentOutput,
      isDemo: true
    });

    return agentOutput;
  }

  /**
   * Simulate progressive analysis with realistic skill usage disclosure
   * Implements Requirements 9.4 - Progressive disclosure of agent findings
   */
  private async simulateProgressiveAnalysis(
    workflowId: string, 
    agentName: string, 
    workflowData: DemoWorkflowData
  ): Promise<void> {
    const skills = this.getAgentSkills(agentName as any);
    const progressSteps = this.generateProgressSteps(agentName as any, skills);
    
    for (let i = 0; i < progressSteps.length; i++) {
      const step = progressSteps[i];
      
      // Emit progressive update
      this.emit('agentProgressUpdate', {
        workflowId,
        agentName,
        step: i + 1,
        totalSteps: progressSteps.length,
        currentActivity: step.activity,
        skillInUse: step.skill,
        partialFindings: step.partialFindings,
        confidenceLevel: step.confidenceLevel,
        isDemo: true
      });

      // Wait between progress updates
      await this.delay(this.config.timingConfig.progressiveDisclosureIntervalMs);
    }
  }

  /**
   * Get authorized skills for agent
   */
  private getAgentSkills(agentName: 'sre-agent' | 'security-agent' | 'governance-agent'): string[] {
    const skillsMap = {
      'sre-agent': ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry'],
      'security-agent': ['Splunk SIEM', 'IAM Logs', 'CSPM'],
      'governance-agent': ['Policy Engine', 'Change Management', 'Risk Register']
    };
    return skillsMap[agentName] || [];
  }

  /**
   * Generate realistic progress steps for agent analysis
   */
  private generateProgressSteps(
    agentName: 'sre-agent' | 'security-agent' | 'governance-agent',
    skills: string[]
  ): Array<{
    activity: string;
    skill: string;
    partialFindings: string[];
    confidenceLevel: number;
  }> {
    const steps = [];
    
    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      const step = {
        activity: this.getActivityForSkill(agentName, skill),
        skill,
        partialFindings: this.getPartialFindingsForSkill(agentName, skill),
        confidenceLevel: Math.min(0.9, 0.3 + (i + 1) * 0.2) // Gradually increase confidence
      };
      steps.push(step);
    }

    return steps;
  }

  /**
   * Get realistic activity description for skill usage
   */
  private getActivityForSkill(agentName: string, skill: string): string {
    const activityMap: Record<string, Record<string, string>> = {
      'sre-agent': {
        'Datadog': 'Analyzing system metrics and performance data',
        'CloudWatch': 'Reviewing AWS infrastructure logs and alarms',
        'Prometheus': 'Querying time-series metrics and alerts',
        'OpenTelemetry': 'Examining distributed tracing data'
      },
      'security-agent': {
        'Splunk SIEM': 'Correlating security events and threat indicators',
        'IAM Logs': 'Analyzing access patterns and authentication logs',
        'CSPM': 'Scanning cloud security posture and compliance'
      },
      'governance-agent': {
        'Policy Engine': 'Evaluating policy compliance and violations',
        'Change Management': 'Reviewing change approval and deployment history',
        'Risk Register': 'Assessing risk levels and mitigation strategies'
      }
    };

    return activityMap[agentName]?.[skill] || `Using ${skill} for analysis`;
  }

  /**
   * Get partial findings for progressive disclosure
   */
  private getPartialFindingsForSkill(agentName: string, skill: string): string[] {
    const findingsMap: Record<string, Record<string, string[]>> = {
      'sre-agent': {
        'Datadog': ['High CPU utilization detected', 'Memory usage trending upward'],
        'CloudWatch': ['Database connection errors increasing', 'Response time degradation observed'],
        'Prometheus': ['Alert threshold breached', 'Service availability declining'],
        'OpenTelemetry': ['Request tracing shows bottlenecks', 'Error rate spike identified']
      },
      'security-agent': {
        'Splunk SIEM': ['Unusual authentication patterns detected', 'Multiple failed login attempts'],
        'IAM Logs': ['Privilege escalation attempts observed', 'Access from unusual locations'],
        'CSPM': ['Security policy violations found', 'Compliance drift detected']
      },
      'governance-agent': {
        'Policy Engine': ['Change approval process bypassed', 'Policy violation identified'],
        'Change Management': ['Emergency deployment detected', 'Standard workflow not followed'],
        'Risk Register': ['Risk level elevated', 'Mitigation controls insufficient']
      }
    };

    return findingsMap[agentName]?.[skill] || [`Analysis in progress using ${skill}`];
  }

  /**
   * Simulate governance decision scenarios with human-in-the-loop requirements
   * Implements Requirements 9.5 - Realistic governance scenarios requiring human approval
   */
  async simulateGovernanceScenario(workflowId: string, scenarioType: 'approve' | 'approve_with_restrictions' | 'block' | 'realistic' | 'human_required'): Promise<{
    blastRadiusAssessment: any;
    policyConflicts: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendedDecision: string;
    requiresHumanApproval: boolean;
    humanApprovalReason?: string;
    escalationRequired?: boolean;
  }> {
    if (!this.isActive || !this.currentSession) {
      throw new Error('Demo mode is not active');
    }

    const workflowData = this.currentSession.workflows.get(workflowId);
    if (!workflowData) {
      throw new Error(`Demo workflow ${workflowId} not found`);
    }

    // Generate governance scenario based on demo scenario and type
    const governanceScenario = this.dataGenerator.generateGovernanceScenario(
      workflowData.incident,
      this.currentSession.scenario,
      scenarioType === 'realistic' ? undefined : scenarioType === 'human_required' ? undefined : scenarioType
    );

    // Determine if human approval is required
    const humanApprovalResult = this.determineHumanApprovalRequirement(
      scenarioType,
      governanceScenario,
      workflowData.incident
    );

    const result = {
      ...governanceScenario,
      requiresHumanApproval: humanApprovalResult.required,
      humanApprovalReason: humanApprovalResult.reason,
      escalationRequired: humanApprovalResult.escalationRequired
    };

    // If human approval is required, emit special event
    if (result.requiresHumanApproval) {
      this.emit('humanApprovalRequired', {
        workflowId,
        scenario: result,
        approvalReason: result.humanApprovalReason,
        escalationRequired: result.escalationRequired,
        timeoutMinutes: this.calculateApprovalTimeout(result.riskLevel),
        isDemo: true
      });

      // Generate audit event for human approval requirement
      this.generateDemoAuditEvent('human_approval_required', {
        workflowId,
        riskLevel: result.riskLevel,
        approvalReason: result.humanApprovalReason,
        escalationRequired: result.escalationRequired,
        policyConflicts: result.policyConflicts.length
      });
    }

    // Generate audit event
    this.generateDemoAuditEvent('governance_scenario_simulated', {
      workflowId,
      scenarioType,
      riskLevel: governanceScenario.riskLevel,
      policyConflicts: governanceScenario.policyConflicts.length,
      requiresHumanApproval: result.requiresHumanApproval
    });

    this.emit('governanceScenarioGenerated', {
      workflowId,
      scenario: result,
      isDemo: true
    });

    return result;
  }

  /**
   * Simulate human approval decision for governance scenarios
   * Implements Requirements 9.5 - Human-in-the-loop governance decisions
   */
  async simulateHumanApprovalDecision(
    workflowId: string,
    decision: 'approve' | 'approve_with_restrictions' | 'block' | 'escalate',
    approver: string,
    justification: string
  ): Promise<{
    decision: string;
    approver: string;
    justification: string;
    timestamp: string;
    restrictions?: string[];
    escalationLevel?: string;
  }> {
    if (!this.isActive || !this.currentSession) {
      throw new Error('Demo mode is not active');
    }

    const workflowData = this.currentSession.workflows.get(workflowId);
    if (!workflowData) {
      throw new Error(`Demo workflow ${workflowId} not found`);
    }

    const approvalResult = {
      decision,
      approver,
      justification,
      timestamp: new Date().toISOString(),
      restrictions: decision === 'approve_with_restrictions' ? this.generateRestrictions(workflowData.incident) : undefined,
      escalationLevel: decision === 'escalate' ? this.determineEscalationLevel(workflowData.incident.severity) : undefined
    };

    // Generate audit event for human decision
    this.generateDemoAuditEvent('human_approval_decision', {
      workflowId,
      decision,
      approver,
      justification,
      restrictions: approvalResult.restrictions?.length || 0,
      escalationLevel: approvalResult.escalationLevel
    });

    this.emit('humanApprovalDecision', {
      workflowId,
      approvalResult,
      isDemo: true
    });

    return approvalResult;
  }

  /**
   * Determine if human approval is required based on scenario and risk factors
   */
  private determineHumanApprovalRequirement(
    scenarioType: string,
    governanceScenario: any,
    incident: any
  ): {
    required: boolean;
    reason?: string;
    escalationRequired?: boolean;
  } {
    // Always require human approval for certain scenario types
    if (scenarioType === 'human_required') {
      return {
        required: true,
        reason: 'Demo scenario configured to require human approval',
        escalationRequired: false
      };
    }

    // Risk-based human approval requirements
    if (governanceScenario.riskLevel === 'critical') {
      return {
        required: true,
        reason: 'Critical risk level requires human oversight',
        escalationRequired: true
      };
    }

    if (incident.severity === 'critical' && governanceScenario.policyConflicts.length > 0) {
      return {
        required: true,
        reason: 'Critical incident with policy conflicts requires human approval',
        escalationRequired: false
      };
    }

    // Security incidents always require human approval
    if (incident.type === 'security-incident') {
      return {
        required: true,
        reason: 'Security incidents require human security team approval',
        escalationRequired: incident.severity === 'critical'
      };
    }

    // High-impact scenarios require approval
    if (governanceScenario.blastRadiusAssessment?.estimatedImpact?.usersAffected > 10000) {
      return {
        required: true,
        reason: 'High user impact requires management approval',
        escalationRequired: false
      };
    }

    // Multiple policy conflicts require approval
    if (governanceScenario.policyConflicts.length >= 2) {
      return {
        required: true,
        reason: 'Multiple policy conflicts require compliance team review',
        escalationRequired: false
      };
    }

    return { required: false };
  }

  /**
   * Calculate approval timeout based on risk level
   */
  private calculateApprovalTimeout(riskLevel: string): number {
    const timeoutMap = {
      'critical': 15, // 15 minutes for critical
      'high': 30,     // 30 minutes for high
      'medium': 60,   // 1 hour for medium
      'low': 120      // 2 hours for low
    };
    return timeoutMap[riskLevel as keyof typeof timeoutMap] || 60;
  }

  /**
   * Generate restrictions for conditional approvals
   */
  private generateRestrictions(incident: any): string[] {
    const restrictions = [];
    
    if (incident.severity === 'critical') {
      restrictions.push('Requires continuous monitoring during execution');
      restrictions.push('Must have rollback plan ready');
    }
    
    if (incident.type === 'database-outage') {
      restrictions.push('Database changes must be applied during maintenance window');
      restrictions.push('Requires DBA approval for schema changes');
    }
    
    if (incident.type === 'security-incident') {
      restrictions.push('Security team must monitor all access during remediation');
      restrictions.push('All actions must be logged and audited');
    }
    
    restrictions.push('Post-incident review required within 24 hours');
    
    return restrictions;
  }

  /**
   * Determine escalation level based on incident severity
   */
  private determineEscalationLevel(severity: string): string {
    const escalationMap = {
      'critical': 'C-Level Executive',
      'high': 'Director Level',
      'medium': 'Manager Level',
      'low': 'Team Lead Level'
    };
    return escalationMap[severity as keyof typeof escalationMap] || 'Manager Level';
  }

  /**
   * Get current demo session status
   */
  getDemoStatus(): {
    isActive: boolean;
    session: DemoSession | null;
    config: DemoConfig;
    metrics: {
      activeWorkflows: number;
      totalIncidentsSimulated: number;
      sessionDuration: number;
    };
  } {
    const metrics = {
      activeWorkflows: this.currentSession?.workflows.size || 0,
      totalIncidentsSimulated: this.stateManager.getTotalIncidentsSimulated(),
      sessionDuration: this.currentSession 
        ? Date.now() - new Date(this.currentSession.startTime).getTime()
        : 0
    };

    return {
      isActive: this.isActive,
      session: this.currentSession,
      config: this.config,
      metrics
    };
  }

  /**
   * Get available demo scenarios
   */
  getAvailableScenarios(): Array<{
    type: string;
    name: string;
    description: string;
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedDuration: string;
  }> {
    return this.scenarioGenerator.getAvailableScenarios();
  }

  /**
   * Create demo state snapshot for persistence
   * Implements Requirements 9.3 - Demo state management
   */
  createStateSnapshot(): DemoStateSnapshot | null {
    if (!this.currentSession) {
      return null;
    }

    return {
      sessionId: this.currentSession.sessionId,
      timestamp: new Date().toISOString(),
      scenario: this.currentSession.scenario,
      workflows: Array.from(this.currentSession.workflows.entries()).map(([id, data]) => ({
        workflowId: id,
        workflow: data.workflow,
        incident: data.incident,
        progressionStep: data.currentStep
      })),
      progressionState: this.currentSession.progressionState,
      config: this.config
    };
  }

  /**
   * Restore demo state from snapshot
   */
  async restoreFromSnapshot(snapshot: DemoStateSnapshot): Promise<void> {
    if (this.isActive) {
      await this.deactivateDemoMode();
    }

    // Restore session with proper type casting for progressionState
    const progressionState = snapshot.progressionState as 'initialized' | 'incident_active' | 'analysis_phase' | 'governance_phase' | 'completed';
    
    this.currentSession = {
      sessionId: snapshot.sessionId,
      scenario: snapshot.scenario,
      startTime: snapshot.timestamp,
      isActive: true,
      workflows: new Map(),
      progressionState,
      autoProgression: false,
      safetyStatus: {
        isolated: true,
        noExternalActions: true,
        auditTrailActive: true,
        clearlyMarked: true
      }
    };

    // Restore workflows
    for (const workflowData of snapshot.workflows) {
      this.currentSession.workflows.set(workflowData.workflowId, {
        workflow: workflowData.workflow,
        incident: workflowData.incident,
        progressionPlan: this.generateProgressionPlan(snapshot.scenario),
        currentStep: workflowData.progressionStep,
        lastUpdate: new Date().toISOString()
      });
    }

    this.isActive = true;
    
    // Activate isolation for restored session
    this.isolationService.activateIsolation(snapshot.sessionId);
    
    await this.stateManager.initializeSession(this.currentSession);

    this.emit('demoStateRestored', { sessionId: snapshot.sessionId });
  }

  /**
   * Generate progression plan for scenario
   */
  private generateProgressionPlan(scenario: DemoScenario): string[] {
    const basePlan = [
      'incident_ingested',
      'parallel_analysis_initiated',
      'sre_analysis_complete',
      'security_analysis_complete',
      'governance_analysis_complete',
      'rca_generated',
      'governance_approval_required',
      'human_decision_pending'
    ];

    // Add scenario-specific steps
    switch (scenario.type) {
      case 'database-outage':
        return [...basePlan, 'database_recovery_proposed', 'connection_pool_restart'];
      case 'api-failure':
        return [...basePlan, 'api_rollback_proposed', 'traffic_rerouting'];
      case 'security-incident':
        return [...basePlan, 'access_revocation_proposed', 'security_audit_initiated'];
      default:
        return basePlan;
    }
  }

  /**
   * Generate demo audit event
   */
  private generateDemoAuditEvent(eventType: string, details: any): void {
    const sessionId = this.currentSession?.sessionId || 'unknown-session';
    
    const auditEvent = {
      eventId: uuidv4(),
      sessionId,
      eventType,
      timestamp: new Date().toISOString(),
      actor: 'demo-system' as const,
      details,
      demoMode: true as const,
      immutable: true as const
    };

    this.stateManager.addAuditEvent(auditEvent);
    this.emit('demoAuditEvent', auditEvent);
  }

  /**
   * Utility method for realistic delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if demo mode is active
   */
  isDemo(): boolean {
    return this.isActive;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSession?.sessionId || null;
  }

  /**
   * Update demo configuration
   */
  updateConfig(newConfig: Partial<DemoConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.currentSession) {
      this.generateDemoAuditEvent('config_updated', {
        sessionId: this.currentSession.sessionId,
        updatedFields: Object.keys(newConfig)
      });
    }
  }

  /**
   * Get simulation status indicators for UI display
   * Implements Requirements 11.4 - Clear simulation status indicators
   */
  getSimulationIndicators(): {
    isDemoMode: boolean;
    statusText: string;
    statusColor: 'green' | 'yellow' | 'red';
    warningMessage?: string;
    blockedActionsCount: number;
    safetyScore: number;
    isolationActive: boolean;
  } {
    return {
      ...this.isolationService.getSimulationIndicators(),
      isolationActive: this.isolationService.isActive()
    };
  }

  /**
   * Validate an external HTTP request in demo mode
   * Implements Requirements 11.4 - Prevent real system interactions
   */
  validateHttpRequest(url: string, method: string = 'GET', headers?: Record<string, string>): {
    allowed: boolean;
    reason?: string;
    mockResponse?: any;
  } {
    return this.isolationService.validateHttpRequest(url, method, headers);
  }

  /**
   * Validate a WebSocket connection in demo mode
   * Implements Requirements 11.4 - Prevent real system interactions
   */
  validateWebSocketConnection(url: string): {
    allowed: boolean;
    reason?: string;
    useMockWebSocket: boolean;
  } {
    return this.isolationService.validateWebSocketConnection(url);
  }

  /**
   * Validate credential access in demo mode
   * Implements Requirements 11.4 - Prevent credential usage in demo mode
   */
  validateCredentialAccess(credentialType: string, source: string): {
    allowed: boolean;
    reason?: string;
  } {
    return this.isolationService.validateCredentialAccess(credentialType, source);
  }

  /**
   * Validate command execution in demo mode
   * Implements Requirements 11.4 - Prevent real system interactions
   */
  validateCommandExecution(command: string): {
    allowed: boolean;
    reason?: string;
    isDangerous: boolean;
  } {
    return this.isolationService.validateCommandExecution(command);
  }

  /**
   * Validate cloud API call in demo mode
   * Implements Requirements 11.4 - Prevent real system interactions
   */
  validateCloudApiCall(provider: string, service: string, action: string): {
    allowed: boolean;
    reason?: string;
    mockResponse?: any;
  } {
    return this.isolationService.validateCloudApiCall(provider, service, action);
  }

  /**
   * Get all blocked external calls for audit
   * Implements Requirements 11.4 - Audit of blocked actions
   */
  getBlockedCalls(): BlockedCallRecord[] {
    return this.isolationService.getBlockedCalls();
  }

  /**
   * Get summary of blocked calls by type
   */
  getBlockedCallsSummary(): Record<string, number> {
    return this.isolationService.getBlockedCallsSummary();
  }

  /**
   * Get isolation status for monitoring
   * Implements Requirements 11.4 - Demo mode isolation status
   */
  getIsolationStatus(): {
    isActive: boolean;
    demoModeEnabled: boolean;
    blockedCallsCount: number;
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
  } {
    return this.isolationService.getIsolationStatus();
  }

  /**
   * Check if a specific external call type is allowed
   * Implements Requirements 11.4 - Prevent real system interactions
   */
  isExternalCallAllowed(callType: string, target: string, options?: any): boolean {
    if (!this.isActive) {
      return true; // Not in demo mode, allow all
    }

    switch (callType) {
      case 'http':
        return this.validateHttpRequest(target, options?.method, options?.headers).allowed;
      case 'websocket':
        return this.validateWebSocketConnection(target).allowed;
      case 'credential':
        return this.validateCredentialAccess(target, options?.source || 'unknown').allowed;
      case 'command':
        return this.validateCommandExecution(target).allowed;
      case 'cloud_api':
        return this.validateCloudApiCall(
          options?.provider || 'unknown',
          options?.service || 'unknown',
          target
        ).allowed;
      default:
        return false; // Block unknown call types in demo mode
    }
  }

  /**
   * Get comprehensive demo mode status including isolation
   * Implements Requirements 11.4 - Demo mode status with isolation info
   */
  getComprehensiveDemoStatus(): {
    isActive: boolean;
    session: DemoSession | null;
    config: DemoConfig;
    metrics: {
      activeWorkflows: number;
      totalIncidentsSimulated: number;
      sessionDuration: number;
    };
    isolation: {
      isActive: boolean;
      blockedCallsCount: number;
      safetyConstraints: Record<string, boolean>;
    };
    simulationIndicators: {
      isDemoMode: boolean;
      statusText: string;
      statusColor: string;
      warningMessage?: string;
      safetyScore: number;
    };
  } {
    const basicStatus = this.getDemoStatus();
    const isolationStatus = this.getIsolationStatus();
    const simulationIndicators = this.getSimulationIndicators();

    return {
      ...basicStatus,
      isolation: {
        isActive: isolationStatus.isActive,
        blockedCallsCount: isolationStatus.blockedCallsCount,
        safetyConstraints: isolationStatus.safetyConstraints
      },
      simulationIndicators: {
        isDemoMode: simulationIndicators.isDemoMode,
        statusText: simulationIndicators.statusText,
        statusColor: simulationIndicators.statusColor,
        warningMessage: simulationIndicators.warningMessage,
        safetyScore: simulationIndicators.safetyScore
      }
    };
  }
}