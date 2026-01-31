/**
 * SentinelFlow Historical Data API Routes
 * REST endpoints for historical workflow data access and analytics
 */

import { Router, Request, Response } from 'express';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { WorkflowState, WorkflowInstance } from '../../types/workflow';
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequest
} from '../middleware';
import {
  GetHistoricalWorkflowsRequest,
  GetHistoricalWorkflowsResponse,
  ApiErrorCode
} from '../types';

export function createHistoricalRoutes(stateManager: WorkflowStateManager): Router {
  const router = Router();

  /**
   * GET /api/historical/workflows
   * Get historical workflows with filtering and pagination
   */
  router.get('/workflows', async (req: Request, res: Response) => {
    try {
      const {
        startDate,
        endDate,
        state,
        limit = 50,
        offset = 0
      }: GetHistoricalWorkflowsRequest = req.query as any;

      // Get all workflows
      let workflows = stateManager.getAllWorkflows();

      // Apply date filtering
      if (startDate) {
        const start = new Date(startDate);
        workflows = workflows.filter(w => new Date(w.createdAt) >= start);
      }

      if (endDate) {
        const end = new Date(endDate);
        workflows = workflows.filter(w => new Date(w.createdAt) <= end);
      }

      // Apply state filtering
      if (state && Object.values(WorkflowState).includes(state as WorkflowState)) {
        workflows = workflows.filter(w => w.currentState === state);
      }

      // Sort by creation date (newest first)
      workflows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply pagination
      const totalCount = workflows.length;
      const paginatedWorkflows = workflows.slice(Number(offset), Number(offset) + Number(limit));

      const response: GetHistoricalWorkflowsResponse = {
        workflows: paginatedWorkflows,
        totalCount,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < totalCount
        }
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error getting historical workflows:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve historical workflows',
        error
      ));
    }
  });

  /**
   * GET /api/historical/workflows/stats
   * Get historical workflow statistics
   */
  router.get('/workflows/stats', async (req: Request, res: Response) => {
    try {
      const workflows = stateManager.getAllWorkflows();

      // Calculate statistics
      const stats = {
        totalWorkflows: workflows.length,
        workflowsByState: workflows.reduce((acc, workflow) => {
          acc[workflow.currentState] = (acc[workflow.currentState] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        workflowsByDate: calculateWorkflowsByDate(workflows),
        averageWorkflowDuration: calculateAverageWorkflowDuration(workflows),
        completionRate: calculateCompletionRate(workflows),
        governanceStats: calculateGovernanceStats(workflows),
        agentOutputStats: calculateAgentOutputStats(workflows)
      };

      res.json(createSuccessResponse(stats));
    } catch (error) {
      console.error('Error getting workflow statistics:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve workflow statistics',
        error
      ));
    }
  });

  /**
   * GET /api/historical/workflows/:workflowId/timeline
   * Get detailed timeline for a specific workflow
   */
  router.get('/workflows/:workflowId/timeline', async (req: Request, res: Response) => {
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
      
      // Build detailed timeline
      const timeline = auditChain.map(event => ({
        timestamp: event.timestamp,
        eventType: event.eventType,
        actor: event.actor,
        description: generateTimelineDescription(event),
        details: event.details,
        contextCapture: event.contextCapture
      }));

      // Calculate workflow phases
      const phases = calculateWorkflowPhases(timeline);

      res.json(createSuccessResponse({
        workflowId,
        timeline,
        phases,
        totalDuration: calculateWorkflowDuration(workflow),
        summary: {
          totalEvents: timeline.length,
          stateTransitions: timeline.filter(e => e.eventType === 'state_transition').length,
          agentOutputs: timeline.filter(e => e.eventType === 'agent_output').length,
          governanceDecisions: timeline.filter(e => e.eventType === 'governance_decision').length
        }
      }));
    } catch (error) {
      console.error('Error getting workflow timeline:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve workflow timeline',
        error
      ));
    }
  });

  /**
   * GET /api/historical/analytics/trends
   * Get workflow trends and analytics
   */
  router.get('/analytics/trends', async (req: Request, res: Response) => {
    try {
      const { period = '30d' } = req.query;
      const workflows = stateManager.getAllWorkflows();

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Filter workflows by date range
      const filteredWorkflows = workflows.filter(w => 
        new Date(w.createdAt) >= startDate && new Date(w.createdAt) <= endDate
      );

      const trends = {
        period,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        workflowVolume: calculateWorkflowVolumeTrend(filteredWorkflows, startDate, endDate),
        stateDistribution: calculateStateDistributionTrend(filteredWorkflows),
        averageProcessingTime: calculateProcessingTimeTrend(filteredWorkflows),
        governanceApprovalRate: calculateGovernanceApprovalRate(filteredWorkflows),
        agentPerformance: calculateAgentPerformanceTrend(filteredWorkflows),
        incidentTypes: analyzeIncidentTypes(filteredWorkflows)
      };

      res.json(createSuccessResponse(trends));
    } catch (error) {
      console.error('Error getting workflow trends:', error);
      res.status(500).json(createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve workflow trends',
        error
      ));
    }
  });

  // Helper methods for statistical calculations

  function calculateWorkflowsByDate(workflows: WorkflowInstance[]): Record<string, number> {
    return workflows.reduce((acc, workflow) => {
      const date = new Date(workflow.createdAt).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  function calculateAverageWorkflowDuration(workflows: WorkflowInstance[]): number {
    const completedWorkflows = workflows.filter(w => 
      w.currentState === WorkflowState.RESOLVED || w.currentState === WorkflowState.TERMINATED
    );

    if (completedWorkflows.length === 0) return 0;

    const totalDuration = completedWorkflows.reduce((sum, workflow) => {
      const duration = new Date(workflow.updatedAt).getTime() - new Date(workflow.createdAt).getTime();
      return sum + duration;
    }, 0);

    return totalDuration / completedWorkflows.length;
  }

  function calculateCompletionRate(workflows: WorkflowInstance[]): number {
    if (workflows.length === 0) return 0;
    
    const completedWorkflows = workflows.filter(w => w.currentState === WorkflowState.RESOLVED);
    return (completedWorkflows.length / workflows.length) * 100;
  }

  function calculateGovernanceStats(workflows: WorkflowInstance[]): any {
    const workflowsWithGovernance = workflows.filter(w => w.governanceDecision);
    
    if (workflowsWithGovernance.length === 0) {
      return {
        totalDecisions: 0,
        approvalRate: 0,
        blockRate: 0,
        restrictionRate: 0
      };
    }

    const decisions = workflowsWithGovernance.map(w => w.governanceDecision!.decision);
    const approvals = decisions.filter(d => d === 'approve').length;
    const blocks = decisions.filter(d => d === 'block').length;
    const restrictions = decisions.filter(d => d === 'approve_with_restrictions').length;

    return {
      totalDecisions: decisions.length,
      approvalRate: (approvals / decisions.length) * 100,
      blockRate: (blocks / decisions.length) * 100,
      restrictionRate: (restrictions / decisions.length) * 100
    };
  }

  function calculateAgentOutputStats(workflows: WorkflowInstance[]): any {
    const allOutputs = workflows.flatMap(w => w.agentOutputs);
    
    if (allOutputs.length === 0) {
      return {
        totalOutputs: 0,
        averageConfidence: 0,
        outputsByAgent: {}
      };
    }

    const outputsByAgent = allOutputs.reduce((acc, output) => {
      acc[output.agentName] = (acc[output.agentName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageConfidence = allOutputs.reduce((sum, output) => sum + output.confidenceLevel, 0) / allOutputs.length;

    return {
      totalOutputs: allOutputs.length,
      averageConfidence,
      outputsByAgent
    };
  }

  function generateTimelineDescription(event: any): string {
    switch (event.eventType) {
      case 'state_transition':
        return `Workflow transitioned from ${event.details.fromState} to ${event.details.toState}`;
      case 'agent_output':
        return `${event.actor} provided analysis with ${event.details.agentOutput?.confidenceLevel || 'unknown'} confidence`;
      case 'governance_decision':
        return `Governance decision: ${event.details.governanceDecision?.decision} - ${event.details.governanceDecision?.rationale}`;
      case 'workflow_termination':
        return `Workflow terminated: ${event.details.terminationReason}`;
      default:
        return `${event.eventType} event occurred`;
    }
  }

  function calculateWorkflowPhases(timeline: any[]): any[] {
    const phases: any[] = [];
    let currentPhase: any = null;

    for (const event of timeline) {
      if (event.eventType === 'state_transition') {
        if (currentPhase) {
          currentPhase.endTime = event.timestamp;
          currentPhase.duration = new Date(currentPhase.endTime).getTime() - new Date(currentPhase.startTime).getTime();
          phases.push(currentPhase);
        }

        currentPhase = {
          phase: event.details.toState,
          startTime: event.timestamp,
          endTime: null,
          duration: null,
          events: []
        };
      }

      if (currentPhase) {
        currentPhase.events.push(event);
      }
    }

    // Close the last phase
    if (currentPhase) {
      currentPhase.endTime = timeline[timeline.length - 1]?.timestamp || currentPhase.startTime;
      currentPhase.duration = new Date(currentPhase.endTime).getTime() - new Date(currentPhase.startTime).getTime();
      phases.push(currentPhase);
    }

    return phases;
  }

  function calculateWorkflowDuration(workflow: WorkflowInstance): number {
    return new Date(workflow.updatedAt).getTime() - new Date(workflow.createdAt).getTime();
  }

  function calculateWorkflowVolumeTrend(workflows: WorkflowInstance[], startDate: Date, endDate: Date): any[] {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trend = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = workflows.filter(w => 
        new Date(w.createdAt).toISOString().split('T')[0] === dateStr
      ).length;

      trend.push({ date: dateStr, count });
    }

    return trend;
  }

  function calculateStateDistributionTrend(workflows: WorkflowInstance[]): any {
    return workflows.reduce((acc, workflow) => {
      acc[workflow.currentState] = (acc[workflow.currentState] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  function calculateProcessingTimeTrend(workflows: WorkflowInstance[]): any {
    const completedWorkflows = workflows.filter(w => 
      w.currentState === WorkflowState.RESOLVED || w.currentState === WorkflowState.TERMINATED
    );

    if (completedWorkflows.length === 0) return { average: 0, median: 0, min: 0, max: 0 };

    const durations = completedWorkflows.map(w => 
      new Date(w.updatedAt).getTime() - new Date(w.createdAt).getTime()
    ).sort((a, b) => a - b);

    return {
      average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      median: durations[Math.floor(durations.length / 2)],
      min: durations[0],
      max: durations[durations.length - 1]
    };
  }

  function calculateGovernanceApprovalRate(workflows: WorkflowInstance[]): number {
    const workflowsWithGovernance = workflows.filter(w => w.governanceDecision);
    if (workflowsWithGovernance.length === 0) return 0;

    const approvals = workflowsWithGovernance.filter(w => 
      w.governanceDecision!.decision === 'approve' || 
      w.governanceDecision!.decision === 'approve_with_restrictions'
    ).length;

    return (approvals / workflowsWithGovernance.length) * 100;
  }

  function calculateAgentPerformanceTrend(workflows: WorkflowInstance[]): any {
    const allOutputs = workflows.flatMap(w => w.agentOutputs);
    
    return allOutputs.reduce((acc, output) => {
      if (!acc[output.agentName]) {
        acc[output.agentName] = {
          totalOutputs: 0,
          averageConfidence: 0,
          averageProcessingTime: 0
        };
      }

      acc[output.agentName].totalOutputs++;
      acc[output.agentName].averageConfidence = 
        (acc[output.agentName].averageConfidence * (acc[output.agentName].totalOutputs - 1) + output.confidenceLevel) / 
        acc[output.agentName].totalOutputs;
      acc[output.agentName].averageProcessingTime = 
        (acc[output.agentName].averageProcessingTime * (acc[output.agentName].totalOutputs - 1) + output.metadata.processingTimeMs) / 
        acc[output.agentName].totalOutputs;

      return acc;
    }, {} as Record<string, any>);
  }

  function analyzeIncidentTypes(workflows: WorkflowInstance[]): any {
    // For MVP, return mock incident type analysis
    // In production, this would analyze incident context data
    return {
      'database-issues': 35,
      'network-connectivity': 25,
      'authentication-failures': 20,
      'performance-degradation': 15,
      'security-incidents': 5
    };
  }

  return router;
}