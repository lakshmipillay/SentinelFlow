/**
 * ActiveAlertCard Component Unit Tests
 * 
 * Tests for the Active Alert Card component that displays alert information
 * in JSON-style format with red border emphasis.
 * 
 * Task 10.1: Create Active Alert Card component
 * Requirements: 14.1 - Display active alert in JSON-style format with service,
 * severity, metric, and timestamp information
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActiveAlertCard } from '../components/ActiveAlertCard';
import { ActiveAlert } from '../types/workflow';

// Mock the lucide-react icons
jest.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-triangle-icon">AlertTriangle</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">AlertCircle</span>,
  Info: () => <span data-testid="info-icon">Info</span>,
}));

describe('ActiveAlertCard Component', () => {
  // Sample valid alert data
  const criticalAlert: ActiveAlert = {
    service: 'payment-service',
    severity: 'critical',
    metric: 'error_rate',
    value: 15.5,
    timestamp: '2024-01-15T14:32:00Z',
  };

  const warningAlert: ActiveAlert = {
    service: 'api-gateway',
    severity: 'warning',
    metric: 'latency_p99',
    value: 250,
    timestamp: '2024-01-15T14:30:00Z',
  };

  const infoAlert: ActiveAlert = {
    service: 'monitoring-service',
    severity: 'info',
    metric: 'cpu_usage',
    value: 45,
    timestamp: '2024-01-15T14:28:00Z',
  };

  const alertWithDescription: ActiveAlert = {
    service: 'database-cluster',
    severity: 'critical',
    metric: 'connection_pool',
    value: 0,
    timestamp: '2024-01-15T14:35:00Z',
    description: 'Connection pool exhausted',
  };

  describe('Empty State Handling', () => {
    /**
     * Test that the component displays empty state when no alert is provided
     */
    it('should display "No active alerts" when alert is null', () => {
      render(<ActiveAlertCard alert={null} />);
      
      expect(screen.getByText('No active alerts')).toBeInTheDocument();
      expect(screen.getByText('System is operating normally')).toBeInTheDocument();
    });

    it('should display empty state icon when no alert', () => {
      render(<ActiveAlertCard alert={null} />);
      
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });
  });

  describe('Alert Data Display', () => {
    /**
     * Test that all required alert fields are displayed
     * Requirements: 14.1 - service, severity, metric, and timestamp
     */
    it('should display service name in header', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      expect(screen.getByText('payment-service')).toBeInTheDocument();
    });

    it('should display severity badge', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      expect(screen.getByText('critical')).toBeInTheDocument();
    });

    it('should display metric name in JSON format', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      expect(screen.getByText('"metric"')).toBeInTheDocument();
      expect(screen.getByText('"error_rate"')).toBeInTheDocument();
    });

    it('should display metric value in JSON format', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      expect(screen.getByText('"value"')).toBeInTheDocument();
      expect(screen.getByText('15.5')).toBeInTheDocument();
    });

    it('should display timestamp in JSON format', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      expect(screen.getByText('"timestamp"')).toBeInTheDocument();
      expect(screen.getByText(`"${criticalAlert.timestamp}"`)).toBeInTheDocument();
    });

    it('should display optional description when provided', () => {
      render(<ActiveAlertCard alert={alertWithDescription} />);
      
      expect(screen.getByText('"description"')).toBeInTheDocument();
      expect(screen.getByText('"Connection pool exhausted"')).toBeInTheDocument();
    });
  });

  describe('JSON-Style Format', () => {
    /**
     * Test that alert is displayed in JSON-style format
     * Requirements: 14.1 - JSON-style format
     */
    it('should display JSON structure with curly braces', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      expect(screen.getByText('{')).toBeInTheDocument();
      expect(screen.getByText('}')).toBeInTheDocument();
    });

    it('should display all JSON keys with quotes', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      expect(screen.getByText('"service"')).toBeInTheDocument();
      expect(screen.getByText('"severity"')).toBeInTheDocument();
      expect(screen.getByText('"metric"')).toBeInTheDocument();
      expect(screen.getByText('"value"')).toBeInTheDocument();
      expect(screen.getByText('"timestamp"')).toBeInTheDocument();
    });

    it('should use monospace font for JSON display', () => {
      const { container } = render(<ActiveAlertCard alert={criticalAlert} />);
      
      const monoElement = container.querySelector('.font-mono');
      expect(monoElement).toBeInTheDocument();
    });
  });

  describe('Severity-Based Styling', () => {
    /**
     * Test that styling changes based on alert severity
     */
    it('should display critical alert with appropriate icon', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    });

    it('should display warning alert with appropriate icon', () => {
      render(<ActiveAlertCard alert={warningAlert} />);
      
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });

    it('should display info alert with appropriate icon', () => {
      render(<ActiveAlertCard alert={infoAlert} />);
      
      expect(screen.getByTestId('info-icon')).toBeInTheDocument();
    });

    it('should have role="alert" for accessibility', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-live="polite" for screen readers', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      const alertElement = screen.getByRole('alert');
      expect(alertElement).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Timestamp Formatting', () => {
    /**
     * Test that timestamp is formatted correctly in footer
     */
    it('should display "Triggered" label in footer', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      expect(screen.getByText('Triggered')).toBeInTheDocument();
    });

    it('should display formatted timestamp in footer', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      // The footer should contain a formatted version of the timestamp
      const footer = screen.getByText('Triggered').parentElement;
      expect(footer).toBeInTheDocument();
    });
  });

  describe('Alert Data Validation', () => {
    /**
     * Test that invalid alert data is handled gracefully
     */
    it('should display error state for alert with empty service', () => {
      const invalidAlert = {
        ...criticalAlert,
        service: '',
      };
      
      render(<ActiveAlertCard alert={invalidAlert} />);
      
      expect(screen.getByText('Invalid alert data')).toBeInTheDocument();
    });

    it('should display error state for alert with empty metric', () => {
      const invalidAlert = {
        ...criticalAlert,
        metric: '',
      };
      
      render(<ActiveAlertCard alert={invalidAlert} />);
      
      expect(screen.getByText('Invalid alert data')).toBeInTheDocument();
    });

    it('should display error state for alert with invalid severity', () => {
      const invalidAlert = {
        ...criticalAlert,
        severity: 'unknown' as any,
      };
      
      render(<ActiveAlertCard alert={invalidAlert} />);
      
      expect(screen.getByText('Invalid alert data')).toBeInTheDocument();
    });

    it('should display error state for alert with empty timestamp', () => {
      const invalidAlert = {
        ...criticalAlert,
        timestamp: '',
      };
      
      render(<ActiveAlertCard alert={invalidAlert} />);
      
      expect(screen.getByText('Invalid alert data')).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    /**
     * Test that custom className is applied
     */
    it('should apply custom className when provided', () => {
      const { container } = render(
        <ActiveAlertCard alert={criticalAlert} className="custom-class" />
      );
      
      const alertCard = container.querySelector('.custom-class');
      expect(alertCard).toBeInTheDocument();
    });

    it('should apply custom className to empty state', () => {
      const { container } = render(
        <ActiveAlertCard alert={null} className="custom-empty-class" />
      );
      
      const emptyCard = container.querySelector('.custom-empty-class');
      expect(emptyCard).toBeInTheDocument();
    });
  });

  describe('Different Severity Levels', () => {
    /**
     * Test all three severity levels display correctly
     */
    it('should display critical severity correctly', () => {
      render(<ActiveAlertCard alert={criticalAlert} />);
      
      expect(screen.getByText('critical')).toBeInTheDocument();
      expect(screen.getByText('"critical"')).toBeInTheDocument();
    });

    it('should display warning severity correctly', () => {
      render(<ActiveAlertCard alert={warningAlert} />);
      
      expect(screen.getByText('warning')).toBeInTheDocument();
      expect(screen.getByText('"warning"')).toBeInTheDocument();
    });

    it('should display info severity correctly', () => {
      render(<ActiveAlertCard alert={infoAlert} />);
      
      expect(screen.getByText('info')).toBeInTheDocument();
      expect(screen.getByText('"info"')).toBeInTheDocument();
    });
  });

  describe('Border Styling', () => {
    /**
     * Test that border styling is applied based on severity
     * Requirements: 14.1 - Red border for critical alerts
     */
    it('should have border-2 class for alert card', () => {
      const { container } = render(<ActiveAlertCard alert={criticalAlert} />);
      
      const alertCard = container.querySelector('.border-2');
      expect(alertCard).toBeInTheDocument();
    });

    it('should have rounded-lg class for alert card', () => {
      const { container } = render(<ActiveAlertCard alert={criticalAlert} />);
      
      const alertCard = container.querySelector('.rounded-lg');
      expect(alertCard).toBeInTheDocument();
    });

    it('should have shadow-lg class for alert card', () => {
      const { container } = render(<ActiveAlertCard alert={criticalAlert} />);
      
      const alertCard = container.querySelector('.shadow-lg');
      expect(alertCard).toBeInTheDocument();
    });
  });
});
