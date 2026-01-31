# propose-remediation

## Purpose
Propose safe, reversible remediation steps after governance approval.

## Orchestrator Instruction
Generate a remediation proposal only if governance approval is granted.
Do not execute any actions.

## Inputs
- Governance decision
- Root cause analysis

## Steps
1. Generate minimal corrective actions addressing the root cause
2. Ensure all actions are reversible
3. Limit scope strictly to affected components
4. Define explicit rollback steps
5. Identify expected outcomes and residual risk

## Output (YAML)
```yaml
remediation_plan:
  steps:
    - action: ""
      scope: ""
      reversible: true
expected_outcome: ""
rollback:
  steps:
    - action: ""
residual_risk: ""
```

## Constraints
- Do not execute actions
- Do not expand blast radius
- Do not introduce new dependencies
