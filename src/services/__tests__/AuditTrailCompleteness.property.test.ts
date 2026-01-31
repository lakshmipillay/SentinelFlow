/**
 * Property-Based Tests for Audit Trail Completeness
 * **Property 26: Comprehensive Audit Trail Generation**
 * **Validates: Requirements 10.2, 10.3, 10.4**
 * 
 * Tests that audit trails capture comprehensive context for all workflow events,
 * including agent analysis details, governance decision context, and termination information.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { AuditArtifactService } from '../AuditArtifactService';
import { WorkflowState, AgentOutput, GovernanceDecision } from '../../types/workflow';
import { AgentName } from '../../types/agent-skills';

describe('Property 26: Comprehensive Audit Trail Generation', () => {
  let stateManager: WorkflowStateManager;
  let auditService: AuditArtifactService;

  beforeEach(() => {
    auditService = new AuditArtifactService();
    stateManager = new WorkflowStateManager(auditService);
  });

  /**
   * Simplified generators for property-based testing
   */
  const generateAgentName = (): fc.Arbitrary<AgentName> => {
    return fc.constantFrom('sre-agent', 'security-agent', 'governance-agent');
  };

  const generateAgentOutputForAgent = (agentName: AgentName): AgentOutput => {
    const agentOutputs: Record<AgentName, AgentOutput> = {
      'sre-agent': {
        agentName: 'sre-agent',
        skillsUsed: ['Datadog', 'CloudWatch'],
        findings: {
          summary: 'High CPU usage detected on production servers',
          evidence: ['CPU at 95%', 'Memory usage normal', 'Disk I/O elevated'],
          correlations: ['Spike correlates with deployment', 'Pattern matches previous incident'],
          recommendations: ['Scale horizontally', 'Investigate recent changes']
        },
        confidenceLevel: 0.85,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 1500,
          dataSourcesAccessed: ['Datadog', 'CloudWatch'],
          skillsMetadata: {
            agentName: 'sre-agent'
          }
        },
        validation: {
          skillsValid: true,
          confidenceLevelValid: true,
          schemaCompliant: true
        }
      },
      'security-agent': {
        agentName: 'security-agent',
        skillsUsed: ['Splunk SIEM', 'IAM Logs'],
        findings: {
          summary: 'Unusual authentication patterns detected',
          evidence: ['Multiple failed login attempts', 'Access from new location', 'Suspicious user agent'],
          correlations: ['Pattern matches known attack signature', 'Correlates with security alert'],
          recommendations: ['Review access logs', 'Enable MFA', 'Block suspicious IPs']
        },
        confidenceLevel: 0.75,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 2000,
          dataSourcesAccessed: ['Splunk SIEM', 'IAM Logs'],
          skillsMetadata: {
            agentName: 'security-agent'
          }
        },
        validation: {
          skillsValid: true,
          confidenceLevelValid: true,
          schemaCompliant: true
        }
      },
      'governance-agent': {
        agentName: 'governance-agent',
        skillsUsed: ['Policy Engine', 'Change Management'],
        findings: {
          summary: 'Change management policy compliance check',
          evidence: ['Change window available', 'Approval authority verified', 'Risk assessment complete'],
          correlations: ['Aligns with maintenance schedule', 'Complies with change policy'],
          recommendations: ['Proceed with standard approval process']
        },
        confidenceLevel: 0.9,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 1000,
          dataSourcesAccessed: ['Policy Engine', 'Change Management'],
          skillsMetadata: {
            agentName: 'governance-agent'
          }
        },
        validation: {
          skillsValid: true,
          confidenceLevelValid: true,
          schemaCompliant: true
        }
      }
    };
    
    return agentOutputs[agentName];
  };

  const generateGovernanceDecision = (decision: 'approve' | 'approve_with_restrictions' | 'block'): GovernanceDecision => {
    return {
      decision,
      rationale: `Decision rationale for ${decision}: Based on comprehensive risk assessment and policy evaluation`,
      approver: {
        id: 'approver-123',
        role: 'Engineering Lead'
      },
      timestamp: new Date().toISOString(),
      restrictions: decision === 'approve_with_restrictions' ? ['Monitor closely', 'Rollback plan required'] : undefined,
      blastRadiusAssessment: {
        affectedServices: ['api-gateway', 'user-service', 'database'],
        riskLevel: decision === 'block' ? 'critical' : decision === 'approve_with_restrictions' ? 'high' : 'medium',
        reversible: decision !== 'block',
        dependencyAnalysis: {
          directDependencies: ['api-gateway', 'user-service'],
          cascadeRisk: decision === 'block' ? 'high' : 'medium',
          criticalPath: decision === 'block',
          totalPotentialImpact: decision === 'block' ? 10 : 5
        },
        riskFactors: {
          confidenceLevel: 0.85,
          serviceCount: 3,
          actionType: 'deployment',
          businessHoursImpact: true,
          criticalServicesAffected: decision === 'block' ? ['database'] : []
        }
      }
    };
  };

  /**
   * Property Tests for Requirement 10.2: Agent Analysis Audit Details
   */
  test('Agent analysis audit events capture complete context including skills, confidence, and validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateAgentName(),
        async (agentName) => {
          // Create workflow and transition to ANALYZING state
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Generate and add agent output
          const agentOutput = generateAgentOutputForAgent(agentName);
          await stateManager.addAgentOutput(workflowId, agentOutput);
          
          // Get audit chain
          const auditChain = stateManager.getAuditChain(workflowId);
          
          // Find agent output audit event
          const agentOutputEvent = auditChain.find(event => 
            event.eventType === 'agent_output' && 
            event.details.agentOutput?.agentName === agentName
          );
          
          expect(agentOutputEvent).toBeDefined();
          
          // Verify agent analysis context is captured (Requirement 10.2)
          const agentContext = agentOutputEvent!.contextCapture.agentAnalysisContext;
          expect(agentContext).toBeDefined();
          
          // Verify skills used are captured
          expect(agentContext!.skillsUsed).toEqual(agentOutput.skillsUsed);
          expect(agentContext!.skillsUsed.length).toBeGreaterThan(0);
          
          // Verify data sources accessed are captured
          expect(agentContext!.dataSourcesAccessed).toEqual(agentOutput.metadata.dataSourcesAccessed);
          expect(agentContext!.dataSourcesAccessed.length).toBeGreaterThan(0);
          
          // Verify confidence level is captured
          expect(agentContext!.confidenceLevel).toBe(agentOutput.confidenceLevel);
          expect(agentContext!.confidenceLevel).toBeGreaterThanOrEqual(0);
          expect(agentContext!.confidenceLevel).toBeLessThanOrEqual(1);
          
          // Verify processing time is captured
          expect(agentContext!.processingTimeMs).toBe(agentOutput.metadata.processingTimeMs);
          expect(agentContext!.processingTimeMs).toBeGreaterThan(0);
          
          // Verify validation results are captured
          expect(agentContext!.validationResults).toBeDefined();
          expect(agentContext!.validationResults.skillsValid).toBe(true);
          expect(agentContext!.validationResults.confidenceLevelValid).toBe(true);
          expect(agentContext!.validationResults.schemaCompliant).toBe(true);
          
          // Verify enhanced analysis metrics are captured
          expect(agentContext!.analysisMetrics).toBeDefined();
          expect(agentContext!.analysisMetrics.findingsCount).toBe(agentOutput.findings.evidence.length);
          expect(agentContext!.analysisMetrics.correlationsCount).toBe(agentOutput.findings.correlations.length);
          expect(agentContext!.analysisMetrics.dataQualityScore).toBeGreaterThanOrEqual(0);
          expect(agentContext!.analysisMetrics.dataQualityScore).toBeLessThanOrEqual(1);
          
          // Verify skills metadata is captured
          expect(agentContext!.skillsMetadata).toBeDefined();
          expect(agentContext!.skillsMetadata.skillsUsedCount).toBe(agentOutput.skillsUsed.length);
          expect(agentContext!.skillsMetadata.skillsValidationPassed).toBe(true);
          expect(agentContext!.skillsMetadata.primarySkillDomain).toBeDefined();
          
          // Verify findings audit is captured
          expect(agentContext!.findingsAudit).toBeDefined();
          expect(agentContext!.findingsAudit.evidenceTypes).toBeDefined();
          expect(agentContext!.findingsAudit.evidenceTypes.length).toBeGreaterThan(0);
          expect(agentContext!.findingsAudit.correlationStrength).toMatch(/^(weak|moderate|strong)$/);
          expect(agentContext!.findingsAudit.findingsReliability).toMatch(/^(low|medium|high)$/);
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property Tests for Requirement 10.3: Governance Decision Audit Records
   */
  test('Governance decision audit events capture complete context including blast radius and policy evaluation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('approve', 'approve_with_restrictions', 'block'),
        async (decisionType) => {
          // Create workflow and transition to GOVERNANCE_PENDING state
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
          await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
          
          // Generate and add governance decision
          const govDecision = generateGovernanceDecision(decisionType as any);
          await stateManager.addGovernanceDecision(workflowId, govDecision);
          
          // Get audit chain
          const auditChain = stateManager.getAuditChain(workflowId);
          
          // Find governance decision audit event
          const govEvent = auditChain.find(event => 
            event.eventType === 'governance_decision'
          );
          
          expect(govEvent).toBeDefined();
          
          // Verify governance context is captured (Requirement 10.3)
          const govContext = govEvent!.contextCapture.governanceContext;
          expect(govContext).toBeDefined();
          
          // Verify blast radius assessment is captured
          expect(govContext!.blastRadiusAssessment).toBeDefined();
          expect(govContext!.blastRadiusAssessment.affectedServices).toEqual(govDecision.blastRadiusAssessment.affectedServices);
          expect(govContext!.blastRadiusAssessment.affectedServices.length).toBeGreaterThan(0);
          expect(govContext!.blastRadiusAssessment.riskLevel).toBe(govDecision.blastRadiusAssessment.riskLevel);
          expect(govContext!.blastRadiusAssessment.reversible).toBe(govDecision.blastRadiusAssessment.reversible);
          expect(govContext!.blastRadiusAssessment.totalPotentialImpact).toBeGreaterThan(0);
          
          // Verify risk assessment is captured
          expect(govContext!.riskAssessment).toBeDefined();
          expect(govContext!.riskAssessment.riskScore).toBeGreaterThanOrEqual(0);
          expect(govContext!.riskAssessment.riskFactors).toBeDefined();
          expect(govContext!.riskAssessment.riskFactors.length).toBeGreaterThan(0);
          expect(govContext!.riskAssessment.policyConflicts).toBeDefined();
          
          // Verify human rationale is captured
          expect(govContext!.humanRationale).toBe(govDecision.rationale);
          expect(govContext!.humanRationale.length).toBeGreaterThan(0);
          
          // Verify approver context is captured
          expect(govContext!.approverContext).toBeDefined();
          expect(govContext!.approverContext.approverId).toBe(govDecision.approver.id);
          expect(govContext!.approverContext.approverRole).toBe(govDecision.approver.role);
          expect(govContext!.approverContext.decisionTimestamp).toBe(govDecision.timestamp);
          
          // Verify enhanced decision analysis is captured
          expect(govContext!.decisionAnalysis).toBeDefined();
          expect(govContext!.decisionAnalysis.decisionType).toBe(decisionType);
          expect(govContext!.decisionAnalysis.hasRestrictions).toBe(decisionType === 'approve_with_restrictions');
          expect(govContext!.decisionAnalysis.complianceStatus).toMatch(/^(compliant|non-compliant|conditional)$/);
          
          // Verify blast radius audit is captured
          expect(govContext!.blastRadiusAudit).toBeDefined();
          expect(govContext!.blastRadiusAudit.criticalServicesAffected).toBeDefined();
          expect(govContext!.blastRadiusAudit.cascadeRiskLevel).toBeDefined();
          expect(govContext!.blastRadiusAudit.criticalPathImpact).toBeDefined();
          expect(govContext!.blastRadiusAudit.dependencyChainLength).toBeGreaterThanOrEqual(0);
          expect(govContext!.blastRadiusAudit.reversibilityConfidence).toMatch(/^(low|medium|high)$/);
          
          // Verify policy evaluation is captured
          expect(govContext!.policyEvaluation).toBeDefined();
          expect(govContext!.policyEvaluation.policyEngineUsed).toBe(true);
          expect(govContext!.policyEvaluation.changeManagementCompliance).toMatch(/^(compliant|non-compliant|partial)$/);
          expect(govContext!.policyEvaluation.riskRegisterUpdated).toBeDefined();
          expect(govContext!.policyEvaluation.approvalAuthority).toMatch(/^(valid|invalid|escalation-required)$/);
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property Tests for Requirement 10.4: Workflow Termination Audit Capture
   */
  test('Workflow termination audit events capture complete context including timeline and residual risks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'Workflow completed successfully',
          'Governance blocked action',
          'Manual termination requested',
          'Error during processing'
        ),
        async (terminationReason) => {
          // Create workflow and add some activity
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Add agent outputs for richer termination context
          const sreOutput = generateAgentOutputForAgent('sre-agent');
          await stateManager.addAgentOutput(workflowId, sreOutput);
          
          await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
          
          // Terminate workflow
          await stateManager.terminateWorkflow(workflowId, terminationReason);
          
          // Get audit chain
          const auditChain = stateManager.getAuditChain(workflowId);
          
          // Find termination audit event
          const terminationEvent = auditChain.find(event => 
            event.eventType === 'workflow_termination'
          );
          
          expect(terminationEvent).toBeDefined();
          
          // Verify termination context is captured (Requirement 10.4)
          const termContext = terminationEvent!.contextCapture.terminationContext;
          expect(termContext).toBeDefined();
          
          // Verify termination reason is captured
          expect(termContext!.terminationReason).toBe(terminationReason);
          
          // Verify residual risks are captured
          expect(termContext!.residualRisks).toBeDefined();
          expect(Array.isArray(termContext!.residualRisks)).toBe(true);
          
          // Verify workflow timeline is captured
          expect(termContext!.workflowTimeline).toBeDefined();
          expect(Array.isArray(termContext!.workflowTimeline)).toBe(true);
          expect(termContext!.workflowTimeline.length).toBeGreaterThan(0);
          
          // Verify timeline entries have required fields
          termContext!.workflowTimeline.forEach(entry => {
            expect(entry.state).toBeDefined();
            expect(entry.timestamp).toBeDefined();
          });
          
          // Verify completion status is captured
          expect(termContext!.completionStatus).toMatch(/^(successful|blocked|error|timeout)$/);
          
          // Verify enhanced termination analysis is captured
          expect(termContext!.terminationAnalysis).toBeDefined();
          expect(termContext!.terminationAnalysis.totalWorkflowDuration).toBeGreaterThanOrEqual(0);
          expect(termContext!.terminationAnalysis.statesTraversed).toBeDefined();
          expect(termContext!.terminationAnalysis.statesTraversed.length).toBeGreaterThan(0);
          expect(termContext!.terminationAnalysis.agentParticipation).toBeDefined();
          expect(termContext!.terminationAnalysis.governanceInteractions).toBeDefined();
          expect(termContext!.terminationAnalysis.terminationTrigger).toMatch(/^(natural|governance-block|error|timeout|manual)$/);
          
          // Verify timeline audit is captured
          expect(termContext!.timelineAudit).toBeDefined();
          expect(termContext!.timelineAudit.totalStateTransitions).toBeGreaterThan(0);
          expect(termContext!.timelineAudit.averageStateTransitionTime).toBeGreaterThanOrEqual(0);
          expect(termContext!.timelineAudit.longestStateTransition).toBeDefined();
          expect(termContext!.timelineAudit.shortestStateTransition).toBeDefined();
          expect(termContext!.timelineAudit.stateTransitionEfficiency).toBeGreaterThanOrEqual(0);
          expect(termContext!.timelineAudit.stateTransitionEfficiency).toBeLessThanOrEqual(1);
          
          // Verify residual risk audit is captured
          expect(termContext!.residualRiskAudit).toBeDefined();
          expect(termContext!.residualRiskAudit.riskCategories).toBeDefined();
          expect(termContext!.residualRiskAudit.riskMitigationStatus).toMatch(/^(complete|partial|none)$/);
          expect(termContext!.residualRiskAudit.incidentResolutionCompleteness).toBeGreaterThanOrEqual(0);
          expect(termContext!.residualRiskAudit.incidentResolutionCompleteness).toBeLessThanOrEqual(1);
          expect(termContext!.residualRiskAudit.followUpActionsRequired).toBeDefined();
          
          // Verify workflow quality metrics are captured
          expect(termContext!.workflowQualityMetrics).toBeDefined();
          expect(termContext!.workflowQualityMetrics.agentOutputQuality).toBeGreaterThanOrEqual(0);
          expect(termContext!.workflowQualityMetrics.agentOutputQuality).toBeLessThanOrEqual(1);
          expect(termContext!.workflowQualityMetrics.governanceDecisionQuality).toBeGreaterThanOrEqual(0);
          expect(termContext!.workflowQualityMetrics.governanceDecisionQuality).toBeLessThanOrEqual(1);
          expect(termContext!.workflowQualityMetrics.auditTrailCompleteness).toBeGreaterThanOrEqual(0);
          expect(termContext!.workflowQualityMetrics.auditTrailCompleteness).toBeLessThanOrEqual(1);
          expect(termContext!.workflowQualityMetrics.complianceScore).toBeGreaterThanOrEqual(0);
          expect(termContext!.workflowQualityMetrics.complianceScore).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Comprehensive test: All event types capture system context
   */
  test('All audit events capture system context including workflow metrics', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateAgentName(),
        async (agentName) => {
          // Create workflow with multiple events
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          
          // Transition through states
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Add agent output
          const agentOutput = generateAgentOutputForAgent(agentName);
          await stateManager.addAgentOutput(workflowId, agentOutput);
          
          // Get audit chain
          const auditChain = stateManager.getAuditChain(workflowId);
          
          // Verify all events have system context
          expect(auditChain.length).toBeGreaterThan(0);
          
          auditChain.forEach(event => {
            expect(event.contextCapture.systemContext).toBeDefined();
            
            // Verify system context fields
            expect(event.contextCapture.systemContext.totalAgentOutputs).toBeGreaterThanOrEqual(0);
            expect(event.contextCapture.systemContext.governanceDecisionsMade).toBeGreaterThanOrEqual(0);
            expect(event.contextCapture.systemContext.stateTransitionsCount).toBeGreaterThanOrEqual(0);
            
            // Verify system load information
            expect(event.contextCapture.systemContext.systemLoad).toBeDefined();
            expect(event.contextCapture.systemContext.systemLoad!.activeWorkflows).toBeGreaterThanOrEqual(0);
          });
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Integration test: Complete workflow captures all context types
   */
  test('Complete workflow lifecycle captures agent analysis, governance, and termination context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('approve', 'block'),
        async (decisionType) => {
          // Create workflow
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          
          // Transition through states
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Add all agent outputs
          const sreOutput = generateAgentOutputForAgent('sre-agent');
          const securityOutput = generateAgentOutputForAgent('security-agent');
          const govOutput = generateAgentOutputForAgent('governance-agent');
          
          await stateManager.addAgentOutput(workflowId, sreOutput);
          await stateManager.addAgentOutput(workflowId, securityOutput);
          await stateManager.addAgentOutput(workflowId, govOutput);
          
          // Continue workflow
          await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
          await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
          
          // Add governance decision
          const govDecision = generateGovernanceDecision(decisionType as any);
          await stateManager.addGovernanceDecision(workflowId, govDecision);
          
          // Terminate workflow
          const terminationReason = decisionType === 'block' ? 'Governance blocked action' : 'Workflow completed';
          await stateManager.terminateWorkflow(workflowId, terminationReason);
          
          // Get audit chain
          const auditChain = stateManager.getAuditChain(workflowId);
          
          // Verify we have all event types
          const eventTypes = new Set(auditChain.map(event => event.eventType));
          expect(eventTypes.has('state_transition')).toBe(true);
          expect(eventTypes.has('agent_output')).toBe(true);
          expect(eventTypes.has('governance_decision')).toBe(true);
          expect(eventTypes.has('workflow_termination')).toBe(true);
          
          // Verify agent analysis context is present
          const agentEvents = auditChain.filter(event => event.eventType === 'agent_output');
          expect(agentEvents.length).toBe(3); // All three agents
          
          agentEvents.forEach(event => {
            expect(event.contextCapture.agentAnalysisContext).toBeDefined();
            expect(event.contextCapture.agentAnalysisContext!.skillsUsed.length).toBeGreaterThan(0);
            expect(event.contextCapture.agentAnalysisContext!.confidenceLevel).toBeGreaterThan(0);
          });
          
          // Verify governance context is present
          const govEvents = auditChain.filter(event => event.eventType === 'governance_decision');
          expect(govEvents.length).toBe(1);
          expect(govEvents[0].contextCapture.governanceContext).toBeDefined();
          expect(govEvents[0].contextCapture.governanceContext!.blastRadiusAssessment).toBeDefined();
          expect(govEvents[0].contextCapture.governanceContext!.humanRationale).toBeDefined();
          
          // Verify termination context is present
          const termEvents = auditChain.filter(event => event.eventType === 'workflow_termination');
          expect(termEvents.length).toBe(1);
          expect(termEvents[0].contextCapture.terminationContext).toBeDefined();
          expect(termEvents[0].contextCapture.terminationContext!.workflowTimeline.length).toBeGreaterThan(0);
          expect(termEvents[0].contextCapture.terminationContext!.terminationAnalysis).toBeDefined();
          
          // Verify all events have system context
          auditChain.forEach(event => {
            expect(event.contextCapture.systemContext).toBeDefined();
          });
        }
      ),
      { numRuns: 20 }
    );
  }, 30000); // 30 second timeout for this comprehensive test
});
