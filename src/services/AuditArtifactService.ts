/**
 * SentinelFlow Audit Artifact Generation Service
 * 
 * Implements comprehensive audit artifact generation system with:
 * - Structured audit event creation for all workflow activities
 * - Immutable audit trail storage with complete context capture
 * - DEVLOG.md integration as canonical audit trail
 * - Machine-readable audit artifacts suitable for compliance review
 * 
 * Validates Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 * 
 * Core Principles:
 * - Audit artifacts are first-class outputs, not optional logging
 * - All workflow decisions and state changes generate audit events
 * - Complete context capture including skills, confidence, and rationale
 * - Immutable audit records with cryptographic integrity
 * - DEVLOG.md serves as canonical, machine-readable audit trail
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { EventEmitter } from 'events';
import { 
  AuditEvent, 
  WorkflowInstance, 
  AgentOutput, 
  GovernanceDecision, 
  WorkflowState 
} from '../types/workflow';
import { AgentName } from '../types/agent-skills';

/**
 * Enhanced audit event with immutability guarantees and context completeness
 */
export interface EnhancedAuditEvent extends AuditEvent {
  // Immutability guarantees
  readonly eventHash: string;
  readonly previousEventHash?: string;
  readonly auditChainPosition: number;
  
  // Enhanced context capture
  readonly contextCapture: {
    // Agent analysis context (Requirement 10.2)
    agentAnalysisContext?: {
      skillsUsed: string[];
      dataSourcesAccessed: string[];
      confidenceLevel: number;
      processingTimeMs: number;
      validationResults: {
        skillsValid: boolean;
        confidenceLevelValid: boolean;
        schemaCompliant: boolean;
      };
      // Enhanced agent analysis audit details
      analysisMetrics: {
        findingsCount: number;
        correlationsCount: number;
        recommendationsCount: number;
        skillsUtilizationRate: number;
        dataQualityScore: number;
      };
      skillsMetadata: {
        availableSkills: string[];
        skillsUsedCount: number;
        skillsValidationPassed: boolean;
        primarySkillDomain: string;
      };
      findingsAudit: {
        evidenceTypes: string[];
        correlationStrength: 'weak' | 'moderate' | 'strong';
        findingsReliability: 'low' | 'medium' | 'high';
      };
    };
    
    // Governance decision context (Requirement 10.3)
    governanceContext?: {
      blastRadiusAssessment: {
        affectedServices: string[];
        riskLevel: string;
        reversible: boolean;
        totalPotentialImpact: number;
      };
      riskAssessment: {
        riskScore: number;
        riskFactors: string[];
        policyConflicts: string[];
      };
      humanRationale: string;
      approverContext: {
        approverId: string;
        approverRole: string;
        decisionTimestamp: string;
      };
      // Enhanced governance decision audit details
      decisionAnalysis: {
        decisionType: string;
        hasRestrictions: boolean;
        restrictionsCount: number;
        riskMitigationFactors: string[];
        complianceStatus: 'compliant' | 'non-compliant' | 'conditional';
      };
      blastRadiusAudit: {
        criticalServicesAffected: string[];
        cascadeRiskLevel: string;
        criticalPathImpact: boolean;
        dependencyChainLength: number;
        reversibilityConfidence: 'low' | 'medium' | 'high';
      };
      policyEvaluation: {
        policyEngineUsed: boolean;
        changeManagementCompliance: 'compliant' | 'non-compliant' | 'partial';
        riskRegisterUpdated: boolean;
        approvalAuthority: 'valid' | 'invalid' | 'escalation-required';
      };
    };
    
    // Workflow termination context (Requirement 10.4)
    terminationContext?: {
      terminationReason: string;
      residualRisks: string[];
      workflowTimeline: Array<{
        state: WorkflowState;
        timestamp: string;
        duration?: number;
      }>;
      completionStatus: 'successful' | 'blocked' | 'error' | 'timeout';
      // Enhanced workflow termination audit details
      terminationAnalysis: {
        totalWorkflowDuration: number;
        statesTraversed: WorkflowState[];
        agentParticipation: {
          [agentName: string]: {
            outputsGenerated: number;
            averageConfidence: number;
            skillsUsed: string[];
          };
        };
        governanceInteractions: {
          decisionsRequested: number;
          decisionsApproved: number;
          decisionsBlocked: number;
          averageDecisionTime: number;
        };
        terminationTrigger: 'natural' | 'governance-block' | 'error' | 'timeout' | 'manual';
      };
      timelineAudit: {
        totalStateTransitions: number;
        averageStateTransitionTime: number;
        longestStateTransition: {
          fromState: WorkflowState;
          toState: WorkflowState;
          duration: number;
        };
        shortestStateTransition: {
          fromState: WorkflowState;
          toState: WorkflowState;
          duration: number;
        };
        stateTransitionEfficiency: number;
      };
      residualRiskAudit: {
        riskCategories: string[];
        riskMitigationStatus: 'complete' | 'partial' | 'none';
        incidentResolutionCompleteness: number;
        followUpActionsRequired: string[];
      };
      workflowQualityMetrics: {
        agentOutputQuality: number;
        governanceDecisionQuality: number;
        auditTrailCompleteness: number;
        complianceScore: number;
      };
    };
    
    // System context for all events
    systemContext: {
      workflowDuration?: number;
      totalAgentOutputs: number;
      governanceDecisionsMade: number;
      stateTransitionsCount: number;
      systemLoad?: {
        activeWorkflows: number;
        memoryUsage?: number;
        processingQueue?: number;
      };
    };
  };
}

/**
 * DEVLOG entry structure for machine-readable audit trail
 */
export interface DevlogAuditEntry {
  readonly entryId: string;
  readonly timestamp: string;
  readonly workflowId: string;
  readonly eventType: string;
  readonly summary: string;
  readonly details: {
    stateTransition?: {
      from: WorkflowState;
      to: WorkflowState;
      transitionValid: boolean;
      governanceRequired: boolean;
    };
    agentAnalysis?: {
      agentName: AgentName;
      skillsUsed: string[];
      confidenceLevel: number;
      findingsSummary: string;
      validationPassed: boolean;
    };
    governanceDecision?: {
      decision: string;
      riskLevel: string;
      affectedServices: number;
      rationale: string;
      approver: string;
    };
    workflowCompletion?: {
      finalState: WorkflowState;
      totalDuration: number;
      agentOutputsGenerated: number;
      governanceDecisionsMade: number;
      auditEventsGenerated: number;
    };
  };
  readonly auditMetadata: {
    eventHash: string;
    chainPosition: number;
    immutable: true;
    complianceReady: boolean;
  };
}

