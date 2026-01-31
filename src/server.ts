/**
 * SentinelFlow Backend Server
 * Main server that integrates workflow state management with real-time communication
 */

import express from 'express';
import { createServer } from 'http';
import { WorkflowStateManager } from './core/WorkflowStateManager';
import { SentinelFlowWebSocketServer } from './communication/WebSocketServer';
import { OrchestratorService } from './services/OrchestratorService';
import { createApiRouter, ApiDependencies } from './api';
import { DemoModeManager } from './demo/DemoModeManager';

export class SentinelFlowServer {
  private app: express.Application;
  private server: any;
  private stateManager: WorkflowStateManager;
  private orchestratorService: OrchestratorService;
  private wsServer: SentinelFlowWebSocketServer;
  private demoManager: DemoModeManager;
  private port: number;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.stateManager = new WorkflowStateManager();
    this.orchestratorService = new OrchestratorService(this.stateManager);
    this.wsServer = new SentinelFlowWebSocketServer(this.server, this.stateManager);
    this.demoManager = new DemoModeManager();
    
    // Setup governance gate event listeners for real-time updates
    this.wsServer.setupGovernanceListeners(this.orchestratorService.getGovernanceGate());
    
    // Setup demo mode event listeners for real-time demo updates
    this.setupDemoEventListeners();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS middleware for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes(): void {
    // Mount structured API routes
    const apiDependencies: ApiDependencies = {
      stateManager: this.stateManager,
      governanceGate: this.orchestratorService.getGovernanceGate(),
      demoManager: this.demoManager
    };
    
    this.app.use('/api', createApiRouter(apiDependencies));

    // Legacy health check endpoint (keep for backward compatibility)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Root endpoint with API documentation
    this.app.get('/', (req, res) => {
      res.json({
        name: 'SentinelFlow Backend Server',
        version: '1.0.0',
        description: 'Governed agentic workflow system for incident response',
        apiVersion: 'v1',
        endpoints: {
          health: '/health',
          api: '/api',
          websocket: 'ws://localhost:' + this.port,
          documentation: {
            workflows: '/api/workflows',
            governance: '/api/governance',
            audit: '/api/workflows/:id/audit-trail',
            historical: '/api/historical'
          }
        },
        timestamp: new Date().toISOString()
      });
    });

    // 404 handler for non-API routes
    this.app.use('*', (req, res) => {
      res.status(404).json({ 
        error: 'Endpoint not found',
        message: 'Use /api for structured API endpoints',
        timestamp: new Date().toISOString()
      });
    });
  }

  public async start(): Promise<void> {
    // Initialize orchestrator with agent configurations
    await this.orchestratorService.initialize();
    
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`SentinelFlow Backend Server running on port ${this.port}`);
        console.log(`WebSocket server ready for connections`);
        console.log(`Health check: http://localhost:${this.port}/health`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wsServer.shutdown();
      this.server.close(() => {
        console.log('SentinelFlow Backend Server stopped');
        resolve();
      });
    });
  }

  public getStateManager(): WorkflowStateManager {
    return this.stateManager;
  }

  public getOrchestratorService(): OrchestratorService {
    return this.orchestratorService;
  }

  public getWebSocketServer(): SentinelFlowWebSocketServer {
    return this.wsServer;
  }

  public getDemoManager(): DemoModeManager {
    return this.demoManager;
  }

  /**
   * Setup demo mode event listeners for real-time updates
   * Implements Requirements 9.1 - Demo mode integration with WebSocket
   */
  private setupDemoEventListeners(): void {
    // Forward demo events to WebSocket clients with demo mode indicators
    this.demoManager.on('demoModeActivated', (session) => {
      this.wsServer.broadcastDemoEvent('demo_activated', {
        sessionId: session.sessionId,
        scenarioType: session.scenario.type,
        demoMode: true,
        timestamp: new Date().toISOString()
      });
    });

    this.demoManager.on('demoModeDeactivated', (data) => {
      this.wsServer.broadcastDemoEvent('demo_deactivated', {
        ...data,
        demoMode: true,
        timestamp: new Date().toISOString()
      });
    });

    this.demoManager.on('incidentSimulated', (data) => {
      this.wsServer.broadcastDemoEvent('incident_simulated', {
        ...data,
        demoMode: true,
        timestamp: new Date().toISOString()
      });
    });

    this.demoManager.on('agentAnalysisCompleted', (data) => {
      this.wsServer.broadcastDemoEvent('agent_analysis_completed', {
        ...data,
        demoMode: true,
        timestamp: new Date().toISOString()
      });
    });

    this.demoManager.on('governanceScenarioGenerated', (data) => {
      this.wsServer.broadcastDemoEvent('governance_scenario_generated', {
        ...data,
        demoMode: true,
        timestamp: new Date().toISOString()
      });
    });

    this.demoManager.on('demoAuditEvent', (event) => {
      this.wsServer.broadcastDemoEvent('demo_audit_event', {
        ...event,
        demoMode: true
      });
    });
  }
}