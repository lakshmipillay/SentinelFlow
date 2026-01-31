# SentinelFlow Backend

## Overview

The SentinelFlow Backend is a governed agentic workflow engine that implements deterministic state management and real-time communication for safety-critical incident response workflows.

## Architecture

### Core Components

1. **WorkflowStateManager** - Manages deterministic state transitions with validation and persistence
2. **WebSocketServer** - Provides real-time state broadcasting to connected UI clients
3. **SentinelFlowServer** - Main server that integrates workflow management with REST API and WebSocket communication

### Workflow States

The system implements a strict 9-state workflow:

```
IDLE → INCIDENT_INGESTED → ANALYZING → RCA_COMPLETE → GOVERNANCE_PENDING → ACTION_PROPOSED → VERIFIED → RESOLVED → TERMINATED
```

- **Deterministic Transitions**: Only valid state transitions are allowed
- **Governance Gates**: Mandatory human approval at GOVERNANCE_PENDING state
- **Audit Trail**: Complete immutable record of all state changes and decisions
- **Recovery**: Workflow state persistence enables system recovery

## Features Implemented

### ✅ Task 1.1: Workflow State Machine with Deterministic Transitions
- Complete WorkflowState enum with all 9 states
- State transition validation logic prevents invalid transitions
- State persistence for workflow recovery
- Comprehensive audit trail generation

### ✅ Task 1.2: Property-Based Test for Workflow State Machine Determinism
- **Property 1: Workflow State Machine Determinism** - Validates Requirements 1.1, 1.2
- 100+ iterations testing deterministic behavior across all valid state sequences
- Validates invalid transition rejection
- Tests workflow consistency across multiple operations

### ✅ Task 1.3: Real-time State Broadcasting System
- WebSocket/Server-Sent Events for state updates
- Structured state update messages
- Client connection management with automatic cleanup
- Real-time notification of all workflow state changes

## API Endpoints

### Workflow Management
- `POST /api/workflows` - Create new workflow
- `GET /api/workflows/:id` - Get workflow by ID
- `GET /api/workflows` - Get all workflows
- `POST /api/workflows/:id/transition` - Transition workflow state
- `POST /api/workflows/:id/terminate` - Terminate workflow

### System Status
- `GET /health` - Health check
- `GET /api/connections` - WebSocket connection statistics
- `POST /api/workflows/validate-transition` - Validate state transition

## WebSocket Communication

### Client Messages
- `ping` - Heartbeat check
- `subscribe_workflow` - Subscribe to workflow updates
- `get_workflow_state` - Request current workflow state

### Server Messages
- `connection_established` - Connection confirmation
- `workflow_state` - State update broadcast
- `subscription_confirmed` - Subscription acknowledgment
- `pong` - Heartbeat response
- `error` - Error messages

## Installation & Usage

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev

# Run demo
npm run demo

# Build for production
npm run build
npm start
```

## Testing

The backend includes comprehensive testing:

- **Unit Tests**: 15 tests covering workflow creation, state transitions, audit trails, and error handling
- **Integration Tests**: 7 tests covering WebSocket server functionality and real-time communication
- **Property-Based Tests**: 3 properties with 100+ iterations each validating deterministic behavior

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch
```

## Safety & Governance

The backend enforces strict safety constraints:

- **No External Side Effects**: All operations are contained within the system
- **Deterministic Behavior**: State transitions follow strict validation rules
- **Audit Trail**: Complete immutable record of all decisions and state changes
- **Governance Gates**: Mandatory human approval prevents autonomous actions
- **Error Handling**: Graceful handling of invalid operations and edge cases

## Real-time Communication

The WebSocket server provides:

- **Automatic Reconnection**: Client connection management with heartbeat
- **State Broadcasting**: Real-time updates to all connected clients
- **Connection Statistics**: Monitoring of client connections
- **Error Recovery**: Graceful handling of connection failures

## Demo

Run the interactive demo to see the system in action:

```bash
npm run demo
```

The demo will:
1. Start the server on port 3001
2. Create a new workflow
3. Demonstrate all state transitions
4. Show the complete audit trail
5. Display WebSocket server statistics

## Integration Ready

The backend is designed for seamless integration with the SRE Sidekick frontend:

- **Structured API**: RESTful endpoints for all workflow operations
- **Real-time Updates**: WebSocket communication for live UI updates
- **CORS Enabled**: Ready for cross-origin frontend integration
- **Type Safety**: Complete TypeScript interfaces for all data models

## Next Steps

The backend is ready for:
1. Frontend integration with the SRE Sidekick Mission Control UI
2. Agent output integration (SRE, Security, Governance agents)
3. Enhanced governance decision processing
4. Production deployment with database persistence

This implementation provides a solid foundation for the complete SentinelFlow unified architecture.