/**
 * SentinelFlow WebSocket Server
 * Implements real-time state broadcasting to connected UI clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { StateUpdate } from '../types/workflow';
import { WorkflowStateManager } from '../core/WorkflowStateManager';

export interface ClientConnection {
  id: string;
  socket: WebSocket;
  connectedAt: Date;
  lastPing?: Date;
}

export class SentinelFlowWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private stateManager: WorkflowStateManager;
  private pingInterval?: NodeJS.Timeout;

  constructor(server: Server, stateManager: WorkflowStateManager) {
    this.stateManager = stateManager;
    this.wss = new WebSocketServer({ server });
    this.setupWebSocketServer();
    this.setupStateManagerListeners();
    this.startPingInterval();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (socket: WebSocket, request) => {
      const clientId = this.generateClientId();
      const client: ClientConnection = {
        id: clientId,
        socket,
        connectedAt: new Date()
      };

      this.clients.set(clientId, client);
      console.log(`Client ${clientId} connected. Total clients: ${this.clients.size}`);

      // Send connection confirmation
      this.sendToClient(clientId, {
        type: 'connection_established',
        clientId,
        timestamp: new Date().toISOString()
      });

      // Handle client messages
      socket.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error(`Error parsing message from client ${clientId}:`, error);
          this.sendErrorToClient(clientId, 'Invalid JSON message');
        }
      });

      // Handle client disconnect
      socket.on('close', () => {
        this.clients.delete(clientId);
        console.log(`Client ${clientId} disconnected. Total clients: ${this.clients.size}`);
      });

      // Handle client errors
      socket.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      // Handle pong responses
      socket.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastPing = new Date();
        }
      });
    });
  }

  private setupStateManagerListeners(): void {
    // Listen for state updates from the WorkflowStateManager
    this.stateManager.on('stateUpdate', (stateUpdate: StateUpdate) => {
      this.broadcastStateUpdate(stateUpdate);
    });
  }

  /**
   * Setup governance gate event listeners
   * Enables real-time governance request and decision broadcasting
   */
  public setupGovernanceListeners(governanceGate: any): void {
    // Listen for governance requests
    governanceGate.on('governanceRequired', (governanceEvent: any) => {
      this.broadcastStateUpdate({
        type: 'governance_required',
        workflowId: governanceEvent.workflowId,
        timestamp: governanceEvent.timestamp,
        payload: governanceEvent.payload
      });
    });

    // Listen for governance decisions
    governanceGate.on('governanceDecision', (decisionEvent: any) => {
      this.broadcastStateUpdate({
        type: 'governance_decision',
        workflowId: decisionEvent.workflowId,
        timestamp: decisionEvent.timestamp,
        payload: decisionEvent.payload
      });
    });
  }

  private handleClientMessage(clientId: string, message: any): void {
    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          timestamp: new Date().toISOString()
        });
        break;
      
      case 'subscribe_workflow':
        // Client wants to subscribe to a specific workflow
        this.sendToClient(clientId, {
          type: 'subscription_confirmed',
          workflowId: message.workflowId,
          timestamp: new Date().toISOString()
        });
        break;
      
      case 'get_workflow_state':
        // Client requests current workflow state
        const workflow = this.stateManager.getWorkflow(message.workflowId);
        if (workflow) {
          this.sendToClient(clientId, {
            type: 'workflow_state',
            workflowId: message.workflowId,
            payload: workflow,
            timestamp: new Date().toISOString()
          });
        } else {
          this.sendErrorToClient(clientId, `Workflow ${message.workflowId} not found`);
        }
        break;

      case 'get_governance_request':
        // Client requests governance request details
        if (message.requestId) {
          // Implementation would get governance request from service
          this.sendToClient(clientId, {
            type: 'governance_request',
            requestId: message.requestId,
            payload: { status: 'pending' }, // Placeholder
            timestamp: new Date().toISOString()
          });
        } else {
          this.sendErrorToClient(clientId, 'Request ID required for governance request');
        }
        break;
      
      default:
        this.sendErrorToClient(clientId, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Broadcast state update to all connected clients
   */
  public broadcastStateUpdate(stateUpdate: StateUpdate): void {
    const message = {
      ...stateUpdate,
      serverTimestamp: new Date().toISOString()
    };

    this.broadcast(message);
    console.log(`State update broadcast completed`);
  }

  /**
   * Broadcast demo event to all connected clients with demo mode indicators
   * Implements Requirements 9.1 - Demo mode real-time updates
   */
  public broadcastDemoEvent(eventType: string, data: any): void {
    const demoEvent = {
      type: 'demo_event',
      eventType,
      data: {
        ...data,
        demoMode: true, // Always mark as demo mode
        timestamp: data.timestamp || new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.broadcast(demoEvent);
    console.log(`Demo event broadcasted: ${eventType} to ${this.clients.size} clients`);
  }

  /**
   * Generic broadcast method for sending messages to all connected clients
   */
  private broadcast(message: any): void {
    let successCount = 0;
    let errorCount = 0;

    this.clients.forEach((client, clientId) => {
      try {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify(message));
          successCount++;
        } else {
          // Remove disconnected clients
          this.clients.delete(clientId);
        }
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
        this.clients.delete(clientId);
        errorCount++;
      }
    });

    console.log(`Broadcast completed: ${successCount} successful, ${errorCount} errors`);
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Send error message to specific client
   */
  private sendErrorToClient(clientId: string, error: string): void {
    this.sendToClient(clientId, {
      type: 'error',
      error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start ping interval to check client connections
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.socket.readyState === WebSocket.OPEN) {
          try {
            client.socket.ping();
          } catch (error) {
            console.error(`Error pinging client ${clientId}:`, error);
            this.clients.delete(clientId);
          }
        } else {
          this.clients.delete(clientId);
        }
      });
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    totalClients: number;
    connectedClients: number;
    clients: Array<{
      id: string;
      connectedAt: Date;
      lastPing?: Date;
    }>;
  } {
    const connectedClients = Array.from(this.clients.values()).filter(
      client => client.socket.readyState === WebSocket.OPEN
    );

    return {
      totalClients: this.clients.size,
      connectedClients: connectedClients.length,
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        connectedAt: client.connectedAt,
        lastPing: client.lastPing
      }))
    };
  }

  /**
   * Shutdown the WebSocket server
   */
  public shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all client connections
    this.clients.forEach((client) => {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.close(1000, 'Server shutting down');
      }
    });

    this.clients.clear();
    this.wss.close();
  }
}