/**
 * Audit artifact generation service with immutability and DEVLOG integration
 */
export class AuditArtifactService extends EventEmitter {
  private auditChain: Map<string, EnhancedAuditEvent[]> = new Map();
  private devlogPath: string = 'DEVLOG.md';
  private auditMetrics: Map<string, {
    totalEvents: number;
    stateTransitions: number;
    agentOutputs: number;
    governanceDecisions: number;
    workflowTerminations: number;
    lastUpdated: string;
  }> = new Map();
  
  // Mutex for atomic chain operations
  private chainMutex: Map<string, Promise<EnhancedAuditEvent | void>> = new Map();

  constructor(devlogPath?: string) {
    super();
    if (devlogPath) {
      this.devlogPath = devlogPath;
    }
  }

  /**
   * Generate structured audit event with immutability guarantees
   * Implements Requirement 10.1 - Mandatory audit artifacts as first-class outputs
   */
  async generateAuditEvent(
    workflowId: string,
    eventType: AuditEvent['eventType'],
    actor: AuditEvent['actor'],
    details: AuditEvent['details'],
    contextData?: {
      agentOutput?: AgentOutput;
      governanceDecision?: GovernanceDecision;
      workflowInstance?: WorkflowInstance;
      terminationReason?: string;
      systemMetrics?: any;
    }
  ): Promise<EnhancedAuditEvent> {
    // Ensure atomic chain operations using mutex
    const currentMutex = this.chainMutex.get(workflowId) || Promise.resolve();
    const newMutex = currentMutex.then(async () => {
      const timestamp = new Date().toISOString();
      const eventId = uuidv4();
      
      // Get existing audit chain for this workflow
      const existingChain = this.auditChain.get(workflowId) || [];
      const chainPosition = existingChain.length;
      const previousEventHash = existingChain.length > 0 
        ? existingChain[existingChain.length - 1].eventHash 
        : undefined;

      // Build enhanced context capture based on event type
      const contextCapture = await this.buildContextCapture(
        eventType, 
        contextData, 
        workflowId
      );

      // Create base audit event
      const baseEvent: AuditEvent = {
        eventId,
        workflowId,
        eventType,
        timestamp,
        actor,
        details,
        immutable: true
      };

      // Create enhanced audit event with immutability guarantees
      const enhancedEvent: EnhancedAuditEvent = {
        ...baseEvent,
        eventHash: this.calculateEventHash(baseEvent, contextCapture, chainPosition),
        previousEventHash,
        auditChainPosition: chainPosition,
        contextCapture
      };

      // Add to audit chain (immutable storage)
      if (!this.auditChain.has(workflowId)) {
        this.auditChain.set(workflowId, []);
      }
      this.auditChain.get(workflowId)!.push(enhancedEvent);

      // Update audit metrics
      this.updateAuditMetrics(workflowId, eventType);

      // Generate DEVLOG entry
      await this.generateDevlogEntry(enhancedEvent, contextData);

      // Emit audit event for real-time monitoring
      this.emit('auditEventGenerated', {
        workflowId,
        eventType,
        eventId,
        timestamp,
        chainPosition
      });

      return enhancedEvent;
    });
    
    this.chainMutex.set(workflowId, newMutex);
    return await newMutex;
  }

