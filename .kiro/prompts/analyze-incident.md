# analyze-incident

## Purpose
Perform parallel specialist analysis of a normalized operational incident.

## Orchestrator Instruction
Invoke specialist analysis agents in parallel.
Enforce read-only analysis and prevent cross-agent influence.

## Inputs
- Normalized incident context (from ingest-event)

## Agents
- `sre-agent` → availability, latency, error analysis
- `security-agent` → authentication, access, anomaly analysis
- `governance-agent` → policy impact and blast radius analysis (analysis-only)

## Steps
1. Dispatch scoped incident context to each specialist agent
2. Enforce analysis-only, read-only execution
3. Collect structured outputs independently
4. Validate completeness and confidence of each response

## Example Input
```json
{
  "incident_id": "INC-2024-0115-001",
  "affected_services": ["user-service", "postgres-primary"],
  "signals_present": ["error_rate_spike", "database_connection_errors"],
  "recent_changes": [{"type": "deployment", "service": "user-service", "version": "v2.3.1"}]
}
```

## Example Output (JSON)
```json
{
  "sre_findings": {
    "agent": "sre-agent",
    "skills_used": ["Datadog", "CloudWatch", "Prometheus"],
    "analysis": {
      "primary_symptom": "Database connection pool exhaustion",
      "error_pattern": "Connection refused errors correlate with deployment timestamp",
      "metrics_analysis": {
        "error_rate": "45% (baseline 0.1%)",
        "latency_p99": "30000ms (baseline 150ms)",
        "connection_pool_utilization": "100%"
      },
      "timeline": [
        {"time": "12:32:00Z", "event": "user-service v2.3.1 deployed"},
        {"time": "14:31:45Z", "event": "First connection refused error"},
        {"time": "14:31:46Z", "event": "Connection pool exhausted"}
      ]
    },
    "evidence": [
      "Connection pool hit 100% utilization 2 hours post-deploy",
      "No database server resource exhaustion detected",
      "New deployment may have connection leak"
    ],
    "confidence": 0.85
  },
  "security_findings": {
    "agent": "security-agent",
    "skills_used": ["Splunk SIEM", "IAM Logs", "CSPM"],
    "analysis": {
      "threat_assessment": "No security threat detected",
      "access_patterns": "Normal authentication patterns prior to outage",
      "anomaly_detection": "No suspicious activity in IAM logs"
    },
    "evidence": [
      "No unauthorized access attempts detected",
      "Authentication failures are downstream of database issue",
      "No credential exposure in error logs"
    ],
    "confidence": 0.92
  },
  "governance_findings": {
    "agent": "governance-agent",
    "skills_used": ["Policy Engine", "Change Management", "Risk Register"],
    "analysis": {
      "change_compliance": "Deployment followed standard change process",
      "blast_radius": {
        "directly_affected": ["user-service"],
        "indirectly_affected": ["order-service", "notification-service"],
        "total_services": 3
      },
      "policy_status": "Within acceptable risk parameters"
    },
    "evidence": [
      "Change ticket CT-2024-0892 approved for deployment",
      "Rollback procedure documented",
      "No compliance violations detected"
    ],
    "confidence": 0.88
  },
  "confidence": {
    "sre": 0.85,
    "security": 0.92,
    "governance": 0.88,
    "overall": 0.88
  }
}
```

## Constraints
- Specialist agents must not propose remediation
- No cross-agent communication or shared state
- No synthesis or decision-making at this stage
- Each agent operates on scoped context only
