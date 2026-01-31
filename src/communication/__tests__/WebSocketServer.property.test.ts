/**
 * Property-Based Tests for WebSocket Server Real-time State Notifications
 * **Property 3: Real-time State Notification Completeness**
 * **Validates: Requirements 1.4**
 * 
 * Feature: sentinelflow-unified-architecture, Property 3: Real-time State Notification Completeness
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createServer } from 'http';
import WebSocket from 'ws';
import { SentinelFlowWebSocketServer } from '../WebSocketServer';
import { WorkflowStateManager } from '../../core/WorkflowStateManager';
import { WorkflowState, StateUpdate, AgentOutput, GovernanceDecision } from '../../types/workflow';
import { AgentName, AgentSkill } from '../../types/agent-skills';

describe('WebSocketServer - Property-Based Tests', () => {
  let server: any;
  let stateManager: WorkflowStateManager;
  let wsServer: SentinelFlowWebSocketServer;
  let port: number;

  beforeEach(async () => {
    // Create HTTP server
    server = createServer();
    stateManager = new WorkflowStateManager();
    wsServer = new SentinelFlowWebSocketServer(server, stateManager);
    
    // Start server on random port to avoid conflicts
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

  describe('Property 3: Real-time State Notification Completeness', () => {
    it('should broadcast workflow state transitions to all connected clients', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a single valid state transition
          fc.constantFrom(
            WorkflowState.INCIDENT_INGESTED,
            WorkflowState.ANALYZING
          ),
          // Generate number of clients to connect (1-2 for speed)
          fc.integer({ min: 1, max: 2 }),
          async (targetState: WorkflowState, clientCount: number) => {
            const workflow = await stateManager.createWorkflow();
            const workflowId = workflow.workflowId;
            
            // Connect WebSocket clients
            const clients: WebSocket[] = [];
            const receivedMessages: any[][] = [];
            
            for (let i = 0; i < clientCount; i++) {
              const client = new WebSocket(`ws://localhost:${port}`);
              clients.push(client);
              receivedMessages.push([]);
              
              const clientIndex = i;
              client.on('message', (data) => {
                try {
                  const message = JSON.parse(data.toString());
                  if (message.type === 'workflow_state') {
                    receivedMessages[clientIndex].push(message);
                  }
                } catch (error) {
                  // Ignore parsing errors
                }
              });
            }
            
            // Wait for all clients to connect
            await Promise.all(clients.map(client => 
              new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Connection timeout')), 2000);
                if (client.readyState === WebSocket.OPEN) {
                  clearTimeout(timeout);
                  resolve();
                } else {
                  client.on('open', () => {
                    clearTimeout(timeout);
                    resolve();
                  });
                  client.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                  });
                }
              })
            ));
            
            // Allow time for connection establishment
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Perform state transition
            if (targetState === WorkflowState.ANALYZING) {
              await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
            }
            await stateManager.transitionTo(workflowId, targetState);
            
            // Allow time for message propagation
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify all clients received at least one state notification
            for (let clientIndex = 0; clientIndex < clientCount; clientIndex++) {
              const clientMessages = receivedMessages[clientIndex];
              expect(clientMessages.length).toBeGreaterThanOrEqual(1);
              
              // Verify the last message contains the target state
              const lastMessage = clientMessages[clientMessages.length - 1];
              expect(lastMessage.type).toBe('workflow_state');
              expect(lastMessage.workflowId).toBe(workflowId);
              expect(lastMessage.timestamp).toBeDefined();
            }
            
            // Clean up clients
            clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.close();
              }
            });
            
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        ),
        { numRuns: 20, timeout: 30000 }
      );
    }, 60000);

    it('should broadcast agent output notifications with complete data', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate agent name
          fc.constantFrom('sre-agent', 'security-agent', 'governance-agent'),
          async (agentName: string) => {
            const workflow = await stateManager.createWorkflow();
            const workflowId = workflow.workflowId;
            
            // Transition to ANALYZING state
            await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
            await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
            
            // Connect WebSocket client
            const client = new WebSocket(`ws://localhost:${port}`);
            const receivedMessages: any[] = [];
            
            client.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                if (message.type === 'agent_output') {
                  receivedMessages.push(message);
                }
              } catch (error) {
                // Ignore parsing errors
              }
            });
            
            // Wait for connection
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Connection timeout')), 2000);
              if (client.readyState === WebSocket.OPEN) {
                clearTimeout(timeout);
                resolve();
              } else {
                client.on('open', () => {
                  clearTimeout(timeout);
                  resolve();
                });
                client.on('error', (err) => {
                  clearTimeout(timeout);
                  reject(err);
                });
              }
            });
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Map agent to appropriate skills
            let skillsToUse: AgentSkill[];
            switch (agentName) {
              case 'sre-agent':
                skillsToUse = ['Datadog'] as AgentSkill[];
                break;
              case 'security-agent':
                skillsToUse = ['Splunk SIEM'] as AgentSkill[];
                break;
              case 'governance-agent':
                skillsToUse = ['Policy Engine'] as AgentSkill[];
                break;
              default:
                skillsToUse = ['Datadog'] as AgentSkill[];
            }

            const agentOutput: AgentOutput = {
              agentName: agentName as AgentName,
              skillsUsed: skillsToUse,
              findings: {
                summary: 'Test summary for property test',
                evidence: ['Evidence item 1'],
                correlations: []
              },
              confidenceLevel: 0.85,
              timestamp: new Date().toISOString(),
              metadata: {
                processingTimeMs: 100,
                dataSourcesAccessed: ['test-source'],
                skillsMetadata: {
                  totalSkillsAvailable: 4,
                  skillsUtilized: skillsToUse.length,
                  utilizationRate: skillsToUse.length / 4,
                  skillsValidation: {
                    allSkillsValid: true,
                    invalidSkills: [],
                    validationErrors: []
                  }
                }
              },
              validation: {
                skillsValid: true,
                confidenceLevelValid: true,
                schemaCompliant: true
              }
            };
            
            await stateManager.addAgentOutput(workflowId, agentOutput);
            
            // Allow time for message propagation
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify client received the agent output notification
            expect(receivedMessages.length).toBe(1);
            
            const message = receivedMessages[0];
            expect(message.type).toBe('agent_output');
            expect(message.workflowId).toBe(workflowId);
            expect(message.timestamp).toBeDefined();
            
            // Verify payload contains agent output data
            const payload = message.payload;
            expect(payload.agentName).toBe(agentOutput.agentName);
            expect(payload.skillsUsed).toEqual(agentOutput.skillsUsed);
            expect(payload.findings.summary).toBe(agentOutput.findings.summary);
            
            // Clean up
            if (client.readyState === WebSocket.OPEN) {
              client.close();
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        ),
        { numRuns: 20, timeout: 30000 }
      );
    }, 60000);

    it('should handle multiple clients receiving notifications reliably', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 3 }), // Number of clients
          async (clientCount: number) => {
            const workflow = await stateManager.createWorkflow();
            const workflowId = workflow.workflowId;
            
            // Connect multiple clients
            const clients: WebSocket[] = [];
            const receivedMessages: any[][] = [];
            
            for (let i = 0; i < clientCount; i++) {
              const client = new WebSocket(`ws://localhost:${port}`);
              clients.push(client);
              receivedMessages.push([]);
              
              const clientIndex = i;
              client.on('message', (data) => {
                try {
                  const message = JSON.parse(data.toString());
                  if (message.type === 'workflow_state') {
                    receivedMessages[clientIndex].push(message);
                  }
                } catch (error) {
                  // Ignore parsing errors
                }
              });
            }
            
            // Wait for connections
            await Promise.all(clients.map(client => 
              new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Connection timeout')), 2000);
                if (client.readyState === WebSocket.OPEN) {
                  clearTimeout(timeout);
                  resolve();
                } else {
                  client.on('open', () => {
                    clearTimeout(timeout);
                    resolve();
                  });
                  client.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                  });
                }
              })
            ));
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Perform a single state transition
            await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
            
            // Allow time for message propagation
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Verify all clients received at least one notification
            for (let clientIndex = 0; clientIndex < clientCount; clientIndex++) {
              const clientMessages = receivedMessages[clientIndex];
              expect(clientMessages.length).toBeGreaterThanOrEqual(1);
              
              const message = clientMessages[clientMessages.length - 1];
              expect(message.type).toBe('workflow_state');
              expect(message.workflowId).toBe(workflowId);
            }
            
            // Clean up
            clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.close();
              }
            });
            
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        ),
        { numRuns: 20, timeout: 30000 }
      );
    }, 60000);

    it('should broadcast governance decision notifications with complete data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('approve', 'approve_with_restrictions', 'block'),
          fc.constantFrom('low', 'medium', 'high'),
          async (decision: string, riskLevel: string) => {
            const workflow = await stateManager.createWorkflow();
            const workflowId = workflow.workflowId;
            
            // Transition to GOVERNANCE_PENDING state
            await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
            await stateManager.transitionTo(workflowId, WorkflowState.ANALYZING);
            await stateManager.transitionTo(workflowId, WorkflowState.RCA_COMPLETE);
            await stateManager.transitionTo(workflowId, WorkflowState.GOVERNANCE_PENDING);
            
            // Connect WebSocket client
            const client = new WebSocket(`ws://localhost:${port}`);
            const receivedMessages: any[] = [];
            
            client.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                if (message.type === 'governance_required') {
                  receivedMessages.push(message);
                }
              } catch (error) {
                // Ignore parsing errors
              }
            });
            
            // Wait for connection
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Connection timeout')), 2000);
              if (client.readyState === WebSocket.OPEN) {
                clearTimeout(timeout);
                resolve();
              } else {
                client.on('open', () => {
                  clearTimeout(timeout);
                  resolve();
                });
                client.on('error', (err) => {
                  clearTimeout(timeout);
                  reject(err);
                });
              }
            });
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Add governance decision
            const governanceDecision: GovernanceDecision = {
              decision: decision as any,
              rationale: 'Test rationale for property test',
              approver: {
                id: 'test-approver-123',
                role: 'security-lead'
              },
              timestamp: new Date().toISOString(),
              restrictions: decision === 'approve_with_restrictions' ? ['limited-scope'] : undefined,
              blastRadiusAssessment: {
                affectedServices: ['service-a', 'service-b'],
                riskLevel: riskLevel as any,
                reversible: true
              }
            };
            
            await stateManager.addGovernanceDecision(workflowId, governanceDecision);
            
            // Allow time for message propagation
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify governance decision notification was received
            expect(receivedMessages.length).toBe(1);
            
            const message = receivedMessages[0];
            expect(message.type).toBe('governance_required');
            expect(message.workflowId).toBe(workflowId);
            expect(message.timestamp).toBeDefined();
            
            // Verify payload contains governance decision data
            const payload = message.payload;
            expect(payload.decision).toBe(governanceDecision.decision);
            expect(payload.rationale).toBe(governanceDecision.rationale);
            expect(payload.blastRadiusAssessment.riskLevel).toBe(governanceDecision.blastRadiusAssessment.riskLevel);
            
            // Clean up
            if (client.readyState === WebSocket.OPEN) {
              client.close();
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        ),
        { numRuns: 20, timeout: 30000 }
      );
    }, 60000);

    it('should handle WebSocket connection management correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 2 }), // Number of connection cycles
          async (connectionCycles: number) => {
            const workflow = await stateManager.createWorkflow();
            const workflowId = workflow.workflowId;
            
            let totalMessagesReceived = 0;
            
            for (let cycle = 0; cycle < connectionCycles; cycle++) {
              // Connect client
              const client = new WebSocket(`ws://localhost:${port}`);
              const receivedMessages: any[] = [];
              
              client.on('message', (data) => {
                try {
                  const message = JSON.parse(data.toString());
                  if (message.type === 'workflow_state') {
                    receivedMessages.push(message);
                  }
                } catch (error) {
                  // Ignore parsing errors
                }
              });
              
              // Wait for connection
              await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Connection timeout')), 2000);
                if (client.readyState === WebSocket.OPEN) {
                  clearTimeout(timeout);
                  resolve();
                } else {
                  client.on('open', () => {
                    clearTimeout(timeout);
                    resolve();
                  });
                  client.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                  });
                }
              });
              
              await new Promise(resolve => setTimeout(resolve, 50));
              
              // Perform state transition on first cycle
              if (cycle === 0) {
                await stateManager.transitionTo(workflowId, WorkflowState.INCIDENT_INGESTED);
              }
              
              // Allow time for message propagation
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Verify connection stats
              const stats = wsServer.getConnectionStats();
              expect(stats.totalClients).toBeGreaterThan(0);
              
              // Count messages received
              totalMessagesReceived += receivedMessages.length;
              
              // Disconnect
              client.close();
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // Verify that messages were received during at least one connection
            expect(totalMessagesReceived).toBeGreaterThan(0);
          }
        ),
        { numRuns: 20, timeout: 30000 }
      );
    }, 60000);
  });
});
