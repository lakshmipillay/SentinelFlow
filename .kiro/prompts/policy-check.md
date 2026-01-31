# policy-check

## Purpose
Evaluate whether remediation is allowed under SentinelFlow governance rules.

## Orchestrator Instruction
Apply the governance gate to determine whether remediation may proceed.
Do not propose or execute remediation.

## Inputs
- Root cause analysis
- Normalized incident context

## Steps
1. Evaluate policy and compliance requirements
2. Assess potential blast radius
3. Assess security and operational risk
4. Evaluate reversibility of proposed actions
5. Decide governance outcome

## Output (JSON)
```json
{
  "decision": "APPROVED | APPROVED_WITH_RESTRICTIONS | BLOCKED",
  "rationale": "",
  "restrictions": [],
  "risk_assessment": ""
}
```

## Constraints
- Prefer blocking over unsafe approval
- No remediation proposal or execution
- Explicitly document uncertainty and risk
