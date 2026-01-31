# propose-remediation

## Purpose
Propose safe, reversible remediation steps after governance approval.

## Orchestrator Instruction
Generate a remediation proposal only if governance approval is granted.
Do not execute any actions.

## Inputs
- Governance decision (must be APPROVED or APPROVED_WITH_RESTRICTIONS)
- Root cause analysis

## Example Input
```json
{
  "governance_decision": {
    "decision": "APPROVED_WITH_RESTRICTIONS",
    "restrictions": [
      "Notify on-call security team before execution",
      "Monitor error rates for 30 minutes post-rollback"
    ]
  },
  "root_cause": {
    "summary": "Database connection leak in user-service v2.3.1",
    "affected_component": "user-service database connection handler"
  }
}
```

## Steps
1. Generate minimal corrective actions addressing the root cause
2. Ensure all actions are reversible
3. Limit scope strictly to affected components
4. Define explicit rollback steps
5. Identify expected outcomes and residual risk

## Example Output (YAML)
```yaml
remediation_plan:
  id: "REM-2024-0115-001"
  incident_id: "INC-2024-0115-001"
  created_at: "2024-01-15T14:45:00Z"
  status: "proposed"
  
  summary: "Rollback user-service to v2.3.0 to resolve connection pool exhaustion"
  
  pre_execution_checklist:
    - description: "Notify on-call security team"
      required: true
      verification: "Slack message sent to #security-oncall"
    - description: "Verify v2.3.0 artifact available"
      required: true
      verification: "Check artifact registry for user-service:v2.3.0"
    - description: "Confirm rollback window with stakeholders"
      required: false
      verification: "Incident commander approval"

  steps:
    - step_number: 1
      action: "Scale down user-service to 0 replicas"
      scope: "user-service deployment in production namespace"
      command: "kubectl scale deployment user-service --replicas=0 -n production"
      reversible: true
      expected_duration: "30 seconds"
      verification: "kubectl get pods -n production -l app=user-service shows 0 running"
      
    - step_number: 2
      action: "Update deployment image to v2.3.0"
      scope: "user-service deployment configuration"
      command: "kubectl set image deployment/user-service user-service=registry/user-service:v2.3.0 -n production"
      reversible: true
      expected_duration: "10 seconds"
      verification: "kubectl describe deployment user-service shows image v2.3.0"
      
    - step_number: 3
      action: "Scale up user-service to normal replica count"
      scope: "user-service deployment in production namespace"
      command: "kubectl scale deployment user-service --replicas=3 -n production"
      reversible: true
      expected_duration: "2 minutes"
      verification: "kubectl get pods -n production -l app=user-service shows 3/3 running"
      
    - step_number: 4
      action: "Verify database connection pool health"
      scope: "user-service metrics"
      command: "curl -s http://user-service:8080/metrics | grep db_pool"
      reversible: true
      expected_duration: "30 seconds"
      verification: "db_pool_available > 50"

  expected_outcome:
    primary: "Database connection pool utilization returns to normal (<20%)"
    secondary:
      - "Error rate drops to baseline (<0.1%)"
      - "Request latency returns to normal (<200ms p99)"
      - "User authentication succeeds"
    timeline: "Full recovery expected within 5 minutes of execution"

  rollback:
    trigger_conditions:
      - "Error rate increases after rollback"
      - "New errors introduced by v2.3.0"
      - "Service fails to start"
    steps:
      - step_number: 1
        action: "Re-deploy user-service v2.3.1"
        command: "kubectl set image deployment/user-service user-service=registry/user-service:v2.3.1 -n production"
      - step_number: 2
        action: "Scale to normal replicas"
        command: "kubectl scale deployment user-service --replicas=3 -n production"
      - step_number: 3
        action: "Escalate to engineering for code fix"
        command: "Page engineering on-call via PagerDuty"
    estimated_time: "5 minutes"

  residual_risk:
    - risk: "v2.3.0 may have other issues not related to connection leak"
      mitigation: "Monitor all service metrics for 30 minutes"
      likelihood: "low"
    - risk: "Connection leak may exist in other services"
      mitigation: "Review similar code patterns in related services"
      likelihood: "medium"

  post_execution_tasks:
    - "Update incident timeline with remediation completion"
    - "Monitor error rates for 30 minutes"
    - "Schedule post-incident review"
    - "Create bug ticket for v2.3.1 connection leak fix"

  approval_required_from:
    - role: "senior-sre"
      name: "pending"
```

## Constraints
- Do not execute actions
- Do not expand blast radius
- Do not introduce new dependencies
- All steps must be reversible
- Include explicit verification for each step
- Rollback procedure is mandatory
