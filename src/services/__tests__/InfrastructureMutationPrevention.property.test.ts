/**
 * Property-Based Tests for Infrastructure Mutation Prevention
 * **Property 28: Infrastructure Mutation Prevention**
 * **Validates: Requirements 11.1, 11.2, 11.5**
 * 
 * Tests that the system enforces safety constraints:
 * 1. No action can directly mutate infrastructure
 * 2. All remediation outputs are marked as proposals
 * 3. Safety constraints prevent execution of any real changes
 * 4. Demo mode maintains all safety constraints
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { AuditArtifactService } from '../AuditArtifactService';
import { GovernanceGateService } from '../GovernanceGateService';
import { OrchestratorService } from '../OrchestratorService';
import { WorkflowState, GovernanceDecision, AgentOutput } from '../../types/workflow';
import { AgentName } from '../../types/agent-skills';

describe('Property 28: Infrastructure Mutation Prevention', () => {
  let stateManager: WorkflowStateManager;
  let auditService: AuditArtifactService;
  let governanceGate: GovernanceGateService;
  let orchestratorService: OrchestratorService;

  beforeEach(async () => {
    auditService = new AuditArtifactService();
    stateManager = new WorkflowStateManager(auditService);
    governanceGate = new GovernanceGateService(stateManager);
    orchestratorService = new OrchestratorService(stateManager, governanceGate);
    
    // Initialize agent configurations from YAML files (or defaults)
    await orchestratorService.initialize();
  });

  /**
   * Simplified generators for property-based testing
   * Using fc.constantFrom() to avoid timeout issues
   */

  const generateAgentName = (): fc.Arbitrary<AgentName> => {
    return fc.constantFrom('sre-agent', 'security-agent', 'governance-agent');
  };

  const generateRemediationAction = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'Restart database connection pool',
      'Scale application instances horizontally',
      'Rollback to previous deployment version',
      'Reset affected user sessions',
      'Apply security patch to vulnerable service',
      'Modify firewall rules to block suspicious IPs',
      'Update DNS configuration for failover',
      'Restart Kubernetes pods in affected namespace',
      'Clear application cache and restart services',
      'Execute database migration rollback'
    );
  };

  const generateGovernanceDecisionType = (): fc.Arbitrary<'approve' | 'approve_with_restrictions' | 'block'> => {
    return fc.constantFrom('approve', 'approve_with_restrictions', 'block');
  };

  const generateIncidentContext = (): fc.Arbitrary<{
    incidentSummary: string;
    agentFindings: string[];
    correlationSummary: string;
    confidenceLevel: number;
  }> => {
    return fc.constantFrom(
      {
        incidentSummary: 'Database connection pool exhaustion causing timeouts',
        agentFindings: ['High connection count', 'Slow query performance', 'Memory pressure'],
        correlationSummary: 'Database overload correlates with recent traffic spike',
        confidenceLevel: 0.85
      },
      {
        incidentSummary: 'API gateway experiencing high latency',
        agentFindings: ['Increased response times', 'Backend service degradation', 'Load balancer issues'],
        correlationSummary: 'Latency spike correlates with deployment at 14:30',
        confidenceLevel: 0.75
      },
      {
        incidentSummary: 'Security breach detected in authentication service',
        agentFindings: ['Unusual login patterns', 'Failed auth attempts', 'Suspicious IP addresses'],
        correlationSummary: 'Attack pattern matches known credential stuffing',
        confidenceLevel: 0.90
      }
    );
  };

  const generateAgentOutput = (agentName: AgentName): AgentOutput => {
    const agentOutputs: Record<AgentName, AgentOutput> = {
      'sre-agent': {
        agentName: 'sre-agent',
        skillsUsed: ['Datadog', 'CloudWatch'],
        findings: {
          summary: 'High CPU usage detected on production servers',
          evidence: ['CPU at 95%', 'Memory usage elevated', 'Disk I/O high'],
          correlations: ['Spike correlates with deployment'],
          recommendations: ['Scale horizontally', 'Investigate recent changes']
        },
        confidenceLevel: 0.85,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 1500,
          dataSourcesAccessed: ['Datadog', 'CloudWatch'],
          skillsMetadata: { agentName: 'sre-agent' }
        },
        validation: { skillsValid: true, confidenceLevelValid: true, schemaCompliant: true }
      },
      'security-agent': {
        agentName: 'security-agent',
        skillsUsed: ['Splunk SIEM', 'IAM Logs'],
        findings: {
          summary: 'Unusual authentication patterns detected',
          evidence: ['Multiple failed logins', 'Access from new location'],
          correlations: ['Pattern matches known attack signature'],
          recommendations: ['Review access logs', 'Enable MFA']
        },
        confidenceLevel: 0.75,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 2000,
          dataSourcesAccessed: ['Splunk SIEM', 'IAM Logs'],
          skillsMetadata: { agentName: 'security-agent' }
        },
        validation: { skillsValid: true, confidenceLevelValid: true, schemaCompliant: true }
      },
      'governance-agent': {
        agentName: 'governance-agent',
        skillsUsed: ['Policy Engine', 'Change Management'],
        findings: {
          summary: 'Change management policy compliance check',
          evidence: ['Change window available', 'Approval authority verified'],
          correlations: ['Aligns with maintenance schedule'],
          recommendations: ['Proceed with standard approval process']
        },
        confidenceLevel: 0.9,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 1000,
          dataSourcesAccessed: ['Policy Engine', 'Change Management'],
          skillsMetadata: { agentName: 'governance-agent' }
        },
        validation: { skillsValid: true, confidenceLevelValid: true, schemaCompliant: true }
      }
    };
    return agentOutputs[agentName];
  };


  /**
   * Property Test: Requirement 11.1 - No Direct Infrastructure Mutation
   * Validates that no system component can directly mutate infrastructure
   */
  test('No workflow state transition can trigger direct infrastructure mutation', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateAgentName(),
        generateRemediationAction(),
        async (agentName, remediationAction) => {
          // Create workflow and progress through states
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          
          // Track all state transitions
          const stateTransitions: WorkflowState[] = [workflow.currentState];
          
          // Progress through workflow states
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          stateTransitions.push(WorkflowState.INCIDENT_INGESTED);
          
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          stateTransitions.push(WorkflowState.ANALYZING);
          
          // Add agent output
          const agentOutput = generateAgentOutput(agentName);
          await stateManager.addAgentOutput(workflowId, agentOutput);
          
          await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
          stateTransitions.push(WorkflowState.RCA_COMPLETE);
          
          await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
          stateTransitions.push(WorkflowState.GOVERNANCE_PENDING);
          
          // Get the workflow after all transitions
          const finalWorkflow = stateManager.getWorkflow(workflowId);
          
          // PROPERTY: No state transition should have triggered infrastructure mutation
          // Verify by checking audit trail - no 'infrastructure_mutation' events should exist
          const auditTrail = finalWorkflow!.auditTrail;
          
          // Check that all audit events are analysis/coordination only
          auditTrail.forEach(event => {
            expect(event.eventType).not.toBe('infrastructure_mutation');
            expect(event.eventType).not.toBe('external_action');
            expect(event.eventType).not.toBe('system_modification');
            
            // Verify event types are only allowed types
            expect(['state_transition', 'agent_output', 'governance_decision', 'workflow_termination'])
              .toContain(event.eventType);
          });
          
          // PROPERTY: Workflow state should never indicate execution occurred
          expect(finalWorkflow!.currentState).not.toBe('EXECUTED');
          expect(finalWorkflow!.currentState).not.toBe('MUTATED');
          
          // Verify no execution flags in workflow
          expect((finalWorkflow as any).executionPerformed).toBeUndefined();
          expect((finalWorkflow as any).infrastructureMutated).toBeUndefined();
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Property Test: Requirement 11.2 - All Remediation Actions Are Proposals Only
   * Validates that governance decisions result in proposals, not executions
   */
  test('Governance approval results in proposal only, never execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateGovernanceDecisionType(),
        generateIncidentContext(),
        generateRemediationAction(),
        async (decisionType, incidentContext, remediationAction) => {
          // Create workflow and progress to governance pending
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Add agent outputs
          const sreOutput = generateAgentOutput('sre-agent');
          await stateManager.addAgentOutput(workflowId, sreOutput);
          
          await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
          await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
          
          // Create governance request
          const governanceRequest = await governanceGate.createGovernanceRequest(
            workflowId,
            remediationAction,
            incidentContext
          );
          
          // Process governance decision
          const result = await governanceGate.processGovernanceDecision(
            governanceRequest.requestId,
            decisionType,
            `Decision rationale for ${decisionType}: Based on risk assessment`,
            { id: 'approver-001', role: 'SRE Lead' },
            decisionType === 'approve_with_restrictions' ? ['Monitor closely'] : undefined
          );
          
          // PROPERTY: Regardless of decision type, no execution should occur
          expect(result.success).toBe(true);
          
          // Get updated workflow
          const updatedWorkflow = stateManager.getWorkflow(workflowId);
          
          // PROPERTY: Governance decision should be recorded but not executed
          if (decisionType === 'block') {
            // Block should terminate workflow, not execute anything
            expect(updatedWorkflow!.currentState).toBe(WorkflowState.TERMINATED);
            expect(result.workflowTerminated).toBe(true);
          } else {
            // Approve should move to ACTION_PROPOSED, not EXECUTED
            expect(updatedWorkflow!.currentState).toBe(WorkflowState.ACTION_PROPOSED);
          }
          
          // PROPERTY: Governance decision should be marked as proposal
          const govDecision = updatedWorkflow!.governanceDecision;
          expect(govDecision).toBeDefined();
          expect(govDecision!.decision).toBe(decisionType);
          
          // PROPERTY: No execution metadata should exist
          expect((govDecision as any).executed).toBeUndefined();
          expect((govDecision as any).executionResult).toBeUndefined();
          expect((govDecision as any).infrastructureChanged).toBeUndefined();
          
          // PROPERTY: Audit trail should show proposal, not execution
          const auditTrail = updatedWorkflow!.auditTrail;
          const govEvents = auditTrail.filter(e => e.eventType === 'governance_decision');
          
          govEvents.forEach(event => {
            expect(event.details.governanceDecision).toBeDefined();
            // No execution details should be present
            expect((event.details as any).executionPerformed).toBeUndefined();
            expect((event.details as any).infrastructureMutated).toBeUndefined();
          });
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Property Test: Requirement 11.5 - Safety Constraints Enforced Across All Components
   * Validates that orchestrator service maintains safety constraints
   */
  test('Orchestrator service never performs domain analysis or remediation', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateAgentName(),
        generateIncidentContext(),
        async (agentName, incidentContext) => {
          // Create workflow
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Coordinate parallel analysis through orchestrator
          const session = await orchestratorService.coordinateParallelAnalysis(
            workflowId,
            {
              incidentId: `incident-${Date.now()}`,
              description: incidentContext.incidentSummary,
              severity: 'high',
              affectedServices: ['api-gateway', 'database'],
              timestamp: new Date().toISOString(),
              source: 'test'
            }
          );
          
          // PROPERTY: Orchestrator should only coordinate, not analyze
          expect(session.sessionId).toBeDefined();
          expect(session.status).toBe('in-progress');
          
          // PROPERTY: Agent tasks should be created but orchestrator doesn't perform analysis
          expect(session.agentTasks.length).toBe(3); // SRE, Security, Governance
          
          session.agentTasks.forEach(task => {
            // Tasks should be pending or in-progress, orchestrator doesn't complete them
            expect(['pending', 'in-progress']).toContain(task.status);
            
            // Task context should define WHAT to analyze, not HOW
            expect(task.context.focus).toBeDefined();
            expect(task.context.focus).toMatch(/analysis$/); // Should end with 'analysis'
          });
          
          // PROPERTY: Orchestrator should not have produced any domain-specific output
          const orchestratorWorkflow = stateManager.getWorkflow(workflowId);
          
          // PROPERTY: Orchestrator coordination should not contain remediation execution
          const auditTrail = orchestratorWorkflow!.auditTrail;
          
          auditTrail.forEach(event => {
            // No event should indicate infrastructure mutation or remediation execution
            expect((event.details as any).remediationExecuted).toBeUndefined();
            expect((event.details as any).infrastructureAction).toBeUndefined();
            expect((event.details as any).commandExecuted).toBeUndefined();
            expect((event.details as any).systemMutated).toBeUndefined();
            
            // Event types should only be allowed coordination/analysis types
            expect(['state_transition', 'agent_output', 'governance_decision', 'workflow_termination'])
              .toContain(event.eventType);
          });
          
          // PROPERTY: Session tasks should define WHAT to analyze, not execution results
          session.agentTasks.forEach(task => {
            // Tasks should not have execution results
            expect((task as any).executionResult).toBeUndefined();
            expect((task as any).infrastructureChanged).toBeUndefined();
            expect((task as any).actionPerformed).toBeUndefined();
          });
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Property Test: Agent outputs are analysis-only, never execution commands
   * Validates that agent outputs contain findings and recommendations, not execution results
   */
  test('Agent outputs contain analysis findings only, never execution results', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateAgentName(),
        async (agentName) => {
          // Create workflow
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Add agent output
          const agentOutput = generateAgentOutput(agentName);
          await stateManager.addAgentOutput(workflowId, agentOutput);
          
          // Get workflow with agent output
          const updatedWorkflow = stateManager.getWorkflow(workflowId);
          const outputs = updatedWorkflow!.agentOutputs;
          
          // PROPERTY: Agent outputs should be analysis-only
          expect(outputs.length).toBeGreaterThan(0);
          
          outputs.forEach(output => {
            // Output should have findings structure
            expect(output.findings).toBeDefined();
            expect(output.findings.summary).toBeDefined();
            expect(output.findings.evidence).toBeDefined();
            expect(Array.isArray(output.findings.evidence)).toBe(true);
            
            // PROPERTY: No execution results in agent output
            expect((output as any).executionResult).toBeUndefined();
            expect((output as any).infrastructureChanged).toBeUndefined();
            expect((output as any).commandExecuted).toBeUndefined();
            expect((output as any).systemModified).toBeUndefined();
            
            // PROPERTY: Recommendations are suggestions, not executed actions
            if (output.findings.recommendations) {
              output.findings.recommendations.forEach(rec => {
                // Recommendations should be descriptive, not execution confirmations
                expect(rec).not.toMatch(/^Executed:/i);
                expect(rec).not.toMatch(/^Completed:/i);
                expect(rec).not.toMatch(/^Applied:/i);
                expect(rec).not.toMatch(/^Modified:/i);
              });
            }
            
            // PROPERTY: Skills used are for analysis, not execution
            output.skillsUsed.forEach(skill => {
              // Skills should be monitoring/analysis tools
              const analysisSkills = [
                'Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry',
                'Splunk SIEM', 'IAM Logs', 'CSPM',
                'Policy Engine', 'Change Management', 'Risk Register'
              ];
              expect(analysisSkills).toContain(skill);
            });
          });
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Property Test: Workflow termination never triggers cleanup actions
   * Validates that terminating a workflow doesn't execute any infrastructure changes
   */
  test('Workflow termination is audit-only, no infrastructure cleanup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'Governance blocked action',
          'Manual termination requested',
          'Workflow timeout exceeded',
          'Error during processing',
          'User cancelled workflow'
        ),
        async (terminationReason) => {
          // Create workflow with some activity
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Add agent output
          const agentOutput = generateAgentOutput('sre-agent');
          await stateManager.addAgentOutput(workflowId, agentOutput);
          
          await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
          
          // Terminate workflow
          await stateManager.terminateWorkflow(workflowId, terminationReason);
          
          // Get terminated workflow
          const terminatedWorkflow = stateManager.getWorkflow(workflowId);
          
          // PROPERTY: Workflow should be in TERMINATED state
          expect(terminatedWorkflow!.currentState).toBe(WorkflowState.TERMINATED);
          
          // PROPERTY: Termination should be recorded in audit trail
          const auditTrail = terminatedWorkflow!.auditTrail;
          const terminationEvent = auditTrail.find(e => e.eventType === 'workflow_termination');
          
          expect(terminationEvent).toBeDefined();
          expect(terminationEvent!.details.terminationReason).toBe(terminationReason);
          
          // PROPERTY: No cleanup or rollback actions should be recorded
          expect((terminationEvent!.details as any).cleanupPerformed).toBeUndefined();
          expect((terminationEvent!.details as any).rollbackExecuted).toBeUndefined();
          expect((terminationEvent!.details as any).resourcesReleased).toBeUndefined();
          expect((terminationEvent!.details as any).infrastructureReverted).toBeUndefined();
          
          // PROPERTY: Audit trail should not contain any execution events
          auditTrail.forEach(event => {
            expect(event.eventType).not.toBe('execution');
            expect(event.eventType).not.toBe('infrastructure_change');
            expect(event.eventType).not.toBe('system_modification');
          });
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Property Test: Complete workflow lifecycle maintains proposal-only constraint
   * Validates end-to-end that no infrastructure mutation occurs at any stage
   */
  test('Complete workflow lifecycle from incident to resolution is proposal-only', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('approve', 'block') as fc.Arbitrary<'approve' | 'block'>,
        generateIncidentContext(),
        generateRemediationAction(),
        async (decisionType, incidentContext, remediationAction) => {
          // Create workflow
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          
          // Progress through all workflow states
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Add all agent outputs
          const sreOutput = generateAgentOutput('sre-agent');
          const securityOutput = generateAgentOutput('security-agent');
          const govOutput = generateAgentOutput('governance-agent');
          
          await stateManager.addAgentOutput(workflowId, sreOutput);
          await stateManager.addAgentOutput(workflowId, securityOutput);
          await stateManager.addAgentOutput(workflowId, govOutput);
          
          await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
          await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
          
          // Create and process governance decision
          const governanceRequest = await governanceGate.createGovernanceRequest(
            workflowId,
            remediationAction,
            incidentContext
          );
          
          await governanceGate.processGovernanceDecision(
            governanceRequest.requestId,
            decisionType,
            `Decision: ${decisionType} - Based on comprehensive analysis`,
            { id: 'approver-001', role: 'SRE Lead' },
            decisionType === 'approve_with_restrictions' ? ['Monitor closely'] : undefined
          );
          
          // Get final workflow state
          const finalWorkflow = stateManager.getWorkflow(workflowId);
          
          // PROPERTY: Final state should be either ACTION_PROPOSED or TERMINATED
          if (decisionType === 'block') {
            expect(finalWorkflow!.currentState).toBe(WorkflowState.TERMINATED);
          } else {
            expect(finalWorkflow!.currentState).toBe(WorkflowState.ACTION_PROPOSED);
          }
          
          // PROPERTY: Complete audit trail should show no infrastructure mutations
          const auditTrail = finalWorkflow!.auditTrail;
          
          // Count event types
          const eventTypeCounts = auditTrail.reduce((acc, event) => {
            acc[event.eventType] = (acc[event.eventType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          // Only allowed event types should exist
          const allowedEventTypes = ['state_transition', 'agent_output', 'governance_decision', 'workflow_termination'];
          Object.keys(eventTypeCounts).forEach(eventType => {
            expect(allowedEventTypes).toContain(eventType);
          });
          
          // PROPERTY: All events should be immutable (audit requirement)
          auditTrail.forEach(event => {
            expect(event.immutable).toBe(true);
          });
          
          // PROPERTY: No execution or mutation metadata anywhere in workflow
          expect((finalWorkflow as any).executed).toBeUndefined();
          expect((finalWorkflow as any).infrastructureMutated).toBeUndefined();
          expect((finalWorkflow as any).changesApplied).toBeUndefined();
          
          // PROPERTY: Agent outputs are analysis only
          finalWorkflow!.agentOutputs.forEach(output => {
            expect((output as any).executionResult).toBeUndefined();
            expect((output as any).actionPerformed).toBeUndefined();
          });
          
          // PROPERTY: Governance decision is proposal only
          if (finalWorkflow!.governanceDecision) {
            expect((finalWorkflow!.governanceDecision as any).executed).toBeUndefined();
            expect((finalWorkflow!.governanceDecision as any).actionTaken).toBeUndefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Property Test: Governance gate blocks cannot be bypassed
   * Validates that blocked workflows cannot proceed to any action state
   */
  test('Blocked governance decisions prevent any further workflow progression', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateIncidentContext(),
        generateRemediationAction(),
        async (incidentContext, remediationAction) => {
          // Create workflow and progress to governance
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          const agentOutput = generateAgentOutput('sre-agent');
          await stateManager.addAgentOutput(workflowId, agentOutput);
          
          await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
          await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
          
          // Create governance request and BLOCK it
          const governanceRequest = await governanceGate.createGovernanceRequest(
            workflowId,
            remediationAction,
            incidentContext
          );
          
          const blockResult = await governanceGate.processGovernanceDecision(
            governanceRequest.requestId,
            'block',
            'Blocked due to high risk and policy violations',
            { id: 'approver-001', role: 'Security Lead' }
          );
          
          // PROPERTY: Block should terminate workflow
          expect(blockResult.success).toBe(true);
          expect(blockResult.workflowTerminated).toBe(true);
          
          // Get blocked workflow
          const blockedWorkflow = stateManager.getWorkflow(workflowId);
          
          // PROPERTY: Workflow should be TERMINATED, not any action state
          expect(blockedWorkflow!.currentState).toBe(WorkflowState.TERMINATED);
          expect(blockedWorkflow!.currentState).not.toBe(WorkflowState.ACTION_PROPOSED);
          expect(blockedWorkflow!.currentState).not.toBe(WorkflowState.VERIFIED);
          expect(blockedWorkflow!.currentState).not.toBe(WorkflowState.RESOLVED);
          
          // PROPERTY: Attempting to transition blocked workflow should fail
          await expect(
            stateManager.transitionTo(workflowId, WorkflowState.ACTION_PROPOSED)
          ).rejects.toThrow();
          
          await expect(
            stateManager.transitionTo(workflowId, WorkflowState.VERIFIED)
          ).rejects.toThrow();
          
          // PROPERTY: Governance decision should record block with rationale
          expect(blockedWorkflow!.governanceDecision).toBeDefined();
          expect(blockedWorkflow!.governanceDecision!.decision).toBe('block');
          expect(blockedWorkflow!.governanceDecision!.rationale).toContain('Blocked');
          
          // PROPERTY: No execution should have occurred
          expect((blockedWorkflow as any).executed).toBeUndefined();
          expect((blockedWorkflow as any).actionPerformed).toBeUndefined();
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Property Test: Remediation proposals are structured data, not executable commands
   * Validates that remediation actions are descriptive proposals in proper format
   */
  test('Remediation proposals are structured descriptions, not executable commands', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateRemediationAction(),
        generateIncidentContext(),
        async (remediationAction, incidentContext) => {
          // Create workflow and progress to governance
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          const agentOutput = generateAgentOutput('sre-agent');
          await stateManager.addAgentOutput(workflowId, agentOutput);
          
          await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
          await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
          
          // Create governance request with remediation action
          const governanceRequest = await governanceGate.createGovernanceRequest(
            workflowId,
            remediationAction,
            incidentContext
          );
          
          // PROPERTY: Remediation action should be a descriptive string
          expect(typeof governanceRequest.recommendedAction).toBe('string');
          expect(governanceRequest.recommendedAction.length).toBeGreaterThan(0);
          
          // PROPERTY: Remediation should not be an executable command format
          const executablePatterns = [
            /^sudo\s/i,
            /^kubectl\s/i,
            /^docker\s/i,
            /^aws\s/i,
            /^gcloud\s/i,
            /^terraform\s/i,
            /^ansible\s/i,
            /^\$\(/,
            /^`.*`$/,
            /^sh\s-c/i,
            /^bash\s-c/i,
            /^curl\s/i,
            /^wget\s/i
          ];
          
          executablePatterns.forEach(pattern => {
            expect(governanceRequest.recommendedAction).not.toMatch(pattern);
          });
          
          // PROPERTY: Governance request should include blast radius assessment
          expect(governanceRequest.blastRadiusAssessment).toBeDefined();
          expect(governanceRequest.blastRadiusAssessment.affectedServices).toBeDefined();
          expect(governanceRequest.blastRadiusAssessment.riskLevel).toBeDefined();
          expect(governanceRequest.blastRadiusAssessment.reversible).toBeDefined();
          
          // PROPERTY: Risk level should be one of allowed values
          expect(['low', 'medium', 'high', 'critical'])
            .toContain(governanceRequest.blastRadiusAssessment.riskLevel);
          
          // PROPERTY: Request should be in pending status (not executed)
          expect(governanceRequest.status).toBe('pending');
        }
      ),
      { numRuns: 20 }
    );
  });
});
