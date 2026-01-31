# run-rca

## Purpose
Identify the most likely root cause based on correlated analysis signals.

## Orchestrator Instruction
Synthesize specialist analysis outputs into a root cause assessment.
Do not propose remediation.

## Inputs
- Specialist analysis outputs (SRE, Security, Governance)

## Steps
1. Correlate signals by timestamp and affected service
2. Separate symptoms from underlying causes
3. Identify the primary root cause
4. Identify contributing factors
5. Assign a confidence score
6. List unresolved questions and data gaps

## Output (JSON)
```json
{
  "root_cause": "",
  "supporting_evidence": [],
  "contributing_factors": [],
  "confidence": 0,
  "open_questions": []
}
```

## Constraints
- Do not guess missing data
- Explicitly mark uncertainty
- Do not propose remediation or actions
