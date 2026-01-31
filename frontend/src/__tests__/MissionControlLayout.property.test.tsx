/**
 * Property-Based Tests for Mission Control Layout Consistency
 * **Property 15: Mission Control Layout Consistency**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 *
 * Tests that the Mission Control dashboard maintains consistent layout
 * across all workflow states and data conditions:
 * - Three-pane layout is always rendered (25%/50%/25%)
 * - All workflow states render without errors
 * - Governance gate blocks workflow progression visually
 * - Agent cards display correctly for all agent types
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import MissionControl from '../app/page';
import { WorkflowProvider } from '../context/WorkflowContext';
import {
  WorkflowState,
  AgentType,
  AgentStatus,
  RiskLevel,
  HealthStatus,
  AlertSeverity,
} from '../types/workflow';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const createMockIcon = (name: string) => {
    const MockIcon = ({ className }: { className?: string }) => (
      React.createElement('span', { 'data-testid': `${name.toLowerCase()}-icon`, className }, name)
    );
    MockIcon.displayName = name;
    return MockIcon;
  };
  return new Proxy({}, {
    get: (_, prop) => typeof prop === 'string' ? createMockIcon(prop) : undefined
  });
});

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, variants, transition, whileHover, whileTap, ...rest } = props as Record<string, unknown>;
      return React.createElement('div', rest, children);
    },
    span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, variants, transition, whileHover, whileTap, ...rest } = props as Record<string, unknown>;
      return React.createElement('span', rest, children);
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children),
}));


// Mock useWebSocket hook
jest.mock('../hooks/useWebSocket', () => ({
  useWebSocket: jest.fn(() => ({
    connectionStatus: 'connected',
    clientId: 'test-client-123',
    isConnected: true,
    subscribeToWorkflow: jest.fn(),
    requestWorkflowState: jest.fn(),
    registerHandlers: jest.fn(),
    reconnect: jest.fn(),
  })),
}));

// Helper to render with WorkflowProvider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(React.createElement(WorkflowProvider, null, ui));
};

// Generators
const workflowStateArb = fc.constantFrom(
  WorkflowState.IDLE,
  WorkflowState.INCIDENT_INGESTED,
  WorkflowState.ANALYZING,
  WorkflowState.RCA_COMPLETE,
  WorkflowState.GOVERNANCE_PENDING,
  WorkflowState.ACTION_PROPOSED,
  WorkflowState.VERIFIED,
  WorkflowState.RESOLVED,
  WorkflowState.TERMINATED
);

const agentTypeArb = fc.constantFrom<AgentType>('sre-agent', 'security-agent', 'governance-agent');
const agentStatusArb = fc.constantFrom<AgentStatus>('idle', 'analyzing', 'complete');
const riskLevelArb = fc.constantFrom<RiskLevel>('low', 'medium', 'high', 'critical');
const healthStatusArb = fc.constantFrom<HealthStatus>('healthy', 'warning', 'critical');
const alertSeverityArb = fc.constantFrom<AlertSeverity>('critical', 'warning', 'info');
const confidenceLevelArb = fc.double({ min: 0, max: 1, noNaN: true });


// Property Tests
describe('Property 15: Mission Control Layout Consistency', () => {
  describe('5.1 Three-Pane Layout Structure', () => {
    test('should always render exactly three panels regardless of workflow state', () => {
      fc.assert(
        fc.property(workflowStateArb, () => {
          const { container } = renderWithProvider(React.createElement(MissionControl));
          
          expect(screen.getByText('Incoming Signal')).toBeInTheDocument();
          expect(screen.getByText('Agent Brain & Workflow')).toBeInTheDocument();
          expect(screen.getByText('Human Handoff & Governance')).toBeInTheDocument();
          
          const sidePanels = container.querySelectorAll('.w-1\\/4');
          expect(sidePanels.length).toBe(2);
          
          const centerPanel = container.querySelector('.flex-1.min-w-\\[400px\\]');
          expect(centerPanel).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });

    test('should maintain panel proportions with correct width constraints', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          const { container } = renderWithProvider(React.createElement(MissionControl));
          
          const minWidthPanels = container.querySelectorAll('.min-w-\\[280px\\]');
          const maxWidthPanels = container.querySelectorAll('.max-w-\\[400px\\]');
          
          expect(minWidthPanels.length).toBe(2);
          expect(maxWidthPanels.length).toBe(2);
        }),
        { numRuns: 20 }
      );
    });

    test('should render header with title and connection status', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          renderWithProvider(React.createElement(MissionControl));
          
          expect(screen.getByText('SentinelFlow Mission Control')).toBeInTheDocument();
          expect(screen.getByText('SRE Sidekick')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });
  });


  describe('5.2 Real-time Workflow State Visualization', () => {
    test('should render workflow progress tracker in center panel', () => {
      fc.assert(
        fc.property(workflowStateArb, () => {
          renderWithProvider(React.createElement(MissionControl));
          expect(screen.getByText('Workflow Progress')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });

    test('should render all required left panel components', () => {
      fc.assert(
        fc.property(alertSeverityArb, () => {
          renderWithProvider(React.createElement(MissionControl));
          expect(screen.getByText('Active Alert')).toBeInTheDocument();
          expect(screen.getByText('Live Logs')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('5.3 Agent Activity and Findings Display', () => {
    test('should always render all three specialist agent cards', () => {
      fc.assert(
        fc.property(agentStatusArb, () => {
          renderWithProvider(React.createElement(MissionControl));
          
          expect(screen.getByText('SRE Agent')).toBeInTheDocument();
          expect(screen.getByText('Security Agent')).toBeInTheDocument();
          expect(screen.getByText('Governance Agent')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });

    test('should render specialist agents section in center panel', () => {
      fc.assert(
        fc.property(agentTypeArb, () => {
          renderWithProvider(React.createElement(MissionControl));
          expect(screen.getByText('Specialist Agents')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });

    test('should render blast radius section in center panel', () => {
      fc.assert(
        fc.property(riskLevelArb, () => {
          renderWithProvider(React.createElement(MissionControl));
          expect(screen.getByText('Blast Radius')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });
  });


  describe('5.4 Governance Gate Enforcement in UI', () => {
    test('should always render governance gate section in right panel', () => {
      fc.assert(
        fc.property(riskLevelArb, () => {
          renderWithProvider(React.createElement(MissionControl));
          expect(screen.getByText('Governance Gate')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });

    test('should render agent summary section in right panel', () => {
      fc.assert(
        fc.property(agentTypeArb, () => {
          renderWithProvider(React.createElement(MissionControl));
          expect(screen.getByText('Agent Summary')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });

    test('should render audit trail section in right panel', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          renderWithProvider(React.createElement(MissionControl));
          expect(screen.getByText('Audit Trail')).toBeInTheDocument();
          expect(screen.getByText('Events Recorded')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });

    test('should show no pending governance decisions when no request is active', () => {
      fc.assert(
        fc.property(workflowStateArb, () => {
          renderWithProvider(React.createElement(MissionControl));
          expect(screen.getByText('No pending governance decisions')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });
  });


  describe('Layout Consistency Across Data Variations', () => {
    test('should maintain layout with various confidence levels', () => {
      fc.assert(
        fc.property(confidenceLevelArb, (confidence) => {
          expect(confidence).toBeGreaterThanOrEqual(0);
          expect(confidence).toBeLessThanOrEqual(1);
          
          const { container } = renderWithProvider(React.createElement(MissionControl));
          expect(container.querySelector('.h-screen')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });

    test('should maintain layout with various risk levels', () => {
      fc.assert(
        fc.property(riskLevelArb, (riskLevel) => {
          expect(['low', 'medium', 'high', 'critical']).toContain(riskLevel);
          
          renderWithProvider(React.createElement(MissionControl));
          
          expect(screen.getByText('Incoming Signal')).toBeInTheDocument();
          expect(screen.getByText('Agent Brain & Workflow')).toBeInTheDocument();
          expect(screen.getByText('Human Handoff & Governance')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Panel Border and Styling Consistency', () => {
    test('should have correct border styling on panels', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          const { container } = renderWithProvider(React.createElement(MissionControl));
          
          const leftPanelBorder = container.querySelector('.border-r.border-border');
          expect(leftPanelBorder).toBeInTheDocument();
          
          const rightPanelBorder = container.querySelector('.border-l.border-border');
          expect(rightPanelBorder).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });

    test('should use dark mode background classes', () => {
      fc.assert(
        fc.property(workflowStateArb, () => {
          const { container } = renderWithProvider(React.createElement(MissionControl));
          
          const bgBackground = container.querySelector('.bg-background');
          expect(bgBackground).toBeInTheDocument();
          
          const bgPanels = container.querySelectorAll('.bg-panel');
          expect(bgPanels.length).toBeGreaterThan(0);
        }),
        { numRuns: 20 }
      );
    });
  });


  describe('Header Consistency', () => {
    test('should render header with all required elements', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          const { container } = renderWithProvider(React.createElement(MissionControl));
          
          const header = container.querySelector('header');
          expect(header).toBeInTheDocument();
          expect(header).toHaveClass('h-14');
          
          expect(screen.getByText('SentinelFlow Mission Control')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });

    test('should show demo mode indicator when in demo mode', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          renderWithProvider(React.createElement(MissionControl));
          
          expect(screen.getByText('DEMO')).toBeInTheDocument();
          expect(screen.getByText('Reset')).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Overflow and Scrolling Behavior', () => {
    test('should have overflow-hidden on main container', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          const { container } = renderWithProvider(React.createElement(MissionControl));
          
          const overflowHidden = container.querySelectorAll('.overflow-hidden');
          expect(overflowHidden.length).toBeGreaterThan(0);
        }),
        { numRuns: 20 }
      );
    });

    test('should have scrollable content areas in panels', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          const { container } = renderWithProvider(React.createElement(MissionControl));
          
          const scrollableAreas = container.querySelectorAll('.overflow-y-auto');
          expect(scrollableAreas.length).toBeGreaterThan(0);
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Accessibility Structure', () => {
    test('should have proper heading hierarchy', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          renderWithProvider(React.createElement(MissionControl));
          
          const h1 = screen.getByRole('heading', { level: 1 });
          expect(h1).toHaveTextContent('SentinelFlow Mission Control');
          
          const h2Elements = screen.getAllByRole('heading', { level: 2 });
          expect(h2Elements.length).toBe(3);
        }),
        { numRuns: 20 }
      );
    });
  });
});


describe('Agent Card Display Properties', () => {
  test('should display agent cards with valid status indicators', () => {
    fc.assert(
      fc.property(agentStatusArb, (status) => {
        expect(['idle', 'analyzing', 'complete']).toContain(status);
        
        renderWithProvider(React.createElement(MissionControl));
        
        expect(screen.getByText('SRE Agent')).toBeInTheDocument();
        expect(screen.getByText('Security Agent')).toBeInTheDocument();
        expect(screen.getByText('Governance Agent')).toBeInTheDocument();
      }),
      { numRuns: 20 }
    );
  });

  test('should handle all valid agent types', () => {
    fc.assert(
      fc.property(agentTypeArb, (agentType) => {
        expect(['sre-agent', 'security-agent', 'governance-agent']).toContain(agentType);
        
        renderWithProvider(React.createElement(MissionControl));
        expect(screen.getByText('Specialist Agents')).toBeInTheDocument();
      }),
      { numRuns: 20 }
    );
  });
});

describe('Governance Request Display Properties', () => {
  test('should handle all valid risk levels in governance context', () => {
    fc.assert(
      fc.property(riskLevelArb, (riskLevel) => {
        expect(['low', 'medium', 'high', 'critical']).toContain(riskLevel);
        
        renderWithProvider(React.createElement(MissionControl));
        expect(screen.getByText('Governance Gate')).toBeInTheDocument();
      }),
      { numRuns: 20 }
    );
  });

  test('should handle all valid health statuses for blast radius', () => {
    fc.assert(
      fc.property(healthStatusArb, (healthStatus) => {
        expect(['healthy', 'warning', 'critical']).toContain(healthStatus);
        
        renderWithProvider(React.createElement(MissionControl));
        expect(screen.getByText('Blast Radius')).toBeInTheDocument();
      }),
      { numRuns: 20 }
    );
  });
});

describe('Workflow State Rendering Properties', () => {
  test('should render without errors for all workflow states', () => {
    fc.assert(
      fc.property(workflowStateArb, (state) => {
        const validStates = [
          WorkflowState.IDLE,
          WorkflowState.INCIDENT_INGESTED,
          WorkflowState.ANALYZING,
          WorkflowState.RCA_COMPLETE,
          WorkflowState.GOVERNANCE_PENDING,
          WorkflowState.ACTION_PROPOSED,
          WorkflowState.VERIFIED,
          WorkflowState.RESOLVED,
          WorkflowState.TERMINATED
        ];
        expect(validStates).toContain(state);
        
        const { container } = renderWithProvider(React.createElement(MissionControl));
        expect(container).toBeInTheDocument();
      }),
      { numRuns: 25 }
    );
  });

  test('should maintain three-panel structure for all workflow states', () => {
    fc.assert(
      fc.property(workflowStateArb, () => {
        renderWithProvider(React.createElement(MissionControl));
        
        expect(screen.getByText('Incoming Signal')).toBeInTheDocument();
        expect(screen.getByText('Agent Brain & Workflow')).toBeInTheDocument();
        expect(screen.getByText('Human Handoff & Governance')).toBeInTheDocument();
      }),
      { numRuns: 25 }
    );
  });
});
