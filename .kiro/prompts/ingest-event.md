# ingest-event

## Purpose
Normalize an incoming operational event into a consistent, validated incident context.

## Orchestrator Instruction
Execute incident ingestion and normalization.
Do not infer root cause or propose remediation.

## Inputs
- Raw incident description
- Logs (text or JSON)
- Metrics (optional)
- Recent changes (optional)

## Steps
1. Validate required input fields
2. Parse and normalize timestamps, services, and environments
3. Identify available and missing signals
4. Explicitly flag assumptions and incomplete data

## Output (JSON)
```json
{
  "incident_id": "",
  "affected_services": [],
  "time_window": "",
  "signals_present": [],
  "signals_missing": [],
  "assumptions": []
}
```

## Constraints
- Do not infer root cause
- Do not propose remediation
- Do not synthesize conclusions beyond provided data
