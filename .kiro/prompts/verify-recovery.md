# verify-recovery

## Purpose
Verify whether the proposed remediation logically resolves the incident.

## Orchestrator Instruction
Evaluate expected recovery signals against the remediation proposal.
Do not assume success.

## Inputs
- Remediation plan
- Expected recovery signals

## Steps
1. Compare expected outcomes against available signals
2. Identify discrepancies or gaps
3. Determine recovery status conservatively
4. Identify remaining or residual risks

## Output (JSON)
```json
{
  "status": "SUCCESS | PARTIAL | FAILED",
  "evidence": [],
  "residual_risk": ""
}
```

## Constraints
- Do not assume success
- Prefer conservative assessment
- Do not infer unobserved outcomes
