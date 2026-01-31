# analyze-incident

## Purpose
Perform parallel specialist analysis of a normalized operational incident.

## Orchestrator Instruction
Invoke specialist analysis agents in parallel.
Enforce read-only analysis and prevent cross-agent influence.

## Inputs
- Normalized incident context

## Agents
- `sre-agent` → availability, latency, error analysis
- `security-agent` → authentication, access, anomaly analysis
- `governance-agent` → policy impact and blast radius analysis (analysis-only)

## Steps
1. Dispatch scoped incident context to each specialist agent
2. Enforce analysis-only, read-only execution
3. Collect structured outputs independently
4. Validate completeness and confidence of each response

## Output (JSON)
```json
{
  "sre_findings": {},
  "security_findings": {},
  "governance_findings": {},
  "confidence": {
    "sre": "",
    "security": "",
    "governance": ""
  }
}
```

## Constraints
- Specialist agents must not propose remediation
- No cross-agent communication or shared state
- No synthesis or decision-making at this stage
