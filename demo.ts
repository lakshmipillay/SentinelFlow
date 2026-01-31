/**
 * SentinelFlow Backend Demo
 * Demonstrates enhanced orchestrator agent coordination with parallel execution
 * Showcases role separation and structured agent output correlation
 */

import { SentinelFlowServer } from './src/server';
import { WorkflowState } from './src/types/workflow';

async function runDemo() {
  console.log('🚀 Starting SentinelFlow Enhanced Orchestrator Demo...\n');
  
  const server = new SentinelFlowServer(3001);
  await server.start();
  
  const stateManager = server.getStateManager();
  const orchestratorService = server.getOrchestratorService();
  
  console.log('📋 Creating a new workflow...');
  const workflow = stateManager.createWorkflow();
  console.log(`✅ Workflow created: ${workflow.workflowId}`);
  console.log(`📊 Initial state: ${workflow.currentState}\n`);
  
  console.log('🔄 Transitioning to ANALYZING state...');
  await stateManager.transitionTo(workflow.workflowId, WorkflowState.INCIDENT_INGESTED);
  console.log(`✅ State: ${stateManager.getCurrentState(workflow.workflowId)}`);
  
  await stateManager.transitionTo(workflow.workflowId, WorkflowState.ANALYZING);
  console.log(`✅ State: ${stateManager.getCurrentState(workflow.workflowId)}\n`);
  
  console.log('🎯 Demonstrating Enhanced Orchestrator Coordination...\n');
  
  // Demonstrate orchestrator role separation
  console.log('🤖 Orchestrator Role: Coordinate agents without domain analysis');
  const incidentContext = {
    incidentId: 'demo-incident-001',
    description: 'Database connection pool exhaustion during peak traffic',
    severity: 'high' as const,
    affectedServices: ['user-service', 'database', 'api-gateway', 'cache-layer'],
    timestamp: new Date().toISOString(),
    source: 'monitoring-system',
    alertData: {
      metric: 'connection_pool_utilization',
      value: 98.5,
      threshold: 85.0,
      duration: '5m'
    }
  };
  
  console.log('📡 Coordinating parallel agent analysis...');
  const session = await orchestratorService.coordinateParallelAnalysis(workflow.workflowId, incidentContext);
  
  console.log(`✅ Analysis session created: ${session.sessionId}`);
  console.log(`📊 Session status: ${session.status}`);
  console.log(`🔧 Agent tasks created: ${session.agentTasks.length}`);
  
  // Show orchestrator task structure (coordination without domain analysis)
  console.log('\n🏗️  Orchestrator Task Structure (Role Separation):');
  session.agentTasks.forEach((task, index) => {
    console.log(`   ${index + 1}. ${task.agentName}:`);
    console.log(`      Focus: ${task.context.focus}`);
    console.log(`      Expected Skills: ${task.expectedSkills.join(', ')}`);
    console.log(`      Status: ${task.status}`);
  });
  
  console.log('\n⚡ Simulating Parallel Agent Execution...');
  console.log('   (Orchestrator coordinates timing, agents perform analysis)');
  
  const startTime = Date.now();
  const simulationResult = await orchestratorService.simulateParallelAgentExecution(
    workflow.workflowId, 
    'database-issue'
  );
  const endTime = Date.now();
  
  console.log(`✅ Parallel execution completed in ${endTime - startTime}ms`);
  console.log(`🔄 Agent completion order: ${simulationResult.completionOrder.join(' → ')}`);
  console.log(`📊 Agent outputs generated: ${simulationResult.simulatedOutputs.length}`);
  
  // Show agent output validation
  console.log('\n🔍 Agent Output Validation:');
  simulationResult.simulatedOutputs.forEach((output, index) => {
    console.log(`   ${index + 1}. ${output.agentName}:`);
    console.log(`      Skills Used: ${output.skillsUsed.join(', ')}`);
    console.log(`      Confidence: ${(output.confidenceLevel * 100).toFixed(1)}%`);
    console.log(`      Skills Valid: ${output.validation.skillsValid ? '✅' : '❌'}`);
    console.log(`      Schema Compliant: ${output.validation.schemaCompliant ? '✅' : '❌'}`);
  });
  
  // Demonstrate orchestrator correlation (structure without interpretation)
  console.log('\n🔗 Orchestrator Output Correlation (Structural Only):');
  const correlation = stateManager.correlateAgentOutputs(workflow.workflowId);
  
  console.log(`   Correlation ID: ${correlation.correlationId}`);
  console.log(`   Agents Completed: ${correlation.agentOutputSummary.completedAgents.join(', ')}`);
  console.log(`   Average Confidence: ${(correlation.agentOutputSummary.averageConfidence * 100).toFixed(1)}%`);
  console.log(`   Skills Utilization: ${(correlation.structuredCorrelations.skillsUtilization.utilizationRate * 100).toFixed(1)}%`);
  console.log(`   Cross-Agent Findings: ${correlation.structuredCorrelations.crossAgentFindings.length}`);
  console.log(`   Ready for RCA: ${correlation.readyForRCA ? '✅' : '❌'}`);
  
  // Show cross-agent findings (structural correlation only)
  if (correlation.structuredCorrelations.crossAgentFindings.length > 0) {
    console.log('\n🔍 Cross-Agent Findings (Structural Correlation):');
    correlation.structuredCorrelations.crossAgentFindings.forEach((finding, index) => {
      console.log(`   ${index + 1}. "${finding.finding}"`);
      console.log(`      Reported by: ${finding.reportedBy.join(', ')}`);
      console.log(`      Confidence range: ${(finding.confidenceRange.min * 100).toFixed(1)}% - ${(finding.confidenceRange.max * 100).toFixed(1)}%`);
    });
  }
  
  // Demonstrate RCA transition coordination
  console.log('\n🎯 RCA Transition Coordination:');
  const rcaReadiness = await orchestratorService.coordinateRCATransition(workflow.workflowId);
  
  console.log(`   Can Transition: ${rcaReadiness.canTransition ? '✅' : '❌'}`);
  if (rcaReadiness.blockers.length > 0) {
    console.log(`   Blockers: ${rcaReadiness.blockers.join(', ')}`);
  } else {
    console.log('   No blockers - ready for RCA phase');
  }
  
  // Transition to RCA_COMPLETE if ready
  if (rcaReadiness.canTransition) {
    console.log('\n⏭️  Transitioning to RCA_COMPLETE...');
    await stateManager.transitionTo(workflow.workflowId, WorkflowState.RCA_COMPLETE);
    console.log(`✅ State: ${stateManager.getCurrentState(workflow.workflowId)}`);
  }
  
  // Show final workflow summary
  const finalWorkflow = stateManager.getWorkflow(workflow.workflowId);
  console.log('\n📋 Final Workflow Summary:');
  console.log(`   Workflow ID: ${finalWorkflow?.workflowId}`);
  console.log(`   Final State: ${finalWorkflow?.currentState}`);
  console.log(`   Agent Outputs: ${finalWorkflow?.agentOutputs.length}`);
  console.log(`   Audit Events: ${finalWorkflow?.auditTrail.length}`);
  
  // Show analysis summary
  const analysisSummary = stateManager.getAnalysisSummary(workflow.workflowId);
  console.log('\n📊 Analysis Summary:');
  console.log(`   Total Outputs: ${analysisSummary.totalOutputs}`);
  console.log(`   Agent Breakdown: ${JSON.stringify(analysisSummary.agentBreakdown)}`);
  console.log(`   Average Confidence: ${(analysisSummary.averageConfidence * 100).toFixed(1)}%`);
  console.log(`   Skills Used: ${analysisSummary.skillsUsed.join(', ')}`);
  console.log(`   All Valid: ${analysisSummary.validationStatus.allValid ? '✅' : '❌'}`);
  
  // Show coordination session info
  const finalSession = orchestratorService.getSessionByWorkflow(workflow.workflowId);
  console.log('\n🎯 Coordination Session Summary:');
  console.log(`   Session ID: ${finalSession?.sessionId}`);
  console.log(`   Status: ${finalSession?.status}`);
  console.log(`   Duration: ${finalSession?.completedAt ? 
    new Date(finalSession.completedAt).getTime() - new Date(finalSession.startedAt).getTime() : 'In Progress'}ms`);
  
  console.log('\n🌐 WebSocket Server Statistics:');
  const wsStats = server.getWebSocketServer().getConnectionStats();
  console.log(`   Total Clients: ${wsStats.totalClients}`);
  console.log(`   Connected Clients: ${wsStats.connectedClients}`);
  
  console.log('\n✨ Enhanced Orchestrator Demo completed!');
  console.log('🎯 Key Demonstrations:');
  console.log('   ✅ Role Separation: Orchestrator coordinates without domain analysis');
  console.log('   ✅ Parallel Execution: Multiple agents analyzed simultaneously');
  console.log('   ✅ Output Correlation: Structured correlation without interpretation');
  console.log('   ✅ State Management: Deterministic workflow progression');
  console.log('   ✅ Validation: Agent skills and output validation');
  console.log('   ✅ Real-time Updates: WebSocket broadcasting of state changes');
  
  console.log('\n🔗 API endpoints available at: http://localhost:3001/api/');
  console.log('🔌 WebSocket server ready at: ws://localhost:3001');
  console.log('\nPress Ctrl+C to stop the server.');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down enhanced orchestrator demo...');
  process.exit(0);
});

if (require.main === module) {
  runDemo().catch(console.error);
}