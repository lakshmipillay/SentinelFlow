/**
 * SentinelFlow Demo State Manager
 * Manages demo workflow state with isolation and audit tracking
 * Implements deterministic state management per architectural principles
 */

import { EventEmitter } from 'events';
import { WorkflowInstance } from '../types/workflow';
import { 
  DemoSession, 
  DemoWorkflowData, 
  DemoIncident, 
  DemoAuditEvent, 
  DemoMetrics,
  DemoProgressionEvent 
} from './types/demo-types';

export class DemoStateManager extends EventEmitter {
  private sessions: Map<string, DemoSession> = new Map();
  private auditEvents: Map<string, DemoAuditEvent[]> = new Map();
  private progressionEvents: Map<string, DemoProgressionEvent[]> = new Map();
  private totalIncidentsSimulated: number = 0;

  constructor() {
    super();
  }

  /**
   * Initialize a new demo session with comprehensive state tracking
   * Implements Requirements 9.1 - Demo mode state management
   */
  async initializeSession(session: DemoSession): Promise<void> {
    // Validate session structure
    this.validateSessionStructure(session);

    // Store session with isolation guarantees
    this.sessions.set(session.sessionId, {
      ...session,
      safetyStatus: {
        isolated: true,
        noExternalActions: true,
        auditTrailActive: true,
        clearlyMarked: true
      }
    });

    // Initialize audit trail for session
    this.auditEvents.set(session.sessionId, []);
    this.progressionEvents.set(session.sessionId, []);

    // Generate initialization audit event
    const initEvent: DemoAuditEvent = {
      eventId: this.generateEventId(),
      sessionId: session.sessionId,
      eventType: 'session_initialized',
      timestamp: new Date().toISOString(),
      actor: 'demo-system',
      details: {
        scenarioType: session.scenario.type,
        scenarioComplexity: session.scenario.complexity,
        autoProgression: session.autoProgression,
        safetyConstraints: session.safetyStatus
      },
      demoMode: true,
      immutable: true
    };

    this.addAuditEvent(initEvent);

    this.emit('demoStateChanged', {
      sessionId: session.sessionId,
      state: 'initialized',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add workflow to demo session with validation
   * Implements Requirements 9.2 - Mocked data isolation
   */
  async addWorkflow(workflowId: string, workflow: WorkflowInstance, incident: DemoIncident): Promise<void> {
    const session = this.findSessionForWorkflow(workflowId);
    if (!session) {
      throw new Error('No active demo session found for workflow');
    }

    // Validate workflow is properly isolated
    this.validateWorkflowIsolation(workflow);

    // Create demo workflow data
    const workflowData: DemoWorkflowData = {
      workflow,
      incident,
      progressionPlan: this.generateProgressionPlan(session.scenario.type),
      currentStep: 0,
      lastUpdate: new Date().toISOString()
    };

    // Add to session
    session.workflows.set(workflowId, workflowData);
    this.totalIncidentsSimulated++;

    // Generate audit event
    const auditEvent: DemoAuditEvent = {
      eventId: this.generateEventId(),
      sessionId: session.sessionId,
      eventType: 'workflow_added',
      timestamp: new Date().toISOString(),
      actor: 'demo-system',
      details: {
        workflowId,
        incidentType: incident.type,
        severity: incident.severity,
        affectedServices: incident.affectedServices,
        isolationVerified: true
      },
      demoMode: true,
      immutable: true
    };

    this.addAuditEvent(auditEvent);

    this.emit('demoWorkflowUpdate', {
      sessionId: session.sessionId,
      workflowId,
      action: 'added',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Update workflow state with audit tracking
   * Implements Requirements 9.3 - Demo state persistence
   */
  async updateWorkflow(workflowId: string, updatedWorkflow: WorkflowInstance): Promise<void> {
    const session = this.findSessionForWorkflow(workflowId);
    if (!session) {
      throw new Error(`No demo session found for workflow ${workflowId}`);
    }

    const workflowData = session.workflows.get(workflowId);
    if (!workflowData) {
      throw new Error(`Workflow ${workflowId} not found in demo session`);
    }

    // Validate updated workflow maintains isolation
    this.validateWorkflowIsolation(updatedWorkflow);

    // Update workflow data
    const previousState = workflowData.workflow.currentState;
    workflowData.workflow = updatedWorkflow;
    workflowData.lastUpdate = new Date().toISOString();

    // Track progression if state changed
    if (previousState !== updatedWorkflow.currentState) {
      const progressionEvent: DemoProgressionEvent = {
        workflowId,
        fromStep: previousState,
        toStep: updatedWorkflow.currentState,
        timestamp: new Date().toISOString(),
        triggerType: 'automatic',
        metadata: {
          agentOutputsCount: updatedWorkflow.agentOutputs.length,
          hasGovernanceDecision: !!updatedWorkflow.governanceDecision
        }
      };

      this.addProgressionEvent(session.sessionId, progressionEvent);
    }

    // Generate audit event
    const auditEvent: DemoAuditEvent = {
      eventId: this.generateEventId(),
      sessionId: session.sessionId,
      eventType: 'workflow_updated',
      timestamp: new Date().toISOString(),
      actor: 'demo-system',
      details: {
        workflowId,
        previousState,
        newState: updatedWorkflow.currentState,
        agentOutputsCount: updatedWorkflow.agentOutputs.length,
        auditTrailLength: updatedWorkflow.auditTrail.length
      },
      demoMode: true,
      immutable: true
    };

    this.addAuditEvent(auditEvent);

    this.emit('demoWorkflowUpdate', {
      sessionId: session.sessionId,
      workflowId,
      action: 'updated',
      previousState,
      newState: updatedWorkflow.currentState,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Cleanup demo session with comprehensive audit
   * Implements Requirements 9.3 - Demo reset functionality
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return; // Already cleaned up
    }

    // Generate cleanup metrics
    const metrics = this.calculateSessionMetrics(sessionId);

    // Generate final audit event
    const cleanupEvent: DemoAuditEvent = {
      eventId: this.generateEventId(),
      sessionId,
      eventType: 'session_cleanup',
      timestamp: new Date().toISOString(),
      actor: 'demo-system',
      details: {
        sessionDuration: Date.now() - new Date(session.startTime).getTime(),
        workflowsProcessed: session.workflows.size,
        totalAuditEvents: this.auditEvents.get(sessionId)?.length || 0,
        metrics
      },
      demoMode: true,
      immutable: true
    };

    this.addAuditEvent(cleanupEvent);

    // Remove session data
    this.sessions.delete(sessionId);
    
    // Preserve audit events for compliance (don't delete)
    // this.auditEvents.delete(sessionId); // Keep for audit trail
    // this.progressionEvents.delete(sessionId); // Keep for audit trail

    this.emit('demoStateChanged', {
      sessionId,
      state: 'cleaned_up',
      timestamp: new Date().toISOString(),
      metrics
    });
  }

  /**
   * Add audit event with validation
   */
  addAuditEvent(event: DemoAuditEvent): void {
    // Validate audit event structure
    this.validateAuditEvent(event);

    const sessionEvents = this.auditEvents.get(event.sessionId) || [];
    sessionEvents.push(event);
    this.auditEvents.set(event.sessionId, sessionEvents);

    this.emit('demoAuditEvent', event);
  }

  /**
   * Add progression event with validation
   */
  addProgressionEvent(sessionId: string, event: DemoProgressionEvent): void {
    const sessionEvents = this.progressionEvents.get(sessionId) || [];
    sessionEvents.push(event);
    this.progressionEvents.set(sessionId, sessionEvents);

    this.emit('demoProgressionEvent', event);
  }

  /**
   * Get session by ID with safety validation
   */
  getSession(sessionId: string): DemoSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Validate session safety status
    if (!this.validateSessionSafety(session)) {
      throw new Error(`Demo session ${sessionId} failed safety validation`);
    }

    return session;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): DemoSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  /**
   * Get audit trail for session
   */
  getAuditTrail(sessionId: string): DemoAuditEvent[] {
    return this.auditEvents.get(sessionId) || [];
  }

  /**
   * Get progression events for session
   */
  getProgressionEvents(sessionId: string): DemoProgressionEvent[] {
    return this.progressionEvents.get(sessionId) || [];
  }

  /**
   * Get total incidents simulated across all sessions
   */
  getTotalIncidentsSimulated(): number {
    return this.totalIncidentsSimulated;
  }

  /**
   * Calculate comprehensive session metrics
   */
  calculateSessionMetrics(sessionId: string): DemoMetrics {
    const session = this.sessions.get(sessionId);
    const auditEvents = this.auditEvents.get(sessionId) || [];
    const progressionEvents = this.progressionEvents.get(sessionId) || [];

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const workflows = Array.from(session.workflows.values());
    const startTime = new Date(session.startTime).getTime();
    const duration = Date.now() - startTime;

    // Calculate workflow metrics
    const completedWorkflows = workflows.filter(w => 
      w.workflow.currentState === 'RESOLVED' || w.workflow.currentState === 'TERMINATED'
    ).length;
    const terminatedWorkflows = workflows.filter(w => 
      w.workflow.currentState === 'TERMINATED'
    ).length;

    // Calculate agent metrics
    const allAgentOutputs = workflows.flatMap(w => w.workflow.agentOutputs);
    const analysesByAgent: Record<string, number> = {};
    const skillsUtilization: Record<string, number> = {};
    
    allAgentOutputs.forEach(output => {
      analysesByAgent[output.agentName] = (analysesByAgent[output.agentName] || 0) + 1;
      output.skillsUsed.forEach(skill => {
        skillsUtilization[skill] = (skillsUtilization[skill] || 0) + 1;
      });
    });

    const averageConfidence = allAgentOutputs.length > 0
      ? allAgentOutputs.reduce((sum, output) => sum + output.confidenceLevel, 0) / allAgentOutputs.length
      : 0;

    // Calculate governance metrics
    const governanceDecisions = workflows
      .map(w => w.workflow.governanceDecision)
      .filter(Boolean);
    
    const decisionsByType: Record<string, number> = {};
    governanceDecisions.forEach(decision => {
      if (decision) {
        decisionsByType[decision.decision] = (decisionsByType[decision.decision] || 0) + 1;
      }
    });

    const blockRate = governanceDecisions.length > 0
      ? (decisionsByType['block'] || 0) / governanceDecisions.length
      : 0;

    // Calculate safety metrics
    const externalActionsBlocked = auditEvents.filter(e => 
      e.eventType === 'external_action_blocked'
    ).length;
    
    const isolationViolations = auditEvents.filter(e => 
      e.eventType === 'isolation_violation'
    ).length;

    const safetyScore = Math.max(0, 100 - (isolationViolations * 10) - (externalActionsBlocked * 5));

    return {
      sessionId,
      startTime: session.startTime,
      duration,
      workflowMetrics: {
        totalWorkflows: workflows.length,
        completedWorkflows,
        terminatedWorkflows,
        averageProcessingTime: duration / Math.max(workflows.length, 1)
      },
      agentMetrics: {
        totalAnalyses: allAgentOutputs.length,
        analysesByAgent,
        averageConfidence,
        skillsUtilization
      },
      governanceMetrics: {
        totalDecisions: governanceDecisions.length,
        decisionsByType,
        averageDecisionTime: 0, // Would need timing data
        blockRate
      },
      safetyMetrics: {
        externalActionsBlocked,
        auditEventsGenerated: auditEvents.length,
        isolationViolations,
        safetyScore
      }
    };
  }

  /**
   * Validate session structure for safety compliance
   */
  private validateSessionStructure(session: DemoSession): void {
    if (!session.sessionId || !session.scenario || !session.startTime) {
      throw new Error('Invalid demo session structure');
    }

    if (!session.safetyStatus.isolated || !session.safetyStatus.noExternalActions) {
      throw new Error('Demo session does not meet safety requirements');
    }
  }

  /**
   * Validate workflow isolation constraints
   */
  private validateWorkflowIsolation(workflow: WorkflowInstance): void {
    // Ensure workflow has no external references
    if (workflow.workflowId.includes('prod') || workflow.workflowId.includes('live')) {
      throw new Error('Demo workflow contains production references');
    }

    // Validate agent outputs don't contain external actions
    workflow.agentOutputs.forEach(output => {
      if (output.findings.recommendations?.some(rec => 
        rec.includes('execute') || rec.includes('deploy') || rec.includes('restart')
      )) {
        throw new Error('Demo agent output contains external action recommendations');
      }
    });
  }

  /**
   * Validate session safety status
   */
  private validateSessionSafety(session: DemoSession): boolean {
    return session.safetyStatus.isolated &&
           session.safetyStatus.noExternalActions &&
           session.safetyStatus.auditTrailActive &&
           session.safetyStatus.clearlyMarked;
  }

  /**
   * Validate audit event structure
   */
  private validateAuditEvent(event: DemoAuditEvent): void {
    if (!event.eventId || !event.sessionId || !event.timestamp) {
      throw new Error('Invalid demo audit event structure');
    }

    if (!event.demoMode || !event.immutable) {
      throw new Error('Demo audit event missing required safety flags');
    }
  }

  /**
   * Find session containing a specific workflow
   */
  private findSessionForWorkflow(workflowId: string): DemoSession | null {
    for (const session of this.sessions.values()) {
      if (session.workflows.has(workflowId)) {
        return session;
      }
    }
    return null;
  }

  /**
   * Generate progression plan based on scenario type
   */
  private generateProgressionPlan(scenarioType: string): string[] {
    const basePlan = [
      'incident_ingested',
      'parallel_analysis_initiated',
      'sre_analysis_complete',
      'security_analysis_complete',
      'governance_analysis_complete',
      'rca_generated',
      'governance_approval_required'
    ];

    switch (scenarioType) {
      case 'database-outage':
        return [...basePlan, 'database_recovery_proposed', 'connection_restart'];
      case 'api-failure':
        return [...basePlan, 'api_rollback_proposed', 'traffic_rerouting'];
      case 'security-incident':
        return [...basePlan, 'access_revocation_proposed', 'security_audit'];
      case 'infrastructure-issue':
        return [...basePlan, 'infrastructure_scaling_proposed', 'resource_reallocation'];
      case 'deployment-problem':
        return [...basePlan, 'rollback_proposed', 'deployment_verification'];
      default:
        return basePlan;
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `demo-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}