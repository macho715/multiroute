# Setup

## 1. Copy
이 pack을 대상 repo 루트에 병합한다.

## 2. Replace placeholders
- `CODEOWNERS` 팀 슬러그
- `config/mcp-governance.yaml`의 MCP server 예시명
- `config/cloud-agent.yaml`의 automation ownership

## 3. Discover real repo commands
```bash
python tools/discover_repo_commands.py
```

## 4. Validate pack
```bash
python tools/validate_pack.py
python tools/verify_ssot_alignment.py
```

## 5. Optional bootstrap
```bash
python tools/init_settings.py --apply-precommit --dry-run
```

## 6. GitHub enablement
- branch protection
- required reviewers
- dependency review
- code scanning
- pre-commit at local dev entrypoint
