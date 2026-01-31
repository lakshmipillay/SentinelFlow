/**
 * Comprehensive unit tests for AuditArtifactService
 * 
 * Tests audit artifact generation system implementation:
 * - Structured audit event creation (Requirement 10.1)
 * - Immutable audit trail storage (Requirements 10.1, 10.5)
 * - Complete context capture (Requirements 10.2, 10.3, 10.4)
 * - DEVLOG.md integration (Requirement 10.5)
 * - Audit chain integrity verification
 * - Compliance-ready audit artifacts
 */

import { promises as fs } from 'fs';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { AuditArtifactService, EnhancedAuditEvent, DevlogAuditEntry } from '../AuditArtifactService';
import { WorkflowState, WorkflowInstance, AgentOutput, GovernanceDecision } from '../../types/workflow';
import { AgentOutputFactory } from '../AgentOutputFactory';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}));

const mockFs = fs as any;

describe('AuditArtifactService', () => {
  let auditService: AuditArtifactService;
  let mockWorkflow: WorkflowInstance;
  let mockAgentOutput: AgentOutput;
  let mockGovernanceDecision: GovernanceDecision;

  beforeEach(() => {
    auditService = new AuditArtifactService('test-devlog.md');
    
    // Reset mocks
    mockFs.readFile.mockReset();
    mockFs.writeFile.mockReset();
    
    // Create mock workflow
    mockWorkflow = {
      workflowId: 'test-workflow-123',
      currentState: WorkflowState.ANALYZING,
      timestamp: '2024-01-15T10:00:00Z',
      agentOutputs: [],
      auditTrail: [],
      createdAt: '2024-01-15T09:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z'
    };

    // Create mock agent output
    mockAgentOutput = AgentOutputFactory.createValidatedAgentOutput({
      agentName: 'sre-agent',
      findings: {
        summary: 'Database connection pool exhaustion detected',
        evidence: ['CPU spike at 14:32', 'Connection timeout errors'],
        correlations: ['Recent deployment at 14:30']
      },
      confidenceLevel: 0.85
    });

    // Create mock governance decision
    mockGovernanceDecision = {
      decision: 'approve',
      rationale: 'Low risk database restart approved',
      approver: {
        id: 'admin-001',
        role: 'SRE Lead'
      },
      timestamp: '2024-01-15T11:00:00Z',
      blastRadiusAssessment: {
        affectedServices: ['database', 'api'],
        riskLevel: 'medium',
        reversible: true,
        dependencyAnalysis: {
          directDependencies: ['api', 'cache'],
          cascadeRisk: 'low',
          criticalPath: false,
          totalPotentialImpact: 2
        },
        riskFactors: {
          confidenceLevel: 0.85,
          serviceCount: 2,
          actionType: 'restart',
          businessHoursImpact: false,
          criticalServicesAffected: ['database']
        }
      }
    };
  });

  describe('Structured Audit Event Creation (Requirement 10.1)', () => {
    test('should generate enhanced audit event with immutability guarantees', async () => {
      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'state_transition',
        'orchestrator',
        { fromState: WorkflowState.IDLE, toState: WorkflowState.INCIDENT_INGESTED },
        { workflowInstance: mockWorkflow }
      );

      // Verify basic audit event structure
      expect(auditEvent.eventId).toBeDefined();
      expect(auditEvent.workflowId).toBe('test-workflow-123');
      expect(auditEvent.eventType).toBe('state_transition');
      expect(auditEvent.actor).toBe('orchestrator');
      expect(auditEvent.immutable).toBe(true);
      expect(auditEvent.timestamp).toBeDefined();

      // Verify immutability guarantees
      expect(auditEvent.eventHash).toBeDefined();
      expect(auditEvent.eventHash).toHaveLength(64); // SHA-256 hex length
      expect(auditEvent.auditChainPosition).toBe(0);
      expect(auditEvent.previousEventHash).toBeUndefined(); // First event

      // Verify context capture
      expect(auditEvent.contextCapture).toBeDefined();
      expect(auditEvent.contextCapture.systemContext).toBeDefined();
      expect(auditEvent.contextCapture.systemContext.totalAgentOutputs).toBe(0);
      expect(auditEvent.contextCapture.systemContext.governanceDecisionsMade).toBe(0);
    });

    test('should create audit chain with proper linkage', async () => {
      // Create first event
      const firstEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'state_transition',
        'orchestrator',
        { toState: WorkflowState.IDLE }
      );

      // Create second event
      const secondEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'state_transition',
        'orchestrator',
        { fromState: WorkflowState.IDLE, toState: WorkflowState.INCIDENT_INGESTED }
      );

      // Verify chain linkage
      expect(firstEvent.auditChainPosition).toBe(0);
      expect(secondEvent.auditChainPosition).toBe(1);
      expect(secondEvent.previousEventHash).toBe(firstEvent.eventHash);
      expect(firstEvent.previousEventHash).toBeUndefined();
    });

    test('should generate mandatory audit artifacts as first-class outputs', async () => {
      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'agent_output',
        'sre-agent',
        { agentOutput: mockAgentOutput },
        { agentOutput: mockAgentOutput, workflowInstance: mockWorkflow }
      );

      // Verify audit artifact is first-class output (not optional logging)
      expect(auditEvent).toBeDefined();
      expect(auditEvent.immutable).toBe(true);
      expect(auditEvent.eventHash).toBeDefined();
      expect(auditEvent.contextCapture).toBeDefined();
      
      // Verify event emission
      const emittedEvents: any[] = [];
      auditService.on('auditEventGenerated', (event) => emittedEvents.push(event));
      
      await auditService.generateAuditEvent(
        'test-workflow-456',
        'state_transition',
        'orchestrator',
        { toState: WorkflowState.IDLE }
      );
      
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].workflowId).toBe('test-workflow-456');
    });
  });

  describe('Agent Analysis Context Capture (Requirement 10.2)', () => {
    test('should record all skills used, data sources accessed, and confidence levels', async () => {
      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'agent_output',
        'sre-agent',
        { agentOutput: mockAgentOutput },
        { agentOutput: mockAgentOutput, workflowInstance: mockWorkflow }
      );

      const agentContext = auditEvent.contextCapture.agentAnalysisContext;
      expect(agentContext).toBeDefined();
      
      // Verify skills used are recorded
      expect(agentContext!.skillsUsed).toEqual(mockAgentOutput.skillsUsed);
      
      // Verify data sources accessed are recorded
      expect(agentContext!.dataSourcesAccessed).toEqual(mockAgentOutput.metadata.dataSourcesAccessed);
      
      // Verify confidence level is recorded
      expect(agentContext!.confidenceLevel).toBe(mockAgentOutput.confidenceLevel);
      
      // Verify processing time is recorded
      expect(agentContext!.processingTimeMs).toBe(mockAgentOutput.metadata.processingTimeMs);
      
      // Verify validation results are recorded
      expect(agentContext!.validationResults).toEqual({
        skillsValid: mockAgentOutput.validation.skillsValid,
        confidenceLevelValid: mockAgentOutput.validation.confidenceLevelValid,
        schemaCompliant: mockAgentOutput.validation.schemaCompliant
      });
    });

    test('should not include agent analysis context for non-agent events', async () => {
      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'state_transition',
        'orchestrator',
        { fromState: WorkflowState.IDLE, toState: WorkflowState.INCIDENT_INGESTED }
      );

      expect(auditEvent.contextCapture.agentAnalysisContext).toBeUndefined();
    });
  });

  describe('Governance Decision Context Capture (Requirement 10.3)', () => {
    test('should record complete decision context including blast radius, risk assessment, and human rationale', async () => {
      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'governance_decision',
        'human',
        { governanceDecision: mockGovernanceDecision },
        { governanceDecision: mockGovernanceDecision, workflowInstance: mockWorkflow }
      );

      const govContext = auditEvent.contextCapture.governanceContext;
      expect(govContext).toBeDefined();
      
      // Verify blast radius assessment is recorded
      expect(govContext!.blastRadiusAssessment).toEqual({
        affectedServices: mockGovernanceDecision.blastRadiusAssessment.affectedServices,
        riskLevel: mockGovernanceDecision.blastRadiusAssessment.riskLevel,
        reversible: mockGovernanceDecision.blastRadiusAssessment.reversible,
        totalPotentialImpact: mockGovernanceDecision.blastRadiusAssessment.dependencyAnalysis!.totalPotentialImpact
      });
      
      // Verify risk assessment is recorded
      expect(govContext!.riskAssessment.riskScore).toBe(mockGovernanceDecision.blastRadiusAssessment.riskFactors!.confidenceLevel);
      expect(govContext!.riskAssessment.riskFactors).toContain('Service Count: 2');
      expect(govContext!.riskAssessment.riskFactors).toContain('Action Type: restart');
      
      // Verify human rationale is recorded
      expect(govContext!.humanRationale).toBe(mockGovernanceDecision.rationale);
      
      // Verify approver context is recorded
      expect(govContext!.approverContext).toEqual({
        approverId: mockGovernanceDecision.approver.id,
        approverRole: mockGovernanceDecision.approver.role,
        decisionTimestamp: mockGovernanceDecision.timestamp
      });
    });

    test('should not include governance context for non-governance events', async () => {
      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'agent_output',
        'sre-agent',
        { agentOutput: mockAgentOutput }
      );

      expect(auditEvent.contextCapture.governanceContext).toBeUndefined();
    });
  });

  describe('Workflow Termination Context Capture (Requirement 10.4)', () => {
    test('should capture termination reason, residual risks, and complete timeline', async () => {
      // Add some audit events to create timeline
      mockWorkflow.auditTrail = [
        {
          eventId: 'event-1',
          workflowId: 'test-workflow-123',
          eventType: 'state_transition',
          timestamp: '2024-01-15T09:00:00Z',
          actor: 'orchestrator',
          details: { toState: WorkflowState.IDLE },
          immutable: true
        },
        {
          eventId: 'event-2',
          workflowId: 'test-workflow-123',
          eventType: 'state_transition',
          timestamp: '2024-01-15T09:05:00Z',
          actor: 'orchestrator',
          details: { fromState: WorkflowState.IDLE, toState: WorkflowState.INCIDENT_INGESTED },
          immutable: true
        }
      ];

      // Set workflow to TERMINATED state for proper completion status
      mockWorkflow.currentState = WorkflowState.TERMINATED;

      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'workflow_termination',
        'orchestrator',
        { terminationReason: 'Governance blocked - high risk action' },
        { 
          workflowInstance: mockWorkflow,
          terminationReason: 'Governance blocked - high risk action'
        }
      );

      const termContext = auditEvent.contextCapture.terminationContext;
      expect(termContext).toBeDefined();
      
      // Verify termination reason is captured
      expect(termContext!.terminationReason).toBe('Governance blocked - high risk action');
      
      // Verify workflow timeline is captured
      expect(termContext!.workflowTimeline).toHaveLength(2);
      expect(termContext!.workflowTimeline[0].state).toBe(WorkflowState.IDLE);
      expect(termContext!.workflowTimeline[1].state).toBe(WorkflowState.INCIDENT_INGESTED);
      
      // Verify completion status is determined
      expect(termContext!.completionStatus).toBe('error'); // TERMINATED state
      
      // Verify residual risks are identified
      expect(termContext!.residualRisks).toBeDefined();
      expect(Array.isArray(termContext!.residualRisks)).toBe(true);
    });

    test('should identify residual risks for blocked workflows', async () => {
      // Set up workflow with governance block
      const blockedWorkflow = {
        ...mockWorkflow,
        currentState: WorkflowState.TERMINATED,
        governanceDecision: {
          ...mockGovernanceDecision,
          decision: 'block' as const,
          rationale: 'High risk - production database modification'
        }
      };

      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'workflow_termination',
        'human',
        { terminationReason: 'Governance block' },
        { 
          workflowInstance: blockedWorkflow,
          terminationReason: 'Governance block'
        }
      );

      const termContext = auditEvent.contextCapture.terminationContext;
      expect(termContext!.residualRisks).toContain('Workflow blocked by governance - incident may require manual intervention');
      expect(termContext!.residualRisks).toContain('Blocked reason: High risk - production database modification');
      expect(termContext!.completionStatus).toBe('blocked');
    });
  });

  describe('DEVLOG.md Integration (Requirement 10.5)', () => {
    test('should generate DEVLOG entry for canonical audit trail', async () => {
      // Mock existing DEVLOG content
      mockFs.readFile.mockResolvedValue('# Existing DEVLOG\n\nSome content\n');
      
      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'state_transition',
        'orchestrator',
        { fromState: WorkflowState.IDLE, toState: WorkflowState.INCIDENT_INGESTED },
        { workflowInstance: mockWorkflow }
      );

      // Verify DEVLOG was updated
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        'test-devlog.md',
        expect.stringContaining('## Audit Trail - Machine Readable'),
        'utf-8'
      );
      
      // Verify DEVLOG content includes audit information
      const writtenContent = mockFs.writeFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('Workflow transitioned from IDLE to INCIDENT_INGESTED');
      expect(writtenContent).toContain(auditEvent.eventHash);
      expect(writtenContent).toContain('Immutable: true');
      expect(writtenContent).toContain('Compliance Ready: true');
    });

    test('should create initial DEVLOG structure if file does not exist', async () => {
      // Mock file not found
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      await auditService.generateAuditEvent(
        'test-workflow-123',
        'state_transition',
        'orchestrator',
        { toState: WorkflowState.IDLE }
      );

      // Verify initial DEVLOG structure was created
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        'test-devlog.md',
        expect.stringContaining('# DEVLOG – SentinelFlow'),
        'utf-8'
      );
      
      const writtenContent = mockFs.writeFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('## Audit Trail - Machine Readable');
      expect(writtenContent).toContain('structured, machine-readable audit artifacts for compliance review');
    });

    test('should emit DEVLOG update events', async () => {
      mockFs.readFile.mockResolvedValue('# Existing DEVLOG\n');
      
      const devlogEvents: any[] = [];
      auditService.on('devlogUpdated', (event) => devlogEvents.push(event));
      
      await auditService.generateAuditEvent(
        'test-workflow-123',
        'agent_output',
        'sre-agent',
        { agentOutput: mockAgentOutput }
      );

      expect(devlogEvents).toHaveLength(1);
      expect(devlogEvents[0].workflowId).toBe('test-workflow-123');
      expect(devlogEvents[0].entryId).toBeDefined();
      expect(devlogEvents[0].timestamp).toBeDefined();
    });

    test('should handle DEVLOG write failures gracefully', async () => {
      mockFs.readFile.mockResolvedValue('# Existing DEVLOG\n');
      mockFs.writeFile.mockRejectedValue(new Error('Write permission denied'));
      
      // Should not throw error - audit should not fail workflow
      await expect(auditService.generateAuditEvent(
        'test-workflow-123',
        'state_transition',
        'orchestrator',
        { toState: WorkflowState.IDLE }
      )).resolves.toBeDefined();
    });
  });

  describe('Audit Chain Integrity Verification', () => {
    test('should verify audit chain integrity correctly', async () => {
      // Create a chain of events
      await auditService.generateAuditEvent('test-workflow-123', 'state_transition', 'orchestrator', { toState: WorkflowState.IDLE });
      await auditService.generateAuditEvent('test-workflow-123', 'state_transition', 'orchestrator', { fromState: WorkflowState.IDLE, toState: WorkflowState.INCIDENT_INGESTED });
      await auditService.generateAuditEvent('test-workflow-123', 'agent_output', 'sre-agent', { agentOutput: mockAgentOutput });

      const integrity = auditService.verifyAuditChainIntegrity('test-workflow-123');
      
      expect(integrity.valid).toBe(true);
      expect(integrity.errors).toHaveLength(0);
      expect(integrity.chainLength).toBe(3);
    });

    test('should detect broken audit chain', async () => {
      // Create events
      await auditService.generateAuditEvent('test-workflow-123', 'state_transition', 'orchestrator', { toState: WorkflowState.IDLE });
      await auditService.generateAuditEvent('test-workflow-123', 'state_transition', 'orchestrator', { fromState: WorkflowState.IDLE, toState: WorkflowState.INCIDENT_INGESTED });
      
      // Manually corrupt the chain
      const chain = auditService.getAuditChain('test-workflow-123') as EnhancedAuditEvent[];
      if (chain.length > 1) {
        // Corrupt the hash linkage
        (chain[1] as any).previousEventHash = 'corrupted-hash';
      }

      const integrity = auditService.verifyAuditChainIntegrity('test-workflow-123');
      
      expect(integrity.valid).toBe(false);
      expect(integrity.errors.length).toBeGreaterThan(0);
      expect(integrity.errors[0]).toContain('Broken chain linkage');
    });

    test('should return error for non-existent workflow', async () => {
      const integrity = auditService.verifyAuditChainIntegrity('non-existent-workflow');
      
      expect(integrity.valid).toBe(false);
      expect(integrity.errors).toContain('Audit chain not found');
      expect(integrity.chainLength).toBe(0);
    });
  });

  describe('Audit Metrics and Export', () => {
    test('should track audit metrics correctly', async () => {
      // Generate various types of events
      await auditService.generateAuditEvent('test-workflow-123', 'state_transition', 'orchestrator', { toState: WorkflowState.IDLE });
      await auditService.generateAuditEvent('test-workflow-123', 'agent_output', 'sre-agent', { agentOutput: mockAgentOutput });
      await auditService.generateAuditEvent('test-workflow-123', 'governance_decision', 'human', { governanceDecision: mockGovernanceDecision });
      await auditService.generateAuditEvent('test-workflow-123', 'workflow_termination', 'orchestrator', { terminationReason: 'Completed' });

      const metrics = auditService.getAuditMetrics('test-workflow-123');
      
      expect(metrics).toBeDefined();
      expect(metrics!.totalEvents).toBe(4);
      expect(metrics!.stateTransitions).toBe(1);
      expect(metrics!.agentOutputs).toBe(1);
      expect(metrics!.governanceDecisions).toBe(1);
      expect(metrics!.workflowTerminations).toBe(1);
      expect(metrics!.lastUpdated).toBeDefined();
    });

    test('should export comprehensive audit artifacts for compliance review', async () => {
      // Generate events
      await auditService.generateAuditEvent('test-workflow-123', 'state_transition', 'orchestrator', { toState: WorkflowState.IDLE });
      await auditService.generateAuditEvent('test-workflow-123', 'agent_output', 'sre-agent', { agentOutput: mockAgentOutput });

      const exportData = await auditService.exportAuditArtifacts('test-workflow-123');
      
      expect(exportData.auditChain).toHaveLength(2);
      expect(exportData.metrics).toBeDefined();
      expect(exportData.integrity.valid).toBe(true);
      expect(exportData.devlogEntries).toHaveLength(2);
      
      // Verify DEVLOG entries are compliance-ready
      exportData.devlogEntries.forEach(entry => {
        expect(entry.auditMetadata.immutable).toBe(true);
        expect(entry.auditMetadata.complianceReady).toBe(true);
        expect(entry.auditMetadata.eventHash).toBeDefined();
      });
    });
  });

  describe('System Context and Compliance', () => {
    test('should gather comprehensive system context', async () => {
      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'state_transition',
        'orchestrator',
        { toState: WorkflowState.IDLE },
        { workflowInstance: mockWorkflow }
      );

      const systemContext = auditEvent.contextCapture.systemContext;
      
      expect(systemContext.workflowDuration).toBeDefined();
      expect(systemContext.totalAgentOutputs).toBe(0);
      expect(systemContext.governanceDecisionsMade).toBe(0);
      expect(systemContext.stateTransitionsCount).toBe(0);
      expect(systemContext.systemLoad).toBeDefined();
      expect(systemContext.systemLoad!.activeWorkflows).toBeDefined();
      expect(systemContext.systemLoad!.memoryUsage).toBeDefined();
    });

    test('should mark audit events as compliance-ready when all required context is present', async () => {
      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'governance_decision',
        'human',
        { governanceDecision: mockGovernanceDecision },
        { governanceDecision: mockGovernanceDecision, workflowInstance: mockWorkflow }
      );

      // Verify compliance readiness
      expect(auditEvent.eventHash).toHaveLength(64); // Valid SHA-256
      expect(auditEvent.auditChainPosition).toBeGreaterThanOrEqual(0);
      expect(auditEvent.contextCapture.systemContext).toBeDefined();
      expect(auditEvent.contextCapture.governanceContext).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing workflow context gracefully', async () => {
      const auditEvent = await auditService.generateAuditEvent(
        'test-workflow-123',
        'state_transition',
        'orchestrator',
        { toState: WorkflowState.IDLE }
        // No context data provided
      );

      expect(auditEvent).toBeDefined();
      expect(auditEvent.contextCapture.systemContext).toBeDefined();
      expect(auditEvent.contextCapture.agentAnalysisContext).toBeUndefined();
      expect(auditEvent.contextCapture.governanceContext).toBeUndefined();
    });

    test('should handle concurrent audit event generation', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        auditService.generateAuditEvent(
          'test-workflow-123',
          'state_transition',
          'orchestrator',
          { toState: WorkflowState.IDLE }
        )
      );

      const events = await Promise.all(promises);
      
      // All events should be created successfully
      expect(events).toHaveLength(5);
      events.forEach(event => {
        expect(event.eventId).toBeDefined();
        expect(event.eventHash).toBeDefined();
      });

      // Chain positions should be sequential (may not be perfectly ordered due to concurrency)
      const chain = auditService.getAuditChain('test-workflow-123');
      expect(chain).toHaveLength(5);
      
      // Verify all positions are unique and within expected range
      const positions = chain.map(event => event.auditChainPosition);
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(5); // All positions should be unique
      expect(Math.min(...positions)).toBe(0);
      expect(Math.max(...positions)).toBe(4);
    });
  });
});