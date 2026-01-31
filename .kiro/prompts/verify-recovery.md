# verify-recovery

## Purpose
Verify whether the proposed remediation logically resolves the incident.

## Orchestrator Instruction
Evaluate expected recovery signals against the remediation proposal.
Do not assume success.

## Inputs
- Remediation plan
- Expected recovery signals
- Post-remediation metrics (simulated)

## Example Input
```json
{
  "remediation_plan": {
    "id": "REM-2024-0115-001",
    "summary": "Rollback user-service to v2.3.0",
    "expected_outcome": {
      "primary": "Database connection pool utilization returns to normal (<20%)"
    }
  },
  "post_remediation_signals": {
    "db_pool_utilization": "15%",
    "error_rate": "0.08%",
    "latency_p99": "145ms",
    "service_health": "healthy",
    "active_connections": 15,
    "available_connections": 85
  },
  "baseline_metrics": {
    "db_pool_utilization": "10%",
    "error_rate": "0.1%",
    "latency_p99": "150ms"
  }
}
```

## Steps
1. Compare expected outcomes against available signals
2. Identify discrepancies or gaps
3. Determine recovery status conservatively
4. Identify remaining or residual risks

## Example Output (JSON)
```json
{
  "verification_id": "VER-2024-0115-001",
  "remediation_id": "REM-2024-0115-001",
  "incident_id": "INC-2024-0115-001",
  "timestamp": "2024-01-15T15:00:00Z",
  
  "status": "SUCCESS",
  
  "outcome_verification": {
    "primary_outcome": {
      "expected": "Database connection pool utilization < 20%",
      "actual": "15%",
      "status": "met",
      "confidence": 0.95
    },
    "secondary_outcomes": [
      {
        "expected": "Error rate < 0.1%",
        "actual": "0.08%",
        "status": "met",
        "confidence": 0.98
      },
      {
        "expected": "Latency p99 < 200ms",
        "actual": "145ms",
        "status": "met",
        "confidence": 0.97
      },
      {
        "expected": "User authentication succeeds",
        "actual": "Authentication success rate 99.9%",
        "status": "met",
        "confidence": 0.99
      }
    ]
  },
  
  "evidence": [
    {
      "source": "Prometheus",
      "metric": "db_pool_utilization",
      "value": "15%",
      "timestamp": "2024-01-15T14:58:00Z",
      "trend": "stable"
    },
    {
      "source": "Datadog",
      "metric": "http_error_rate",
      "value": "0.08%",
      "timestamp": "2024-01-15T14:58:00Z",
      "trend": "decreasing"
    },
    {
      "source": "CloudWatch",
      "metric": "request_latency_p99",
      "value": "145ms",
      "timestamp": "2024-01-15T14:58:00Z",
      "trend": "stable"
    }
  ],
  
  "comparison_to_baseline": {
    "db_pool_utilization": {
      "baseline": "10%",
      "current": "15%",
      "delta": "+5%",
      "assessment": "Within acceptable range"
    },
    "error_rate": {
      "baseline": "0.1%",
      "current": "0.08%",
      "delta": "-0.02%",
      "assessment": "Better than baseline"
    },
    "latency_p99": {
      "baseline": "150ms",
      "current": "145ms",
      "delta": "-5ms",
      "assessment": "Better than baseline"
    }
  },
  
  "residual_risk": [
    {
      "risk": "Root cause code still exists in v2.3.1",
      "severity": "medium",
      "mitigation": "Bug fix required before re-deployment",
      "owner": "Engineering team"
    },
    {
      "risk": "Similar patterns may exist in other services",
      "severity": "low",
      "mitigation": "Code review of related services recommended",
      "owner": "Platform team"
    }
  ],
  
  "monitoring_recommendations": [
    {
      "metric": "db_pool_utilization",
      "threshold": "> 50%",
      "action": "Alert on-call SRE",
      "duration": "24 hours"
    },
    {
      "metric": "error_rate",
      "threshold": "> 1%",
      "action": "Page incident commander",
      "duration": "24 hours"
    }
  ],
  
  "follow_up_actions": [
    {
      "action": "Create bug ticket for connection leak fix",
      "priority": "high",
      "owner": "Engineering",
      "due": "2024-01-16"
    },
    {
      "action": "Schedule post-incident review",
      "priority": "medium",
      "owner": "SRE",
      "due": "2024-01-17"
    },
    {
      "action": "Add connection pool monitoring alert",
      "priority": "medium",
      "owner": "Platform",
      "due": "2024-01-18"
    }
  ],
  
  "incident_resolution": {
    "resolved": true,
    "resolution_time": "28 minutes",
    "resolution_method": "Rollback to previous version",
    "customer_impact_duration": "28 minutes"
  }
}
```

## Status Definitions

| Status | Criteria |
|--------|----------|
| SUCCESS | All primary and secondary outcomes met |
| PARTIAL | Primary outcome met, some secondary outcomes not met |
| FAILED | Primary outcome not met |

## Constraints
- Do not assume success
- Prefer conservative assessment
- Do not infer unobserved outcomes
- All claims must be backed by evidence
- Residual risks must be documented
