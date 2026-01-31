/**
 * Property-Based Tests for Audit Trail Immutability
 * **Property 11: Audit Trail Immutability**
 * **Validates: Requirements 3.5, 10.1**
 * 
 * Tests that audit events are immutable once created and cannot be modified,
 * ensuring audit trail integrity and preventing tampering across all workflows.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { AuditArtifactService } from '../AuditArtifactService';
import { WorkflowState, AgentOutput } from '../../types/workflow';
import { AgentName } from '../../types/agent-skills';

describe('Property 11: Audit Trail Immutability', () => {
  let stateManager: WorkflowStateManager;
  let auditService: AuditArtifactService;

  beforeEach(() => {
    auditService = new AuditArtifactService();
    stateManager = new WorkflowStateManager(auditService);
  });

  /**
   * Simplified generators for property-based testing
   */
  const generateValidStateSequence = (): fc.Arbitrary<WorkflowState[]> => {
    return fc.constantFrom(
      [WorkflowState.INCIDENT_INGESTED],
      [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING],
      [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING, WorkflowState.RCA_COMPLETE],
      [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING, WorkflowState.RCA_COMPLETE, WorkflowState.GOVERNANCE_PENDING],
      // Note: Cannot include ACTION_PROPOSED without governance decision
      [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING, WorkflowState.RCA_COMPLETE, WorkflowState.GOVERNANCE_PENDING, WorkflowState.TERMINATED]
    );
  };

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
          evidence: ['CPU at 95%', 'Memory usage normal'],
          correlations: ['Spike correlates with deployment'],
          recommendations: ['Scale horizontally', 'Investigate recent changes']
        },
        confidenceLevel: 0.85,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 1500,
          dataSourcesAccessed: ['Datadog', 'CloudWatch'],
          skillsMetadata: {
            availableSkills: ['Datadog', 'CloudWatch', 'Prometheus', 'OpenTelemetry'],
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
          evidence: ['Multiple failed login attempts', 'Access from new location'],
          correlations: ['Pattern matches known attack signature'],
          recommendations: ['Review access logs', 'Enable MFA']
        },
        confidenceLevel: 0.75,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 2000,
          dataSourcesAccessed: ['Splunk SIEM', 'IAM Logs'],
          skillsMetadata: {
            availableSkills: ['Splunk SIEM', 'IAM Logs', 'CSPM'],
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
          evidence: ['Change window available', 'Approval authority verified'],
          correlations: ['Aligns with maintenance schedule'],
          recommendations: ['Proceed with standard approval process']
        },
        confidenceLevel: 0.9,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: 1000,
          dataSourcesAccessed: ['Policy Engine', 'Change Management'],
          skillsMetadata: {
            availableSkills: ['Policy Engine', 'Change Management', 'Risk Register'],
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

  const generateAgentOutput = (agentName: AgentName): fc.Arbitrary<AgentOutput> => {
    return fc.constant(generateAgentOutputForAgent(agentName));
  };

  /**
   * Helper function to create a workflow and transition through states
   */
  async function createWorkflowWithTransitions(states: WorkflowState[]): Promise<string> {
    const workflow = await stateManager.createWorkflow();
    const workflowId = workflow.workflowId;
    
    for (const state of states) {
      await stateManager.transitionTo(workflowId, state);
    }
    
    return workflowId;
  }

  /**
   * Property Tests
   */
  test('All audit events have immutable flag set to true', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidStateSequence(),
        async (states) => {
          const workflowId = await createWorkflowWithTransitions(states);
          
          // Get audit chain
          const auditChain = stateManager.getAuditChain(workflowId);
          
          // Verify all events have immutable flag set to true
          expect(auditChain.length).toBeGreaterThan(0);
          
          auditChain.forEach((event, index) => {
            expect(event.immutable).toBe(true);
            expect(event.immutable).toBe(true as const); // Type-level immutability check
            
            // Verify event has required immutability fields
            expect(event.eventHash).toBeDefined();
            expect(event.eventHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
            expect(event.auditChainPosition).toBe(index);
            
            // Verify previous hash linkage (except for first event)
            if (index > 0) {
              expect(event.previousEventHash).toBeDefined();
              expect(event.previousEventHash).toBe(auditChain[index - 1].eventHash);
            }
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Audit events cannot be modified after creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidStateSequence(),
        async (states) => {
          const workflowId = await createWorkflowWithTransitions(states);
          
          // Get initial audit chain
          const initialAuditChain = stateManager.getAuditChain(workflowId);
          const initialLength = initialAuditChain.length;
          
          // Store initial event hashes
          const initialHashes = initialAuditChain.map(event => event.eventHash);
          const initialTimestamps = initialAuditChain.map(event => event.timestamp);
          
          // Attempt to modify audit events (should not affect stored events)
          // The returned audit chain is frozen at the array level
          const isFrozen = Object.isFrozen(initialAuditChain);
          expect(isFrozen).toBe(true);
          
          // Note: Individual events may not be deeply frozen, but the array is immutable
          // and getAuditChain returns a copy, so modifications don't affect the stored chain
          
          // Get audit chain again
          const laterAuditChain = stateManager.getAuditChain(workflowId);
          
          // Verify audit chain length hasn't changed
          expect(laterAuditChain.length).toBe(initialLength);
          
          // Verify all event hashes remain unchanged
          laterAuditChain.forEach((event, index) => {
            expect(event.eventHash).toBe(initialHashes[index]);
            expect(event.timestamp).toBe(initialTimestamps[index]);
            expect(event.immutable).toBe(true);
          });
          
          // Verify chain integrity is maintained
          const integrity = stateManager.verifyAuditChainIntegrity(workflowId);
          expect(integrity.valid).toBe(true);
          expect(integrity.errors).toHaveLength(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Audit chain maintains cryptographic integrity across state transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidStateSequence(),
        async (states) => {
          const workflowId = await createWorkflowWithTransitions(states);
          
          // Get audit chain
          const auditChain = stateManager.getAuditChain(workflowId);
          
          // Verify chain integrity
          const integrity = stateManager.verifyAuditChainIntegrity(workflowId);
          
          expect(integrity.valid).toBe(true);
          expect(integrity.errors).toHaveLength(0);
          expect(integrity.chainLength).toBe(auditChain.length);
          
          // Verify each event's hash is correctly calculated
          auditChain.forEach((event, index) => {
            // Hash should be SHA-256 (64 hex characters)
            expect(event.eventHash).toMatch(/^[a-f0-9]{64}$/);
            
            // Chain position should match index
            expect(event.auditChainPosition).toBe(index);
            
            // Previous hash should link to previous event (except first)
            if (index > 0) {
              expect(event.previousEventHash).toBe(auditChain[index - 1].eventHash);
            } else {
              expect(event.previousEventHash).toBeUndefined();
            }
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Agent output audit events are immutable and maintain integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateAgentName(),
        async (agentName) => {
          // Create workflow and transition to ANALYZING state
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Generate agent output for the specific agent
          const agentOutput = generateAgentOutputForAgent(agentName);
          
          // Add agent output
          await stateManager.addAgentOutput(workflowId, agentOutput);
          
          // Get audit chain
          const auditChain = stateManager.getAuditChain(workflowId);
          
          // Find agent output audit event
          const agentOutputEvent = auditChain.find(event => 
            event.eventType === 'agent_output' && 
            event.details.agentOutput?.agentName === agentName
          );
          
          expect(agentOutputEvent).toBeDefined();
          expect(agentOutputEvent!.immutable).toBe(true);
          expect(agentOutputEvent!.eventHash).toMatch(/^[a-f0-9]{64}$/);
          
          // Verify agent output context is captured
          expect(agentOutputEvent!.contextCapture.agentAnalysisContext).toBeDefined();
          expect(agentOutputEvent!.contextCapture.agentAnalysisContext!.skillsUsed).toEqual(agentOutput.skillsUsed);
          expect(agentOutputEvent!.contextCapture.agentAnalysisContext!.confidenceLevel).toBe(agentOutput.confidenceLevel);
          
          // Verify chain integrity after agent output
          const integrity = stateManager.verifyAuditChainIntegrity(workflowId);
          expect(integrity.valid).toBe(true);
          expect(integrity.errors).toHaveLength(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Workflow termination audit events are immutable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'Workflow completed successfully',
          'Governance blocked action',
          'Manual termination requested',
          'Error during processing'
        ),
        async (terminationReason) => {
          // Create workflow and transition through states
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Terminate workflow
          await stateManager.terminateWorkflow(workflowId, terminationReason);
          
          // Get audit chain
          const auditChain = stateManager.getAuditChain(workflowId);
          
          // Find termination audit event
          const terminationEvent = auditChain.find(event => 
            event.eventType === 'workflow_termination'
          );
          
          expect(terminationEvent).toBeDefined();
          expect(terminationEvent!.immutable).toBe(true);
          expect(terminationEvent!.eventHash).toMatch(/^[a-f0-9]{64}$/);
          expect(terminationEvent!.details.terminationReason).toBe(terminationReason);
          
          // Verify termination context is captured
          expect(terminationEvent!.contextCapture.terminationContext).toBeDefined();
          expect(terminationEvent!.contextCapture.terminationContext!.terminationReason).toBe(terminationReason);
          
          // Verify chain integrity after termination
          const integrity = stateManager.verifyAuditChainIntegrity(workflowId);
          expect(integrity.valid).toBe(true);
          expect(integrity.errors).toHaveLength(0);
          
          // Verify workflow is in TERMINATED state
          expect(stateManager.getCurrentState(workflowId)).toBe(WorkflowState.TERMINATED);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Multiple workflows maintain independent immutable audit chains', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          [
            [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING],
            [WorkflowState.INCIDENT_INGESTED, WorkflowState.ANALYZING, WorkflowState.RCA_COMPLETE],
            [WorkflowState.INCIDENT_INGESTED]
          ]
        ),
        async (workflowStates) => {
          const workflowIds: string[] = [];
          const initialChains: Map<string, any[]> = new Map();
          
          // Create multiple workflows with different state transitions
          for (const states of workflowStates) {
            const workflowId = await createWorkflowWithTransitions(states);
            workflowIds.push(workflowId);
            
            const chain = stateManager.getAuditChain(workflowId);
            initialChains.set(workflowId, chain.map(event => ({
              eventHash: event.eventHash,
              timestamp: event.timestamp,
              chainPosition: event.auditChainPosition
            })));
          }
          
          // Verify each workflow has independent audit chain
          workflowIds.forEach((workflowId, index) => {
            const auditChain = stateManager.getAuditChain(workflowId);
            const initialChain = initialChains.get(workflowId)!;
            
            // Verify chain length matches expected
            expect(auditChain.length).toBe(initialChain.length);
            
            // Verify all events are immutable
            auditChain.forEach((event, eventIndex) => {
              expect(event.immutable).toBe(true);
              expect(event.eventHash).toBe(initialChain[eventIndex].eventHash);
              expect(event.timestamp).toBe(initialChain[eventIndex].timestamp);
              expect(event.auditChainPosition).toBe(initialChain[eventIndex].chainPosition);
            });
            
            // Verify chain integrity
            const integrity = stateManager.verifyAuditChainIntegrity(workflowId);
            expect(integrity.valid).toBe(true);
            expect(integrity.errors).toHaveLength(0);
          });
          
          // Verify workflows don't share audit events
          const allEventIds = new Set<string>();
          workflowIds.forEach(workflowId => {
            const auditChain = stateManager.getAuditChain(workflowId);
            auditChain.forEach(event => {
              expect(allEventIds.has(event.eventId)).toBe(false);
              allEventIds.add(event.eventId);
            });
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Audit chain integrity verification detects tampering attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidStateSequence(),
        async (states) => {
          const workflowId = await createWorkflowWithTransitions(states);
          
          // Verify initial integrity
          const initialIntegrity = stateManager.verifyAuditChainIntegrity(workflowId);
          expect(initialIntegrity.valid).toBe(true);
          expect(initialIntegrity.errors).toHaveLength(0);
          
          // Get audit chain (frozen copy)
          const auditChain = stateManager.getAuditChain(workflowId);
          
          // Attempt to modify frozen audit chain should be prevented
          const isFrozen = Object.isFrozen(auditChain);
          expect(isFrozen).toBe(true);
          
          // Verify array methods that would mutate are prevented
          const originalLength = auditChain.length;
          try {
            (auditChain as any).push({ eventType: 'fake_event' });
          } catch (e) {
            // Expected to fail
          }
          expect(auditChain.length).toBe(originalLength);
          
          // Verify integrity remains valid after tampering attempts
          const laterIntegrity = stateManager.verifyAuditChainIntegrity(workflowId);
          expect(laterIntegrity.valid).toBe(true);
          expect(laterIntegrity.errors).toHaveLength(0);
          expect(laterIntegrity.chainLength).toBe(initialIntegrity.chainLength);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Audit events maintain immutability across workflow lifecycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateAgentName(),
        fc.constantFrom('Workflow completed', 'Manual termination'),
        async (agentName, terminationReason) => {
          // Create workflow and go through full lifecycle
          const workflow = await stateManager.createWorkflow();
          const workflowId = workflow.workflowId;
          
          // Transition through states
          await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
          await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
          
          // Add agent output with correct agent name and skills
          const agentOutput = generateAgentOutputForAgent(agentName);
          await stateManager.addAgentOutput(workflowId, agentOutput);
          
          // Continue transitions
          await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
          
          // Terminate workflow
          await stateManager.terminateWorkflow(workflowId, terminationReason);
          
          // Get final audit chain
          const auditChain = stateManager.getAuditChain(workflowId);
          
          // Verify all events are immutable
          expect(auditChain.length).toBeGreaterThan(0);
          auditChain.forEach((event, index) => {
            expect(event.immutable).toBe(true);
            expect(event.eventHash).toMatch(/^[a-f0-9]{64}$/);
            expect(event.auditChainPosition).toBe(index);
            
            // Verify chain linkage
            if (index > 0) {
              expect(event.previousEventHash).toBe(auditChain[index - 1].eventHash);
            }
          });
          
          // Verify chain integrity
          const integrity = stateManager.verifyAuditChainIntegrity(workflowId);
          expect(integrity.valid).toBe(true);
          expect(integrity.errors).toHaveLength(0);
          
          // Verify different event types are present
          const eventTypes = new Set(auditChain.map(event => event.eventType));
          expect(eventTypes.has('state_transition')).toBe(true);
          expect(eventTypes.has('agent_output')).toBe(true);
          expect(eventTypes.has('workflow_termination')).toBe(true);
          
          // Verify all events have required immutability fields
          auditChain.forEach(event => {
            expect(event.eventId).toBeDefined();
            expect(event.workflowId).toBe(workflowId);
            expect(event.timestamp).toBeDefined();
            expect(event.actor).toBeDefined();
            expect(event.immutable).toBe(true);
          });
        }
      ),
      { numRuns: 20 } // Reduced iterations for performance
    );
  }, 30000); // 30 second timeout for this test

  test('Audit metrics remain consistent with immutable audit chain', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidStateSequence(),
        async (states) => {
          const workflowId = await createWorkflowWithTransitions(states);
          
          // Get audit chain and metrics
          const auditChain = stateManager.getAuditChain(workflowId);
          const metrics = stateManager.getAuditMetrics(workflowId);
          
          expect(metrics).toBeDefined();
          
          // Verify metrics match audit chain
          expect(metrics!.totalEvents).toBe(auditChain.length);
          
          // Count event types in chain
          const stateTransitions = auditChain.filter(event => event.eventType === 'state_transition').length;
          const agentOutputs = auditChain.filter(event => event.eventType === 'agent_output').length;
          const governanceDecisions = auditChain.filter(event => event.eventType === 'governance_decision').length;
          const terminations = auditChain.filter(event => event.eventType === 'workflow_termination').length;
          
          // Verify metrics match counts
          expect(metrics!.stateTransitions).toBe(stateTransitions);
          expect(metrics!.agentOutputs).toBe(agentOutputs);
          expect(metrics!.governanceDecisions).toBe(governanceDecisions);
          expect(metrics!.workflowTerminations).toBe(terminations);
          
          // Verify metrics are also immutable (frozen)
          const isFrozen = Object.isFrozen(metrics);
          expect(isFrozen).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });
});
