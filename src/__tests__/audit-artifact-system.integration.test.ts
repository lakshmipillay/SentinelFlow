/**
 * Integration tests for comprehensive audit artifact generation system
 * 
 * Tests end-to-end audit artifact generation across the complete workflow lifecycle:
 * - WorkflowStateManager integration with AuditArtifactService
 * - Complete workflow audit trail generation
 * - DEVLOG.md integration and canonical audit trail
 * - Audit chain integrity across workflow operations
 * - Compliance-ready audit artifact export
 * 
 * Validates Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { promises as fs } from 'fs';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { WorkflowStateManager } from '../core/WorkflowStateManager';
import { AuditArtifactService } from '../services/AuditArtifactService';
import { AgentOutputFactory } from '../services/AgentOutputFactory';
import { WorkflowState, AgentOutput, GovernanceDecision } from '../types/workflow';

// Mock fs module for DEVLOG testing
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}));

const mockFs = fs as any;

describe('Audit Artifact System Integration', () => {
  let stateManager: WorkflowStateManager;
  let auditService: AuditArtifactService;
  let workflowId: string;

  beforeEach(async () => {
    // Create audit service with test DEVLOG path
    auditService = new AuditArtifactService('test-integration-devlog.md');
    
    // Create state manager with audit service
    stateManager = new WorkflowStateManager(auditService);
    
    // Mock DEVLOG file operations
    mockFs.readFile.mockReset();
    mockFs.writeFile.mockReset();
    mockFs.readFile.mockResolvedValue(`# Test DEVLOG

Existing content

## Audit Trail - Machine Readable

This section contains structured, machine-readable audit artifacts for compliance review.
Each entry represents an immutable audit event with complete context capture.

`);
    
    // Create workflow
    const workflow = await stateManager.createWorkflow();
    workflowId = workflow.workflowId;
  });

  describe('Complete Workflow Audit Trail Generation', () => {
    test('should generate comprehensive audit trail for complete incident response workflow', async () => {
      // 1. Workflow Creation (already done in beforeEach)
      let auditChain = stateManager.getAuditChain(workflowId);
      expect(auditChain).toHaveLength(1);
      expect(auditChain[0].eventType).toBe('state_transition');
      expect(auditChain[0].details.toState).toBe(WorkflowState.IDLE);

      // 2. Incident Ingestion
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      auditChain = stateManager.getAuditChain(workflowId);
      expect(auditChain).toHaveLength(2);
      expect(auditChain[1].details.fromState).toBe(WorkflowState.IDLE);
      expect(auditChain[1].details.toState).toBe(WorkflowState.INCIDENT_INGESTED);

      // 3. Analysis Phase
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      
      // Add agent outputs with comprehensive context capture
      const sreOutput = AgentOutputFactory.createValidatedAgentOutput({
        agentName: 'sre-agent',
        findings: {
          summary: 'Database connection pool exhaustion',
          evidence: ['CPU spike at 14:32', 'Connection timeout errors'],
          correlations: ['Recent deployment at 14:30']
        },
        confidenceLevel: 0.85
      });

      const securityOutput = AgentOutputFactory.createValidatedAgentOutput({
        agentName: 'security-agent',
        findings: {
          summary: 'No security threats detected',
          evidence: ['Normal authentication patterns', 'No suspicious access'],
          correlations: ['Operational issue, not security']
        },
        confidenceLevel: 0.90
      });

      const governanceOutput = AgentOutputFactory.createValidatedAgentOutput({
        agentName: 'governance-agent',
        findings: {
          summary: 'Database restart approved for non-production',
          evidence: ['Low risk action', 'Reversible operation'],
          correlations: ['Standard operational procedure']
        },
        confidenceLevel: 0.95
      });

      await stateManager.addAgentOutput(workflowId, sreOutput);
      await stateManager.addAgentOutput(workflowId, securityOutput);
      await stateManager.addAgentOutput(workflowId, governanceOutput);

      // Verify agent output audit events with complete context
      auditChain = stateManager.getAuditChain(workflowId);
      const agentOutputEvents = auditChain.filter(event => event.eventType === 'agent_output');
      expect(agentOutputEvents).toHaveLength(3);

      // Verify agent analysis context capture (Requirement 10.2)
      agentOutputEvents.forEach(event => {
        expect(event.contextCapture.agentAnalysisContext).toBeDefined();
        expect(event.contextCapture.agentAnalysisContext!.skillsUsed).toBeDefined();
        expect(event.contextCapture.agentAnalysisContext!.dataSourcesAccessed).toBeDefined();
        expect(event.contextCapture.agentAnalysisContext!.confidenceLevel).toBeGreaterThan(0);
        expect(event.contextCapture.agentAnalysisContext!.validationResults).toBeDefined();
      });

      // 4. RCA Complete
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);

      // 5. Governance Pending
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      // 6. Governance Decision with comprehensive context
      const governanceDecision: GovernanceDecision = {
        decision: 'approve',
        rationale: 'Low risk database restart approved - reversible action with minimal impact',
        approver: {
          id: 'sre-lead-001',
          role: 'SRE Team Lead'
        },
        timestamp: new Date().toISOString(),
        blastRadiusAssessment: {
          affectedServices: ['database', 'api', 'cache'],
          riskLevel: 'medium',
          reversible: true,
          dependencyAnalysis: {
            directDependencies: ['api', 'cache'],
            cascadeRisk: 'low',
            criticalPath: false,
            totalPotentialImpact: 3
          },
          riskFactors: {
            confidenceLevel: 0.85,
            serviceCount: 3,
            actionType: 'restart',
            businessHoursImpact: false,
            criticalServicesAffected: ['database']
          }
        }
      };

      await stateManager.addGovernanceDecision(workflowId, governanceDecision);

      // Verify governance decision audit event with complete context (Requirement 10.3)
      auditChain = stateManager.getAuditChain(workflowId);
      const govDecisionEvent = auditChain.find(event => event.eventType === 'governance_decision');
      expect(govDecisionEvent).toBeDefined();
      expect(govDecisionEvent!.contextCapture.governanceContext).toBeDefined();
      
      const govContext = govDecisionEvent!.contextCapture.governanceContext!;
      expect(govContext.blastRadiusAssessment.affectedServices).toEqual(['database', 'api', 'cache']);
      expect(govContext.riskAssessment.riskScore).toBe(0.85);
      expect(govContext.humanRationale).toBe(governanceDecision.rationale);
      expect(govContext.approverContext.approverId).toBe('sre-lead-001');

      // 7. Action Proposed
      await stateManager.transitionTo(workflowId, WorkflowState.ACTION_PROPOSED);

      // 8. Verified
      await stateManager.transitionTo(workflowId, WorkflowState.VERIFIED);

      // 9. Resolved
      await stateManager.transitionTo(workflowId, WorkflowState.RESOLVED);

      // 10. Workflow Termination with comprehensive context
      await stateManager.terminateWorkflow(workflowId, 'Incident resolved successfully');

      // Verify complete audit trail
      auditChain = stateManager.getAuditChain(workflowId);
      expect(auditChain.length).toBeGreaterThan(10); // Multiple state transitions + agent outputs + governance + termination

      // Verify workflow termination context capture (Requirement 10.4)
      const terminationEvent = auditChain.find(event => event.eventType === 'workflow_termination');
      expect(terminationEvent).toBeDefined();
      expect(terminationEvent!.contextCapture.terminationContext).toBeDefined();
      
      const termContext = terminationEvent!.contextCapture.terminationContext!;
      expect(termContext.terminationReason).toBe('Incident resolved successfully');
      expect(termContext.workflowTimeline).toBeDefined();
      expect(termContext.workflowTimeline.length).toBeGreaterThan(0);
      expect(termContext.completionStatus).toBe('successful');
      expect(termContext.residualRisks).toBeDefined();
    });

    test('should generate audit trail for blocked workflow with residual risk capture', async () => {
      // Set up workflow to governance pending
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      // Add blocking governance decision
      const blockingDecision: GovernanceDecision = {
        decision: 'block',
        rationale: 'High risk production database modification during business hours',
        approver: {
          id: 'security-lead-001',
          role: 'Security Team Lead'
        },
        timestamp: new Date().toISOString(),
        blastRadiusAssessment: {
          affectedServices: ['database', 'api', 'frontend', 'payment'],
          riskLevel: 'critical',
          reversible: false,
          dependencyAnalysis: {
            directDependencies: ['api', 'frontend', 'payment'],
            cascadeRisk: 'high',
            criticalPath: true,
            totalPotentialImpact: 4
          },
          riskFactors: {
            confidenceLevel: 0.95,
            serviceCount: 4,
            actionType: 'database-modification',
            businessHoursImpact: true,
            criticalServicesAffected: ['database', 'payment']
          }
        }
      };

      await stateManager.addGovernanceDecision(workflowId, blockingDecision);

      // Force terminate due to governance block
      await stateManager.forceTerminateWorkflow(workflowId, 'Governance blocked - high risk action', 'human');

      // Verify termination context captures blocking and residual risks
      const auditChain = stateManager.getAuditChain(workflowId);
      const terminationEvent = auditChain.find(event => event.eventType === 'workflow_termination');
      expect(terminationEvent).toBeDefined();
      
      const termContext = terminationEvent!.contextCapture.terminationContext!;
      expect(termContext.terminationReason).toBe('Governance blocked - high risk action');
      expect(termContext.completionStatus).toBe('blocked');
      expect(termContext.residualRisks).toContain('Workflow blocked by governance - incident may require manual intervention');
      expect(termContext.residualRisks).toContain('Blocked reason: High risk production database modification during business hours');
    });
  });

  describe('DEVLOG.md Integration and Canonical Audit Trail', () => {
    test('should maintain DEVLOG.md as canonical audit trail with machine-readable format', async () => {
      // Perform several workflow operations
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      
      const agentOutput = AgentOutputFactory.createValidatedAgentOutput({
        agentName: 'sre-agent',
        findings: {
          summary: 'System performance degradation detected',
          evidence: ['High CPU usage', 'Memory pressure'],
          correlations: ['Load balancer misconfiguration']
        },
        confidenceLevel: 0.80
      });
      
      await stateManager.addAgentOutput(workflowId, agentOutput);
      await stateManager.terminateWorkflow(workflowId, 'Analysis complete');

      // Verify DEVLOG was updated multiple times
      expect(mockFs.writeFile).toHaveBeenCalledTimes(5); // Workflow creation + state transition + agent output + termination + additional events

      // Verify DEVLOG content structure
      const lastWriteCall = mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1];
      const devlogContent = lastWriteCall[1] as string;
      
      // Verify machine-readable audit trail section exists
      expect(devlogContent).toContain('## Audit Trail - Machine Readable');
      expect(devlogContent).toContain('structured, machine-readable audit artifacts for compliance review');
      
      // Verify audit entries are properly formatted
      expect(devlogContent).toContain('**Workflow ID**:');
      expect(devlogContent).toContain('**Event Type**:');
      expect(devlogContent).toContain('**Audit Hash**:');
      expect(devlogContent).toContain('**Chain Position**:');
      
      // Verify JSON details are included
      expect(devlogContent).toContain('```json');
      expect(devlogContent).toContain('- Immutable: true');
      expect(devlogContent).toContain('- Compliance Ready: true');
    });

    test('should emit DEVLOG update events for real-time monitoring', async () => {
      const devlogEvents: any[] = [];
      stateManager.on('devlogUpdated', (event) => devlogEvents.push(event));

      // Perform operations that should trigger DEVLOG updates
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      // Verify DEVLOG update events were emitted
      expect(devlogEvents.length).toBeGreaterThan(0);
      devlogEvents.forEach(event => {
        expect(event.workflowId).toBe(workflowId);
        expect(event.entryId).toBeDefined();
        expect(event.timestamp).toBeDefined();
      });
    });
  });

  describe('Audit Chain Integrity and Immutability', () => {
    test('should maintain audit chain integrity across all workflow operations', async () => {
      // Perform complete workflow with multiple operations
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      
      const agentOutput = AgentOutputFactory.createValidatedAgentOutput({
        agentName: 'security-agent',
        findings: {
          summary: 'Security analysis complete',
          evidence: ['No threats detected'],
          correlations: ['Operational issue confirmed']
        },
        confidenceLevel: 0.88
      });
      
      await stateManager.addAgentOutput(workflowId, agentOutput);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.terminateWorkflow(workflowId, 'Workflow complete');

      // Verify audit chain integrity
      const integrity = stateManager.verifyAuditChainIntegrity(workflowId);
      expect(integrity.valid).toBe(true);
      expect(integrity.errors).toHaveLength(0);
      expect(integrity.chainLength).toBeGreaterThan(5);

      // Verify chain linkage
      const auditChain = stateManager.getAuditChain(workflowId);
      for (let i = 1; i < auditChain.length; i++) {
        expect(auditChain[i].previousEventHash).toBe(auditChain[i - 1].eventHash);
        expect(auditChain[i].auditChainPosition).toBe(i);
      }

      // Verify immutability flags
      auditChain.forEach(event => {
        expect(event.immutable).toBe(true);
        expect(event.eventHash).toHaveLength(64); // SHA-256 hex
      });
    });

    test('should detect audit chain tampering', async () => {
      // Create some audit events
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);

      // Verify initial integrity
      let integrity = stateManager.verifyAuditChainIntegrity(workflowId);
      expect(integrity.valid).toBe(true);

      // Simulate tampering by corrupting the audit chain
      const auditChain = stateManager.getAuditChain(workflowId) as any[];
      if (auditChain.length > 1) {
        auditChain[1].eventHash = 'tampered-hash';
      }

      // Verify tampering is detected
      integrity = stateManager.verifyAuditChainIntegrity(workflowId);
      expect(integrity.valid).toBe(false);
      expect(integrity.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Compliance-Ready Audit Artifact Export', () => {
    test('should export comprehensive audit artifacts suitable for compliance review', async () => {
      // Create comprehensive workflow with all event types
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      
      const agentOutput = AgentOutputFactory.createValidatedAgentOutput({
        agentName: 'governance-agent',
        findings: {
          summary: 'Policy compliance verified',
          evidence: ['Change management approval', 'Risk assessment complete'],
          correlations: ['Standard operational procedure']
        },
        confidenceLevel: 0.92
      });
      
      await stateManager.addAgentOutput(workflowId, agentOutput);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
      
      const governanceDecision: GovernanceDecision = {
        decision: 'approve_with_restrictions',
        rationale: 'Approved with monitoring requirements',
        approver: { id: 'compliance-001', role: 'Compliance Officer' },
        timestamp: new Date().toISOString(),
        restrictions: ['Monitor for 24 hours', 'Rollback plan required'],
        blastRadiusAssessment: {
          affectedServices: ['api'],
          riskLevel: 'low',
          reversible: true,
          dependencyAnalysis: {
            directDependencies: ['cache'],
            cascadeRisk: 'low',
            criticalPath: false,
            totalPotentialImpact: 1
          },
          riskFactors: {
            confidenceLevel: 0.92,
            serviceCount: 1,
            actionType: 'configuration-change',
            businessHoursImpact: false,
            criticalServicesAffected: []
          }
        }
      };
      
      await stateManager.addGovernanceDecision(workflowId, governanceDecision);
      await stateManager.terminateWorkflow(workflowId, 'Approved with restrictions');

      // Export audit artifacts
      const exportData = await stateManager.exportAuditArtifacts(workflowId);

      // Verify comprehensive export structure
      expect(exportData.auditChain).toBeDefined();
      expect(exportData.auditChain.length).toBeGreaterThan(5);
      expect(exportData.metrics).toBeDefined();
      expect(exportData.integrity.valid).toBe(true);
      expect(exportData.devlogEntries).toBeDefined();

      // Verify audit metrics
      expect(exportData.metrics!.totalEvents).toBeGreaterThan(5);
      expect(exportData.metrics!.stateTransitions).toBeGreaterThan(0);
      expect(exportData.metrics!.agentOutputs).toBe(1);
      expect(exportData.metrics!.governanceDecisions).toBe(1);
      expect(exportData.metrics!.workflowTerminations).toBe(1);

      // Verify DEVLOG entries are compliance-ready
      exportData.devlogEntries.forEach(entry => {
        expect(entry.auditMetadata.immutable).toBe(true);
        expect(entry.auditMetadata.complianceReady).toBe(true);
        expect(entry.auditMetadata.eventHash).toBeDefined();
        expect(entry.auditMetadata.chainPosition).toBeGreaterThanOrEqual(0);
      });

      // Verify all event types are represented in export
      const eventTypes = exportData.auditChain.map(event => event.eventType);
      expect(eventTypes).toContain('state_transition');
      expect(eventTypes).toContain('agent_output');
      expect(eventTypes).toContain('governance_decision');
      expect(eventTypes).toContain('workflow_termination');
    });

    test('should provide audit metrics for workflow analysis', async () => {
      // Create workflow with multiple operations
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      
      // Add multiple agent outputs
      const outputs = ['sre-agent', 'security-agent', 'governance-agent'].map(agentName =>
        AgentOutputFactory.createValidatedAgentOutput({
          agentName: agentName as any,
          findings: {
            summary: `${agentName} analysis complete`,
            evidence: ['Analysis evidence'],
            correlations: ['Cross-agent correlation']
          },
          confidenceLevel: 0.85
        })
      );
      
      for (const output of outputs) {
        await stateManager.addAgentOutput(workflowId, output);
      }
      
      await stateManager.terminateWorkflow(workflowId, 'Analysis complete');

      // Get audit metrics
      const metrics = stateManager.getAuditMetrics(workflowId);
      expect(metrics).toBeDefined();
      expect(metrics!.totalEvents).toBeGreaterThan(6); // State transitions + agent outputs + termination
      expect(metrics!.agentOutputs).toBe(3);
      expect(metrics!.stateTransitions).toBeGreaterThan(2);
      expect(metrics!.workflowTerminations).toBe(1);
      expect(metrics!.lastUpdated).toBeDefined();
    });
  });

  describe('Real-time Audit Event Broadcasting', () => {
    test('should broadcast audit events for real-time monitoring', async () => {
      const auditEvents: any[] = [];
      stateManager.on('auditEventGenerated', (event) => auditEvents.push(event));

      // Perform operations that generate audit events
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      
      const agentOutput = AgentOutputFactory.createValidatedAgentOutput({
        agentName: 'sre-agent',
        findings: {
          summary: 'Real-time monitoring test',
          evidence: ['Test evidence'],
          correlations: ['Test correlation']
        },
        confidenceLevel: 0.75
      });
      
      await stateManager.addAgentOutput(workflowId, agentOutput);

      // Verify audit events were broadcast
      expect(auditEvents.length).toBeGreaterThan(0);
      auditEvents.forEach(event => {
        expect(event.workflowId).toBe(workflowId);
        expect(event.eventType).toBeDefined();
        expect(event.eventId).toBeDefined();
        expect(event.timestamp).toBeDefined();
        expect(event.chainPosition).toBeGreaterThanOrEqual(0);
      });
    });
  });
});