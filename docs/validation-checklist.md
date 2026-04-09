# Validation Checklist

## Pack Integrity
- [ ] required root files exist
- [ ] `.cursor/rules/` exists
- [ ] `.cursor/skills/` exists
- [ ] `.cursor/agents/` exists
- [ ] `.github/workflows/` exists
- [ ] `prompts/` exists
- [ ] `config/` exists
- [ ] `docs/` exists

## Domain Consistency
- [ ] status enum is canonical
- [ ] route codes are canonical
- [ ] role model is canonical
- [ ] approval/execution separation is preserved
- [ ] `evidence_ref` is required

## GitHub / Review
- [ ] `CODEOWNERS` placeholder replaced
- [ ] branch protection configured
- [ ] dependency review enabled
- [ ] code scanning enabled

## Local Validation
- [ ] `python tools/validate_pack.py`
- [ ] `python tools/verify_ssot_alignment.py`
- [ ] `python tools/discover_repo_commands.py`
- [ ] `pre-commit run --all-files`
