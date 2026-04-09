# Cursor Full Pack — Route Optimization Engine

이 저장소는 **Multi-Route Optimization + Cost vs Transit Tradeoff Engine**용 Cursor/GitHub 운영 세팅 풀옵션 pack이다.

이 pack의 목적은 제품 기능 코드를 직접 구현하는 것이 아니라, 아래 항목을 **repo-ready** 상태로 고정하는 것이다.

- Cursor Rules / Commands / Skills / Subagents / Hooks
- GitHub Copilot instructions / workflows / review harness
- Prompt regression harness
- MCP / Cloud Agent / automation governance
- SSOT 문서 정리
- 검증 스크립트 및 bootstrap 절차

## 적용 범위

- 대상 도메인: 해상 멀티라우트 최적화 + 승인형 운영 Workbench
- 고정 상태값: `OK`, `REVIEW`, `AMBER`, `BLOCKED`, `ZERO`
- MVP route code: `SEA_DIRECT`, `SEA_TRANSSHIP`, `SEA_LAND`
- 핵심 원칙: `Dry-run -> Approval -> Execution Eligible` 분리

## 바로 적용 순서

1. 이 pack을 기존 repo 루트에 병합한다.
2. `docs/assumptions-and-zero.md`를 먼저 읽고 placeholder와 미확정 항목을 처리한다.
3. `python tools/discover_repo_commands.py`로 실제 repo 명령을 추출한다.
4. `python tools/validate_pack.py`로 pack 무결성을 점검한다.
5. 필요하면 `python tools/init_settings.py --apply-precommit --dry-run`으로 bootstrap 절차를 확인한다.
6. `CODEOWNERS`의 placeholder 팀 슬러그를 실제 값으로 교체한다.
7. GitHub에서 required reviewers / dependency review / code scanning 정책을 활성화한다.

## 설치 예시

```bash
python -m venv .venv
. .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .[dev]
python tools/discover_repo_commands.py
python tools/validate_pack.py
pre-commit install
pre-commit run --all-files
```

## 문서 우선순위

1. `plan.md`
2. `AGENTS.md`
3. `docs/route-contract-summary.md`
4. `docs/workbench-layout-summary.md`
5. `docs/assumptions-and-zero.md`

## 주의

- 이 pack은 **실제 제품 명령어를 가정하지 않는다.**
- `npm`, `pnpm`, `pytest`, `docker`, 배포 명령은 repo evidence 확인 전까지 확정하지 않는다.
- secrets, PII, private URL, carrier rate, 내부 계정 정보는 포함하지 않는다.
- approval과 execution CTA를 같은 surface에 두지 않는다.

## 검증 명령

```bash
python tools/validate_pack.py
python tools/verify_ssot_alignment.py
python tools/discover_repo_commands.py
pre-commit run --all-files
```
