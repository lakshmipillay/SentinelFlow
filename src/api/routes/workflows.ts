/**
 * SentinelFlow Workflow API Routes
 * REST endpoints with enhanced security and validation
 */

import { Router, Request, Response } from 'express';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { WorkflowState } from '../../types/workflow';
import {
  createSuccessResponse,
  createErrorResponse,
  validateWorkflowId,
  validateRequest,
  createValidationMiddleware
} from '../middleware';
import { WorkflowSchemas } from '../validation/schemas';
import {
  CreateWorkflowResponse,
  GetWorkflowResponse,
  GetWorkflowsResponse,
  UpdateWorkflowStateRequest,
  UpdateWorkflowStateResponse,
  ApiErrorCode
} from '../types';

export function createWorkflowRoutes(stateManager: WorkflowStateManager): Router {
  const router = Router();

  /**
   * GET /api/workflows
   * List all workflows
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const workflows = stateManager.getAllWorkflows();
      
      const response: GetWorkflowsResponse = {
        workflows,
        totalCount: workflows.length
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error getting workflows:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve workflows',
        error
      ));
    }
  });

  /**
   * POST /api/workflows
   * Create new workflow with enhanced validation
   */
  router.post('/', 
    createValidationMiddleware(WorkflowSchemas.createWorkflow),
    async (req: Request, res: Response) => {
      try {
        const workflow = await stateManager.createWorkflow();
        
        const response: CreateWorkflowResponse = {
          workflowId: workflow.workflowId,
          currentState: workflow.currentState,
          timestamp: workflow.timestamp,
          createdAt: workflow.createdAt
        };

        res.status(201).json(createSuccessResponse(response));
      } catch (error) {
        console.error('Error creating workflow:', error);
        res.status(500).json(createErrorResponse(
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create workflow'
        ));
      }
    }
  );

  /**
   * GET /api/workflows/:workflowId
   * Get specific workflow details
   */
  router.get('/:workflowId', validateWorkflowId, async (req: Request, res: Response) => {
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
      
      const response: GetWorkflowResponse = {
        workflow
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error getting workflow:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve workflow',
        error
      ));
    }
  });

  /**
   * GET /api/workflows/:workflowId/state
   * Get current workflow state
   */
  router.get('/:workflowId/state', validateWorkflowId, async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      const currentState = stateManager.getCurrentState(workflowId);
      
      if (!currentState) {
        res.status(404).json(createErrorResponse(
          ApiErrorCode.WORKFLOW_NOT_FOUND,
          `Workflow ${workflowId} not found`
        ));
        return;
      }

      res.json(createSuccessResponse({
        workflowId,
        currentState,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error getting workflow state:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve workflow state',
        error
      ));
    }
  });

  /**
   * PUT /api/workflows/:workflowId/state
   * Transition workflow state with enhanced validation
   */
  router.put('/:workflowId/state', 
    createValidationMiddleware(WorkflowSchemas.updateWorkflowState),
    async (req: Request, res: Response) => {
      try {
        const { workflowId } = req.params;
        const { newState, reason }: UpdateWorkflowStateRequest = req.body;
        
        const workflow = stateManager.getWorkflow(workflowId);
        if (!workflow) {
          res.status(404).json(createErrorResponse(
            ApiErrorCode.WORKFLOW_NOT_FOUND,
            `Workflow ${workflowId} not found`
          ));
          return;
        }

        const previousState = workflow.currentState;
        const result = await stateManager.transitionTo(workflowId, newState);
        const updatedWorkflow = stateManager.getWorkflow(workflowId);
        
        const response: UpdateWorkflowStateResponse = {
          success: result,
          workflow: updatedWorkflow!,
          previousState
        };

        res.json(createSuccessResponse(response));
      } catch (error) {
        console.error('Error transitioning workflow state:', error);
        
        if (error instanceof Error && error.message.includes('Invalid state transition')) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.INVALID_STATE_TRANSITION,
            'Invalid workflow state transition requested'
          ));
        } else {
          res.status(500).json(createErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to transition workflow state'
          ));
        }
      }
    }
  );

  /**
   * POST /api/workflows/:workflowId/terminate
   * Terminate workflow with enhanced validation
   */
  router.post('/:workflowId/terminate',
    createValidationMiddleware(WorkflowSchemas.terminateWorkflow),
    async (req: Request, res: Response) => {
      try {
        const { workflowId } = req.params;
        const { reason } = req.body;

        const workflow = stateManager.getWorkflow(workflowId);
        if (!workflow) {
          res.status(404).json(createErrorResponse(
            ApiErrorCode.WORKFLOW_NOT_FOUND,
            `Workflow ${workflowId} not found`
          ));
          return;
        }

        await stateManager.terminateWorkflow(workflowId, reason);
        const updatedWorkflow = stateManager.getWorkflow(workflowId);
        
        res.json(createSuccessResponse({
          success: true,
          workflow: updatedWorkflow,
          message: 'Workflow terminated successfully'
        }));
      } catch (error) {
        console.error('Error terminating workflow:', error);
        res.status(500).json(createErrorResponse(
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to terminate workflow'
        ));
      }
    }
  );

  return router;
}