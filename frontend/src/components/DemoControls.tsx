'use client';

/**
 * Demo Controls Component
 * Provides demo presentation features including scenario selection,
 * incident simulation, and demo reset functionality.
 * 
 * Task 17.2: Add demo presentation features
 * - Implement demo reset and scenario selection
 * - Add presentation mode with clear simulation indicators
 * - Create smooth demo flow with appropriate pacing
 * 
 * **Validates: Requirements 9.3**
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  RefreshCw, 
  ChevronDown, 
  AlertTriangle, 
  Database, 
  Shield, 
  Server, 
  Rocket,
  Clock,
  Zap,
  CheckCircle2,
  Loader2
} from 'lucide-react';

/**
 * Demo scenario metadata for UI display
 */
export interface DemoScenarioOption {
  type: string;
  name: string;
  description: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedDuration: string;
}

/**
 * Default available scenarios matching DemoScenarioGenerator
 */
const DEFAULT_SCENARIOS: DemoScenarioOption[] = [
  {
    type: 'database-outage',
    name: 'Database Connection Pool Exhaustion',
    description: 'Primary database experiencing connection pool exhaustion causing application timeouts',
    complexity: 'moderate',
    estimatedDuration: '10-15 minutes'
  },
  {
    type: 'api-failure',
    name: 'API Gateway Rate Limiting Cascade',
    description: 'API Gateway experiencing rate limiting cascade causing downstream service failures',
    complexity: 'complex',
    estimatedDuration: '15-20 minutes'
  },
  {
    type: 'security-incident',
    name: 'Unauthorized Access Attempt',
    description: 'Suspicious authentication patterns indicating potential unauthorized access attempt',
    complexity: 'complex',
    estimatedDuration: '20-25 minutes'
  },
  {
    type: 'infrastructure-issue',
    name: 'Container Orchestration Resource Exhaustion',
    description: 'Kubernetes cluster experiencing resource exhaustion causing pod scheduling failures',
    complexity: 'moderate',
    estimatedDuration: '12-18 minutes'
  },
  {
    type: 'deployment-problem',
    name: 'Failed Deployment Rollback Required',
    description: 'Recent deployment causing application errors requiring immediate rollback',
    complexity: 'simple',
    estimatedDuration: '8-12 minutes'
  }
];

/**
 * Get icon for scenario type
 */
function getScenarioIcon(type: string): React.ReactNode {
  switch (type) {
    case 'database-outage':
      return <Database className="w-4 h-4" />;
    case 'api-failure':
      return <Server className="w-4 h-4" />;
    case 'security-incident':
      return <Shield className="w-4 h-4" />;
    case 'infrastructure-issue':
      return <Server className="w-4 h-4" />;
    case 'deployment-problem':
      return <Rocket className="w-4 h-4" />;
    default:
      return <AlertTriangle className="w-4 h-4" />;
  }
}

/**
 * Get complexity badge color
 */
function getComplexityColor(complexity: string): string {
  switch (complexity) {
    case 'simple':
      return 'bg-status-success/20 text-status-success border-status-success/30';
    case 'moderate':
      return 'bg-status-warning/20 text-status-warning border-status-warning/30';
    case 'complex':
      return 'bg-status-error/20 text-status-error border-status-error/30';
    default:
      return 'bg-muted/20 text-muted border-muted/30';
  }
}

export interface DemoControlsProps {
  /** Whether demo mode is active */
  isDemoMode: boolean;
  /** Whether a workflow is currently running */
  isWorkflowActive: boolean;
  /** Available scenarios (defaults to built-in scenarios) */
  scenarios?: DemoScenarioOption[];
  /** Callback when simulate incident is triggered */
  onSimulateIncident: (scenarioType: string) => void;
  /** Callback when reset is triggered */
  onReset: () => void;
  /** Whether simulation is in progress */
  isSimulating?: boolean;
  /** Compact mode for header display */
  compact?: boolean;
}

/**
 * Demo Controls Component
 * Provides scenario selection and demo control buttons
 */