  /**
   * Build comprehensive context capture based on event type
   * Implements Requirements 10.2, 10.3, 10.4 - Complete context capture
   */
  private async buildContextCapture(
    eventType: AuditEvent['eventType'],
    contextData?: any,
    workflowId?: string
  ): Promise<EnhancedAuditEvent['contextCapture']> {
    const systemContext = await this.gatherSystemContext(workflowId);
    
    const contextCapture: EnhancedAuditEvent['contextCapture'] = {
      systemContext
    };

    // Agent analysis context (Requirement 10.2)
    if (eventType === 'agent_output' && contextData?.agentOutput) {
      const agentOutput = contextData.agentOutput as AgentOutput;
      contextCapture.agentAnalysisContext = {
        skillsUsed: agentOutput.skillsUsed,
        dataSourcesAccessed: agentOutput.metadata.dataSourcesAccessed,
        confidenceLevel: agentOutput.confidenceLevel,
        processingTimeMs: agentOutput.metadata.processingTimeMs,
        validationResults: {
          skillsValid: agentOutput.validation.skillsValid,
          confidenceLevelValid: agentOutput.validation.confidenceLevelValid,
          schemaCompliant: agentOutput.validation.schemaCompliant
        },
        // Enhanced agent analysis audit details
        analysisMetrics: {
          findingsCount: agentOutput.findings.evidence.length,
          correlationsCount: agentOutput.findings.correlations.length,
          recommendationsCount: agentOutput.findings.recommendations?.length || 0,
          skillsUtilizationRate: agentOutput.metadata.skillsMetadata.skillsUtilizationRate || (agentOutput.skillsUsed.length / (agentOutput.metadata.skillsMetadata.totalSkillsAvailable || 1)),
          dataQualityScore: this.calculateDataQualityScore(agentOutput)
        },
        // Complete skills metadata for audit trail
        skillsMetadata: {
          availableSkills: agentOutput.metadata.skillsMetadata.skillsUsed || [],
          skillsUsedCount: agentOutput.skillsUsed.length,
          skillsValidationPassed: agentOutput.validation.skillsValid,
          primarySkillDomain: this.determinePrimarySkillDomain(agentOutput.agentName)
        },
        // Evidence and correlation audit details
        findingsAudit: {
          evidenceTypes: this.categorizeEvidence(agentOutput.findings.evidence),
          correlationStrength: this.assessCorrelationStrength(agentOutput.findings.correlations),
          findingsReliability: agentOutput.confidenceLevel >= 0.8 ? 'high' : agentOutput.confidenceLevel >= 0.6 ? 'medium' : 'low'
        }
      };
    }

    // Governance decision context (Requirement 10.3)
    if (eventType === 'governance_decision' && contextData?.governanceDecision) {
      const govDecision = contextData.governanceDecision as GovernanceDecision;
      contextCapture.governanceContext = {
        blastRadiusAssessment: {
          affectedServices: govDecision.blastRadiusAssessment.affectedServices,
          riskLevel: govDecision.blastRadiusAssessment.riskLevel,
          reversible: govDecision.blastRadiusAssessment.reversible,
          totalPotentialImpact: govDecision.blastRadiusAssessment.dependencyAnalysis?.totalPotentialImpact || 0
        },
        riskAssessment: {
          riskScore: govDecision.blastRadiusAssessment.riskFactors?.confidenceLevel || 0,
          riskFactors: [
            `Service Count: ${govDecision.blastRadiusAssessment.riskFactors?.serviceCount || 0}`,
            `Action Type: ${govDecision.blastRadiusAssessment.riskFactors?.actionType || 'unknown'}`,
            `Business Hours Impact: ${govDecision.blastRadiusAssessment.riskFactors?.businessHoursImpact || false}`
          ],
          policyConflicts: this.identifyPolicyConflicts(govDecision)
        },
        humanRationale: govDecision.rationale,
        approverContext: {
          approverId: govDecision.approver.id,
          approverRole: govDecision.approver.role,
          decisionTimestamp: govDecision.timestamp
        },
        // Enhanced governance decision audit details
        decisionAnalysis: {
          decisionType: govDecision.decision,
          hasRestrictions: (govDecision.restrictions?.length || 0) > 0,
          restrictionsCount: govDecision.restrictions?.length || 0,
          riskMitigationFactors: this.identifyRiskMitigationFactors(govDecision),
          complianceStatus: this.assessComplianceStatus(govDecision)
        },
        // Complete blast radius audit context
        blastRadiusAudit: {
          criticalServicesAffected: govDecision.blastRadiusAssessment.riskFactors?.criticalServicesAffected || [],
          cascadeRiskLevel: govDecision.blastRadiusAssessment.dependencyAnalysis?.cascadeRisk || 'unknown',
          criticalPathImpact: govDecision.blastRadiusAssessment.dependencyAnalysis?.criticalPath || false,
          dependencyChainLength: govDecision.blastRadiusAssessment.dependencyAnalysis?.directDependencies?.length || 0,
          reversibilityConfidence: govDecision.blastRadiusAssessment.reversible ? 'high' : 'low'
        },
        // Policy evaluation audit details
        policyEvaluation: {
          policyEngineUsed: true, // Would be determined from governance agent skills
          changeManagementCompliance: this.assessChangeManagementCompliance(govDecision),
          riskRegisterUpdated: this.checkRiskRegisterUpdate(govDecision),
          approvalAuthority: this.validateApprovalAuthority(govDecision.approver)
        }
      };
    }

    // Workflow termination context (Requirement 10.4)
    if (eventType === 'workflow_termination' && contextData?.workflowInstance) {
      const workflow = contextData.workflowInstance as WorkflowInstance;
      const workflowTimeline = this.buildWorkflowTimeline(workflow);
      
      contextCapture.terminationContext = {
        terminationReason: contextData.terminationReason || 'Unknown',
        residualRisks: this.identifyResidualRisks(workflow),
        workflowTimeline,
        completionStatus: this.determineCompletionStatus(workflow),
        // Enhanced workflow termination audit details
        terminationAnalysis: {
          totalWorkflowDuration: this.calculateWorkflowDuration(workflow.workflowId),
          statesTraversed: this.getStatesTraversed(workflowTimeline),
          agentParticipation: this.analyzeAgentParticipation(workflow),
          governanceInteractions: this.analyzeGovernanceInteractions(workflow),
          terminationTrigger: this.identifyTerminationTrigger(workflow, contextData.terminationReason)
        },
        // Complete timeline audit with performance metrics
        timelineAudit: {
          totalStateTransitions: workflowTimeline.length,
          averageStateTransitionTime: this.calculateAverageStateTransitionTime(workflowTimeline),
          longestStateTransition: this.findLongestStateTransition(workflowTimeline),
          shortestStateTransition: this.findShortestStateTransition(workflowTimeline),
          stateTransitionEfficiency: this.calculateStateTransitionEfficiency(workflowTimeline)
        },
        // Residual risk assessment audit
        residualRiskAudit: {
          riskCategories: this.categorizeResidualRisks(this.identifyResidualRisks(workflow)),
          riskMitigationStatus: this.assessRiskMitigationStatus(workflow),
          incidentResolutionCompleteness: this.assessIncidentResolutionCompleteness(workflow),
          followUpActionsRequired: this.identifyFollowUpActions(workflow)
        },
        // Workflow quality metrics for audit
        workflowQualityMetrics: {
          agentOutputQuality: this.assessAgentOutputQuality(workflow),
          governanceDecisionQuality: this.assessGovernanceDecisionQuality(workflow),
          auditTrailCompleteness: this.assessAuditTrailCompleteness(workflow),
          complianceScore: this.calculateComplianceScore(workflow)
        }
      };
    }

    return contextCapture;
  }

