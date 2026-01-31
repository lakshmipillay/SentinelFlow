/**
 * SentinelFlow Demo Mode Types
 * Structured types for demo mode operations with safety constraints
 * Implements deterministic, machine-readable formats per coding standards
 */

import { WorkflowInstance, AgentOutput, GovernanceDecision } from '../../types/workflow';

/**
 * Demo scenario definition with structured configuration
 */
export interface DemoScenario {
  type: 'database-outage' | 'api-failure' | 'security-incident' | 'infrastructure-issue' | 'deployment-problem';
  name: string;
  description: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedDuration: string;
  
  // Structured incident parameters
  incidentTemplate: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedServices: string[];
    symptoms: string[];
    initialMetrics: Record<string, number>;
    timelineEvents: Array<{
      timestamp: string;
      event: string;
      impact: string;
    }>;
  };
  
  // Expected agent analysis patterns
  expectedAnalysis: {
    sreFindings: string[];
    securityFindings: string[];
    governanceFindings: string[];
    correlationPoints: string[];
  };
  
  // Governance scenario parameters
  governanceScenario: {
    defaultRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    policyConflicts: string[];
    blastRadiusServices: string[];
    recommendedDecision: 'approve' | 'approve_with_restrictions' | 'block';
  };
}

/**
 * Demo session state with comprehensive tracking
 */
export interface DemoSession {
  sessionId: string;
  scenario: DemoScenario;
  startTime: string; // ISO8601
  isActive: boolean;
  
  // Workflow tracking
  workflows: Map<string, DemoWorkflowData>;
  progressionState: 'initialized' | 'incident_active' | 'analysis_phase' | 'governance_phase' | 'completed';
  autoProgression: boolean;
  
  // Safety status tracking
  safetyStatus: {
    isolated: boolean;
    noExternalActions: boolean;
    auditTrailActive: boolean;
    clearlyMarked: boolean;
  };
}

/**
 * Demo workflow data with progression tracking
 */
export interface DemoWorkflowData {
  workflow: WorkflowInstance;
  incident: DemoIncident;
  progressionPlan: string[];
  currentStep: number;
  lastUpdate: string; // ISO8601
}

/**
 * Demo incident structure with realistic data
 */
export interface DemoIncident {
  incidentId: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: string[];
  timestamp: string; // ISO8601
  
  // Structured metrics and logs
  metrics: {
    cpu: number;
    memory: number;
    errorRate: number;
    responseTime: number;
    throughput: number;
  };
  
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'critical';
    service: string;
    message: string;
    metadata?: Record<string, any>;
  }>;
  
  // Alert information
  alert: {
    alertId: string;
    source: string;
    rule: string;
    threshold: number;
    currentValue: number;
    duration: string;
  };
}

/**
 * Demo configuration with safety constraints
 */
export interface DemoConfig {
  maxConcurrentWorkflows: number;
  defaultScenarioType: string;
  enableProgressiveDisclosure: boolean;
  enableRealisticTiming: boolean;
  
  // Safety constraints (non-negotiable)
  safetyConstraints: {
    noExternalActions: boolean;
    isolatedEnvironment: boolean;
    auditAllOperations: boolean;
    clearIndicators: boolean;
  };
  
  // Timing configuration for realistic simulation
  timingConfig: {
    agentProcessingDelayMs: number;
    stateTransitionDelayMs: number;
    progressiveDisclosureIntervalMs: number;
  };
}

/**
 * Demo state snapshot for persistence
 */
export interface DemoStateSnapshot {
  sessionId: string;
  timestamp: string; // ISO8601
  scenario: DemoScenario;
  
  workflows: Array<{
    workflowId: string;
    workflow: WorkflowInstance;
    incident: DemoIncident;
    progressionStep: number;
  }>;
  
  progressionState: string;
  config: DemoConfig;
}

/**
 * Demo audit event structure
 */
export interface DemoAuditEvent {
  eventId: string;
  sessionId: string;
  eventType: string;
  timestamp: string; // ISO8601
  actor: 'demo-system' | 'demo-user';
  details: Record<string, any>;
  demoMode: true; // Always true for demo events
  immutable: true; // Always true for audit events
}

/**
 * Demo governance scenario structure
 */
