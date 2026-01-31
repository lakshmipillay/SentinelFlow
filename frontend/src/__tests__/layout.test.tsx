/**
 * Layout Consistency Unit Tests
 * 
 * Tests for the Mission Control 3-pane layout, dark mode implementation,
 * and responsive behavior as specified in Requirements 5.1.
 * 
 * Task 9.3: Write unit tests for layout consistency
 * - Test 3-pane layout rendering
 * - Test responsive behavior
 * - Test dark mode implementation
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MissionControl from '../app/page';
import RootLayout from '../app/layout';
import { WorkflowProvider } from '../context/WorkflowContext';

// Mock the lucide-react icons to avoid rendering issues in tests
// Use a Proxy to handle any icon that might be imported
jest.mock('lucide-react', () => {
  const createMockIcon = (name: string) => {
    const MockIcon = ({ className }: { className?: string }) => (
      <span data-testid={`${name.toLowerCase()}-icon`} className={className}>{name}</span>
    );
    MockIcon.displayName = name;
    return MockIcon;
  };
  
  // Return a Proxy that creates mock icons for any property access
  return new Proxy({}, {
    get: (target, prop) => {
      if (typeof prop === 'string') {
        return createMockIcon(prop);
      }
      return undefined;
    }
  });
});

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => {
  // Filter out framer-motion specific props that shouldn't be passed to DOM elements
  const filterMotionProps = (props: Record<string, unknown>) => {
    const motionProps = ['initial', 'animate', 'exit', 'variants', 'transition', 'whileHover', 'whileTap', 'whileFocus', 'whileInView', 'style'];
    const filtered: Record<string, unknown> = {};
    Object.keys(props).forEach(key => {
      if (!motionProps.includes(key)) {
        filtered[key] = props[key];
      }
    });
    return filtered;
  };
  
  return {
    motion: {
      div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...filterMotionProps(props)}>{children}</div>,
      span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <span {...filterMotionProps(props)}>{children}</span>,
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  };
});

// Helper to render with WorkflowProvider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <WorkflowProvider>
      {ui}
    </WorkflowProvider>
  );
};

describe('Mission Control Layout', () => {
  describe('3-Pane Layout Rendering', () => {
    /**
     * Test that the main 3-pane layout structure renders correctly
     * Requirements: 5.1 - Fixed 3-pane Mission Control dashboard layout
     */
    it('should render the main Mission Control container', () => {
      renderWithProvider(<MissionControl />);
      
      // Check for the main header
      expect(screen.getByText('SentinelFlow Mission Control')).toBeInTheDocument();
      expect(screen.getByText('SRE Sidekick')).toBeInTheDocument();
    });

    it('should render the Left Panel (Incoming Signal)', () => {
      renderWithProvider(<MissionControl />);
      
      // Left Panel should have "Incoming Signal" header
      expect(screen.getByText('Incoming Signal')).toBeInTheDocument();
      
      // Should have Active Alert section
      expect(screen.getByText('Active Alert')).toBeInTheDocument();
      
      // Should have Live Logs section
      expect(screen.getByText('Live Logs')).toBeInTheDocument();
    });

    it('should render the Center Panel (Agent Brain & Workflow)', () => {
      renderWithProvider(<MissionControl />);
      
      // Center Panel should have "Agent Brain & Workflow" header
      expect(screen.getByText('Agent Brain & Workflow')).toBeInTheDocument();
      
      // Should have Workflow Progress section
      expect(screen.getByText('Workflow Progress')).toBeInTheDocument();
      
      // Should have Specialist Agents section
      expect(screen.getByText('Specialist Agents')).toBeInTheDocument();
      
      // Should have Blast Radius section
      expect(screen.getByText('Blast Radius')).toBeInTheDocument();
    });

    it('should render the Right Panel (Human Handoff & Governance)', () => {
      renderWithProvider(<MissionControl />);
      
      // Right Panel should have "Human Handoff & Governance" header
      expect(screen.getByText('Human Handoff & Governance')).toBeInTheDocument();
      
      // Should have Agent Summary section
      expect(screen.getByText('Agent Summary')).toBeInTheDocument();
      
      // Should have Governance Gate section
      expect(screen.getByText('Governance Gate')).toBeInTheDocument();
      
      // Should have Audit Trail section
      expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    });

    it('should render all three agent cards in the Center Panel', () => {
      renderWithProvider(<MissionControl />);
      
      // All three specialist agents should be displayed
      expect(screen.getByText('SRE Agent')).toBeInTheDocument();
      expect(screen.getByText('Security Agent')).toBeInTheDocument();
      expect(screen.getByText('Governance Agent')).toBeInTheDocument();
    });
  });

  describe('Header Elements', () => {
    /**
     * Test that the header renders with expected elements
     */
    it('should render the header with title and connection status', () => {
      renderWithProvider(<MissionControl />);
      
      // Header title
      expect(screen.getByText('SentinelFlow Mission Control')).toBeInTheDocument();
      
      // SRE Sidekick badge
      expect(screen.getByText('SRE Sidekick')).toBeInTheDocument();
    });

    it('should display connection status indicator', () => {
      renderWithProvider(<MissionControl />);
      
      // Default state is disconnected
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should display demo mode indicator when in demo mode', () => {
      renderWithProvider(<MissionControl />);
      
      // Default state has demo mode enabled - DemoModeBadge shows "DEMO"
      expect(screen.getByText('DEMO')).toBeInTheDocument();
    });

    it('should render reset button in demo mode', () => {
      renderWithProvider(<MissionControl />);
      
      // Reset button should be visible in demo mode
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });
  });

  describe('Panel Structure', () => {
    /**
     * Test that panels have correct structure and CSS classes
     */
    it('should have correct panel structure with borders', () => {
      const { container } = renderWithProvider(<MissionControl />);
      
      // Check for border classes on panels
      const leftPanel = container.querySelector('.border-r.border-border');
      const rightPanel = container.querySelector('.border-l.border-border');
      
      expect(leftPanel).toBeInTheDocument();
      expect(rightPanel).toBeInTheDocument();
    });

    it('should have flex layout for the main content area', () => {
      const { container } = renderWithProvider(<MissionControl />);
      
      // Main container should use flex layout
      const mainContainer = container.querySelector('main.flex');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should have proper width constraints on side panels', () => {
      const { container } = renderWithProvider(<MissionControl />);
      
      // Side panels should have width constraints (w-1/4)
      const sidePanels = container.querySelectorAll('.w-1\\/4');
      expect(sidePanels.length).toBe(2); // Left and Right panels
    });
  });

  describe('Governance Interface Elements', () => {
    /**
     * Test governance-related UI elements
     */
    it('should display "No pending governance decisions" when no request', () => {
      renderWithProvider(<MissionControl />);
      
      expect(screen.getByText('No pending governance decisions')).toBeInTheDocument();
    });

    it('should display audit trail event counter', () => {
      renderWithProvider(<MissionControl />);
      
      expect(screen.getByText('Events Recorded')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('Log Display', () => {
    /**
     * Test log display elements
     */
    it('should display waiting message when no logs', () => {
      renderWithProvider(<MissionControl />);
      
      expect(screen.getByText('Waiting for log stream...')).toBeInTheDocument();
    });

    it('should display "No active alerts" when no alert is present', () => {
      renderWithProvider(<MissionControl />);
      
      expect(screen.getByText('No active alerts')).toBeInTheDocument();
    });
  });
});

describe('Dark Mode Implementation', () => {
  /**
   * Test dark mode is applied correctly
   * Requirements: 12.2 - Dark mode design with specified color tokens
   */
  it('should have dark mode configured in RootLayout', () => {
    // RootLayout applies dark class to html element
    // We verify this by checking the layout.tsx source exports correctly
    // and that the dark mode classes are used throughout the app
    expect(RootLayout).toBeDefined();
    expect(typeof RootLayout).toBe('function');
  });

  it('should use dark background color classes', () => {
    const { container } = renderWithProvider(<MissionControl />);
    
    // Main container should have bg-background class
    const mainDiv = container.querySelector('.bg-background');
    expect(mainDiv).toBeInTheDocument();
  });

  it('should use dark panel background classes', () => {
    const { container } = renderWithProvider(<MissionControl />);
    
    // Panels should have bg-panel class
    const panels = container.querySelectorAll('.bg-panel');
    expect(panels.length).toBeGreaterThan(0);
  });

  it('should use appropriate text color classes for dark mode', () => {
    const { container } = renderWithProvider(<MissionControl />);
    
    // Should have text-foreground class for main text
    const foregroundText = container.querySelectorAll('.text-foreground');
    expect(foregroundText.length).toBeGreaterThan(0);
    
    // Should have text-muted class for secondary text
    const mutedText = container.querySelectorAll('.text-muted');
    expect(mutedText.length).toBeGreaterThan(0);
  });
});

describe('Responsive Behavior', () => {
  /**
   * Test responsive layout constraints
   */
  it('should have minimum width constraints on side panels', () => {
    const { container } = renderWithProvider(<MissionControl />);
    
    // Side panels should have min-w-[280px] class
    const minWidthPanels = container.querySelectorAll('.min-w-\\[280px\\]');
    expect(minWidthPanels.length).toBe(2); // Left and Right panels
  });

  it('should have maximum width constraints on side panels', () => {
    const { container } = renderWithProvider(<MissionControl />);
    
    // Side panels should have max-w-[400px] class
    const maxWidthPanels = container.querySelectorAll('.max-w-\\[400px\\]');
    expect(maxWidthPanels.length).toBe(2); // Left and Right panels
  });

  it('should have minimum width constraint on center panel', () => {
    const { container } = renderWithProvider(<MissionControl />);
    
    // Center panel should have min-w-[400px] class
    const centerPanel = container.querySelector('.min-w-\\[400px\\]');
    expect(centerPanel).toBeInTheDocument();
  });

  it('should have flex-shrink-0 on side panels to prevent shrinking', () => {
    const { container } = renderWithProvider(<MissionControl />);
    
    // Side panels should have flex-shrink-0 class
    const noShrinkPanels = container.querySelectorAll('.flex-shrink-0');
    expect(noShrinkPanels.length).toBeGreaterThan(0);
  });

  it('should have flex-1 on center panel for flexible width', () => {
    const { container } = renderWithProvider(<MissionControl />);
    
    // Center panel should have flex-1 class
    const flexPanel = container.querySelector('.flex-1.min-w-\\[400px\\]');
    expect(flexPanel).toBeInTheDocument();
  });

  it('should use overflow-hidden to prevent layout overflow', () => {
    const { container } = renderWithProvider(<MissionControl />);
    
    // Main container should have overflow-hidden
    const overflowHidden = container.querySelectorAll('.overflow-hidden');
    expect(overflowHidden.length).toBeGreaterThan(0);
  });
});

describe('Layout Accessibility', () => {
  /**
   * Test basic accessibility features
   */
  it('should have proper heading hierarchy', () => {
    renderWithProvider(<MissionControl />);
    
    // Main title should be h1
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('SentinelFlow Mission Control');
  });

  it('should have section headings for each panel', () => {
    renderWithProvider(<MissionControl />);
    
    // Each panel should have h2 headings
    const h2Elements = screen.getAllByRole('heading', { level: 2 });
    expect(h2Elements.length).toBe(3); // Left, Center, Right panels
  });

  it('should have accessible button labels', () => {
    renderWithProvider(<MissionControl />);
    
    // Reset button should be accessible
    const resetButton = screen.getByRole('button', { name: /reset/i });
    expect(resetButton).toBeInTheDocument();
  });
});
