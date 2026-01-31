/**
 * SentinelFlow Demo Mode API Routes
 * REST endpoints for demo mode operations with safety constraints
 * Implements Requirements 9.1, 9.3 - Demo mode API with isolation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DemoModeManager } from '../../demo/DemoModeManager';
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequest
} from '../middleware';
import { DemoSchemas } from '../validation/demo-schemas';
import { ApiErrorCode } from '../types';
import Joi from 'joi';

/**
 * Create Joi validation middleware for demo routes
 */
function createJoiValidationMiddleware(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json(createErrorResponse(
        ApiErrorCode.VALIDATION_ERROR,
        'Request validation failed',
        error.details.map(d => d.message)
      ));
      return;
    }
    req.body = value;
    next();
  };
}

export function createDemoRoutes(demoManager: DemoModeManager): Router {
  const router = Router();

  /**
   * GET /api/demo/status
   * Get current demo mode status and metrics
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const status = demoManager.getDemoStatus();
      
      res.json(createSuccessResponse({
        ...status,
        demoMode: true, // Always indicate demo mode in responses
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error getting demo status:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve demo status',
        error
      ));
    }
  });

  /**
   * POST /api/demo/activate
   * Activate demo mode with scenario configuration
   */
  router.post('/activate',
    createJoiValidationMiddleware(DemoSchemas.activateDemo),
    async (req: Request, res: Response) => {
      try {
        const { scenarioType, customScenario, enableAutoProgression } = req.body;

        // Safety check - ensure no production references
        if (scenarioType?.includes('prod') || customScenario?.name?.includes('production')) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            'Demo mode cannot reference production systems'
          ));
          return;
        }

        const session = await demoManager.activateDemoMode({
          scenarioType,
          customScenario,
          enableAutoProgression
        });

        res.status(201).json(createSuccessResponse({
          session: {
            sessionId: session.sessionId,
            scenarioType: session.scenario.type,
            scenarioName: session.scenario.name,
            isActive: session.isActive,
            startTime: session.startTime,
            safetyStatus: session.safetyStatus
          },
          demoMode: true,
          message: 'Demo mode activated successfully'
        }));
      } catch (error) {
        console.error('Error activating demo mode:', error);
        
        if (error instanceof Error && error.message.includes('already active')) {
          res.status(409).json(createErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            'Demo mode is already active'
          ));
        } else {
          res.status(500).json(createErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to activate demo mode'
          ));
        }
      }
    }
  );

  /**
   * POST /api/demo/deactivate
   * Deactivate demo mode and cleanup resources
   */
  router.post('/deactivate', async (req: Request, res: Response) => {
    try {
      await demoManager.deactivateDemoMode();

      res.json(createSuccessResponse({
        message: 'Demo mode deactivated successfully',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error deactivating demo mode:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to deactivate demo mode'
      ));
    }
  });

  /**
   * POST /api/demo/reset
   * Reset demo mode to initial state
   */
  router.post('/reset', async (req: Request, res: Response) => {
    try {
      const session = await demoManager.resetDemoMode();

      if (!session) {
        res.status(400).json(createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          'No active demo session to reset'
        ));
        return;
      }

      res.json(createSuccessResponse({
        session: {
          sessionId: session.sessionId,
          scenarioType: session.scenario.type,
          isActive: session.isActive,
          startTime: session.startTime
        },
        demoMode: true,
        message: 'Demo mode reset successfully'
      }));
    } catch (error) {
      console.error('Error resetting demo mode:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to reset demo mode'
      ));
    }
  });

  /**
   * POST /api/demo/simulate-incident
   * Simulate incident with realistic data
   */
  router.post('/simulate-incident', async (req: Request, res: Response) => {
    try {
      if (!demoManager.isDemo()) {
        res.status(400).json(createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          'Demo mode is not active'
        ));
        return;
      }

      const result = await demoManager.simulateIncident();

      res.status(201).json(createSuccessResponse({
        ...result,
        demoMode: true,
        message: 'Incident simulated successfully'
      }));
    } catch (error) {
      console.error('Error simulating incident:', error);
      
      if (error instanceof Error && error.message.includes('Maximum concurrent')) {
        res.status(429).json(createErrorResponse(
          ApiErrorCode.RATE_LIMIT_EXCEEDED,
          'Maximum concurrent demo workflows reached'
        ));
      } else {
        res.status(500).json(createErrorResponse(
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to simulate incident'
        ));
      }
    }
  });

  /**
   * POST /api/demo/workflows/:workflowId/simulate-agent-analysis
   * Simulate agent analysis for specific workflow
   */
  router.post('/workflows/:workflowId/simulate-agent-analysis',
    createJoiValidationMiddleware(DemoSchemas.simulateAgentAnalysis),
    async (req: Request, res: Response) => {
      try {
        const { workflowId } = req.params;
        const { agentName } = req.body;

        if (!demoManager.isDemo()) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            'Demo mode is not active'
          ));
          return;
        }

        // Validate agent name
        const validAgents = ['sre-agent', 'security-agent', 'governance-agent'];
        if (!validAgents.includes(agentName)) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            `Invalid agent name. Must be one of: ${validAgents.join(', ')}`
          ));
          return;
        }

        const agentOutput = await demoManager.simulateAgentAnalysis(workflowId, agentName);

        res.status(201).json(createSuccessResponse({
          workflowId,
          agentOutput,
          demoMode: true,
          message: `${agentName} analysis simulated successfully`
        }));
      } catch (error) {
        console.error('Error simulating agent analysis:', error);
        
        if (error instanceof Error && error.message.includes('not found')) {
          res.status(404).json(createErrorResponse(
            ApiErrorCode.WORKFLOW_NOT_FOUND,
            'Demo workflow not found'
          ));
        } else {
          res.status(500).json(createErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to simulate agent analysis'
          ));
        }
      }
    }
  );

  /**
   * POST /api/demo/workflows/:workflowId/simulate-governance
   * Simulate governance scenario for decision making
   */
  router.post('/workflows/:workflowId/simulate-governance',
    createJoiValidationMiddleware(DemoSchemas.simulateGovernance),
    async (req: Request, res: Response) => {
      try {
        const { workflowId } = req.params;
        const { scenarioType } = req.body;

        if (!demoManager.isDemo()) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            'Demo mode is not active'
          ));
          return;
        }

        const validScenarios = ['approve', 'approve_with_restrictions', 'block', 'realistic'];
        if (scenarioType && !validScenarios.includes(scenarioType)) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            `Invalid scenario type. Must be one of: ${validScenarios.join(', ')}`
          ));
          return;
        }

        const governanceScenario = await demoManager.simulateGovernanceScenario(
          workflowId, 
          scenarioType || 'realistic'
        );

        res.status(201).json(createSuccessResponse({
          workflowId,
          governanceScenario,
          demoMode: true,
          message: 'Governance scenario simulated successfully'
        }));
      } catch (error) {
        console.error('Error simulating governance scenario:', error);
        
        if (error instanceof Error && error.message.includes('not found')) {
          res.status(404).json(createErrorResponse(
            ApiErrorCode.WORKFLOW_NOT_FOUND,
            'Demo workflow not found'
          ));
        } else {
          res.status(500).json(createErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to simulate governance scenario'
          ));
        }
      }
    }
  );

  /**
   * GET /api/demo/scenarios
   * Get available demo scenarios
   */
  router.get('/scenarios', async (req: Request, res: Response) => {
    try {
      const scenarios = demoManager.getAvailableScenarios();

      res.json(createSuccessResponse({
        scenarios,
        totalCount: scenarios.length,
        demoMode: true
      }));
    } catch (error) {
      console.error('Error getting demo scenarios:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve demo scenarios'
      ));
    }
  });

  /**
   * GET /api/demo/state-snapshot
   * Create demo state snapshot for persistence
   */
  router.get('/state-snapshot', async (req: Request, res: Response) => {
    try {
      const snapshot = demoManager.createStateSnapshot();

      if (!snapshot) {
        res.status(400).json(createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          'No active demo session to snapshot'
        ));
        return;
      }

      res.json(createSuccessResponse({
        snapshot,
        demoMode: true,
        message: 'Demo state snapshot created successfully'
      }));
    } catch (error) {
      console.error('Error creating demo state snapshot:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to create demo state snapshot'
      ));
    }
  });

  /**
   * POST /api/demo/restore-snapshot
   * Restore demo state from snapshot
   */
  router.post('/restore-snapshot',
    createJoiValidationMiddleware(DemoSchemas.restoreSnapshot),
    async (req: Request, res: Response) => {
      try {
        const { snapshot } = req.body;

        // Validate snapshot structure
        if (!snapshot.sessionId || !snapshot.scenario || !snapshot.workflows) {
          res.status(400).json(createErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            'Invalid snapshot structure'
          ));
          return;
        }

        await demoManager.restoreFromSnapshot(snapshot);

        res.json(createSuccessResponse({
          sessionId: snapshot.sessionId,
          scenarioType: snapshot.scenario.type,
          workflowsRestored: snapshot.workflows.length,
          demoMode: true,
          message: 'Demo state restored from snapshot successfully'
        }));
      } catch (error) {
        console.error('Error restoring demo state:', error);
        res.status(500).json(createErrorResponse(
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to restore demo state from snapshot'
        ));
      }
    }
  );

  /**
   * GET /api/demo/simulation-button
   * Get simulation button configuration (hidden button for demos)
   */
  router.get('/simulation-button', async (req: Request, res: Response) => {
    try {
      const buttonConfig = {
        id: 'demo-simulate-incident',
        label: 'Simulate Incident',
        description: 'Generate realistic incident scenario for demonstration',
        scenarioType: 'database-outage',
        isHidden: true, // Hidden by default for demo purposes
        requiresConfirmation: true,
        safetyWarning: 'This will create a simulated incident in demo mode only. No real systems will be affected.',
        demoMode: true
      };

      res.json(createSuccessResponse(buttonConfig));
    } catch (error) {
      console.error('Error getting simulation button config:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve simulation button configuration'
      ));
    }
  });

  /**
   * POST /api/demo/update-config
   * Update demo configuration
   */
  router.post('/update-config',
    createJoiValidationMiddleware(DemoSchemas.updateConfig),
    async (req: Request, res: Response) => {
      try {
        const { config } = req.body;

        // Validate safety constraints cannot be disabled
        if (config.safetyConstraints) {
          const requiredConstraints = ['noExternalActions', 'isolatedEnvironment', 'auditAllOperations'];
          for (const constraint of requiredConstraints) {
            if (config.safetyConstraints[constraint] === false) {
              res.status(400).json(createErrorResponse(
                ApiErrorCode.VALIDATION_ERROR,
                `Safety constraint '${constraint}' cannot be disabled`
              ));
              return;
            }
          }
        }

        demoManager.updateConfig(config);

        res.json(createSuccessResponse({
          message: 'Demo configuration updated successfully',
          updatedFields: Object.keys(config),
          demoMode: true
        }));
      } catch (error) {
        console.error('Error updating demo config:', error);
        res.status(500).json(createErrorResponse(
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update demo configuration'
        ));
      }
    }
  );

  return router;
}