export interface DemoGovernanceScenario {
  blastRadiusAssessment: {
    affectedServices: string[];
    dependencyChain: Array<{
      service: string;
      dependencies: string[];
      criticalPath: boolean;
    }>;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reversible: boolean;
    estimatedImpact: {
      usersAffected: number;
      revenueImpact: number;
      recoveryTime: string;
    };
  };
  
  policyConflicts: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedDecision: 'approve' | 'approve_with_restrictions' | 'block';
  
  // Structured rationale for decision
  decisionFactors: {
    businessImpact: 'low' | 'medium' | 'high' | 'critical';
    technicalRisk: 'low' | 'medium' | 'high' | 'critical';
    complianceRisk: 'low' | 'medium' | 'high' | 'critical';
    timeConstraints: 'flexible' | 'moderate' | 'urgent' | 'critical';
  };
}

/**
 * Demo agent output template for consistent generation with progressive disclosure
 */
export interface DemoAgentOutputTemplate {
  agentName: 'sre-agent' | 'security-agent' | 'governance-agent';
  skillsToUse: string[];
  findingsTemplate: {
    summaryPattern: string;
    evidencePatterns: string[];
    correlationPatterns: string[];
    recommendationPatterns?: string[];
  };
  confidenceRange: {
    min: number;
    max: number;
  };
  processingTimeRange: {
    minMs: number;
    maxMs: number;
  };
  progressiveDisclosure?: {
    enableStepByStep: boolean;
    stepDelayMs: number;
    skillProgression: Array<{
      skill: string;
      expectedFindings: string[];
      confidenceContribution: number;
    }>;
  };
}

/**
 * Demo progression event for tracking workflow advancement with skills attribution
 */
export interface DemoProgressionEvent {
  workflowId: string;
  fromStep: string;
  toStep: string;
  timestamp: string; // ISO8601
  triggerType: 'automatic' | 'manual' | 'timed';
  metadata: Record<string, any>;
  skillsInvolved?: string[];
  agentProgress?: {
    agentName: string;
    currentSkill: string;
    partialFindings: string[];
    confidenceLevel: number;
  };
}

/**
 * Human approval requirement structure for governance scenarios
 */
export interface HumanApprovalRequirement {
  workflowId: string;
  approvalType: 'security_review' | 'executive_approval' | 'compliance_check' | 'risk_assessment';
  reason: string;
  escalationLevel: 'Team Lead Level' | 'Manager Level' | 'Director Level' | 'C-Level Executive';
  timeoutMinutes: number;
  requiredApprovers: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  businessJustification: string;
  alternativeOptions?: string[];
  escalationPath?: string[];
}

/**
 * Human approval decision structure
 */
export interface HumanApprovalDecision {
  approvalId: string;
  workflowId: string;
  decision: 'approve' | 'approve_with_restrictions' | 'block' | 'escalate';
  approver: string;
  approverRole: string;
  justification: string;
  timestamp: string; // ISO8601
  restrictions?: string[];
  escalationLevel?: string;
  nextApprover?: string;
  auditTrail: Array<{
    action: string;
    timestamp: string;
    actor: string;
    details: Record<string, any>;
  }>;
}

/**
 * Demo metrics for session tracking
 */
export interface DemoMetrics {
  sessionId: string;
  startTime: string; // ISO8601
  duration: number; // milliseconds
  
  workflowMetrics: {
    totalWorkflows: number;
    completedWorkflows: number;
    terminatedWorkflows: number;
    averageProcessingTime: number;
  };
  
  agentMetrics: {
    totalAnalyses: number;
    analysesByAgent: Record<string, number>;
    averageConfidence: number;
    skillsUtilization: Record<string, number>;
  };
  
  governanceMetrics: {
    totalDecisions: number;
    decisionsByType: Record<string, number>;
    averageDecisionTime: number;
    blockRate: number;
  };
  
  safetyMetrics: {
    externalActionsBlocked: number;
    auditEventsGenerated: number;
    isolationViolations: number;
    safetyScore: number; // 0-100
  };
}

/**
 * Demo reset options for controlled cleanup
 */
export interface DemoResetOptions {
  preserveConfig: boolean;
  preserveScenario: boolean;
  clearAuditTrail: boolean;
  resetTimers: boolean;
  generateResetAudit: boolean;
}

/**
 * Demo simulation button configuration
 */
export interface DemoSimulationButton {
  id: string;
  label: string;
  description: string;
  scenarioType: string;
  isHidden: boolean;
  requiresConfirmation: boolean;
  safetyWarning?: string;
}