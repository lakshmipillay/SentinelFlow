# policy-check

## Purpose
Evaluate whether remediation is allowed under SentinelFlow governance rules.

## Orchestrator Instruction
Apply the governance gate to determine whether remediation may proceed.
Do not propose or execute remediation.

## Inputs
- Root cause analysis
- Normalized incident context

## Example Input
```json
{
  "root_cause": {
    "summary": "Database connection leak in user-service v2.3.1",
    "category": "code_defect",
    "confidence": 0.87
  },
  "incident_context": {
    "severity": "critical",
    "affected_services": ["user-service", "postgres-primary"],
    "environment": "production"
  }
}
```

## Steps
1. Evaluate policy and compliance requirements
2. Assess potential blast radius
3. Assess security and operational risk
4. Evaluate reversibility of proposed actions
5. Decide governance outcome

## Example Output (JSON)
```json
{
  "decision": "APPROVED_WITH_RESTRICTIONS",
  "rationale": "Rollback to v2.3.0 is approved given high confidence in root cause and critical severity. Restrictions applied due to production environment and business hours.",
  "policy_evaluation": {
    "change_management": {
      "status": "compliant",
      "notes": "Emergency change process applies for critical incidents"
    },
    "approval_authority": {
      "required_level": "senior-sre",
      "reason": "Production database-affecting change"
    },
    "compliance_check": {
      "soc2": "no_impact",
      "pci": "no_impact",
      "gdpr": "no_impact"
    }
  },
  "blast_radius_assessment": {
    "directly_affected_services": ["user-service"],
    "indirectly_affected_services": ["order-service", "notification-service", "mobile-app"],
    "estimated_user_impact": "All authenticated users (~50,000 active)",
    "data_risk": "none - read-only rollback",
    "risk_level": "medium"
  },
  "risk_assessment": {
    "operational_risk": "low - rollback is standard procedure",
    "security_risk": "none - no credential or access changes",
    "data_integrity_risk": "none - no data mutations",
    "availability_risk": "low - brief service restart expected"
  },
  "reversibility_check": {
    "is_reversible": true,
    "rollback_procedure": "Re-deploy v2.3.1 if rollback causes issues",
    "rollback_time_estimate": "5 minutes",
    "rollback_risk": "low"
  },
  "restrictions": [
    "Notify on-call security team before execution",
    "Monitor error rates for 30 minutes post-rollback",
    "Prepare v2.3.0 rollback verification checklist",
    "Document decision in incident timeline"
  ],
  "required_approvers": [
    {
      "role": "senior-sre",
      "reason": "Production change authority"
    }
  ],
  "expiration": "2024-01-15T16:00:00Z",
  "audit_notes": "Approval granted under emergency change process. Full post-incident review required within 48 hours."
}
```

## Decision Matrix

| Condition | Decision |
|-----------|----------|
| High confidence + reversible + low blast radius | APPROVED |
| High confidence + reversible + medium blast radius | APPROVED_WITH_RESTRICTIONS |
| Low confidence OR irreversible OR high blast radius | BLOCKED |
| Security implications detected | BLOCKED (escalate to security) |
| Compliance violation possible | BLOCKED (escalate to compliance) |

## Constraints
- Prefer blocking over unsafe approval
- No remediation proposal or execution
- Explicitly document uncertainty and risk
- All decisions must include rationale
- Restrictions must be actionable and verifiable
