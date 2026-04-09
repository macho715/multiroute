# Cloud Agent Governance

기본값은 **disabled** 이다.

## Allowed candidate tasks
- nightly pack validation
- documentation drift review
- prompt regression summary
- dependency bump triage

## Not allowed without explicit human gate
- merge
- release
- deployment
- secrets work
- authz/policy change

## Required outputs from any cloud run
- what changed
- commands actually run
- validation result
- residual risk
- rollback notes