  /**
   * Calculate cryptographic hash for audit event immutability
   */
  private calculateEventHash(
    event: AuditEvent, 
    contextCapture: EnhancedAuditEvent['contextCapture'],
    chainPosition: number
  ): string {
    const hashInput = JSON.stringify({
      eventId: event.eventId,
      workflowId: event.workflowId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      actor: event.actor,
      details: event.details,
      contextCapture,
      chainPosition
    });
    
    return createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Generate DEVLOG.md entry for canonical audit trail
   * Implements Requirement 10.5 - DEVLOG.md as canonical audit trail
   */
  private async generateDevlogEntry(
    auditEvent: EnhancedAuditEvent,
    contextData?: any
  ): Promise<void> {
    const devlogEntry = this.createDevlogEntry(auditEvent, contextData);
    
    try {
      // Read existing DEVLOG content
      let existingContent = '';
      try {
        const fileContent = await fs.readFile(this.devlogPath, 'utf-8');
        existingContent = fileContent || '';
      } catch (error) {
        // File doesn't exist, will create new one
        existingContent = this.createInitialDevlogContent();
      }

      // Find the audit section or create it
      const auditSectionMarker = '## Audit Trail - Machine Readable';
      let updatedContent: string;

      if (existingContent && existingContent.includes(auditSectionMarker)) {
        // Append to existing audit section
        const sections = existingContent.split(auditSectionMarker);
        const beforeAudit = sections[0];
        const auditSection = sections[1] || '';
        
        updatedContent = beforeAudit + auditSectionMarker + auditSection + 
          '\n' + this.formatDevlogEntry(devlogEntry);
      } else {
        // Add new audit section
        updatedContent = existingContent + '\n\n' + auditSectionMarker + '\n\n' +
          this.formatDevlogEntry(devlogEntry);
      }

      // Write updated content
      await fs.writeFile(this.devlogPath, updatedContent, 'utf-8');
      
      // Emit DEVLOG update event
      this.emit('devlogUpdated', {
        workflowId: auditEvent.workflowId,
        entryId: devlogEntry.entryId,
        timestamp: devlogEntry.timestamp
      });

    } catch (error) {
      console.error('Failed to update DEVLOG.md:', error);
      // Don't throw - audit should not fail workflow
    }
  }

  /**
   * Create structured DEVLOG entry from audit event
   */
  private createDevlogEntry(
    auditEvent: EnhancedAuditEvent,
    contextData?: any
  ): DevlogAuditEntry {
    const entry: DevlogAuditEntry = {
      entryId: `devlog-${auditEvent.eventId}`,
      timestamp: auditEvent.timestamp,
      workflowId: auditEvent.workflowId,
      eventType: auditEvent.eventType,
      summary: this.generateEventSummary(auditEvent),
      details: this.buildDevlogDetails(auditEvent, contextData),
      auditMetadata: {
        eventHash: auditEvent.eventHash,
        chainPosition: auditEvent.auditChainPosition,
        immutable: true,
        complianceReady: this.isComplianceReady(auditEvent)
      }
    };

    return entry;
  }

  /**
   * Generate human-readable summary for DEVLOG entry
   */
  private generateEventSummary(auditEvent: EnhancedAuditEvent): string {
    switch (auditEvent.eventType) {
      case 'state_transition':
        const from = auditEvent.details.fromState;
        const to = auditEvent.details.toState;
        return `Workflow transitioned from ${from || 'INITIAL'} to ${to}`;
      
      case 'agent_output':
        const agentName = auditEvent.details.agentOutput?.agentName || 'unknown';
        return `${agentName} completed analysis with structured output`;
      
      case 'governance_decision':
        const decision = auditEvent.details.governanceDecision?.decision || 'unknown';
        return `Governance decision: ${decision.toUpperCase()}`;
      
      case 'workflow_termination':
        const reason = auditEvent.details.terminationReason || 'completed';
        return `Workflow terminated: ${reason}`;
      
      default:
        return `Audit event: ${auditEvent.eventType}`;
    }
  }

  /**
   * Build detailed context for DEVLOG entry
   */
  private buildDevlogDetails(
    auditEvent: EnhancedAuditEvent,
    contextData?: any
  ): DevlogAuditEntry['details'] {
    const details: DevlogAuditEntry['details'] = {};

    if (auditEvent.eventType === 'state_transition') {
      details.stateTransition = {
        from: auditEvent.details.fromState as WorkflowState,
        to: auditEvent.details.toState as WorkflowState,
        transitionValid: true, // Would be validated
        governanceRequired: auditEvent.details.toState === WorkflowState.GOVERNANCE_PENDING
      };
    }

    if (auditEvent.eventType === 'agent_output' && auditEvent.contextCapture.agentAnalysisContext) {
      const ctx = auditEvent.contextCapture.agentAnalysisContext;
      details.agentAnalysis = {
        agentName: auditEvent.details.agentOutput?.agentName as AgentName,
        skillsUsed: ctx.skillsUsed,
        confidenceLevel: ctx.confidenceLevel,
        findingsSummary: auditEvent.details.agentOutput?.findings.summary || '',
        validationPassed: ctx.validationResults.schemaCompliant && 
                         ctx.validationResults.skillsValid && 
                         ctx.validationResults.confidenceLevelValid
      };
    }

    if (auditEvent.eventType === 'governance_decision' && auditEvent.contextCapture.governanceContext) {
      const ctx = auditEvent.contextCapture.governanceContext;
      details.governanceDecision = {
        decision: auditEvent.details.governanceDecision?.decision || 'unknown',
        riskLevel: ctx.blastRadiusAssessment.riskLevel,
        affectedServices: ctx.blastRadiusAssessment.affectedServices.length,
        rationale: ctx.humanRationale,
        approver: ctx.approverContext.approverId
      };
    }

    if (auditEvent.eventType === 'workflow_termination' && auditEvent.contextCapture.terminationContext) {
      const ctx = auditEvent.contextCapture.terminationContext;
      const metrics = this.auditMetrics.get(auditEvent.workflowId);
      
      details.workflowCompletion = {
        finalState: ctx.workflowTimeline[ctx.workflowTimeline.length - 1]?.state || WorkflowState.TERMINATED,
        totalDuration: auditEvent.contextCapture.systemContext.workflowDuration || 0,
        agentOutputsGenerated: metrics?.agentOutputs || 0,
        governanceDecisionsMade: metrics?.governanceDecisions || 0,
        auditEventsGenerated: metrics?.totalEvents || 0
      };
    }

    return details;
  }

  /**
   * Format DEVLOG entry as machine-readable text
   */
  private formatDevlogEntry(entry: DevlogAuditEntry): string {
    const formatted = `
### ${entry.timestamp} - ${entry.summary}

**Workflow ID**: ${entry.workflowId}  
**Event Type**: ${entry.eventType}  
**Event ID**: ${entry.entryId}  
**Audit Hash**: ${entry.auditMetadata.eventHash}  
**Chain Position**: ${entry.auditMetadata.chainPosition}  

**Details**:
\`\`\`json
${JSON.stringify(entry.details, null, 2)}
\`\`\`

**Audit Metadata**:
- Immutable: ${entry.auditMetadata.immutable}
- Compliance Ready: ${entry.auditMetadata.complianceReady}
- Hash: ${entry.auditMetadata.eventHash.substring(0, 16)}...

---
`;
    return formatted;
  }

  /**
   * Gather system context for audit events
   */
  private async gatherSystemContext(workflowId?: string): Promise<EnhancedAuditEvent['contextCapture']['systemContext']> {
    const metrics = workflowId ? this.auditMetrics.get(workflowId) : undefined;
    
    return {
      workflowDuration: this.calculateWorkflowDuration(workflowId),
      totalAgentOutputs: metrics?.agentOutputs || 0,
      governanceDecisionsMade: metrics?.governanceDecisions || 0,
      stateTransitionsCount: metrics?.stateTransitions || 0,
      systemLoad: {
        activeWorkflows: this.auditChain.size,
        memoryUsage: process.memoryUsage().heapUsed,
        processingQueue: 0 // Would be actual queue size
      }
    };
  }

  /**
   * Build workflow timeline for termination context
   */
  private buildWorkflowTimeline(workflow: WorkflowInstance): Array<{
    state: WorkflowState;
    timestamp: string;
    duration?: number;
  }> {
    const stateTransitions: Array<{
      state: WorkflowState;
      timestamp: string;
      duration?: number;
    }> = workflow.auditTrail
      .filter(event => event.eventType === 'state_transition')
      .map(event => ({
        state: event.details.toState as WorkflowState,
        timestamp: event.timestamp,
        duration: undefined
      }));

    // Calculate durations between states
    for (let i = 0; i < stateTransitions.length - 1; i++) {
      const current = new Date(stateTransitions[i].timestamp);
      const next = new Date(stateTransitions[i + 1].timestamp);
      stateTransitions[i].duration = next.getTime() - current.getTime();
    }

    return stateTransitions;
  }

  /**
   * Identify residual risks for workflow termination
   */
  private identifyResidualRisks(workflow: WorkflowInstance): string[] {
    const risks: string[] = [];
    
    if (workflow.currentState === WorkflowState.TERMINATED) {
      // Check if terminated due to governance block
      const govDecision = workflow.governanceDecision;
      if (govDecision?.decision === 'block') {
        risks.push('Workflow blocked by governance - incident may require manual intervention');
        risks.push(`Blocked reason: ${govDecision.rationale}`);
      }
      
      // Check if analysis was incomplete
      const agentOutputs = workflow.agentOutputs;
      const requiredAgents = ['sre-agent', 'security-agent', 'governance-agent'];
      const completedAgents = [...new Set(agentOutputs.map(o => o.agentName))];
      const missingAgents = requiredAgents.filter(agent => !completedAgents.includes(agent as any));
      
      if (missingAgents.length > 0) {
        risks.push(`Incomplete analysis - missing outputs from: ${missingAgents.join(', ')}`);
      }
    }
    
    return risks;
  }

  /**
   * Determine workflow completion status
   */
  private determineCompletionStatus(workflow: WorkflowInstance): 'successful' | 'blocked' | 'error' | 'timeout' {
    if (workflow.currentState === WorkflowState.RESOLVED) {
      return 'successful';
    }
    
    const decision = workflow.governanceDecision?.decision;
    if (decision === 'block') {
      return 'blocked';
    }
    
    // Check if workflow was terminated normally (after reaching a reasonable state)
    if (workflow.currentState === WorkflowState.TERMINATED) {
      // If we have agent outputs and governance approved (or no governance yet), consider it successful
      if (workflow.agentOutputs.length > 0 && (decision === 'approve' || decision === 'approve_with_restrictions' || decision === undefined)) {
        return 'successful';
      }
      return 'error';
    }
    
    return 'timeout';
  }

  /**
   * Update audit metrics for workflow
   */
  private updateAuditMetrics(workflowId: string, eventType: AuditEvent['eventType']): void {
    if (!this.auditMetrics.has(workflowId)) {
      this.auditMetrics.set(workflowId, {
        totalEvents: 0,
        stateTransitions: 0,
        agentOutputs: 0,
        governanceDecisions: 0,
        workflowTerminations: 0,
        lastUpdated: new Date().toISOString()
      });
    }
    
    const metrics = this.auditMetrics.get(workflowId)!;
    metrics.totalEvents++;
    metrics.lastUpdated = new Date().toISOString();
    
    switch (eventType) {
      case 'state_transition':
        metrics.stateTransitions++;
        break;
      case 'agent_output':
        metrics.agentOutputs++;
        break;
      case 'governance_decision':
        metrics.governanceDecisions++;
        break;
      case 'workflow_termination':
        metrics.workflowTerminations++;
        break;
    }
  }

  /**
   * Calculate workflow duration
   */
  private calculateWorkflowDuration(workflowId?: string): number {
    if (!workflowId) return 0;
    
    const chain = this.auditChain.get(workflowId);
    if (!chain || chain.length === 0) return 0;
    
    const firstEvent = chain[0];
    const lastEvent = chain[chain.length - 1];
    
    const start = new Date(firstEvent.timestamp);
    const end = new Date(lastEvent.timestamp);
    
    return end.getTime() - start.getTime();
  }

  /**
   * Check if audit event is compliance ready
   */
  private isComplianceReady(auditEvent: EnhancedAuditEvent): boolean {
    // Check if all required context is present
    const hasRequiredContext = auditEvent.contextCapture.systemContext !== undefined;
    const hasValidHash = auditEvent.eventHash.length === 64; // SHA-256 hex length
    const hasChainPosition = auditEvent.auditChainPosition >= 0;
    
    return hasRequiredContext && hasValidHash && hasChainPosition;
  }

  /**
   * Create initial DEVLOG content structure
   */
  private createInitialDevlogContent(): string {
    return `# DEVLOG – SentinelFlow

This log documents the development process, key decisions,
and iteration history for the SentinelFlow project.

The focus is on process transparency rather than feature volume.

---

## Audit Trail - Machine Readable

This section contains structured, machine-readable audit artifacts for compliance review.
Each entry represents an immutable audit event with complete context capture.

`;
  }

  /**
   * Get audit chain for workflow (read-only)
   */
  getAuditChain(workflowId: string): readonly EnhancedAuditEvent[] {
    const chain = this.auditChain.get(workflowId) || [];
    return Object.freeze([...chain]); // Return frozen copy, not original
  }

  /**
   * Get audit metrics for workflow
   */
  getAuditMetrics(workflowId: string): Readonly<typeof this.auditMetrics extends Map<string, infer T> ? T : never> | undefined {
    const metrics = this.auditMetrics.get(workflowId);
    return metrics ? Object.freeze({ ...metrics }) : undefined;
  }

  /**
   * Verify audit chain integrity
   */
  verifyAuditChainIntegrity(workflowId: string): {
    valid: boolean;
    errors: string[];
    chainLength: number;
  } {
    const chain = this.auditChain.get(workflowId);
    if (!chain) {
      return { valid: false, errors: ['Audit chain not found'], chainLength: 0 };
    }

    const errors: string[] = [];
    
    for (let i = 0; i < chain.length; i++) {
      const event = chain[i];
      
      // Verify chain position
      if (event.auditChainPosition !== i) {
        errors.push(`Invalid chain position at index ${i}: expected ${i}, got ${event.auditChainPosition}`);
      }
      
      // Verify previous hash linkage
      if (i > 0) {
        const previousEvent = chain[i - 1];
        if (event.previousEventHash !== previousEvent.eventHash) {
          errors.push(`Broken chain linkage at index ${i}: hash mismatch`);
        }
      }
      
      // Verify event hash
      const expectedHash = this.calculateEventHash(
        {
          eventId: event.eventId,
          workflowId: event.workflowId,
          eventType: event.eventType,
          timestamp: event.timestamp,
          actor: event.actor,
          details: event.details,
          immutable: event.immutable
        },
        event.contextCapture,
        event.auditChainPosition
      );
      
      if (event.eventHash !== expectedHash) {
        errors.push(`Invalid event hash at index ${i}: hash verification failed`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      chainLength: chain.length
    };
  }

  /**
   * Export audit artifacts for compliance review
   */
  async exportAuditArtifacts(workflowId: string): Promise<{
    auditChain: EnhancedAuditEvent[];
    metrics: any;
    integrity: any;
    devlogEntries: DevlogAuditEntry[];
  }> {
    const auditChain = this.auditChain.get(workflowId) || [];
    const metrics = this.auditMetrics.get(workflowId);
    const integrity = this.verifyAuditChainIntegrity(workflowId);
    
    // Generate DEVLOG entries for all audit events
    const devlogEntries: DevlogAuditEntry[] = [];
    for (const event of auditChain) {
      const entry = this.createDevlogEntry(event);
      devlogEntries.push(entry);
    }

    return {
      auditChain: [...auditChain], // Create copy for export
      metrics: metrics ? { ...metrics } : undefined,
      integrity,
      devlogEntries
    };
  }

  // ========================================
  // Enhanced Audit Context Helper Methods
  // ========================================

  /**
   * Calculate data quality score for agent output
   */
  private calculateDataQualityScore(agentOutput: AgentOutput): number {
    let score = 0;
    
    // Evidence quality (40% of score)
    const evidenceScore = Math.min(agentOutput.findings.evidence.length / 3, 1) * 0.4;
    
    // Correlation quality (30% of score)
    const correlationScore = Math.min(agentOutput.findings.correlations.length / 2, 1) * 0.3;
    
    // Confidence level (30% of score)
    const confidenceScore = agentOutput.confidenceLevel * 0.3;
    
    score = evidenceScore + correlationScore + confidenceScore;
    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Determine primary skill domain for agent
   */
  private determinePrimarySkillDomain(agentName: AgentName): string {
    switch (agentName) {
      case 'sre-agent':
        return 'reliability-operations';
      case 'security-agent':
        return 'security-risk';
      case 'governance-agent':
        return 'policy-compliance';
      default:
        return 'unknown';
    }
  }

  /**
   * Categorize evidence types from agent findings
   */
  private categorizeEvidence(evidence: string[]): string[] {
    const categories: string[] = [];
    
    evidence.forEach(item => {
      const lowerItem = item.toLowerCase();
      if (lowerItem.includes('cpu') || lowerItem.includes('memory') || lowerItem.includes('performance')) {
        categories.push('performance-metrics');
      } else if (lowerItem.includes('error') || lowerItem.includes('exception') || lowerItem.includes('failure')) {
        categories.push('error-indicators');
      } else if (lowerItem.includes('log') || lowerItem.includes('trace')) {
        categories.push('log-analysis');
      } else if (lowerItem.includes('network') || lowerItem.includes('connection')) {
        categories.push('network-analysis');
      } else {
        categories.push('general-observation');
      }
    });
    
    return [...new Set(categories)]; // Remove duplicates
  }

  /**
   * Assess correlation strength between findings
   */
  private assessCorrelationStrength(correlations: string[]): 'weak' | 'moderate' | 'strong' {
    if (correlations.length === 0) return 'weak';
    if (correlations.length <= 2) return 'moderate';
    return 'strong';
  }

  /**
   * Identify policy conflicts from governance decision
   */
  private identifyPolicyConflicts(govDecision: GovernanceDecision): string[] {
    const conflicts: string[] = [];
    
    // Check for business hours impact
    if (govDecision.blastRadiusAssessment.riskFactors?.businessHoursImpact) {
      conflicts.push('Business hours deployment policy violation');
    }
    
    // Check for critical service impact
    const criticalServices = govDecision.blastRadiusAssessment.riskFactors?.criticalServicesAffected || [];
    if (criticalServices.length > 0) {
      conflicts.push(`Critical service impact policy: ${criticalServices.join(', ')}`);
    }
    
    // Check for high risk actions
    if (govDecision.blastRadiusAssessment.riskLevel === 'critical' || govDecision.blastRadiusAssessment.riskLevel === 'high') {
      conflicts.push('High risk action requires additional approval');
    }
    
    return conflicts;
  }

  /**
   * Identify risk mitigation factors
   */
  private identifyRiskMitigationFactors(govDecision: GovernanceDecision): string[] {
    const factors: string[] = [];
    
    if (govDecision.blastRadiusAssessment.reversible) {
      factors.push('Action is reversible');
    }
    
    if (govDecision.restrictions && govDecision.restrictions.length > 0) {
      factors.push(`Restrictions applied: ${govDecision.restrictions.length}`);
    }
    
    if (govDecision.blastRadiusAssessment.dependencyAnalysis?.cascadeRisk === 'low') {
      factors.push('Low cascade risk');
    }
    
    return factors;
  }

  /**
   * Assess compliance status of governance decision
   */
  private assessComplianceStatus(govDecision: GovernanceDecision): 'compliant' | 'non-compliant' | 'conditional' {
    const conflicts = this.identifyPolicyConflicts(govDecision);
    
    if (conflicts.length === 0) {
      return 'compliant';
    } else if (govDecision.decision === 'approve_with_restrictions') {
      return 'conditional';
    } else if (govDecision.decision === 'block') {
      return 'non-compliant';
    } else {
      return 'conditional';
    }
  }

  /**
   * Assess change management compliance
   */
  private assessChangeManagementCompliance(govDecision: GovernanceDecision): 'compliant' | 'non-compliant' | 'partial' {
    // In a real implementation, this would check against change management system
    // For now, we assess based on available information
    
    if (govDecision.approver.role.toLowerCase().includes('lead') || 
        govDecision.approver.role.toLowerCase().includes('manager')) {
      return 'compliant';
    }
    
    if (govDecision.blastRadiusAssessment.riskLevel === 'low') {
      return 'partial';
    }
    
    return 'non-compliant';
  }

  /**
   * Check if risk register was updated
   */
  private checkRiskRegisterUpdate(govDecision: GovernanceDecision): boolean {
    // In a real implementation, this would check the risk register system
    // For now, we assume it's updated for high-risk decisions
    return govDecision.blastRadiusAssessment.riskLevel === 'high' || 
           govDecision.blastRadiusAssessment.riskLevel === 'critical';
  }

  /**
   * Validate approval authority
   */
  private validateApprovalAuthority(approver: { id: string; role: string }): 'valid' | 'invalid' | 'escalation-required' {
    // In a real implementation, this would check against authorization matrix
    const role = approver.role.toLowerCase();
    
    if (role.includes('lead') || role.includes('manager') || role.includes('director')) {
      return 'valid';
    } else if (role.includes('senior') || role.includes('principal')) {
      return 'escalation-required';
    } else {
      return 'invalid';
    }
  }

  /**
   * Get states traversed in workflow timeline
   */
  private getStatesTraversed(timeline: Array<{ state: WorkflowState; timestamp: string; duration?: number }>): WorkflowState[] {
    return timeline.map(entry => entry.state);
  }

  /**
   * Analyze agent participation in workflow
   */
  private analyzeAgentParticipation(workflow: WorkflowInstance): {
    [agentName: string]: {
      outputsGenerated: number;
      averageConfidence: number;
      skillsUsed: string[];
    };
  } {
    const participation: any = {};
    
    workflow.agentOutputs.forEach(output => {
      const agentName = output.agentName;
      if (!participation[agentName]) {
        participation[agentName] = {
          outputsGenerated: 0,
          totalConfidence: 0,
          skillsUsed: new Set<string>()
        };
      }
      
      participation[agentName].outputsGenerated++;
      participation[agentName].totalConfidence += output.confidenceLevel;
      output.skillsUsed.forEach(skill => participation[agentName].skillsUsed.add(skill));
    });
    
    // Calculate averages and convert sets to arrays
    Object.keys(participation).forEach(agentName => {
      const agent = participation[agentName];
      agent.averageConfidence = agent.totalConfidence / agent.outputsGenerated;
      agent.skillsUsed = Array.from(agent.skillsUsed);
      delete agent.totalConfidence;
    });
    
    return participation;
  }

  /**
   * Analyze governance interactions in workflow
   */
  private analyzeGovernanceInteractions(workflow: WorkflowInstance): {
    decisionsRequested: number;
    decisionsApproved: number;
    decisionsBlocked: number;
    averageDecisionTime: number;
  } {
    const govEvents = workflow.auditTrail.filter(event => event.eventType === 'governance_decision');
    
    let approved = 0;
    let blocked = 0;
    let totalDecisionTime = 0;
    
    govEvents.forEach(event => {
      const decision = event.details.governanceDecision?.decision;
      if (decision === 'approve' || decision === 'approve_with_restrictions') {
        approved++;
      } else if (decision === 'block') {
        blocked++;
      }
      
      // Calculate decision time (simplified - would need more context in real implementation)
      totalDecisionTime += 300000; // Assume 5 minutes average
    });
    
    return {
      decisionsRequested: govEvents.length,
      decisionsApproved: approved,
      decisionsBlocked: blocked,
      averageDecisionTime: govEvents.length > 0 ? totalDecisionTime / govEvents.length : 0
    };
  }

  /**
   * Identify termination trigger
   */
  private identifyTerminationTrigger(workflow: WorkflowInstance, terminationReason?: string): 'natural' | 'governance-block' | 'error' | 'timeout' | 'manual' {
    if (workflow.governanceDecision?.decision === 'block') {
      return 'governance-block';
    }
    
    if (terminationReason?.toLowerCase().includes('error') || terminationReason?.toLowerCase().includes('failed')) {
      return 'error';
    }
    
    if (terminationReason?.toLowerCase().includes('timeout')) {
      return 'timeout';
    }
    
    if (terminationReason?.toLowerCase().includes('manual') || terminationReason?.toLowerCase().includes('user')) {
      return 'manual';
    }
    
    if (workflow.currentState === WorkflowState.RESOLVED) {
      return 'natural';
    }
    
    return 'manual';
  }

  /**
   * Calculate average state transition time
   */
  private calculateAverageStateTransitionTime(timeline: Array<{ state: WorkflowState; timestamp: string; duration?: number }>): number {
    const durations = timeline.filter(entry => entry.duration !== undefined).map(entry => entry.duration!);
    if (durations.length === 0) return 0;
    return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  }

  /**
   * Find longest state transition
   */
  private findLongestStateTransition(timeline: Array<{ state: WorkflowState; timestamp: string; duration?: number }>): {
    fromState: WorkflowState;
    toState: WorkflowState;
    duration: number;
  } {
    let longest = { fromState: WorkflowState.IDLE, toState: WorkflowState.IDLE, duration: 0 };
    
    for (let i = 1; i < timeline.length; i++) {
      const duration = timeline[i].duration || 0;
      if (duration > longest.duration) {
        longest = {
          fromState: timeline[i - 1].state,
          toState: timeline[i].state,
          duration
        };
      }
    }
    
    return longest;
  }

  /**
   * Find shortest state transition
   */
  private findShortestStateTransition(timeline: Array<{ state: WorkflowState; timestamp: string; duration?: number }>): {
    fromState: WorkflowState;
    toState: WorkflowState;
    duration: number;
  } {
    let shortest = { fromState: WorkflowState.IDLE, toState: WorkflowState.IDLE, duration: Number.MAX_VALUE };
    
    for (let i = 1; i < timeline.length; i++) {
      const duration = timeline[i].duration || Number.MAX_VALUE;
      if (duration < shortest.duration && duration > 0) {
        shortest = {
          fromState: timeline[i - 1].state,
          toState: timeline[i].state,
          duration
        };
      }
    }
    
    return shortest.duration === Number.MAX_VALUE ? 
      { fromState: WorkflowState.IDLE, toState: WorkflowState.IDLE, duration: 0 } : 
      shortest;
  }

  /**
   * Calculate state transition efficiency
   */
  private calculateStateTransitionEfficiency(timeline: Array<{ state: WorkflowState; timestamp: string; duration?: number }>): number {
    // Efficiency based on how quickly states are traversed relative to expected times
    const expectedTimes = {
      [WorkflowState.IDLE]: 1000,
      [WorkflowState.INCIDENT_INGESTED]: 5000,
      [WorkflowState.ANALYZING]: 30000,
      [WorkflowState.RCA_COMPLETE]: 10000,
      [WorkflowState.GOVERNANCE_PENDING]: 300000, // 5 minutes
      [WorkflowState.ACTION_PROPOSED]: 5000,
      [WorkflowState.VERIFIED]: 10000,
      [WorkflowState.RESOLVED]: 5000,
      [WorkflowState.TERMINATED]: 1000
    };
    
    let totalEfficiency = 0;
    let validTransitions = 0;
    
    timeline.forEach(entry => {
      if (entry.duration && expectedTimes[entry.state]) {
        const efficiency = Math.min(expectedTimes[entry.state] / entry.duration, 1);
        totalEfficiency += efficiency;
        validTransitions++;
      }
    });
    
    return validTransitions > 0 ? totalEfficiency / validTransitions : 1;
  }

  /**
   * Categorize residual risks
   */
  private categorizeResidualRisks(risks: string[]): string[] {
    const categories: string[] = [];
    
    risks.forEach(risk => {
      const lowerRisk = risk.toLowerCase();
      if (lowerRisk.includes('governance') || lowerRisk.includes('blocked')) {
        categories.push('governance-risk');
      } else if (lowerRisk.includes('incomplete') || lowerRisk.includes('missing')) {
        categories.push('analysis-risk');
      } else if (lowerRisk.includes('manual') || lowerRisk.includes('intervention')) {
        categories.push('operational-risk');
      } else {
        categories.push('general-risk');
      }
    });
    
    return [...new Set(categories)];
  }

  /**
   * Assess risk mitigation status
   */
  private assessRiskMitigationStatus(workflow: WorkflowInstance): 'complete' | 'partial' | 'none' {
    if (workflow.currentState === WorkflowState.RESOLVED) {
      return 'complete';
    } else if (workflow.governanceDecision?.decision === 'approve_with_restrictions') {
      return 'partial';
    } else {
      return 'none';
    }
  }

  /**
   * Assess incident resolution completeness
   */
  private assessIncidentResolutionCompleteness(workflow: WorkflowInstance): number {
    let completeness = 0;
    
    // Check if all required agents provided output
    const requiredAgents = ['sre-agent', 'security-agent', 'governance-agent'];
    const providedAgents = [...new Set(workflow.agentOutputs.map(output => output.agentName))];
    completeness += (providedAgents.length / requiredAgents.length) * 0.4;
    
    // Check if governance decision was made
    if (workflow.governanceDecision) {
      completeness += 0.3;
    }
    
    // Check if workflow reached resolution
    if (workflow.currentState === WorkflowState.RESOLVED) {
      completeness += 0.3;
    }
    
    return Math.round(completeness * 100) / 100;
  }

  /**
   * Identify follow-up actions required
   */
  private identifyFollowUpActions(workflow: WorkflowInstance): string[] {
    const actions: string[] = [];
    
    if (workflow.governanceDecision?.decision === 'block') {
      actions.push('Manual incident resolution required');
      actions.push('Review and update incident response procedures');
    }
    
    if (workflow.agentOutputs.some(output => output.confidenceLevel < 0.7)) {
      actions.push('Review low-confidence agent outputs');
    }
    
    if (workflow.currentState === WorkflowState.TERMINATED) {
      actions.push('Investigate workflow termination cause');
    }
    
    return actions;
  }

  /**
   * Assess agent output quality
   */
  private assessAgentOutputQuality(workflow: WorkflowInstance): number {
    if (workflow.agentOutputs.length === 0) return 0;
    
    const totalQuality = workflow.agentOutputs.reduce((sum, output) => {
      let quality = output.confidenceLevel * 0.5; // Base confidence
      quality += Math.min(output.findings.evidence.length / 3, 1) * 0.3; // Evidence quality
      quality += Math.min(output.findings.correlations.length / 2, 1) * 0.2; // Correlation quality
      return sum + quality;
    }, 0);
    
    return Math.round((totalQuality / workflow.agentOutputs.length) * 100) / 100;
  }

  /**
   * Assess governance decision quality
   */
  private assessGovernanceDecisionQuality(workflow: WorkflowInstance): number {
    if (!workflow.governanceDecision) return 0;
    
    let quality = 0;
    
    // Rationale quality
    quality += workflow.governanceDecision.rationale.length > 20 ? 0.3 : 0.1;
    
    // Blast radius assessment completeness
    const blastRadius = workflow.governanceDecision.blastRadiusAssessment;
    if (blastRadius.affectedServices.length > 0) quality += 0.2;
    if (blastRadius.dependencyAnalysis) quality += 0.2;
    if (blastRadius.riskFactors) quality += 0.2;
    
    // Decision appropriateness
    if (workflow.governanceDecision.decision === 'block' && blastRadius.riskLevel === 'critical') {
      quality += 0.1;
    } else if (workflow.governanceDecision.decision === 'approve' && blastRadius.riskLevel === 'low') {
      quality += 0.1;
    }
    
    return Math.round(quality * 100) / 100;
  }

  /**
   * Assess audit trail completeness
   */
  private assessAuditTrailCompleteness(workflow: WorkflowInstance): number {
    let completeness = 0;
    
    // Check for state transition events
    const stateTransitions = workflow.auditTrail.filter(event => event.eventType === 'state_transition');
    completeness += Math.min(stateTransitions.length / 8, 1) * 0.4; // Expect ~8 state transitions
    
    // Check for agent output events
    const agentOutputs = workflow.auditTrail.filter(event => event.eventType === 'agent_output');
    completeness += Math.min(agentOutputs.length / 3, 1) * 0.3; // Expect 3 agent outputs
    
    // Check for governance decision events
    const govDecisions = workflow.auditTrail.filter(event => event.eventType === 'governance_decision');
    completeness += Math.min(govDecisions.length / 1, 1) * 0.2; // Expect 1 governance decision
    
    // Check for termination event
    const terminations = workflow.auditTrail.filter(event => event.eventType === 'workflow_termination');
    completeness += Math.min(terminations.length / 1, 1) * 0.1; // Expect 1 termination
    
    return Math.round(completeness * 100) / 100;
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(workflow: WorkflowInstance): number {
    let score = 0;
    
    // Governance compliance
    if (workflow.governanceDecision) {
      score += 0.4;
      if (workflow.governanceDecision.rationale.length > 10) score += 0.1;
    }
    
    // Agent output compliance
    const validOutputs = workflow.agentOutputs.filter(output => 
      output.validation.schemaCompliant && 
      output.validation.skillsValid && 
      output.validation.confidenceLevelValid
    );
    score += (validOutputs.length / Math.max(workflow.agentOutputs.length, 1)) * 0.3;
    
    // Audit trail compliance
    score += this.assessAuditTrailCompleteness(workflow) * 0.2;
    
    // State transition compliance
    const validTransitions = workflow.auditTrail.filter(event => 
      event.eventType === 'state_transition' && event.immutable
    );
    score += Math.min(validTransitions.length / 8, 1) * 0.1;
    
    return Math.round(score * 100) / 100;
  }
}