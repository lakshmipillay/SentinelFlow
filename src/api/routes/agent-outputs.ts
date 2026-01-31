/**
 * SentinelFlow Agent Output API Routes
 * REST endpoints with enhanced security and validation for agent output management
 */

import { Router, Request, Response } from 'express';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { AgentOutput } from '../../types/workflow';
import {
  createSuccessResponse,
  createErrorResponse,
  validateWorkflowId,
  validateRequest,
  createValidationMiddleware
} from '../middleware';
import { AgentOutputSchemas } from '../validation/schemas';
import {
  GetAgentOutputsResponse,
  GetAgentOutputsByAgentResponse,
  ApiErrorCode
} from '../types';

export function createAgentOutputRoutes(stateManager: WorkflowStateManager): Router {
  const router = Router();

  /**
   * GET /api/workflows/:workflowId/agent-outputs
   * Get all agent outputs for workflow
   */
  router.get('/:workflowId/agent-outputs', validateWorkflowId, async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      const { agentName } = req.query;
      
      const workflow = stateManager.getWorkflow(workflowId);
      if (!workflow) {
        res.status(404).json(createErrorResponse(
          ApiErrorCode.WORKFLOW_NOT_FOUND,
          `Workflow ${workflowId} not found`
        ));
        return;
      }

      const outputs = stateManager.getAgentOutputs(workflowId, agentName as string);
      
      const response: GetAgentOutputsResponse = {
        workflowId,
        agentOutputs: outputs,
        totalOutputs: outputs.length,
        ...(agentName && { agentName: agentName as string })
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error getting agent outputs:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve agent outputs',
        error
      ));
    }
  });

  /**
   * GET /api/workflows/:workflowId/agent-outputs/:agentName
   * Get outputs from specific agent
   */
  router.get('/:workflowId/agent-outputs/:agentName', validateWorkflowId, async (req: Request, res: Response) => {
    try {
      const { workflowId, agentName } = req.params;
      
      const workflow = stateManager.getWorkflow(workflowId);
      if (!workflow) {
        res.status(404).json(createErrorResponse(
          ApiErrorCode.WORKFLOW_NOT_FOUND,
          `Workflow ${workflowId} not found`
        ));
        return;
      }

      const outputs = stateManager.getAgentOutputs(workflowId, agentName);
      
      const response: GetAgentOutputsByAgentResponse = {
        workflowId,
        agentName,
        agentOutputs: outputs,
        totalOutputs: outputs.length
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error getting agent outputs by agent:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve agent outputs',
        error
      ));
    }
  });

  /**
   * POST /api/workflows/:workflowId/agent-outputs
   * Add agent output to workflow
   */
  router.post('/:workflowId/agent-outputs',
    validateWorkflowId,
    validateRequest({ body: true }),
    async (req: Request, res: Response) => {
      try {
        const { workflowId } = req.params;
        const { agentOutput }: { agentOutput: AgentOutput } = req.body;
        
        if (!agentOutput) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            'Agent output is required'
          ));
          return;
        }

        const workflow = stateManager.getWorkflow(workflowId);
        if (!workflow) {
          res.status(404).json(createErrorResponse(
            ApiErrorCode.WORKFLOW_NOT_FOUND,
            `Workflow ${workflowId} not found`
          ));
          return;
        }

        const result = await stateManager.addAgentOutput(workflowId, agentOutput);
        const updatedWorkflow = stateManager.getWorkflow(workflowId);
        
        res.status(201).json(createSuccessResponse({
          success: result,
          workflow: updatedWorkflow,
          agentOutput,
          message: 'Agent output added successfully'
        }));
      } catch (error) {
        console.error('Error adding agent output:', error);
        
        if (error instanceof Error && error.message.includes('Invalid agent output')) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.AGENT_OUTPUT_VALIDATION_FAILED,
            error.message
          ));
        } else {
          res.status(500).json(createErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to add agent output',
            error
          ));
        }
      }
    }
  );

  /**
   * GET /api/workflows/:workflowId/analysis-summary
   * Get analysis summary for workflow
   */
  router.get('/:workflowId/analysis-summary', validateWorkflowId, async (req: Request, res: Response) => {
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

      const summary = stateManager.getAnalysisSummary(workflowId);
      const isComplete = stateManager.isAnalysisComplete(workflowId);
      const canTransitionToRCA = stateManager.canTransitionToRCAComplete(workflowId);
      
      res.json(createSuccessResponse({
        workflowId,
        summary,
        analysisComplete: isComplete,
        readyForRCA: canTransitionToRCA
      }));
    } catch (error) {
      console.error('Error getting analysis summary:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve analysis summary',
        error
      ));
    }
  });

  /**
   * GET /api/workflows/:workflowId/correlate-outputs
   * Get agent output correlation
   */
  router.get('/:workflowId/correlate-outputs', validateWorkflowId, async (req: Request, res: Response) => {
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

      const correlation = stateManager.correlateAgentOutputs(workflowId);
      
      res.json(createSuccessResponse({
        workflowId,
        correlation
      }));
    } catch (error) {
      console.error('Error correlating agent outputs:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to correlate agent outputs',
        error
      ));
    }
  });

  /**
   * GET /api/workflows/:workflowId/parallel-analysis-status
   * Check parallel analysis status
   */
  router.get('/:workflowId/parallel-analysis-status', validateWorkflowId, async (req: Request, res: Response) => {
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

      const status = stateManager.isParallelAnalysisComplete(workflowId);
      
      res.json(createSuccessResponse({
        workflowId,
        ...status
      }));
    } catch (error) {
      console.error('Error checking parallel analysis status:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to check analysis status',
        error
      ));
    }
  });

  return router;
}