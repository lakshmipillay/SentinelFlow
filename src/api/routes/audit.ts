/**
 * SentinelFlow Audit API Routes
 * REST endpoints for audit trail access and artifact export
 */

import { Router, Request, Response } from 'express';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import {
  createSuccessResponse,
  createErrorResponse,
  validateWorkflowId
} from '../middleware';
import {
  GetAuditTrailResponse,
  GetAuditChainResponse,
  GetAuditMetricsResponse,
  ExportAuditRequest,
  ExportAuditResponse,
  ApiErrorCode
} from '../types';

export function createAuditRoutes(stateManager: WorkflowStateManager): Router {
  const router = Router();

  /**
   * GET /api/workflows/:workflowId/audit-trail
   * Get complete audit trail for workflow
   */
  router.get('/:workflowId/audit-trail', validateWorkflowId, async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      
      const workflow = stateManager.getWorkflow(workflowId);
      if (!workflow) {
        res.status(404).json(createErrorResponse(
          ApiErrorCode.WORKFLOW_NOT_FOUND,
          `Workflow ${workflowId} not found`
        ));
        return;
      }

      // Get basic audit trail from workflow
      const basicAuditTrail = workflow.auditTrail;
      
      // Get enhanced audit chain from audit service
      const enhancedAuditChain = stateManager.getAuditChain(workflowId);
      
      const response: GetAuditTrailResponse = {
        workflowId,
        auditTrail: [...enhancedAuditChain],
        totalEvents: enhancedAuditChain.length
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error getting audit trail:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.AUDIT_TRAIL_NOT_FOUND,
        'Failed to retrieve audit trail',
        error
      ));
    }
  });

  /**
   * GET /api/workflows/:workflowId/audit-chain
   * Get enhanced audit chain with integrity verification
   */
  router.get('/:workflowId/audit-chain', validateWorkflowId, async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      
      const workflow = stateManager.getWorkflow(workflowId);
      if (!workflow) {
        res.status(404).json(createErrorResponse(
          ApiErrorCode.WORKFLOW_NOT_FOUND,
          `Workflow ${workflowId} not found`
        ));
        return;
      }

      const auditChain = stateManager.getAuditChain(workflowId);
      const integrityCheck = stateManager.verifyAuditChainIntegrity(workflowId);
      
      const response: GetAuditChainResponse = {
        workflowId,
        auditChain: [...auditChain],
        chainIntegrity: {
          valid: integrityCheck.valid,
          totalEvents: integrityCheck.chainLength,
          verifiedEvents: integrityCheck.chainLength,
          integrityScore: integrityCheck.valid ? 1.0 : 0.0
        }
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error getting audit chain:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.AUDIT_TRAIL_NOT_FOUND,
        'Failed to retrieve audit chain',
        error
      ));
    }
  });

  /**
   * GET /api/workflows/:workflowId/audit-metrics
   * Get audit metrics for workflow
   */
  router.get('/:workflowId/audit-metrics', validateWorkflowId, async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      
      const workflow = stateManager.getWorkflow(workflowId);
      if (!workflow) {
        res.status(404).json(createErrorResponse(
          ApiErrorCode.WORKFLOW_NOT_FOUND,
          `Workflow ${workflowId} not found`
        ));
        return;
      }

      const metrics = stateManager.getAuditMetrics(workflowId);
      
      const response: GetAuditMetricsResponse = {
        workflowId,
        metrics: {
          totalEvents: metrics?.totalEvents || 0,
          eventsByType: {
            'state_transition': metrics?.stateTransitions || 0,
            'agent_output': metrics?.agentOutputs || 0,
            'governance_decision': metrics?.governanceDecisions || 0,
            'workflow_termination': metrics?.workflowTerminations || 0
          },
          eventsByActor: {
            'orchestrator': metrics?.stateTransitions || 0,
            'sre-agent': 0,
            'security-agent': 0,
            'governance-agent': 0,
            'human': metrics?.governanceDecisions || 0
          },
          averageProcessingTime: 0, // Not available in current metrics
          workflowDuration: 0, // Not available in current metrics
          auditCompleteness: 1.0 // Assume complete for MVP
        }
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error getting audit metrics:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.AUDIT_TRAIL_NOT_FOUND,
        'Failed to retrieve audit metrics',
        error
      ));
    }
  });

  /**
   * POST /api/workflows/:workflowId/export-audit
   * Export audit artifacts for compliance review
   */
  router.post('/:workflowId/export-audit', validateWorkflowId, async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      const { format = 'json', includeContext = true }: ExportAuditRequest = req.body;
      
      const workflow = stateManager.getWorkflow(workflowId);
      if (!workflow) {
        res.status(404).json(createErrorResponse(
          ApiErrorCode.WORKFLOW_NOT_FOUND,
          `Workflow ${workflowId} not found`
        ));
        return;
      }

      // Validate format
      const validFormats = ['json', 'csv', 'pdf'];
      if (!validFormats.includes(format)) {
        res.status(400).json(createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          `Invalid export format. Must be one of: ${validFormats.join(', ')}`
        ));
        return;
      }

      const exportResult = await stateManager.exportAuditArtifacts(workflowId);
      
      // Generate export ID and mock download URL for MVP
      const exportId = `export-${workflowId}-${Date.now()}`;
      const downloadUrl = `/api/downloads/${exportId}.${format}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      
      const response: ExportAuditResponse = {
        workflowId,
        exportId,
        format,
        downloadUrl,
        expiresAt
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error exporting audit artifacts:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.AUDIT_EXPORT_FAILED,
        'Failed to export audit artifacts',
        error
      ));
    }
  });

  /**
   * GET /api/workflows/:workflowId/audit-summary
   * Get audit summary with key insights
   */
  router.get('/:workflowId/audit-summary', validateWorkflowId, async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      
      const workflow = stateManager.getWorkflow(workflowId);
      if (!workflow) {
        res.status(404).json(createErrorResponse(
          ApiErrorCode.WORKFLOW_NOT_FOUND,
          `Workflow ${workflowId} not found`
        ));
        return;
      }

      const auditChain = stateManager.getAuditChain(workflowId);
      const metrics = stateManager.getAuditMetrics(workflowId);
      const integrityCheck = stateManager.verifyAuditChainIntegrity(workflowId);
      
      // Generate audit summary
      const summary = {
        workflowId,
        workflowState: workflow.currentState,
        auditOverview: {
          totalEvents: auditChain.length,
          integrityValid: integrityCheck.valid,
          completenessScore: 1.0, // Assume complete for MVP
          workflowDuration: 0 // Not available in current metrics
        },
        keyEvents: auditChain
          .filter(event => ['state_transition', 'governance_decision', 'workflow_termination'].includes(event.eventType))
          .map(event => ({
            eventType: event.eventType,
            timestamp: event.timestamp,
            actor: event.actor,
            summary: generateEventSummary(event)
          })),
        governanceDecisions: auditChain
          .filter(event => event.eventType === 'governance_decision')
          .map(event => ({
            decision: event.details.governanceDecision?.decision,
            rationale: event.details.governanceDecision?.rationale,
            timestamp: event.timestamp,
            approver: event.details.governanceDecision?.approver
          })),
        agentAnalysis: {
          totalOutputs: workflow.agentOutputs.length,
          agentBreakdown: workflow.agentOutputs.reduce((acc, output) => {
            acc[output.agentName] = (acc[output.agentName] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          averageConfidence: workflow.agentOutputs.length > 0 
            ? workflow.agentOutputs.reduce((sum, output) => sum + output.confidenceLevel, 0) / workflow.agentOutputs.length 
            : 0
        }
      };

      res.json(createSuccessResponse(summary));
    } catch (error) {
      console.error('Error getting audit summary:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.AUDIT_TRAIL_NOT_FOUND,
        'Failed to retrieve audit summary',
        error
      ));
    }
  });

  /**
   * Helper function to generate event summaries
   */
  function generateEventSummary(event: any): string {
    switch (event.eventType) {
      case 'state_transition':
        return `Transitioned from ${event.details.fromState} to ${event.details.toState}`;
      case 'governance_decision':
        return `Governance decision: ${event.details.governanceDecision?.decision}`;
      case 'workflow_termination':
        return `Workflow terminated: ${event.details.terminationReason}`;
      case 'agent_output':
        return `Agent ${event.actor} provided analysis output`;
      default:
        return `${event.eventType} event occurred`;
    }
  }

  return router;
}