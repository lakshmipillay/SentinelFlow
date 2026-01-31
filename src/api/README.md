# SentinelFlow Structured API

This directory contains the complete structured REST API implementation for SentinelFlow, providing comprehensive access to workflow management, agent outputs, governance decisions, audit trails, and historical data.

## Architecture Overview

The API follows SentinelFlow's core architectural principles:

- **Deterministic Outputs**: All responses use structured JSON format with consistent schemas
- **Governance-First**: Governance gates are enforced at the API level
- **Audit as First-Class**: Complete audit trail generation and access
- **Separation of Concerns**: Clear separation between workflow, governance, and audit operations
- **No External Side Effects**: All operations are safe and reversible

## API Structure

```
src/api/
├── index.ts              # Main API router and endpoint documentation
├── types.ts              # Standardized request/response types
├── middleware.ts         # Validation, error handling, and CORS
├── routes/
│   ├── workflows.ts      # Workflow management endpoints
│   ├── agent-outputs.ts  # Agent output tracking endpoints
│   ├── governance.ts     # Governance decision endpoints
│   ├── audit.ts          # Audit trail and artifact endpoints
│   └── historical.ts     # Historical data and analytics endpoints
└── __tests__/
    ├── api.integration.test.ts  # Comprehensive integration tests
    └── middleware.test.ts       # Middleware unit tests
```

## Endpoint Categories

### 1. System Endpoints
- `GET /api/health` - System health check
- `GET /api/version` - API version and feature information

### 2. Workflow Management
- `GET /api/workflows` - List all workflows
- `POST /api/workflows` - Create new workflow
- `GET /api/workflows/:id` - Get specific workflow
- `GET /api/workflows/:id/state` - Get current workflow state
- `PUT /api/workflows/:id/state` - Transition workflow state
- `POST /api/workflows/:id/terminate` - Terminate workflow

### 3. Agent Output Management
- `GET /api/workflows/:id/agent-outputs` - Get all agent outputs
- `GET /api/workflows/:id/agent-outputs/:agentName` - Get outputs by agent
- `POST /api/workflows/:id/agent-outputs` - Add agent output
- `GET /api/workflows/:id/analysis-summary` - Get analysis summary
- `GET /api/workflows/:id/correlate-outputs` - Get output correlations
- `GET /api/workflows/:id/parallel-analysis-status` - Check analysis status

### 4. Governance Management
- `POST /api/workflows/:id/governance-decision` - Submit governance decision
- `GET /api/workflows/:id/governance-decision` - Get governance decision
- `GET /api/workflows/:id/governance-status` - Check governance status
- `GET /api/governance/requests/:id` - Get governance request details
- `GET /api/governance/requests/:id/approval-interface` - Get approval interface
- `POST /api/governance/requests/:id/decision` - Submit decision by request ID
- `GET /api/governance/requests/pending` - Get pending requests
- `GET /api/governance/stats` - Get governance statistics

### 5. Audit Management
- `GET /api/workflows/:id/audit-trail` - Get complete audit trail
- `GET /api/workflows/:id/audit-chain` - Get audit chain with integrity
- `GET /api/workflows/:id/audit-metrics` - Get audit metrics
- `POST /api/workflows/:id/export-audit` - Export audit artifacts
- `GET /api/workflows/:id/audit-summary` - Get audit summary

### 6. Historical Data Access
- `GET /api/historical/workflows` - Get historical workflows with filtering
- `GET /api/historical/workflows/stats` - Get workflow statistics
- `GET /api/historical/workflows/:id/timeline` - Get detailed timeline
- `GET /api/historical/analytics/trends` - Get workflow trends and analytics

## Response Format

All API responses follow a consistent structure:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "v1.0.0"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional additional details
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "v1.0.0"
}
```

## Error Codes

The API uses standardized error codes:

- `INVALID_REQUEST` - Malformed request
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `VALIDATION_ERROR` - Request validation failed
- `WORKFLOW_NOT_FOUND` - Workflow not found
- `INVALID_STATE_TRANSITION` - Invalid workflow state transition
- `GOVERNANCE_DECISION_REQUIRED` - Governance decision required
- `AUDIT_TRAIL_NOT_FOUND` - Audit trail not found
- `INTERNAL_ERROR` - Internal server error

## Validation and Security

### Request Validation
- UUID format validation for workflow and request IDs
- Required field validation for all endpoints
- Governance decision validation (decision type, rationale length, approver info)
- State transition validation

### Security Features
- CORS middleware for cross-origin requests
- Request logging for audit purposes
- Input sanitization and validation
- No external side effects or infrastructure mutations

## Integration with SentinelFlow Services

The API integrates with core SentinelFlow services:

- **WorkflowStateManager**: Workflow lifecycle and state management
- **GovernanceGateService**: Governance decision processing
- **AuditArtifactService**: Comprehensive audit trail generation
- **OrchestratorService**: Workflow coordination and agent management

## Usage Examples

### Create and Manage Workflow
```bash
# Create new workflow
curl -X POST http://localhost:3001/api/workflows

# Get workflow details
curl http://localhost:3001/api/workflows/{workflowId}

# Transition workflow state
curl -X PUT http://localhost:3001/api/workflows/{workflowId}/state \
  -H "Content-Type: application/json" \
  -d '{"newState": "ANALYZING"}'
```

### Submit Governance Decision
```bash
curl -X POST http://localhost:3001/api/governance/requests/{requestId}/decision \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approve",
    "rationale": "Risk is acceptable and action is reversible",
    "approver": {
      "id": "senior-sre-001",
      "role": "senior-sre"
    }
  }'
```

### Export Audit Artifacts
```bash
curl -X POST http://localhost:3001/api/workflows/{workflowId}/export-audit \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "includeContext": true
  }'
```

## Testing

The API includes comprehensive tests:

- **Integration Tests**: Full API workflow testing with real services
- **Middleware Tests**: Validation, error handling, and CORS testing
- **Error Handling Tests**: Comprehensive error scenario coverage

Run tests:
```bash
npm test src/api/__tests__/
```

## Compliance and Governance

The API maintains SentinelFlow's governance-first approach:

- All governance decisions are validated and audited
- Workflow state transitions respect governance gates
- Complete audit trails are generated for all operations
- No operations can bypass governance approval
- All actions are reversible and documented

## Performance Considerations

- Efficient filtering and pagination for historical data
- Structured responses minimize payload size
- Audit chain integrity verification is optimized
- In-memory caching for frequently accessed data (MVP)

## Future Extensions

The API architecture supports future enhancements:

- Database persistence layer
- Real-time WebSocket notifications
- Advanced analytics and reporting
- Multi-tenant support
- External system integrations

## Architecture Compliance

This API implementation strictly adheres to SentinelFlow's architectural principles:

- **Orchestration Over Autonomy**: API coordinates but doesn't make autonomous decisions
- **Governance Before Action**: All state changes respect governance gates
- **Deterministic Outputs**: All responses are structured and predictable
- **Audit as First-Class**: Complete audit trail generation and access
- **Separation of Concerns**: Clear boundaries between workflow, governance, and audit operations

The API serves as the primary interface for external systems while maintaining SentinelFlow's safety guarantees and governance requirements.