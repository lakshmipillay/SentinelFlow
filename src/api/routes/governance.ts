/**
 * SentinelFlow Governance API Routes
 * REST endpoints with enhanced security and validation for governance decisions
 */

import { Router, Request, Response } from 'express';
import { GovernanceGateService } from '../../services/GovernanceGateService';
import {
  createSuccessResponse,
  createErrorResponse,
  validateWorkflowId,
  validateRequestId,
  validateRequest,
  validateGovernanceDecision,
  createValidationMiddleware
} from '../middleware';
import { GovernanceSchemas } from '../validation/schemas';
import {
  SubmitGovernanceDecisionRequest,
  SubmitGovernanceDecisionResponse,
  GetGovernanceStatusResponse,
  ApiErrorCode
} from '../types';

export function createGovernanceRoutes(governanceGate: GovernanceGateService): Router {
  const router = Router();

  /**
   * POST /api/workflows/:workflowId/governance-decision
   * Submit governance decision for workflow
   */
  router.post('/:workflowId/governance-decision',
    validateWorkflowId,
    validateRequest({ body: true }),
    validateGovernanceDecision,
    async (req: Request, res: Response) => {
      try {
        const { workflowId } = req.params;
        const { decision, rationale, approver, restrictions }: SubmitGovernanceDecisionRequest = req.body;
        
        // Get the governance request for this workflow
        const request = governanceGate.getRequestByWorkflow(workflowId);
        if (!request) {
          res.status(404).json(createErrorResponse(
            ApiErrorCode.GOVERNANCE_REQUEST_NOT_FOUND,
            `No governance request found for workflow ${workflowId}`
          ));
          return;
        }

        const result = await governanceGate.processGovernanceDecision(
          request.requestId,
          decision,
          rationale,
          approver,
          restrictions
        );
        
        if (!result.success) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.INVALID_GOVERNANCE_DECISION,
            'Governance decision validation failed',
            result.validationErrors
          ));
          return;
        }
        
        const response: SubmitGovernanceDecisionResponse = {
          success: true,
          governanceDecision: result.governanceDecision!,
          workflowTerminated: result.workflowTerminated || false,
          message: `Governance decision processed: ${decision}`
        };

        res.json(createSuccessResponse(response));
      } catch (error) {
        console.error('Error processing governance decision:', error);
        res.status(500).json(createErrorResponse(
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to process governance decision',
          error
        ));
      }
    }
  );

  /**
   * GET /api/workflows/:workflowId/governance-decision
   * Get governance decision for workflow
   */
  router.get('/:workflowId/governance-decision', validateWorkflowId, async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      
      const request = governanceGate.getRequestByWorkflow(workflowId);
      if (!request) {
        res.status(404).json(createErrorResponse(
          ApiErrorCode.GOVERNANCE_REQUEST_NOT_FOUND,
          `No governance request found for workflow ${workflowId}`
        ));
        return;
      }

      res.json(createSuccessResponse({
        workflowId,
        governanceRequest: request,
        hasDecision: !!request.decision,
        decision: request.decision
      }));
    } catch (error) {
      console.error('Error getting governance decision:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve governance decision',
        error
      ));
    }
  });

  /**
   * GET /api/workflows/:workflowId/governance-status
   * Check if governance decision is required
   */
  router.get('/:workflowId/governance-status', validateWorkflowId, async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      
      const hasPending = governanceGate.hasPendingGovernanceRequest(workflowId);
      const request = governanceGate.getRequestByWorkflow(workflowId);
      
      const response: GetGovernanceStatusResponse = {
        workflowId,
        hasGovernanceDecision: !!request?.decision,
        governanceRequired: hasPending,
        ...(request?.decision && { governanceDecision: request.decision })
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error checking governance status:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to check governance status',
        error
      ));
    }
  });

  /**
   * GET /api/governance/requests/pending
   * Get all pending governance requests
   * NOTE: This route MUST be defined before /requests/:requestId to avoid matching "pending" as a requestId
   */
  router.get('/requests/pending', async (req: Request, res: Response) => {
    try {
      const pendingRequests = governanceGate.getPendingRequests();
      
      res.json(createSuccessResponse({
        totalPending: pendingRequests.length,
        requests: pendingRequests
      }));
    } catch (error) {
      console.error('Error getting pending governance requests:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve pending requests',
        error
      ));
    }
  });

  /**
   * GET /api/governance/requests/:requestId
   * Get governance request details
   */
  router.get('/requests/:requestId', validateRequestId, async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      
      const request = governanceGate.getRequest(requestId);
      if (!request) {
        res.status(404).json(createErrorResponse(
          ApiErrorCode.GOVERNANCE_REQUEST_NOT_FOUND,
          `Governance request ${requestId} not found`
        ));
        return;
      }
      
      res.json(createSuccessResponse(request));
    } catch (error) {
      console.error('Error getting governance request:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve governance request',
        error
      ));
    }
  });

  /**
   * GET /api/governance/requests/:requestId/approval-interface
   * Get governance approval interface
   */
  router.get('/requests/:requestId/approval-interface', validateRequestId, async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      
      const approvalInterface = governanceGate.getApprovalInterface(requestId);
      if (!approvalInterface) {
        res.status(404).json(createErrorResponse(
          ApiErrorCode.GOVERNANCE_REQUEST_NOT_FOUND,
          `Governance request ${requestId} not found or not pending`
        ));
        return;
      }
      
      res.json(createSuccessResponse(approvalInterface));
    } catch (error) {
      console.error('Error getting approval interface:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve approval interface',
        error
      ));
    }
  });

  /**
   * POST /api/governance/requests/:requestId/decision
   * Submit governance decision by request ID
   */
  router.post('/requests/:requestId/decision',
    validateRequestId,
    validateRequest({ body: true }),
    validateGovernanceDecision,
    async (req: Request, res: Response) => {
      try {
        const { requestId } = req.params;
        const { decision, rationale, approver, restrictions }: SubmitGovernanceDecisionRequest = req.body;
        
        const result = await governanceGate.processGovernanceDecision(
          requestId,
          decision,
          rationale,
          approver,
          restrictions
        );
        
        if (!result.success) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.INVALID_GOVERNANCE_DECISION,
            'Governance decision validation failed',
            result.validationErrors
          ));
          return;
        }
        
        const response: SubmitGovernanceDecisionResponse = {
          success: true,
          governanceDecision: result.governanceDecision!,
          workflowTerminated: result.workflowTerminated || false,
          message: `Governance decision processed: ${decision}`
        };

        res.json(createSuccessResponse(response));
      } catch (error) {
        console.error('Error processing governance decision:', error);
        res.status(500).json(createErrorResponse(
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to process governance decision',
          error
        ));
      }
    }
  );

  /**
   * GET /api/governance/stats
   * Get governance statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = governanceGate.getGovernanceStats();
      
      res.json(createSuccessResponse(stats));
    } catch (error) {
      console.error('Error getting governance statistics:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve governance statistics',
        error
      ));
    }
  });

  return router;
}