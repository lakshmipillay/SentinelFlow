# ingest-event

## Purpose
Normalize an incoming operational event into a consistent, validated incident context.

## Orchestrator Instruction
Execute incident ingestion and normalization.
Do not infer root cause or propose remediation.

## Inputs
- Raw incident description
- Logs (text or JSON)
- Metrics (optional)
- Recent changes (optional)

## Example Input
```
Alert: High error rate detected on user-service
Time: 2024-01-15T14:32:00Z
Service: user-service
Environment: production
Error Rate: 45% (baseline: 0.1%)
Affected Endpoints: /api/users, /api/auth
Recent Deploy: user-service v2.3.1 deployed 2 hours ago

Logs:
[ERROR] 14:31:45 Connection refused to postgres-primary:5432
[ERROR] 14:31:46 Connection pool exhausted, 0/100 available
[WARN]  14:31:47 Retry attempt 3/3 failed for database connection
[ERROR] 14:31:48 Request timeout after 30000ms on /api/users
```

## Steps
1. Validate required input fields
2. Parse and normalize timestamps, services, and environments
3. Identify available and missing signals
4. Explicitly flag assumptions and incomplete data

## Output (JSON)
```json
{
  "incident_id": "INC-2024-0115-001",
  "affected_services": ["user-service", "postgres-primary"],
  "environment": "production",
  "time_window": {
    "start": "2024-01-15T14:31:45Z",
    "end": "2024-01-15T14:32:00Z"
  },
  "signals_present": [
    "error_rate_spike",
    "database_connection_errors",
    "connection_pool_exhaustion",
    "request_timeouts"
  ],
  "signals_missing": [
    "database_server_metrics",
    "network_latency_data",
    "connection_pool_configuration"
  ],
  "recent_changes": [
    {
      "type": "deployment",
      "service": "user-service",
      "version": "v2.3.1",
      "timestamp": "2024-01-15T12:32:00Z"
    }
  ],
  "assumptions": [
    "Database server is reachable but refusing connections",
    "Connection pool size is 100 based on error message"
  ],
  "severity": "critical",
  "impact": "User authentication and profile operations unavailable"
}
```

## Constraints
- Do not infer root cause
- Do not propose remediation
- Do not synthesize conclusions beyond provided data
- Flag all assumptions explicitly
