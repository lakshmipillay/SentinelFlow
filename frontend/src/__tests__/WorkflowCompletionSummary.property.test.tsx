/**
 * Property-Based Tests for Workflow Completion Summary
 * **Property 23: Workflow Completion Summary**
 * **Validates: Requirements 8.4, 8.5**
 *
 * Tests that the WorkflowCompletionSummary component correctly displays:
 * - Final decision summary (decision type, rationale, approver)
 * - Audit confirmation and event counts
 * - Resolution status with timestamp and final state
 * - Only renders for completed workflows (RESOLVED/TERMINATED)
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import { WorkflowCompletionSummary } from '../components/WorkflowCompletionSummary';
import {
  WorkflowState,
  WorkflowInstance,
  GovernanceDecision,
  AuditEvent,
  AgentOutput,
  RiskLevel,
  GovernanceDecisionType,
  AgentType,
} from '../types/workflow';

// Cleanup after each test - important for property tests
afterEach(() => {
  cleanup();
});

// Helper to run property test with cleanup between iterations
const runPropertyWithCleanup = <T,>(
  arb: fc.Arbitrary<T>,
  predicate: (value: T) => void,
  numRuns: number = 20
) => {
  fc.assert(
    fc.property(arb, (value) => {
      cleanup(); // Clean up before each iteration
      predicate(value);
      return true;
    }),
    { numRuns }
  );
};

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const createMockIcon = (name: string) => {
    const MockIcon = ({ className }: { className?: string }) =>
      React.createElement('span', { 'data-testid': `${name.toLowerCase()}-icon`, className }, name);
    MockIcon.displayName = name;
    return MockIcon;
  };
  return new Proxy(
    {},
    {
      get: (_, prop) => (typeof prop === 'string' ? createMockIcon(prop) : undefined),
    }
  );
});

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, variants, transition, whileHover, whileTap, ...rest } =
        props as Record<string, unknown>;
      return React.createElement('div', rest, children);
    },
    span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, variants, transition, whileHover, whileTap, ...rest } =
        props as Record<string, unknown>;
      return React.createElement('span', rest, children);
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) =>
    React.createElement(React.Fragment, null, children),
}));

// ============================================================================
// Generators
// ============================================================================

// Completed workflow states (RESOLVED or TERMINATED)
const completedStateArb = fc.constantFrom(WorkflowState.RESOLVED, WorkflowState.TERMINATED);

// Non-completed workflow states
const nonCompletedStateArb = fc.constantFrom(
  WorkflowState.IDLE,
  WorkflowState.INCIDENT_INGESTED,
  WorkflowState.ANALYZING,
  WorkflowState.RCA_COMPLETE,
  WorkflowState.GOVERNANCE_PENDING,
  WorkflowState.ACTION_PROPOSED,
  WorkflowState.VERIFIED
);

// Decision types
const decisionTypeArb = fc.constantFrom<GovernanceDecisionType>(
  'approve',
  'approve_with_restrictions',
  'block'
);

// Risk levels
const riskLevelArb = fc.constantFrom<RiskLevel>('low', 'medium', 'high', 'critical');

// Agent types
const agentTypeArb = fc.constantFrom<AgentType>('sre-agent', 'security-agent', 'governance-agent');

// Simple timestamp generator - use constant timestamps to avoid invalid date issues
const timestampArb = fc.constantFrom(
  '2024-01-15T10:30:00.000Z',
  '2024-02-20T14:45:00.000Z',
  '2024-03-10T08:15:00.000Z',
  '2024-04-05T16:00:00.000Z',
  '2024-05-25T12:30:00.000Z'
);

// Simple string generators
const simpleStringArb = fc.constantFrom(
  'user-001',
  'admin-002',
  'operator-003',
  'reviewer-004',
  'approver-005'
);

const roleArb = fc.constantFrom('admin', 'operator', 'reviewer', 'approver', 'engineer');

const rationaleArb = fc.constantFrom(
  'Approved after review',
  'Risk assessment complete',
  'Policy compliance verified',
  'Blocked due to high risk',
  'Approved with monitoring restrictions'
);

const serviceArb = fc.constantFrom(
  'api-gateway',
  'database',
  'auth-service',
  'payment-service',
  'frontend'
);

const restrictionArb = fc.constantFrom(
  'Monitor for 24 hours',
  'Rollback if errors increase',
  'Notify on-call team',
  'Limit to staging first'
);

// Governance decision generator
const governanceDecisionArb = fc.record({
  decision: decisionTypeArb,
  rationale: rationaleArb,
  approver: fc.record({
    id: simpleStringArb,
    role: roleArb,
  }),
  timestamp: timestampArb,
  restrictions: fc.option(fc.array(restrictionArb, { minLength: 0, maxLength: 2 }), { nil: undefined }),
  blastRadiusAssessment: fc.record({
    affectedServices: fc.array(serviceArb, { minLength: 0, maxLength: 3 }),
    riskLevel: riskLevelArb,
    reversible: fc.boolean(),
  }),
});

// Audit event type
const auditEventTypeArb = fc.constantFrom<AuditEvent['eventType']>(
  'state_transition',
  'agent_output',
  'governance_decision',
  'workflow_termination'
);

// Audit event generator
const auditEventArb = fc.record({
  eventId: fc.constantFrom('evt-001', 'evt-002', 'evt-003', 'evt-004', 'evt-005'),
  workflowId: fc.constantFrom('wf-001', 'wf-002', 'wf-003'),
  eventType: auditEventTypeArb,
  timestamp: timestampArb,
  actor: fc.constantFrom<AuditEvent['actor']>(
    'orchestrator',
    'sre-agent',
    'security-agent',
    'governance-agent',
    'human'
  ),
  details: fc.record({
    fromState: fc.option(fc.constantFrom(WorkflowState.ANALYZING, WorkflowState.RCA_COMPLETE), {
      nil: undefined,
    }),
    toState: fc.option(fc.constantFrom(WorkflowState.RESOLVED, WorkflowState.TERMINATED), {
      nil: undefined,
    }),
    terminationReason: fc.option(fc.constantFrom('Blocked by governance', 'Manual termination'), {
      nil: undefined,
    }),
  }),
});

// Agent output generator
const agentOutputArb = fc.record({
  agentName: agentTypeArb,
  skillsUsed: fc.array(fc.constantFrom('Datadog', 'CloudWatch', 'Splunk SIEM'), {
    minLength: 1,
    maxLength: 2,
  }),
  findings: fc.record({
    summary: fc.constantFrom('Root cause identified', 'Security analysis complete'),
    evidence: fc.array(fc.constantFrom('Log entry found', 'Metric spike detected'), {
      minLength: 1,
      maxLength: 2,
    }),
    correlations: fc.array(fc.constantFrom('Related to deployment', 'Config change detected'), {
      minLength: 0,
      maxLength: 1,
    }),
  }),
  confidenceLevel: fc.double({ min: 0.5, max: 1.0, noNaN: true }),
  timestamp: timestampArb,
  metadata: fc.record({
    processingTimeMs: fc.integer({ min: 100, max: 5000 }),
    dataSourcesAccessed: fc.array(fc.constantFrom('logs', 'metrics', 'traces'), {
      minLength: 1,
      maxLength: 2,
    }),
  }),
});

// Completed workflow instance generator
const completedWorkflowArb = fc.record({
  workflowId: fc.constantFrom('wf-001', 'wf-002', 'wf-003'),
  currentState: completedStateArb,
  timestamp: timestampArb,
  agentOutputs: fc.array(agentOutputArb, { minLength: 1, maxLength: 3 }),
  governanceDecision: fc.option(governanceDecisionArb, { nil: undefined }),
  auditTrail: fc.array(auditEventArb, { minLength: 1, maxLength: 5 }),
});

// Non-completed workflow instance generator
const nonCompletedWorkflowArb = fc.record({
  workflowId: fc.constantFrom('wf-001', 'wf-002', 'wf-003'),
  currentState: nonCompletedStateArb,
  timestamp: timestampArb,
  agentOutputs: fc.array(agentOutputArb, { minLength: 0, maxLength: 2 }),
  governanceDecision: fc.option(governanceDecisionArb, { nil: undefined }),
  auditTrail: fc.array(auditEventArb, { minLength: 0, maxLength: 3 }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 23: Workflow Completion Summary', () => {
  describe('8.4 Plain-English Summary of Findings', () => {
    test('completed workflows should display the completion summary section', () => {
      runPropertyWithCleanup(completedWorkflowArb, (workflow) => {
        render(
          React.createElement(WorkflowCompletionSummary, {
            workflow: workflow as WorkflowInstance,
          })
        );

        // Should render the summary header
        expect(screen.getByText('Workflow Completion Summary')).toBeInTheDocument();
      }, 25);
    });

    test('completed workflows should display resolution status section', () => {
      runPropertyWithCleanup(completedWorkflowArb, (workflow) => {
        render(
          React.createElement(WorkflowCompletionSummary, {
            workflow: workflow as WorkflowInstance,
          })
        );

        // Should show workflow ID
        expect(screen.getByText(workflow.workflowId)).toBeInTheDocument();

        // Should show final state
        expect(screen.getByText(workflow.currentState)).toBeInTheDocument();
      }, 25);
    });

    test('resolved workflows should display "Workflow Resolved" status', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter((w) => w.currentState === WorkflowState.RESOLVED),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          expect(screen.getByText('Workflow Resolved')).toBeInTheDocument();
        },
        20
      );
    });

    test('terminated workflows should display "Workflow Terminated" status', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter((w) => w.currentState === WorkflowState.TERMINATED),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          expect(screen.getByText('Workflow Terminated')).toBeInTheDocument();
        },
        20
      );
    });
  });

  describe('8.5 Final Decision Summary Display', () => {
    test('should display governance decision type when decision exists', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter((w) => w.governanceDecision !== undefined),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          const decision = workflow.governanceDecision!;

          // Should display decision label based on type
          if (decision.decision === 'approve') {
            expect(screen.getByText('Approved')).toBeInTheDocument();
          } else if (decision.decision === 'approve_with_restrictions') {
            expect(screen.getByText('Approved with Restrictions')).toBeInTheDocument();
          } else if (decision.decision === 'block') {
            expect(screen.getByText('Blocked')).toBeInTheDocument();
          }
        },
        25
      );
    });

    test('should display approver information when decision exists', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter((w) => w.governanceDecision !== undefined),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          const decision = workflow.governanceDecision!;

          // Should display approver ID
          expect(screen.getByText(decision.approver.id)).toBeInTheDocument();
        },
        25
      );
    });

    test('should display decision rationale when decision exists', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter((w) => w.governanceDecision !== undefined),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          const decision = workflow.governanceDecision!;

          // Should display rationale
          expect(screen.getByText(decision.rationale)).toBeInTheDocument();
        },
        25
      );
    });

    test('should display risk level when decision exists', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter((w) => w.governanceDecision !== undefined),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          const decision = workflow.governanceDecision!;
          const riskText = `${decision.blastRadiusAssessment.riskLevel.toUpperCase()} Risk`;

          // Should display risk level
          expect(screen.getByText(riskText)).toBeInTheDocument();
        },
        25
      );
    });
  });

  describe('Audit Trail Confirmation', () => {
    test('should display audit trail confirmation with event count', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter((w) => w.auditTrail.length > 0),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          // Should show audit trail confirmed message
          expect(screen.getByText('Audit Trail Confirmed')).toBeInTheDocument();

          // Should show event count
          const eventCountText = `${workflow.auditTrail.length} events recorded`;
          expect(screen.getByText(eventCountText)).toBeInTheDocument();
        },
        25
      );
    });

    test('should display correct event type counts in audit summary', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter((w) => w.auditTrail.length > 0),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          // Count events by type
          const eventCounts = {
            state_transition: 0,
            agent_output: 0,
            governance_decision: 0,
            workflow_termination: 0,
          };
          workflow.auditTrail.forEach((event) => {
            eventCounts[event.eventType]++;
          });

          // Verify displayed counts match
          if (eventCounts.state_transition > 0) {
            expect(
              screen.getByText(`${eventCounts.state_transition} state transitions`)
            ).toBeInTheDocument();
          }
          if (eventCounts.agent_output > 0) {
            expect(
              screen.getByText(`${eventCounts.agent_output} agent outputs`)
            ).toBeInTheDocument();
          }
          if (eventCounts.governance_decision > 0) {
            expect(
              screen.getByText(`${eventCounts.governance_decision} governance decision`)
            ).toBeInTheDocument();
          }
          if (eventCounts.workflow_termination > 0) {
            expect(
              screen.getByText(`${eventCounts.workflow_termination} termination`)
            ).toBeInTheDocument();
          }
        },
        25
      );
    });
  });

  describe('Non-Completed Workflow Handling', () => {
    test('should not render summary for non-completed workflows', () => {
      runPropertyWithCleanup(nonCompletedWorkflowArb, (workflow) => {
        const { container } = render(
          React.createElement(WorkflowCompletionSummary, {
            workflow: workflow as WorkflowInstance,
          })
        );

        // Should not render anything for non-completed workflows
        expect(container.firstChild).toBeNull();
      }, 30);
    });

    test('should not display completion summary text for non-completed workflows', () => {
      runPropertyWithCleanup(nonCompletedWorkflowArb, (workflow) => {
        render(
          React.createElement(WorkflowCompletionSummary, {
            workflow: workflow as WorkflowInstance,
          })
        );

        // Should not find completion summary elements
        expect(screen.queryByText('Workflow Completion Summary')).not.toBeInTheDocument();
        expect(screen.queryByText('Workflow Resolved')).not.toBeInTheDocument();
        expect(screen.queryByText('Workflow Terminated')).not.toBeInTheDocument();
      }, 30);
    });
  });

  describe('Resolution Status Display', () => {
    test('should display workflow ID in resolution status', () => {
      runPropertyWithCleanup(completedWorkflowArb, (workflow) => {
        render(
          React.createElement(WorkflowCompletionSummary, {
            workflow: workflow as WorkflowInstance,
          })
        );

        // Should display workflow ID
        expect(screen.getByText(workflow.workflowId)).toBeInTheDocument();
      }, 25);
    });

    test('should display final state badge', () => {
      runPropertyWithCleanup(completedWorkflowArb, (workflow) => {
        render(
          React.createElement(WorkflowCompletionSummary, {
            workflow: workflow as WorkflowInstance,
          })
        );

        // Should display the current state
        expect(screen.getByText(workflow.currentState)).toBeInTheDocument();
      }, 25);
    });

    test('should display agent outputs summary when agents completed analysis', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter((w) => w.agentOutputs.length > 0),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          // Should show agent analysis completed section
          expect(screen.getByText('Agent Analysis Completed:')).toBeInTheDocument();

          // Should show at least one agent name from the outputs (use queryAllByText to handle duplicates)
          const agentNames = workflow.agentOutputs.map((o) => o.agentName);
          const uniqueAgentNames = [...new Set(agentNames)];
          const foundAgent = uniqueAgentNames.some((name) => {
            const elements = screen.queryAllByText(new RegExp(name));
            return elements.length > 0;
          });
          expect(foundAgent).toBe(true);
        },
        25
      );
    });
  });

  describe('Blast Radius Information', () => {
    test('should display affected services count when decision exists', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter((w) => w.governanceDecision !== undefined),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          const decision = workflow.governanceDecision!;
          const servicesCount = decision.blastRadiusAssessment.affectedServices.length;
          const servicesText = `${servicesCount} services affected`;

          // Use getAllByText since there might be multiple instances
          const elements = screen.getAllByText(servicesText);
          expect(elements.length).toBeGreaterThan(0);
        },
        25
      );
    });

    test('should display reversibility status when decision exists', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter((w) => w.governanceDecision !== undefined),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          const decision = workflow.governanceDecision!;
          const reversibilityText = decision.blastRadiusAssessment.reversible
            ? 'Reversible'
            : 'Not Reversible';

          // Use getAllByText since there might be multiple instances
          const elements = screen.getAllByText(reversibilityText);
          expect(elements.length).toBeGreaterThan(0);
        },
        25
      );
    });
  });

  describe('Restrictions Display', () => {
    test('should display restrictions when present in decision', () => {
      runPropertyWithCleanup(
        completedWorkflowArb.filter(
          (w) =>
            w.governanceDecision !== undefined &&
            w.governanceDecision.restrictions !== undefined &&
            w.governanceDecision.restrictions.length > 0
        ),
        (workflow) => {
          render(
            React.createElement(WorkflowCompletionSummary, {
              workflow: workflow as WorkflowInstance,
            })
          );

          // Should show restrictions section - use getAllByText for multiple instances
          const restrictionHeaders = screen.getAllByText('Restrictions Applied:');
          expect(restrictionHeaders.length).toBeGreaterThan(0);

          // Should show each restriction (at least once)
          workflow.governanceDecision!.restrictions!.forEach((restriction) => {
            const restrictionElements = screen.getAllByText(restriction);
            expect(restrictionElements.length).toBeGreaterThan(0);
          });
        },
        20
      );
    });
  });
});

describe('Workflow Completion Summary Edge Cases', () => {
  test('should handle workflow with empty audit trail gracefully', () => {
    const workflowWithEmptyAudit: WorkflowInstance = {
      workflowId: 'wf-empty-audit',
      currentState: WorkflowState.RESOLVED,
      timestamp: new Date().toISOString(),
      agentOutputs: [],
      auditTrail: [],
    };

    render(React.createElement(WorkflowCompletionSummary, { workflow: workflowWithEmptyAudit }));

    // Should still render completion summary
    expect(screen.getByText('Workflow Completion Summary')).toBeInTheDocument();
    expect(screen.getByText('Workflow Resolved')).toBeInTheDocument();

    // Should not show audit trail section when empty
    expect(screen.queryByText('Audit Trail Confirmed')).not.toBeInTheDocument();
  });

  test('should handle workflow without governance decision', () => {
    const workflowWithoutDecision: WorkflowInstance = {
      workflowId: 'wf-no-decision',
      currentState: WorkflowState.TERMINATED,
      timestamp: new Date().toISOString(),
      agentOutputs: [],
      auditTrail: [
        {
          eventId: 'evt-001',
          workflowId: 'wf-no-decision',
          eventType: 'workflow_termination',
          timestamp: new Date().toISOString(),
          actor: 'orchestrator',
          details: {
            terminationReason: 'Manual termination',
          },
        },
      ],
    };

    render(React.createElement(WorkflowCompletionSummary, { workflow: workflowWithoutDecision }));

    // Should render completion summary
    expect(screen.getByText('Workflow Completion Summary')).toBeInTheDocument();
    expect(screen.getByText('Workflow Terminated')).toBeInTheDocument();

    // Should not show decision-related elements
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument();
  });

  test('should handle all decision types correctly', () => {
    const decisionTypes: GovernanceDecisionType[] = ['approve', 'approve_with_restrictions', 'block'];
    const expectedLabels = ['Approved', 'Approved with Restrictions', 'Blocked'];

    decisionTypes.forEach((decisionType, index) => {
      cleanup();

      const workflow: WorkflowInstance = {
        workflowId: `wf-${decisionType}`,
        currentState:
          decisionType === 'block' ? WorkflowState.TERMINATED : WorkflowState.RESOLVED,
        timestamp: new Date().toISOString(),
        agentOutputs: [],
        governanceDecision: {
          decision: decisionType,
          rationale: 'Test rationale',
          approver: { id: 'test-user', role: 'admin' },
          timestamp: new Date().toISOString(),
          blastRadiusAssessment: {
            affectedServices: ['service-a'],
            riskLevel: 'medium',
            reversible: true,
          },
        },
        auditTrail: [],
      };

      render(React.createElement(WorkflowCompletionSummary, { workflow }));

      expect(screen.getByText(expectedLabels[index])).toBeInTheDocument();
    });
  });
});
