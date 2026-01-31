'use client';

/**
 * SentinelFlow Mission Control - Main Dashboard Page
 * 
 * Implements the fixed 3-pane layout for incident response visualization:
 * - Left Panel (25%): Incoming Signal (alerts and logs)
 * - Center Panel (50%): Agent Brain & Workflow (agent cards and workflow progress)
 * - Right Panel (25%): Human Handoff & Governance (summaries and approval interface)
 * 
 * Task 16.2: Implement complete workflow visualization
 * - Connect workflow state changes to UI animations
 * - Integrate agent outputs with visualization components
 * - Add governance gate enforcement in UI workflow
 * - Add visual feedback for workflow state transitions
 * 
 * Requirements: 5.1 - Fixed 3-pane Mission Control dashboard layout
 * Requirements: 5.2 - Real-time workflow state visualization
 * Requirements: 5.3 - Agent activity and findings display
 * Requirements: 5.4 - Governance gate enforcement in UI
 * Design: Dark mode as default with specified color tokens
 */

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflow } from '@/context/WorkflowContext';
import { 
  ActiveAlertCard, 
  LiveTerminalLogs, 
  WorkflowStepTracker, 
  AgentCard, 
  BlastRadiusVisualization, 
  AgentSummaryChat,
  GovernanceApprovalCard,
  DemoModeBadge,
  WorkflowCompletionSummary,
  DemoControls
} from '@/components';
import { WorkflowState, GovernanceDecisionType, GovernanceDecision, WorkflowInstance, ActiveAlert, AgentOutput, GovernanceApprovalRequest } from '@/types/workflow';
import { Shield, Activity, AlertTriangle, Wifi, WifiOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { getApiClient } from '@/services/api';

/**
 * Helper to log audit events to backend AUDIT.md
 * Fire-and-forget - doesn't block demo flow
 */
function logAuditEvent(workflowId: string, eventType: string, actor: string, details: Record<string, unknown>) {
  getApiClient().logDemoAudit(workflowId, eventType, actor, details).catch(err => {
    console.warn('[Audit] Failed to log audit event:', err);
  });
}

/**
 * Header component with connection status and demo controls
 * Provides system-wide status indicators and demo mode controls
 * Implements Requirements 11.4 - Clear simulation status indicators
 * Task 16.2: Add visual feedback for workflow state transitions
 * Task 17.2: Add demo presentation features with scenario selection
 */
function Header() {
  const { state, resetWorkflow, isConnected, reconnect, setWorkflow, setActiveAlert, addLog, setGovernanceRequest, updateAgentCard } = useWorkflow();
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Determine workflow status for visual feedback
  const workflowStatus = useMemo(() => {
    if (!state.currentWorkflow) return 'idle';
    const currentState = state.currentWorkflow.currentState;
    if (currentState === WorkflowState.RESOLVED) return 'success';
    if (currentState === WorkflowState.TERMINATED) return 'error';
    if (currentState === WorkflowState.GOVERNANCE_PENDING) return 'pending';
    if (currentState === WorkflowState.ANALYZING) return 'analyzing';
    return 'active';
  }, [state.currentWorkflow]);

  // Check if workflow is active (not idle or completed)
  const isWorkflowActive = useMemo(() => {
    if (!state.currentWorkflow) return false;
    const currentState = state.currentWorkflow.currentState;
    return currentState !== WorkflowState.IDLE && 
           currentState !== WorkflowState.RESOLVED && 
           currentState !== WorkflowState.TERMINATED;
  }, [state.currentWorkflow]);

  /**
   * Simulate incident with selected scenario
   * Task 17.2: Implement demo scenario simulation with smooth pacing
   */
  const handleSimulateIncident = useCallback(async (scenarioType: string) => {
    setIsSimulating(true);
    
    try {
      // Generate workflow ID
      const workflowId = `demo-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      // Create initial workflow instance
      const workflow: WorkflowInstance = {
        workflowId,
        currentState: WorkflowState.IDLE,
        timestamp: new Date().toISOString(),
        agentOutputs: [],
        auditTrail: [{
          eventId: `audit-${Date.now()}`,
          workflowId,
          eventType: 'state_transition',
          timestamp: new Date().toISOString(),
          actor: 'orchestrator',
          details: {
            fromState: undefined,
            toState: WorkflowState.IDLE
          }
        }]
      };

      // Set initial workflow
      setWorkflow(workflow);

      // Log audit event for demo start
      logAuditEvent(workflowId, 'state_transition', 'orchestrator', {
        scenarioType,
        toState: WorkflowState.IDLE,
        event: 'demo_started'
      });

      // Add initial log
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Demo scenario initiated: ${scenarioType}`,
        source: 'demo-system'
      });

      // Simulate incident ingestion with delay for smooth pacing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate alert based on scenario type
      const alert = generateAlertForScenario(scenarioType);
      setActiveAlert(alert);

      // Transition to INCIDENT_INGESTED
      workflow.currentState = WorkflowState.INCIDENT_INGESTED;
      workflow.timestamp = new Date().toISOString();
      workflow.alert = alert;
      setWorkflow({ ...workflow });

      // Log audit event for incident ingestion
      logAuditEvent(workflowId, 'state_transition', 'orchestrator', {
        fromState: WorkflowState.IDLE,
        toState: WorkflowState.INCIDENT_INGESTED,
        alert: { service: alert.service, severity: alert.severity, metric: alert.metric }
      });

      addLog({
        timestamp: new Date().toISOString(),
        level: 'warning',
        message: `Incident ingested: ${alert.service} - ${alert.metric}`,
        source: 'orchestrator'
      });

      // Simulate analysis phase with progressive agent updates
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      workflow.currentState = WorkflowState.ANALYZING;
      workflow.timestamp = new Date().toISOString();
      setWorkflow({ ...workflow });

      // Update agent cards to analyzing state
      updateAgentCard({
        agentName: 'sre-agent',
        status: 'analyzing',
        skillsActive: ['Datadog', 'CloudWatch'],
        findings: [],
        confidenceLevel: 0,
        thinkingAnimation: true
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      updateAgentCard({
        agentName: 'security-agent',
        status: 'analyzing',
        skillsActive: ['Splunk SIEM', 'IAM Logs'],
        findings: [],
        confidenceLevel: 0,
        thinkingAnimation: true
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      updateAgentCard({
        agentName: 'governance-agent',
        status: 'analyzing',
        skillsActive: ['Policy Engine', 'Risk Register'],
        findings: [],
        confidenceLevel: 0,
        thinkingAnimation: true
      });

      // Simulate agent analysis completion with realistic timing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Complete SRE agent analysis
      const sreOutput = generateAgentOutput('sre-agent', scenarioType);
      workflow.agentOutputs.push(sreOutput);
      updateAgentCard({
        agentName: 'sre-agent',
        status: 'complete',
        skillsActive: sreOutput.skillsUsed,
        findings: [sreOutput.findings.summary, ...sreOutput.findings.evidence.slice(0, 2)],
        confidenceLevel: sreOutput.confidenceLevel,
        thinkingAnimation: false
      });

      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `SRE Agent completed analysis with ${Math.round(sreOutput.confidenceLevel * 100)}% confidence`,
        source: 'sre-agent'
      });

      // Log audit event for SRE agent completion
      logAuditEvent(workflowId, 'agent_output', 'sre-agent', {
        agentName: 'sre-agent',
        confidenceLevel: sreOutput.confidenceLevel,
        skillsUsed: sreOutput.skillsUsed,
        findingsSummary: sreOutput.findings.summary
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Complete Security agent analysis
      const securityOutput = generateAgentOutput('security-agent', scenarioType);
      workflow.agentOutputs.push(securityOutput);
      updateAgentCard({
        agentName: 'security-agent',
        status: 'complete',
        skillsActive: securityOutput.skillsUsed,
        findings: [securityOutput.findings.summary, ...securityOutput.findings.evidence.slice(0, 2)],
        confidenceLevel: securityOutput.confidenceLevel,
        thinkingAnimation: false
      });

      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Security Agent completed analysis with ${Math.round(securityOutput.confidenceLevel * 100)}% confidence`,
        source: 'security-agent'
      });

      // Log audit event for Security agent completion
      logAuditEvent(workflowId, 'agent_output', 'security-agent', {
        agentName: 'security-agent',
        confidenceLevel: securityOutput.confidenceLevel,
        skillsUsed: securityOutput.skillsUsed,
        findingsSummary: securityOutput.findings.summary
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Complete Governance agent analysis
      const governanceOutput = generateAgentOutput('governance-agent', scenarioType);
      workflow.agentOutputs.push(governanceOutput);
      updateAgentCard({
        agentName: 'governance-agent',
        status: 'complete',
        skillsActive: governanceOutput.skillsUsed,
        findings: [governanceOutput.findings.summary, ...governanceOutput.findings.evidence.slice(0, 2)],
        confidenceLevel: governanceOutput.confidenceLevel,
        thinkingAnimation: false
      });

      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Governance Agent completed analysis with ${Math.round(governanceOutput.confidenceLevel * 100)}% confidence`,
        source: 'governance-agent'
      });

      // Log audit event for Governance agent completion
      logAuditEvent(workflowId, 'agent_output', 'governance-agent', {
        agentName: 'governance-agent',
        confidenceLevel: governanceOutput.confidenceLevel,
        skillsUsed: governanceOutput.skillsUsed,
        findingsSummary: governanceOutput.findings.summary
      });

      // Transition to RCA_COMPLETE
      await new Promise(resolve => setTimeout(resolve, 1000));
      workflow.currentState = WorkflowState.RCA_COMPLETE;
      workflow.timestamp = new Date().toISOString();
      setWorkflow({ ...workflow });

      // Generate governance request early so blast radius is visible during RCA_COMPLETE
      const governanceRequest = generateGovernanceRequest(scenarioType, workflow.agentOutputs);
      console.log('[Demo] Setting governance request with blast radius:', governanceRequest.blastRadius);
      setGovernanceRequest(governanceRequest);

      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Root cause analysis complete - proceeding to governance gate',
        source: 'orchestrator'
      });

      // Transition to GOVERNANCE_PENDING
      await new Promise(resolve => setTimeout(resolve, 1000));
      workflow.currentState = WorkflowState.GOVERNANCE_PENDING;
      workflow.timestamp = new Date().toISOString();
      setWorkflow({ ...workflow });

      addLog({
        timestamp: new Date().toISOString(),
        level: 'warning',
        message: `Governance approval required - Risk Level: ${governanceRequest.riskLevel}`,
        source: 'governance-agent'
      });

      // Log audit event for governance gate activation
      logAuditEvent(workflowId, 'state_transition', 'orchestrator', {
        fromState: WorkflowState.RCA_COMPLETE,
        toState: WorkflowState.GOVERNANCE_PENDING,
        riskLevel: governanceRequest.riskLevel,
        event: 'governance_gate_activated'
      });

    } catch (error) {
      console.error('Demo simulation error:', error);
      addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Demo simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'demo-system'
      });
    } finally {
      setIsSimulating(false);
    }
  }, [setWorkflow, setActiveAlert, addLog, setGovernanceRequest, updateAgentCard]);
  
  return (
    <header className="h-14 bg-panel border-b border-border flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-accent" />
        <h1 className="text-lg font-semibold text-foreground">
          SentinelFlow Mission Control
        </h1>
        <span className="text-xs text-muted px-2 py-0.5 bg-panel-secondary rounded">
          SRE Sidekick
        </span>
        
        {/* Workflow Status Indicator with Animation */}
        <AnimatePresence mode="wait">
          {state.currentWorkflow && (
            <motion.div
              key={workflowStatus}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                workflowStatus === 'success' ? 'bg-status-success/20 text-status-success' :
                workflowStatus === 'error' ? 'bg-status-error/20 text-status-error' :
                workflowStatus === 'pending' ? 'bg-status-pending/20 text-status-pending' :
                workflowStatus === 'analyzing' ? 'bg-status-analyzing/20 text-status-analyzing' :
                'bg-accent/20 text-accent'
              }`}
            >
              {workflowStatus === 'analyzing' && <Loader2 className="w-3 h-3 animate-spin" />}
              {workflowStatus === 'success' && <CheckCircle2 className="w-3 h-3" />}
              {workflowStatus === 'error' && <XCircle className="w-3 h-3" />}
              {workflowStatus === 'pending' && <Shield className="w-3 h-3" />}
              <span>{state.currentWorkflow.currentState}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Connection Status with Reconnect Button */}
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${
            state.connectionStatus === 'connected' 
              ? 'bg-status-success' 
              : state.connectionStatus === 'reconnecting'
              ? 'bg-status-warning status-pulse'
              : 'bg-status-error'
          }`} />
          <span className="text-muted">
            {state.connectionStatus === 'connected' ? 'Connected' : 
             state.connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
          </span>
          {state.connectionStatus === 'disconnected' && (
            <button
              onClick={reconnect}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
              title="Reconnect"
            >
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            </button>
          )}
        </div>
        
        {/* Demo Mode Indicator - Enhanced for Requirements 11.4 */}
        {state.isDemoMode && (
          <DemoModeBadge isDemoMode={state.isDemoMode} />
        )}
        
        {/* Demo Controls with Scenario Selection - Task 17.2 */}
        {state.isDemoMode && (
          <DemoControls
            isDemoMode={state.isDemoMode}
            isWorkflowActive={isWorkflowActive}
            onSimulateIncident={handleSimulateIncident}
            onReset={resetWorkflow}
            isSimulating={isSimulating}
            compact={true}
          />
        )}
      </div>
    </header>
  );
}

