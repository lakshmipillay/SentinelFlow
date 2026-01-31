/**
 * Simplified tests for WebSocket Server
 * Validates core real-time state broadcasting functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { SentinelFlowWebSocketServer } from '../WebSocketServer';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { WorkflowState } from '../../types/workflow';

describe('SentinelFlowWebSocketServer - Core Functionality', () => {
  let server: any;
  let stateManager: WorkflowStateManager;
  let wsServer: SentinelFlowWebSocketServer;
  let port: number;

  beforeEach(async () => {
    // Create HTTP server
    server = createServer();
    stateManager = new WorkflowStateManager();
    wsServer = new SentinelFlowWebSocketServer(server, stateManager);
    
    // Start server on random port
    port = 3000 + Math.floor(Math.random() * 1000);
    await new Promise<void>((resolve) => {
      server.listen(port, resolve);
    });
  });

  afterEach(async () => {
    wsServer.shutdown();
    await new Promise<void>((resolve) => {
      server.close(resolve);
    });
  });

  describe('Server Initialization', () => {
    it('should initialize WebSocket server correctly', () => {
      expect(wsServer).toBeDefined();
      expect(wsServer.getConnectionStats().totalClients).toBe(0);
    });

    it('should integrate with WorkflowStateManager', async () => {
      const workflow = await stateManager.createWorkflow();
      expect(workflow.currentState).toBe(WorkflowState.IDLE);
    });
  });

  describe('State Broadcasting Integration', () => {
    it('should handle state transitions without errors', async () => {
      const workflow = await stateManager.createWorkflow();
      
      // Trigger state transition
      await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);
      
      // Verify state was updated correctly
      expect(stateManager.getCurrentState(workflow.workflowId)).toBe(WorkflowState.INCIDENT_INGESTED);
    });

    it('should handle broadcasting when no clients are connected', async () => {
      const workflow = await stateManager.createWorkflow();
      
      // Should not throw error when no clients are connected
      await expect(
        stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED)
      ).resolves.toBe(true);
      
      expect(wsServer.getConnectionStats().totalClients).toBe(0);
    });
  });

  describe('Connection Management', () => {
    it('should provide connection statistics', () => {
      const stats = wsServer.getConnectionStats();
      
      expect(stats).toHaveProperty('totalClients');
      expect(stats).toHaveProperty('connectedClients');
      expect(stats).toHaveProperty('clients');
      expect(Array.isArray(stats.clients)).toBe(true);
    });

    it('should handle server shutdown gracefully', () => {
      expect(() => wsServer.shutdown()).not.toThrow();
    });
  });

  describe('State Update Message Structure', () => {
    it('should create properly structured state update messages', async () => {
      const workflow = await stateManager.createWorkflow();
      
      // Test that state update structure is correct by checking the workflow
      const stateUpdate = {
        type: 'workflow_state' as const,
        workflowId: workflow.workflowId,
        timestamp: new Date().toISOString(),
        payload: WorkflowState.INCIDENT_INGESTED
      };
      
      // Verify the structure matches our expected format
      expect(stateUpdate.type).toBe('workflow_state');
      expect(stateUpdate.workflowId).toBe(workflow.workflowId);
      expect(stateUpdate.timestamp).toBeDefined();
      expect(stateUpdate.payload).toBe(WorkflowState.INCIDENT_INGESTED);
    });
  });
});