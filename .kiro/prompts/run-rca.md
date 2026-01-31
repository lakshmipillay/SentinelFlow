# run-rca

## Purpose
Identify the most likely root cause based on correlated analysis signals.

## Orchestrator Instruction
Synthesize specialist analysis outputs into a root cause assessment.
Do not propose remediation.

## Inputs
- Specialist analysis outputs (SRE, Security, Governance)

## Example Input
```json
{
  "sre_findings": {
    "primary_symptom": "Database connection pool exhaustion",
    "error_pattern": "Connection refused errors correlate with deployment",
    "evidence": ["Connection pool hit 100% utilization 2 hours post-deploy"]
  },
  "security_findings": {
    "threat_assessment": "No security threat detected",
    "evidence": ["No unauthorized access attempts"]
  },
  "governance_findings": {
    "change_compliance": "Deployment followed standard change process",
    "blast_radius": {"directly_affected": ["user-service"]}
  }
}
```

## Steps
1. Correlate signals by timestamp and affected service
2. Separate symptoms from underlying causes
3. Identify the primary root cause
4. Identify contributing factors
5. Assign a confidence score
6. List unresolved questions and data gaps

## Example Output (JSON)
```json
{
  "root_cause": {
    "summary": "Database connection leak introduced in user-service v2.3.1 deployment",
    "category": "code_defect",
    "affected_component": "user-service database connection handler",
    "mechanism": "New code path fails to release database connections on error, causing pool exhaustion over time"
  },
  "supporting_evidence": [
    {
      "source": "sre-agent",
      "finding": "Connection pool utilization grew from 10% to 100% over 2 hours post-deployment",
      "weight": "high"
    },
    {
      "source": "sre-agent", 
      "finding": "No database server resource constraints detected",
      "weight": "medium"
    },
    {
      "source": "governance-agent",
      "finding": "Deployment of v2.3.1 is the only recent change",
      "weight": "high"
    },
    {
      "source": "security-agent",
      "finding": "No external factors or attacks detected",
      "weight": "medium"
    }
  ],
  "contributing_factors": [
    {
      "factor": "Connection pool size (100) may be undersized for traffic volume",
      "impact": "Accelerated time to exhaustion"
    },
    {
      "factor": "No connection pool monitoring alerts configured",
      "impact": "Delayed detection"
    }
  ],
  "correlation_analysis": {
    "timeline_correlation": "Strong - symptoms began exactly 2 hours after deployment",
    "service_correlation": "Strong - only user-service affected initially",
    "pattern_match": "Classic connection leak pattern"
  },
  "confidence": 0.87,
  "confidence_factors": {
    "evidence_quality": "high",
    "signal_correlation": "strong",
    "alternative_explanations_ruled_out": ["security_breach", "infrastructure_failure", "traffic_spike"]
  },
  "open_questions": [
    "Which specific code path in v2.3.1 introduced the leak?",
    "Was this regression tested before deployment?",
    "Are other services using similar connection patterns?"
  ],
  "data_gaps": [
    "Application-level connection tracking metrics not available",
    "Code diff for v2.3.1 not reviewed"
  ]
}
```

## Constraints
- Do not guess missing data
- Explicitly mark uncertainty
- Do not propose remediation or actions
- Confidence score must reflect evidence quality