/**
 * Left Panel - Incoming Signal (25% width)
 * Displays active alerts and streaming logs
 * Requirements: 5.2 - Active alert information and live streaming terminal logs
 * Requirements: 14.1 - Display active alert in JSON-style format
 * Requirements: 14.2, 14.3, 14.4, 14.5 - Live terminal logs with syntax highlighting
 */
function LeftPanel() {
  const { state } = useWorkflow();
  
  // Determine if agents are actively investigating (for scroll speed)
  const isActivelyInvestigating = state.agentCards.some(
    agent => agent.status === 'analyzing'
  );
  
  // Determine if incident is resolved (for scroll speed slowdown)
  const isResolved = state.currentWorkflow?.currentState === 'RESOLVED' ||
                     state.currentWorkflow?.currentState === 'TERMINATED';
  
  return (
    <div className="flex flex-col h-full bg-panel border-r border-border panel-transition">
      <div className="p-3 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-status-error" />
          Incoming Signal
        </h2>
      </div>
      
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Active Alert Card - Task 10.1 */}
        <div className="p-3 border-b border-border flex-shrink-0">
          <div className="text-xs text-muted mb-2">Active Alert</div>
          <ActiveAlertCard alert={state.activeAlert} />
        </div>
        
        {/* Live Terminal Logs - Task 10.3 */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-3">
          <LiveTerminalLogs
            logs={state.logs}
            isStreaming={state.isLogStreaming}
            isActivelyInvestigating={isActivelyInvestigating}
            isResolved={isResolved}
            maxLogs={500}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Center Panel - Agent Brain & Workflow (50% width)
 * Shows workflow progress and agent analysis cards
 * Task 16.2: Connect workflow state changes to UI animations
 * Requirements: 5.3 - Animated workflow progress, parallel agent cards, blast radius visualization
 * Requirements: 6.1 - Display agent cards showing current activity with skills badges
 * Requirements: 6.3 - Visual indicators for agent confidence levels
 * Requirements: 6.4 - Display structured findings when agents complete analysis
 */
function CenterPanel() {
  const { state } = useWorkflow();
  
  // Determine if workflow is in a transitioning state for visual feedback
  const isTransitioning = useMemo(() => {
    const currentState = state.currentWorkflow?.currentState;
    return currentState === WorkflowState.ANALYZING || 
           currentState === WorkflowState.INCIDENT_INGESTED;
  }, [state.currentWorkflow?.currentState]);
  
  // Check if governance gate is blocking
  const isGovernanceBlocking = state.currentWorkflow?.currentState === WorkflowState.GOVERNANCE_PENDING;
  
  return (
    <div className="flex flex-col h-full bg-panel panel-transition">
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Activity className={`w-4 h-4 ${isTransitioning ? 'text-status-analyzing animate-pulse' : 'text-status-analyzing'}`} />
            Agent Brain & Workflow
          </h2>
          {isGovernanceBlocking && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs text-status-pending bg-status-pending/20 px-2 py-0.5 rounded-full flex items-center gap-1"
            >
              <Shield className="w-3 h-3" />
              Awaiting Approval
            </motion.span>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {/* Workflow Step Tracker - Task 11.1 */}
        <div className="mb-6">
          <div className="text-xs text-muted mb-2">Workflow Progress</div>
          <motion.div 
            className="bg-panel-secondary rounded-lg p-4 border border-border"
            animate={{
              borderColor: isGovernanceBlocking ? 'var(--status-pending)' : 'var(--border)',
              boxShadow: isGovernanceBlocking ? '0 0 20px rgba(251, 191, 36, 0.1)' : 'none'
            }}
            transition={{ duration: 0.3 }}
          >
            <WorkflowStepTracker 
              currentState={state.currentWorkflow?.currentState ?? WorkflowState.IDLE}
            />
          </motion.div>
        </div>
        
        {/* Parallel Agent Cards - Task 11.2 */}
        <div className="space-y-4">
          <div className="text-xs text-muted flex items-center justify-between">
            <span>Specialist Agents</span>
            {isTransitioning && (
              <span className="flex items-center gap-1 text-status-analyzing">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing...
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {state.agentCards.map((agent, index) => (
                <motion.div
                  key={agent.agentName}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <AgentCard agent={agent} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Blast Radius Visualization - Task 11.4 */}
        <div className="mt-6">
          <div className="text-xs text-muted mb-2">Blast Radius {state.governanceRequest?.blastRadius?.length ? `(${state.governanceRequest.blastRadius.length} services)` : ''}</div>
          <BlastRadiusVisualization 
            nodes={state.governanceRequest?.blastRadius ?? []}
            showDependencies={true}
            animated={true}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Right Panel - Human Handoff & Governance (25% width)
 * Shows agent summaries and governance approval interface
 * Task 16.2: Add governance gate enforcement in UI workflow
 * Requirements: 5.4 - Agent summaries and governance approval interface with mandatory human decision points
 * Requirements: 8.4 - Display plain-English summary of findings including RCA summary, correlation explanation, and risk assessment
 */
function RightPanel() {
  const { state, submitGovernanceDecision, governanceSubmission, addLog } = useWorkflow();
  
  // Extract agent outputs from current workflow
  const agentOutputs = state.currentWorkflow?.agentOutputs ?? [];
  
  // Determine RCA summary from agent outputs (combine key findings)
  const rcaSummary = useMemo(() => {
    if (agentOutputs.length === 0) return undefined;
    return agentOutputs
      .filter(o => o.findings?.summary)
      .map(o => o.findings.summary)
      .join(' ');
  }, [agentOutputs]);
  
  // Get risk level from governance request
  const riskLevel = state.governanceRequest?.riskLevel;
  
  // Check if governance gate is active (blocking workflow)
  const isGovernanceGateActive = state.currentWorkflow?.currentState === WorkflowState.GOVERNANCE_PENDING;
  
  // Handle governance decision callback
  const handleGovernanceDecision = useCallback((
    decision: GovernanceDecisionType, 
    rationale: string, 
    fullDecision?: GovernanceDecision
  ) => {
    // Log the decision
    addLog({
      timestamp: new Date().toISOString(),
      level: decision === 'block' ? 'warning' : 'info',
      message: `Governance decision: ${decision.toUpperCase()} - ${rationale}`,
      source: 'human'
    });

    // Log audit event for governance decision
    if (state.currentWorkflow?.workflowId) {
      logAuditEvent(state.currentWorkflow.workflowId, 'governance_decision', 'human', {
        decision,
        rationale,
        approver: fullDecision?.approver,
        restrictions: fullDecision?.restrictions
      });
    }
    
    // Submit the decision to update workflow state
    if (fullDecision) {
      submitGovernanceDecision(fullDecision);
    }
  }, [addLog, submitGovernanceDecision, state.currentWorkflow?.workflowId]);
  
  // Default decision maker for demo
  // Role must be one of: senior-sre, security-lead, compliance-officer, engineering-manager
  const decisionMaker = useMemo(() => ({
    id: 'demo-operator',
    role: 'senior-sre'
  }), []);
  
  return (
    <div className="flex flex-col h-full bg-panel border-l border-border panel-transition">
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-agent-governance" />
            Human Handoff & Governance
          </h2>
          {isGovernanceGateActive && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: [1, 1.05, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              className="text-xs text-status-pending bg-status-pending/20 px-2 py-0.5 rounded-full border border-status-pending/50"
            >
              Action Required
            </motion.span>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {/* Agent Summary Chat - Task 12.1 */}
        <div className="mb-6">
          <div className="text-xs text-muted mb-2">Agent Summary</div>
          <AgentSummaryChat
            agentOutputs={agentOutputs}
            rcaSummary={rcaSummary}
            riskLevel={riskLevel}
          />
        </div>
        
        {/* Governance Approval Card - Task 12.2, 12.4, 16.2 */}
        <div>
          <div className="text-xs text-muted mb-2 flex items-center justify-between">
            <span>Governance Gate</span>
            {isGovernanceGateActive && (
              <span className="text-status-pending text-[10px]">
                Workflow blocked until decision
              </span>
            )}
          </div>
          
          <AnimatePresence mode="wait">
            {state.governanceRequest ? (
              <motion.div
                key="governance-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <GovernanceApprovalCard
                  request={state.governanceRequest}
                  onDecision={handleGovernanceDecision}
                  isSubmitting={governanceSubmission.isSubmitting}
                  decisionMaker={decisionMaker}
                  submitToBackend={true}
                />
              </motion.div>
            ) : (
              <motion.div
                key="no-governance"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-panel-secondary rounded-lg p-4 text-center text-muted border border-border"
              >
                <Shield className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <div className="text-sm">No pending governance decisions</div>
                <div className="text-xs mt-1 text-muted-foreground">
                  Governance gate will activate when approval is required
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Workflow Completion Status - Task 16.4: Enhanced with WorkflowCompletionSummary */}
        <AnimatePresence>
          {(state.currentWorkflow?.currentState === WorkflowState.RESOLVED ||
            state.currentWorkflow?.currentState === WorkflowState.TERMINATED) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-6"
            >
              <WorkflowCompletionSummary 
                workflow={state.currentWorkflow}
                defaultExpanded={false}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Audit Trail - Always visible as audit is a first-class output (Architecture: Audit as a First-Class Output) */}
        <div className="mt-6">
          <div className="text-xs text-muted mb-2">Audit Trail</div>
          <div className="bg-panel-secondary rounded p-4 border border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Events Recorded</span>
              <span className="text-foreground font-medium">
                {state.currentWorkflow?.auditTrail.length || 0}
              </span>
            </div>
            {state.currentWorkflow?.auditTrail.length ? (
              <div className="mt-2 text-xs text-status-success flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Audit trail active
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">
                Waiting for workflow events...
              </div>
            )}
            
            {/* Recent Audit Events Preview */}
            {state.currentWorkflow?.auditTrail && state.currentWorkflow.auditTrail.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
                <div className="text-xs text-muted mb-1">Recent Events:</div>
                {state.currentWorkflow.auditTrail.slice(-3).map((event, idx) => (
                  <div key={event.eventId || idx} className="text-xs text-muted-foreground truncate">
                    • {event.eventType.replace('_', ' ')}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate alert data for a given scenario type
 * Task 17.2: Demo data generation for smooth demo flow
 */
function generateAlertForScenario(scenarioType: string): ActiveAlert {
  const timestamp = new Date().toISOString();
  
  const alertConfigs: Record<string, ActiveAlert> = {
    'database-outage': {
      service: 'user-service',
      severity: 'critical',
      metric: 'database_connection_pool_exhaustion',
      value: 100,
      timestamp,
      description: 'Database connection pool exhausted - all connections in use'
    },
    'api-failure': {
      service: 'api-gateway',
      severity: 'warning',
      metric: 'rate_limiting_cascade',
      value: 95,
      timestamp,
      description: 'API Gateway rate limiting triggered - downstream cascade detected'
    },
    'security-incident': {
      service: 'auth-service',
      severity: 'critical',
      metric: 'unauthorized_access_attempts',
      value: 150,
      timestamp,
      description: 'Unusual authentication patterns - potential unauthorized access'
    },
    'infrastructure-issue': {
      service: 'kubernetes-cluster',
      severity: 'warning',
      metric: 'resource_exhaustion',
      value: 98,
      timestamp,
      description: 'Container orchestration resource exhaustion - pod scheduling failures'
    },
    'deployment-problem': {
      service: 'web-service',
      severity: 'warning',
      metric: 'deployment_error_rate',
      value: 12.1,
      timestamp,
      description: 'Recent deployment causing application errors - rollback may be required'
    }
  };

  return alertConfigs[scenarioType] || alertConfigs['database-outage'];
}

/**
 * Generate agent output for a given agent and scenario
 * Task 17.2: Demo data generation with realistic findings
 */
function generateAgentOutput(agentName: string, scenarioType: string): AgentOutput {
  const timestamp = new Date().toISOString();
  
  const agentConfigs: Record<string, Record<string, AgentOutput>> = {
    'sre-agent': {
      'database-outage': {
        agentName: 'sre-agent',
        skillsUsed: ['Datadog', 'CloudWatch', 'Prometheus'],
        findings: {
          summary: 'Database connection pool exhausted due to connection leak in recent deployment',
          evidence: [
            'Connection pool utilization at 100%',
            'Connection timeout errors increasing exponentially',
            'Recent deployment v2.1.3 correlates with issue onset'
          ],
          correlations: ['Deployment timing matches error spike', 'No infrastructure changes detected'],
          recommendations: ['Restart connection pool', 'Rollback to v2.1.2']
        },
        confidenceLevel: 0.87,
        timestamp,
        metadata: { processingTimeMs: 2500, dataSourcesAccessed: ['Datadog', 'CloudWatch'] }
      },
      'api-failure': {
        agentName: 'sre-agent',
        skillsUsed: ['Datadog', 'CloudWatch', 'OpenTelemetry'],
        findings: {
          summary: 'API Gateway rate limiting triggered by traffic spike causing downstream cascade',
          evidence: [
            'Traffic increased 300% in last 15 minutes',
            'Rate limiting threshold exceeded',
            'Downstream services experiencing timeout cascade'
          ],
          correlations: ['Marketing campaign launch timing', 'Geographic traffic concentration'],
          recommendations: ['Increase rate limits temporarily', 'Scale downstream services']
        },
        confidenceLevel: 0.82,
        timestamp,
        metadata: { processingTimeMs: 2200, dataSourcesAccessed: ['Datadog', 'CloudWatch'] }
      },
      'security-incident': {
        agentName: 'sre-agent',
        skillsUsed: ['Datadog', 'Prometheus', 'OpenTelemetry'],
        findings: {
          summary: 'Authentication service under stress but infrastructure healthy',
          evidence: [
            'Auth service CPU at 65% - within normal range',
            'No infrastructure anomalies detected',
            'Request patterns show unusual distribution'
          ],
          correlations: ['Security events correlate with traffic patterns'],
          recommendations: ['Monitor infrastructure closely', 'Defer to security team']
        },
        confidenceLevel: 0.75,
        timestamp,
        metadata: { processingTimeMs: 1800, dataSourcesAccessed: ['Datadog', 'Prometheus'] }
      },
      'infrastructure-issue': {
        agentName: 'sre-agent',
        skillsUsed: ['Prometheus', 'CloudWatch', 'OpenTelemetry'],
        findings: {
          summary: 'Kubernetes cluster resource exhaustion causing pod scheduling failures',
          evidence: [
            'Node CPU utilization at 95%',
            'Memory pressure on 3 of 5 nodes',
            'Pod scheduling queue growing'
          ],
          correlations: ['Traffic growth outpacing capacity', 'Recent scaling event insufficient'],
          recommendations: ['Add cluster nodes', 'Implement horizontal pod autoscaling']
        },
        confidenceLevel: 0.91,
        timestamp,
        metadata: { processingTimeMs: 2100, dataSourcesAccessed: ['Prometheus', 'CloudWatch'] }
      },
      'deployment-problem': {
        agentName: 'sre-agent',
        skillsUsed: ['Datadog', 'OpenTelemetry'],
        findings: {
          summary: 'Recent deployment v2.1.3 causing application errors',
          evidence: [
            'Error rate spike correlates with deployment time',
            'Configuration validation failures in logs',
            'Health check failures on 2 of 4 instances'
          ],
          correlations: ['Deployment v2.1.3 at 09:00 matches error onset'],
          recommendations: ['Rollback to v2.1.2', 'Review configuration changes']
        },
        confidenceLevel: 0.94,
        timestamp,
        metadata: { processingTimeMs: 1500, dataSourcesAccessed: ['Datadog', 'OpenTelemetry'] }
      }
    },
    'security-agent': {
      'database-outage': {
        agentName: 'security-agent',
        skillsUsed: ['Splunk SIEM', 'IAM Logs'],
        findings: {
          summary: 'No security indicators detected - operational issue confirmed',
          evidence: [
            'Normal authentication patterns',
            'No suspicious access attempts',
            'Database access logs show expected patterns'
          ],
          correlations: ['No security correlation with incident'],
          recommendations: ['Continue monitoring', 'No security action required']
        },
        confidenceLevel: 0.89,
        timestamp,
        metadata: { processingTimeMs: 1800, dataSourcesAccessed: ['Splunk SIEM', 'IAM Logs'] }
      },
      'api-failure': {
        agentName: 'security-agent',
        skillsUsed: ['Splunk SIEM', 'IAM Logs', 'CSPM'],
        findings: {
          summary: 'Traffic spike appears legitimate - no DDoS indicators',
          evidence: [
            'Traffic patterns consistent with legitimate users',
            'Geographic distribution matches user base',
            'No malicious payload signatures detected'
          ],
          correlations: ['Marketing campaign correlation confirmed'],
          recommendations: ['Monitor for anomalies', 'Maintain rate limiting']
        },
        confidenceLevel: 0.78,
        timestamp,
        metadata: { processingTimeMs: 2000, dataSourcesAccessed: ['Splunk SIEM', 'CSPM'] }
      },
      'security-incident': {
        agentName: 'security-agent',
        skillsUsed: ['Splunk SIEM', 'IAM Logs', 'CSPM'],
        findings: {
          summary: 'Coordinated credential stuffing attack detected from multiple IPs',
          evidence: [
            'Failed login attempts from 47 unique IPs',
            'Credential patterns match known breach databases',
            'Privilege escalation attempts on 3 accounts'
          ],
          correlations: ['Attack timing correlates with recent data breach disclosure'],
          recommendations: ['Block attacking IPs', 'Force password reset for affected accounts', 'Enable additional MFA']
        },
        confidenceLevel: 0.92,
        timestamp,
        metadata: { processingTimeMs: 2500, dataSourcesAccessed: ['Splunk SIEM', 'IAM Logs', 'CSPM'] }
      },
      'infrastructure-issue': {
        agentName: 'security-agent',
        skillsUsed: ['Splunk SIEM', 'CSPM'],
        findings: {
          summary: 'No security implications - resource exhaustion is operational',
          evidence: [
            'Container security policies intact',
            'Network security unaffected',
            'No unauthorized access detected'
          ],
          correlations: ['No security correlation'],
          recommendations: ['Continue security monitoring']
        },
        confidenceLevel: 0.85,
        timestamp,
        metadata: { processingTimeMs: 1600, dataSourcesAccessed: ['Splunk SIEM', 'CSPM'] }
      },
      'deployment-problem': {
        agentName: 'security-agent',
        skillsUsed: ['Splunk SIEM', 'IAM Logs'],
        findings: {
          summary: 'No security vulnerabilities in deployment - operational issue',
          evidence: [
            'Deployment process security maintained',
            'Access controls functioning normally',
            'No security-related configuration changes'
          ],
          correlations: ['No security correlation with deployment'],
          recommendations: ['No security action required']
        },
        confidenceLevel: 0.88,
        timestamp,
        metadata: { processingTimeMs: 1400, dataSourcesAccessed: ['Splunk SIEM', 'IAM Logs'] }
      }
    },
    'governance-agent': {
      'database-outage': {
        agentName: 'governance-agent',
        skillsUsed: ['Policy Engine', 'Change Management', 'Risk Register'],
        findings: {
          summary: 'Database restart requires change approval - high blast radius',
          evidence: [
            'Change management process followed for deployment',
            'Database maintenance window compliance required',
            'Incident response procedures activated'
          ],
          correlations: ['Recent deployment had proper approvals'],
          recommendations: ['Obtain emergency change approval', 'Document incident timeline']
        },
        confidenceLevel: 0.86,
        timestamp,
        metadata: { processingTimeMs: 1900, dataSourcesAccessed: ['Policy Engine', 'Change Management'] }
      },
      'api-failure': {
        agentName: 'governance-agent',
        skillsUsed: ['Policy Engine', 'Risk Register'],
        findings: {
          summary: 'Rate limiting adjustment requires security approval',
          evidence: [
            'Rate limiting policy compliance maintained',
            'SLA impact assessment required',
            'Customer communication may be needed'
          ],
          correlations: ['Policy compliance maintained throughout'],
          recommendations: ['Obtain security team approval for rate limit changes']
        },
        confidenceLevel: 0.81,
        timestamp,
        metadata: { processingTimeMs: 1700, dataSourcesAccessed: ['Policy Engine', 'Risk Register'] }
      },
      'security-incident': {
        agentName: 'governance-agent',
        skillsUsed: ['Policy Engine', 'Change Management', 'Risk Register'],
        findings: {
          summary: 'Security incident requires immediate response - compliance notification mandatory',
          evidence: [
            'Security incident response activated',
            'Compliance notification within 24 hours required',
            'Data breach assessment in progress'
          ],
          correlations: ['Regulatory requirements triggered'],
          recommendations: ['Immediate access revocation', 'Compliance team notification', 'Customer notification assessment']
        },
        confidenceLevel: 0.95,
        timestamp,
        metadata: { processingTimeMs: 2200, dataSourcesAccessed: ['Policy Engine', 'Change Management', 'Risk Register'] }
      },
      'infrastructure-issue': {
        agentName: 'governance-agent',
        skillsUsed: ['Policy Engine', 'Change Management'],
        findings: {
          summary: 'Infrastructure scaling requires budget approval',
          evidence: [
            'Capacity planning process review required',
            'Resource allocation policy compliance',
            'Cost impact assessment needed'
          ],
          correlations: ['Budget allocation for Q1 may be exceeded'],
          recommendations: ['Obtain budget approval for scaling', 'Document capacity planning gaps']
        },
        confidenceLevel: 0.83,
        timestamp,
        metadata: { processingTimeMs: 1600, dataSourcesAccessed: ['Policy Engine', 'Change Management'] }
      },
      'deployment-problem': {
        agentName: 'governance-agent',
        skillsUsed: ['Policy Engine', 'Change Management'],
        findings: {
          summary: 'Rollback during business hours requires approval',
          evidence: [
            'Deployment process followed correctly',
            'Change management approval obtained',
            'Rollback procedures documented'
          ],
          correlations: ['Standard deployment process was followed'],
          recommendations: ['Obtain rollback approval', 'Document lessons learned']
        },
        confidenceLevel: 0.90,
        timestamp,
        metadata: { processingTimeMs: 1400, dataSourcesAccessed: ['Policy Engine', 'Change Management'] }
      }
    }
  };

  const agentConfig = agentConfigs[agentName]?.[scenarioType];
  if (agentConfig) {
    return agentConfig;
  }

  // Default fallback
  return agentConfigs['sre-agent']['database-outage'];
}

/**
 * Generate governance request for a given scenario
 * Task 17.2: Demo governance scenarios with realistic data
 */
function generateGovernanceRequest(scenarioType: string, _agentOutputs: AgentOutput[]): GovernanceApprovalRequest {
  const governanceConfigs: Record<string, GovernanceApprovalRequest> = {
    'database-outage': {
      recommendedAction: 'Restart database connection pool and rollback to v2.1.2',
      blastRadius: [
        { serviceName: 'user-service', healthStatus: 'critical', dependencies: ['database'], impactLevel: 'high' },
        { serviceName: 'order-service', healthStatus: 'warning', dependencies: ['user-service', 'database'], impactLevel: 'high' },
        { serviceName: 'payment-service', healthStatus: 'warning', dependencies: ['order-service'], impactLevel: 'medium' },
        { serviceName: 'notification-service', healthStatus: 'healthy', dependencies: ['user-service'], impactLevel: 'low' }
      ],
      riskLevel: 'high',
      policyConflicts: [
        'Database restart requires change approval',
        'Production access during business hours restricted'
      ],
      reversibility: true
    },
    'api-failure': {
      recommendedAction: 'Increase rate limits temporarily and scale downstream services',
      blastRadius: [
        { serviceName: 'api-gateway', healthStatus: 'critical', dependencies: [], impactLevel: 'high' },
        { serviceName: 'auth-service', healthStatus: 'warning', dependencies: ['api-gateway'], impactLevel: 'high' },
        { serviceName: 'user-service', healthStatus: 'warning', dependencies: ['api-gateway'], impactLevel: 'medium' },
        { serviceName: 'mobile-app', healthStatus: 'critical', dependencies: ['api-gateway', 'auth-service'], impactLevel: 'high' }
      ],
      riskLevel: 'high',
      policyConflicts: [
        'Rate limiting adjustment requires security approval',
        'Traffic rerouting impacts customer SLA'
      ],
      reversibility: true
    },
    'security-incident': {
      recommendedAction: 'Block attacking IPs, force password reset, enable additional MFA',
      blastRadius: [
        { serviceName: 'auth-service', healthStatus: 'critical', dependencies: [], impactLevel: 'high' },
        { serviceName: 'user-service', healthStatus: 'warning', dependencies: ['auth-service'], impactLevel: 'high' },
        { serviceName: 'admin-panel', healthStatus: 'critical', dependencies: ['auth-service'], impactLevel: 'high' },
        { serviceName: 'audit-service', healthStatus: 'healthy', dependencies: [], impactLevel: 'low' }
      ],
      riskLevel: 'critical',
      policyConflicts: [
        'Immediate access revocation required',
        'Compliance reporting within 24 hours mandatory',
        'Customer notification may be required'
      ],
      reversibility: true
    },
    'infrastructure-issue': {
      recommendedAction: 'Add cluster nodes and implement horizontal pod autoscaling',
      blastRadius: [
        { serviceName: 'kubernetes-cluster', healthStatus: 'critical', dependencies: [], impactLevel: 'high' },
        { serviceName: 'web-service', healthStatus: 'warning', dependencies: ['kubernetes-cluster'], impactLevel: 'medium' },
        { serviceName: 'worker-service', healthStatus: 'warning', dependencies: ['kubernetes-cluster'], impactLevel: 'medium' },
        { serviceName: 'cache-service', healthStatus: 'healthy', dependencies: ['kubernetes-cluster'], impactLevel: 'low' }
      ],
      riskLevel: 'medium',
      policyConflicts: [
        'Infrastructure scaling requires budget approval',
        'Node addition impacts cost allocation'
      ],
      reversibility: true
    },
    'deployment-problem': {
      recommendedAction: 'Rollback to v2.1.2 and review configuration changes',
      blastRadius: [
        { serviceName: 'web-service', healthStatus: 'warning', dependencies: [], impactLevel: 'medium' },
        { serviceName: 'api-service', healthStatus: 'warning', dependencies: ['web-service'], impactLevel: 'medium' }
      ],
      riskLevel: 'low',
      policyConflicts: [
        'Rollback during business hours requires approval'
      ],
      reversibility: true
    }
  };

  return governanceConfigs[scenarioType] || governanceConfigs['database-outage'];
}

/**
 * Main Mission Control Dashboard
 * 
 * Implements the fixed 3-pane layout as specified in Requirements 5.1:
 * - Left Panel: 25% width (min 280px, max 400px) - Incoming Signal
 * - Center Panel: 50% width (flexible) - Agent Brain & Workflow
 * - Right Panel: 25% width (min 280px, max 400px) - Human Handoff & Governance
 * 
 * Dark mode is enforced as the default design for Mission Control dashboard.
 */
export default function MissionControl() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Header />
      
      {/* 3-Pane Layout - Requirements 5.1 */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - 25% width (Incoming Signal) */}
        <div className="w-1/4 min-w-[280px] max-w-[400px] flex-shrink-0">
          <LeftPanel />
        </div>
        
        {/* Center Panel - 50% width (Agent Brain & Workflow) */}
        <div className="flex-1 min-w-[400px]">
          <CenterPanel />
        </div>
        
        {/* Right Panel - 25% width (Human Handoff & Governance) */}
        <div className="w-1/4 min-w-[280px] max-w-[400px] flex-shrink-0">
          <RightPanel />
        </div>
      </main>
    </div>
  );
}
