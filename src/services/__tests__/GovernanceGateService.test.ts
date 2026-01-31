/**
 * GovernanceGateService Tests
 * Tests governance gate enforcement, decision validation, and blocking behavior
 * Implements Requirements 4.1, 4.3, 4.4 - Governance gate enforcement and validation
 */

import { vi } from 'vitest';
import { GovernanceGateService, GovernanceRequest } from '../GovernanceGateService';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { WorkflowState } from '../../types/workflow';

describe('GovernanceGateService', () => {
  let stateManager: WorkflowStateManager;
  let governanceGate: GovernanceGateService;
  let workflowId: string;

  beforeEach(async () => {
    stateManager = new WorkflowStateManager();
    governanceGate = new GovernanceGateService(stateManager);
    
    // Create workflow and transition to GOVERNANCE_PENDING
    const workflow = await stateManager.createWorkflow();
    workflowId = workflow.workflowId;
  });

  describe('createGovernanceRequest', () => {
    it('should create governance request when workflow is in GOVERNANCE_PENDING state', async () => {
      // Transition to GOVERNANCE_PENDING
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const contextData = {
        incidentSummary: 'Database connection pool exhaustion',
        agentFindings: ['SRE: High CPU usage detected', 'Security: No security issues found'],
        correlationSummary: '2 agents completed analysis',
        confidenceLevel: 0.85
      };

      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Restart database connection pool',
        contextData
      );

      expect(request).toBeDefined();
      expect(request.workflowId).toBe(workflowId);
      expect(request.status).toBe('pending');
      expect(request.recommendedAction).toBe('Restart database connection pool');
      expect(request.contextData).toEqual(contextData);
      expect(request.blastRadiusAssessment).toBeDefined();
      expect(request.policyConflicts).toBeDefined();
    });

    it('should throw error when workflow is not in GOVERNANCE_PENDING state', async () => {
      const contextData = {
        incidentSummary: 'Test incident',
        agentFindings: [],
        correlationSummary: 'No analysis',
        confidenceLevel: 0.5
      };

      await expect(
        governanceGate.createGovernanceRequest(workflowId, 'Test action', contextData)
      ).rejects.toThrow('expected GOVERNANCE_PENDING');
    });

    it('should generate appropriate blast radius assessment', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const contextData = {
        incidentSummary: 'Database and API service failure',
        agentFindings: ['Database connection issues', 'API gateway timeout'],
        correlationSummary: 'Multiple service impact',
        confidenceLevel: 0.6 // Lower confidence should increase risk
      };

      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Restart services',
        contextData
      );

      expect(request.blastRadiusAssessment.affectedServices).toContain('database');
      expect(request.blastRadiusAssessment.affectedServices).toContain('api');
      expect(request.blastRadiusAssessment.riskLevel).toBe('high'); // Adjusted risk calculation now returns high instead of critical
      expect(request.blastRadiusAssessment.reversible).toBe(true);
      
      // Test enhanced blast radius assessment fields
      expect(request.blastRadiusAssessment.dependencyAnalysis).toBeDefined();
      expect(request.blastRadiusAssessment.dependencyAnalysis.directDependencies).toBeDefined();
      expect(request.blastRadiusAssessment.dependencyAnalysis.cascadeRisk).toBeDefined();
      expect(request.blastRadiusAssessment.dependencyAnalysis.criticalPath).toBe(true); // Database and API are critical path
      expect(request.blastRadiusAssessment.dependencyAnalysis.totalPotentialImpact).toBeGreaterThan(0);
      
      expect(request.blastRadiusAssessment.riskFactors).toBeDefined();
      expect(request.blastRadiusAssessment.riskFactors.confidenceLevel).toBe(0.6);
      expect(request.blastRadiusAssessment.riskFactors.serviceCount).toBe(3); // Enhanced detection finds more services
      expect(request.blastRadiusAssessment.riskFactors.actionType).toBe('disruptive');
      expect(request.blastRadiusAssessment.riskFactors.criticalServicesAffected).toContain('database');
      expect(request.blastRadiusAssessment.riskFactors.criticalServicesAffected).toContain('api');
    });

    it('should detect comprehensive policy conflicts', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const contextData = {
        incidentSummary: 'Production deployment issue with security implications',
        agentFindings: ['Deployment failed', 'Security vulnerability detected'],
        correlationSummary: 'Deployment and security analysis',
        confidenceLevel: 0.8
      };

      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Deploy to production environment with security changes',
        contextData
      );

      expect(request.policyConflicts).toContain('Production deployment requires change management approval');
      expect(request.policyConflicts).toContain('Security changes require security team approval');
    });

    it('should detect database and critical service conflicts', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const contextData = {
        incidentSummary: 'Database performance issues affecting payment service',
        agentFindings: ['Database slow queries', 'Payment processing delays'],
        correlationSummary: 'Database and payment correlation',
        confidenceLevel: 0.7
      };

      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Modify database configuration and restart payment service',
        contextData
      );

      expect(request.policyConflicts).toContain('Database modifications require DBA review');
      expect(request.policyConflicts).toContain('Critical service changes (payment, database) require senior approval');
    });

    it('should detect business hours and compliance conflicts', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      // Mock current time to be during business hours (10 AM on a Tuesday)
      const mockDate = new Date('2024-01-09T10:00:00Z'); // Tuesday 10 AM
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const contextData = {
        incidentSummary: 'PCI compliance system restart required',
        agentFindings: ['Compliance audit findings', 'System restart needed'],
        correlationSummary: 'Compliance and system analysis',
        confidenceLevel: 0.5 // Lower confidence to trigger the policy conflict
      };

      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Restart and disable compliance monitoring service', // Action that triggers both conflicts
        contextData
      );

      expect(request.policyConflicts).toContain('Service restarts during business hours require additional approval');
      expect(request.policyConflicts).toContain('Actions affecting compliance-regulated systems require compliance review');
      expect(request.policyConflicts).toContain('Low confidence actions require emergency response team consultation');

      // Restore Date
      vi.restoreAllMocks();
    });
  });

  describe('getApprovalInterface', () => {
    let requestId: string;

    beforeEach(async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Test action',
        {
          incidentSummary: 'Test incident',
          agentFindings: [],
          correlationSummary: 'Test',
          confidenceLevel: 0.8
        }
      );
      requestId = request.requestId;
    });

    it('should return approval interface for pending request', () => {
      const approvalInterface = governanceGate.getApprovalInterface(requestId);

      expect(approvalInterface).toBeDefined();
      expect(approvalInterface!.requestId).toBe(requestId);
      expect(approvalInterface!.workflowId).toBe(workflowId);
      expect(approvalInterface!.approvalOptions.approve).toBeDefined();
      expect(approvalInterface!.approvalOptions.approveWithRestrictions).toBeDefined();
      expect(approvalInterface!.approvalOptions.block).toBeDefined();
      expect(approvalInterface!.requiredFields.rationale.required).toBe(true);
    });

    it('should return null for non-existent request', () => {
      const approvalInterface = governanceGate.getApprovalInterface('non-existent');
      expect(approvalInterface).toBeNull();
    });

    it('should disable approve option for critical risk', async () => {
      // Create request with critical risk
      const criticalRequest = await governanceGate.createGovernanceRequest(
        workflowId,
        'Delete production database',
        {
          incidentSummary: 'Critical database issue',
          agentFindings: ['Multiple service failures'],
          correlationSummary: 'Critical impact',
          confidenceLevel: 0.3 // Very low confidence = critical risk
        }
      );

      const approvalInterface = governanceGate.getApprovalInterface(criticalRequest.requestId);

      expect(approvalInterface!.approvalOptions.approve.available).toBe(false);
      expect(approvalInterface!.approvalOptions.approveWithRestrictions.available).toBe(true);
      expect(approvalInterface!.approvalOptions.block.available).toBe(true);
    });
  });

  describe('processGovernanceDecision', () => {
    let requestId: string;

    beforeEach(async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Test action',
        {
          incidentSummary: 'Test incident',
          agentFindings: [],
          correlationSummary: 'Test',
          confidenceLevel: 0.8
        }
      );
      requestId = request.requestId;
    });

    it('should process approve decision successfully', async () => {
      const result = await governanceGate.processGovernanceDecision(
        requestId,
        'approve',
        'Action is safe and necessary',
        { id: 'user123', role: 'incident-commander' }
      );

      expect(result.success).toBe(true);
      expect(result.governanceDecision).toBeDefined();
      expect(result.governanceDecision!.decision).toBe('approve');
      expect(result.workflowTerminated).toBe(false);

      // Verify workflow transitioned to ACTION_PROPOSED
      const workflow = stateManager.getWorkflow(workflowId);
      expect(workflow!.currentState).toBe(WorkflowState.ACTION_PROPOSED);
      expect(workflow!.governanceDecision).toBeDefined();
    });

    it('should process approve_with_restrictions decision successfully', async () => {
      const result = await governanceGate.processGovernanceDecision(
        requestId,
        'approve_with_restrictions',
        'Approve with monitoring restrictions',
        { id: 'user123', role: 'incident-commander' },
        ['Monitor for 30 minutes', 'Have rollback ready']
      );

      expect(result.success).toBe(true);
      expect(result.governanceDecision!.decision).toBe('approve_with_restrictions');
      expect(result.governanceDecision!.restrictions).toEqual(['Monitor for 30 minutes', 'Have rollback ready']);
      expect(result.workflowTerminated).toBe(false);

      // Verify workflow transitioned to ACTION_PROPOSED
      const workflow = stateManager.getWorkflow(workflowId);
      expect(workflow!.currentState).toBe(WorkflowState.ACTION_PROPOSED);
    });

    it('should process block decision and terminate workflow', async () => {
      const result = await governanceGate.processGovernanceDecision(
        requestId,
        'block',
        'Action is too risky for current conditions',
        { id: 'user123', role: 'incident-commander' }
      );

      expect(result.success).toBe(true);
      expect(result.governanceDecision!.decision).toBe('block');
      expect(result.workflowTerminated).toBe(true);

      // Verify workflow was terminated
      const workflow = stateManager.getWorkflow(workflowId);
      expect(workflow!.currentState).toBe(WorkflowState.TERMINATED);
    });

    it('should validate governance decision input', async () => {
      // Test missing rationale
      const result1 = await governanceGate.processGovernanceDecision(
        requestId,
        'approve',
        '', // Empty rationale
        { id: 'user123', role: 'incident-commander' }
      );

      expect(result1.success).toBe(false);
      expect(result1.validationErrors).toContain('Rationale is required');

      // Test invalid decision type
      const result2 = await governanceGate.processGovernanceDecision(
        requestId,
        'invalid' as any,
        'Valid rationale here',
        { id: 'user123', role: 'incident-commander' }
      );

      expect(result2.success).toBe(false);
      expect(result2.validationErrors![0]).toContain('Invalid decision type');

      // Test missing restrictions for approve_with_restrictions
      const result3 = await governanceGate.processGovernanceDecision(
        requestId,
        'approve_with_restrictions',
        'Valid rationale here',
        { id: 'user123', role: 'incident-commander' }
        // No restrictions provided
      );

      expect(result3.success).toBe(false);
      expect(result3.validationErrors).toContain('Restrictions are required when approving with restrictions');
    });

    it('should prevent duplicate decision processing', async () => {
      // Process first decision
      await governanceGate.processGovernanceDecision(
        requestId,
        'approve',
        'First decision',
        { id: 'user123', role: 'incident-commander' }
      );

      // Attempt second decision - should fail because request is no longer pending
      const result = await governanceGate.processGovernanceDecision(
        requestId,
        'block',
        'Second decision attempt',
        { id: 'user456', role: 'security-lead' }
      );

      expect(result.success).toBe(false);
      expect(result.validationErrors).toContain('Governance request not found');
    });
  });

  describe('governance gate enforcement', () => {
    it('should block workflow progression without governance decision', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      // Attempt to transition to ACTION_PROPOSED without governance decision
      await expect(
        stateManager.transitionTo(workflowId, WorkflowState.ACTION_PROPOSED)
      ).rejects.toThrow('Cannot transition from GOVERNANCE_PENDING to ACTION_PROPOSED without governance decision');
    });

    it('should block workflow progression with block decision', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      // Create and process block decision
      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Test action',
        {
          incidentSummary: 'Test',
          agentFindings: [],
          correlationSummary: 'Test',
          confidenceLevel: 0.8
        }
      );

      await governanceGate.processGovernanceDecision(
        request.requestId,
        'block',
        'Action blocked for safety',
        { id: 'user123', role: 'incident-commander' }
      );

      // Workflow should be terminated, not in ACTION_PROPOSED
      const workflow = stateManager.getWorkflow(workflowId);
      expect(workflow!.currentState).toBe(WorkflowState.TERMINATED);
    });

    it('should allow workflow progression with approve decision', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      // Create and process approve decision
      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Test action',
        {
          incidentSummary: 'Test',
          agentFindings: [],
          correlationSummary: 'Test',
          confidenceLevel: 0.8
        }
      );

      await governanceGate.processGovernanceDecision(
        request.requestId,
        'approve',
        'Action approved as safe',
        { id: 'user123', role: 'incident-commander' }
      );

      // Workflow should be in ACTION_PROPOSED
      const workflow = stateManager.getWorkflow(workflowId);
      expect(workflow!.currentState).toBe(WorkflowState.ACTION_PROPOSED);
    });
  });

  describe('enhanced governance information completeness', () => {
    it('should calculate comprehensive risk levels with multiple factors', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      // Test critical risk scenario
      const criticalContextData = {
        incidentSummary: 'Database, API, and payment service failure',
        agentFindings: ['Database corruption detected', 'API gateway down', 'Payment processing stopped'],
        correlationSummary: 'Multiple critical service failure',
        confidenceLevel: 0.3 // Very low confidence
      };

      const criticalRequest = await governanceGate.createGovernanceRequest(
        workflowId,
        'Delete corrupted database tables and restart all services',
        criticalContextData
      );

      expect(criticalRequest.blastRadiusAssessment.riskLevel).toBe('critical');
      expect(criticalRequest.blastRadiusAssessment.dependencyAnalysis.criticalPath).toBe(true);
      expect(criticalRequest.blastRadiusAssessment.dependencyAnalysis.cascadeRisk).toBe('high');
      expect(criticalRequest.blastRadiusAssessment.riskFactors.criticalServicesAffected).toContain('database');
      expect(criticalRequest.blastRadiusAssessment.riskFactors.criticalServicesAffected).toContain('api');
      expect(criticalRequest.blastRadiusAssessment.riskFactors.criticalServicesAffected).toContain('payment');
      expect(criticalRequest.blastRadiusAssessment.riskFactors.actionType).toBe('destructive');
    });

    it('should analyze service dependency chains accurately', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const contextData = {
        incidentSummary: 'Frontend application performance issues',
        agentFindings: ['Frontend slow loading', 'User complaints about UI'],
        correlationSummary: 'Frontend performance analysis',
        confidenceLevel: 0.8
      };

      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Update frontend configuration',
        contextData
      );

      // Frontend depends on API, auth, CDN, load-balancer
      expect(request.blastRadiusAssessment.dependencyAnalysis.directDependencies).toContain('api');
      expect(request.blastRadiusAssessment.dependencyAnalysis.directDependencies).toContain('auth');
      expect(request.blastRadiusAssessment.dependencyAnalysis.totalPotentialImpact).toBeGreaterThan(1);
      expect(request.blastRadiusAssessment.riskFactors.actionType).toBe('change');
    });

    it('should assess action reversibility correctly', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const contextData = {
        incidentSummary: 'Data cleanup required',
        agentFindings: ['Corrupted data detected'],
        correlationSummary: 'Data analysis',
        confidenceLevel: 0.9
      };

      // Test irreversible action
      const irreversibleRequest = await governanceGate.createGovernanceRequest(
        workflowId,
        'Delete corrupted user data permanently',
        contextData
      );

      expect(irreversibleRequest.blastRadiusAssessment.reversible).toBe(false);

      // Test reversible action
      const reversibleRequest = await governanceGate.createGovernanceRequest(
        workflowId,
        'Restart data processing service',
        contextData
      );

      expect(reversibleRequest.blastRadiusAssessment.reversible).toBe(true);
    });

    it('should generate detailed impact descriptions', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const contextData = {
        incidentSummary: 'Database and API service coordination issue',
        agentFindings: ['Database locks detected', 'API timeout errors'],
        correlationSummary: 'Database-API coordination failure',
        confidenceLevel: 0.7
      };

      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Restart database and API services',
        contextData
      );

      expect(request.blastRadiusAssessment.impactDescription).toContain('primary service(s)');
      expect(request.blastRadiusAssessment.impactDescription).toContain('database, api');
      expect(request.blastRadiusAssessment.impactDescription).toContain('cascade impact');
      expect(request.blastRadiusAssessment.impactDescription).toContain('critical path');
      expect(request.blastRadiusAssessment.impactDescription).toContain('Total potential impact');
    });

    it('should categorize action types correctly', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const contextData = {
        incidentSummary: 'Service scaling needed',
        agentFindings: ['High load detected'],
        correlationSummary: 'Load analysis',
        confidenceLevel: 0.8
      };

      // Test different action types
      const scalingRequest = await governanceGate.createGovernanceRequest(
        workflowId,
        'Scale up API service instances',
        contextData
      );
      expect(scalingRequest.blastRadiusAssessment.riskFactors.actionType).toBe('scaling');

      const recoveryRequest = await governanceGate.createGovernanceRequest(
        workflowId,
        'Rollback to previous deployment',
        contextData
      );
      expect(recoveryRequest.blastRadiusAssessment.riskFactors.actionType).toBe('recovery');

      const maintenanceRequest = await governanceGate.createGovernanceRequest(
        workflowId,
        'Clear cache and optimize performance',
        contextData
      );
      expect(maintenanceRequest.blastRadiusAssessment.riskFactors.actionType).toBe('maintenance');
    });

    it('should detect business hours impact correctly', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const contextData = {
        incidentSummary: 'API service restart needed',
        agentFindings: ['API performance degraded'],
        correlationSummary: 'API analysis',
        confidenceLevel: 0.8
      };

      // Test during current time (business hours impact will depend on when test runs)
      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Restart API service',
        contextData
      );

      // Business hours impact should be a boolean
      expect(typeof request.blastRadiusAssessment.riskFactors.businessHoursImpact).toBe('boolean');
      
      // The actual value depends on when the test runs, but the field should exist
      expect(request.blastRadiusAssessment.riskFactors).toHaveProperty('businessHoursImpact');
    });
  });

  describe('governance statistics and monitoring', () => {
    it('should track governance statistics', async () => {
      // Create first workflow and request
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const request1 = await governanceGate.createGovernanceRequest(
        workflowId,
        'Action 1',
        {
          incidentSummary: 'Test 1',
          agentFindings: [],
          correlationSummary: 'Test',
          confidenceLevel: 0.8
        }
      );

      // Create second workflow for another request
      const workflow2 = await stateManager.createWorkflow();
      await stateManager.transitionTo(workflow2.workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflow2.workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflow2.workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflow2.workflowId, WorkflowState.GOVERNANCE_PENDING);

      const request2 = await governanceGate.createGovernanceRequest(
        workflow2.workflowId,
        'Action 2',
        {
          incidentSummary: 'Test 2',
          agentFindings: [],
          correlationSummary: 'Test',
          confidenceLevel: 0.8
        }
      );

      // Check initial stats - should have 2 pending
      let stats = governanceGate.getGovernanceStats();
      expect(stats.pendingRequests).toBe(2);
      expect(stats.completedRequests).toBe(0);

      // Process first decision
      const result1 = await governanceGate.processGovernanceDecision(
        request1.requestId,
        'approve',
        'Approved decision',
        { id: 'user123', role: 'commander' }
      );
      expect(result1.success).toBe(true);

      // Check intermediate stats
      stats = governanceGate.getGovernanceStats();
      expect(stats.pendingRequests).toBe(1);
      expect(stats.completedRequests).toBe(1);

      // Process second decision
      const result2 = await governanceGate.processGovernanceDecision(
        request2.requestId,
        'block',
        'Blocked decision',
        { id: 'user123', role: 'commander' }
      );
      expect(result2.success).toBe(true);

      // Check final stats
      stats = governanceGate.getGovernanceStats();
      expect(stats.pendingRequests).toBe(0);
      expect(stats.completedRequests).toBe(2);
      expect(stats.approvalRate).toBe(0.5); // 1 approved out of 2
      expect(stats.blockRate).toBe(0.5); // 1 blocked out of 2
      expect(stats.averageDecisionTime).toBeGreaterThanOrEqual(0); // Allow 0 for fast tests
    });

    it('should check for pending governance requests', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(false);

      await governanceGate.createGovernanceRequest(
        workflowId,
        'Test action',
        {
          incidentSummary: 'Test',
          agentFindings: [],
          correlationSummary: 'Test',
          confidenceLevel: 0.8
        }
      );

      expect(governanceGate.hasPendingGovernanceRequest(workflowId)).toBe(true);
    });
  });

  describe('event emission', () => {
    it('should emit governanceRequired event when request is created', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      let eventEmitted = false;
      governanceGate.on('governanceRequired', (event) => {
        expect(event.type).toBe('governance_required');
        expect(event.workflowId).toBe(workflowId);
        expect(event.payload).toBeDefined();
        eventEmitted = true;
      });

      await governanceGate.createGovernanceRequest(
        workflowId,
        'Test action',
        {
          incidentSummary: 'Test',
          agentFindings: [],
          correlationSummary: 'Test',
          confidenceLevel: 0.8
        }
      );

      expect(eventEmitted).toBe(true);
    });

    it('should emit governanceDecision event when decision is processed', async () => {
      await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
      await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
      await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
      await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);

      const request = await governanceGate.createGovernanceRequest(
        workflowId,
        'Test action',
        {
          incidentSummary: 'Test',
          agentFindings: [],
          correlationSummary: 'Test',
          confidenceLevel: 0.8
        }
      );

      let eventEmitted = false;
      governanceGate.on('governanceDecision', (event) => {
        expect(event.type).toBe('governance_decision');
        expect(event.workflowId).toBe(workflowId);
        expect(event.payload.decision).toBeDefined();
        expect(event.payload.requestId).toBe(request.requestId);
        eventEmitted = true;
      });

      await governanceGate.processGovernanceDecision(
        request.requestId,
        'approve',
        'Test approval',
        { id: 'user123', role: 'commander' }
      );

      expect(eventEmitted).toBe(true);
    });
  });
});