export function DemoControls({
  isDemoMode,
  isWorkflowActive,
  scenarios = DEFAULT_SCENARIOS,
  onSimulateIncident,
  onReset,
  isSimulating = false,
  compact = false
}: DemoControlsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<DemoScenarioOption>(scenarios[0]);

  const handleScenarioSelect = useCallback((scenario: DemoScenarioOption) => {
    setSelectedScenario(scenario);
    setIsDropdownOpen(false);
  }, []);

  const handleSimulate = useCallback(() => {
    if (!isSimulating && !isWorkflowActive) {
      onSimulateIncident(selectedScenario.type);
    }
  }, [isSimulating, isWorkflowActive, onSimulateIncident, selectedScenario.type]);

  const handleReset = useCallback(() => {
    onReset();
    setIsDropdownOpen(false);
  }, [onReset]);

  if (!isDemoMode) {
    return null;
  }

  // Compact mode for header integration
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Scenario Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={isWorkflowActive || isSimulating}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded border transition-colors ${
              isWorkflowActive || isSimulating
                ? 'bg-panel-secondary text-muted border-border cursor-not-allowed'
                : 'bg-panel-secondary text-foreground border-border hover:border-accent hover:bg-panel'
            }`}
          >
            {getScenarioIcon(selectedScenario.type)}
            <span className="max-w-[120px] truncate">{selectedScenario.name}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 mt-1 w-80 bg-panel border border-border rounded-lg shadow-lg z-50 overflow-hidden"
              >
                <div className="p-2 border-b border-border">
                  <div className="text-xs text-muted font-medium">Select Demo Scenario</div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {scenarios.map((scenario) => (
                    <button
                      key={scenario.type}
                      onClick={() => handleScenarioSelect(scenario)}
                      className={`w-full p-3 text-left hover:bg-panel-secondary transition-colors border-b border-border/50 last:border-b-0 ${
                        selectedScenario.type === scenario.type ? 'bg-accent/10' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 text-accent">
                          {getScenarioIcon(scenario.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {scenario.name}
                          </div>
                          <div className="text-xs text-muted mt-0.5 line-clamp-2">
                            {scenario.description}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getComplexityColor(scenario.complexity)}`}>
                              {scenario.complexity}
                            </span>
                            <span className="text-[10px] text-muted flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {scenario.estimatedDuration}
                            </span>
                          </div>
                        </div>
                        {selectedScenario.type === scenario.type && (
                          <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Simulate Button */}
        <button
          onClick={handleSimulate}
          disabled={isWorkflowActive || isSimulating}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            isWorkflowActive || isSimulating
              ? 'bg-muted/20 text-muted cursor-not-allowed'
              : 'bg-accent text-accent-foreground hover:bg-accent/90'
          }`}
          title="Simulate Incident"
        >
          {isSimulating ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Simulating...
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              Simulate
            </>
          )}
        </button>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-foreground rounded hover:bg-panel-secondary transition-colors"
          title="Reset Demo"
        >
          <RefreshCw className="w-3 h-3" />
          Reset
        </button>
      </div>
    );
  }

  // Full mode for dedicated demo panel
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent" />
          Demo Controls
        </h3>
        <span className="text-xs text-status-warning bg-status-warning/20 px-2 py-0.5 rounded">
          Presentation Mode
        </span>
      </div>

      {/* Scenario Selection */}
      <div className="mb-4">
        <label className="text-xs text-muted mb-2 block">Select Scenario</label>
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={isWorkflowActive || isSimulating}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded border transition-colors ${
              isWorkflowActive || isSimulating
                ? 'bg-panel-secondary text-muted border-border cursor-not-allowed'
                : 'bg-panel-secondary text-foreground border-border hover:border-accent'
            }`}
          >
            <div className="flex items-center gap-2">
              {getScenarioIcon(selectedScenario.type)}
              <span className="truncate">{selectedScenario.name}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-1 bg-panel border border-border rounded-lg shadow-lg z-50 overflow-hidden"
              >
                <div className="max-h-64 overflow-y-auto">
                  {scenarios.map((scenario) => (
                    <button
                      key={scenario.type}
                      onClick={() => handleScenarioSelect(scenario)}
                      className={`w-full p-3 text-left hover:bg-panel-secondary transition-colors border-b border-border/50 last:border-b-0 ${
                        selectedScenario.type === scenario.type ? 'bg-accent/10' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 text-accent">
                          {getScenarioIcon(scenario.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">
                            {scenario.name}
                          </div>
                          <div className="text-xs text-muted mt-0.5">
                            {scenario.description}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getComplexityColor(scenario.complexity)}`}>
                              {scenario.complexity}
                            </span>
                            <span className="text-[10px] text-muted flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {scenario.estimatedDuration}
                            </span>
                          </div>
                        </div>
                        {selectedScenario.type === scenario.type && (
                          <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Selected Scenario Info */}
      <div className="mb-4 p-3 bg-panel-secondary rounded border border-border">
        <div className="flex items-center gap-2 mb-2">
          {getScenarioIcon(selectedScenario.type)}
          <span className="text-sm font-medium text-foreground">{selectedScenario.name}</span>
        </div>
        <p className="text-xs text-muted mb-2">{selectedScenario.description}</p>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getComplexityColor(selectedScenario.complexity)}`}>
            {selectedScenario.complexity}
          </span>
          <span className="text-[10px] text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {selectedScenario.estimatedDuration}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSimulate}
          disabled={isWorkflowActive || isSimulating}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors ${
            isWorkflowActive || isSimulating
              ? 'bg-muted/20 text-muted cursor-not-allowed'
              : 'bg-accent text-accent-foreground hover:bg-accent/90'
          }`}
        >
          {isSimulating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Simulating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Simulate Incident
            </>
          )}
        </button>

        <button
          onClick={handleReset}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-muted hover:text-foreground rounded border border-border hover:bg-panel-secondary transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* Workflow Status */}
      {isWorkflowActive && (
        <div className="mt-3 p-2 bg-status-analyzing/10 border border-status-analyzing/30 rounded text-xs text-status-analyzing flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Workflow in progress - wait for completion or reset to start a new scenario
        </div>
      )}
    </div>
  );
}

export default DemoControls;
