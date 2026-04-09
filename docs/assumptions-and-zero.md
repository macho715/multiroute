# Assumptions and ZERO

## 가정:
- 실제 제품 repo는 Next.js App Router + PostgreSQL 중심 구조를 채택할 가능성이 높다.
- Cursor project-level assets는 `.cursor/`에서 로드한다.
- GitHub custom instructions는 `.github/copilot-instructions.md`와 `.github/instructions/*.instructions.md`를 사용한다.
- Hook schema는 Cursor 2.4 계열의 `hooks.json` pattern을 따른다.

## ZERO:
- 실제 repo의 `install/dev/build/test/lint/format` 명령은 아직 미확정이다.
- 실제 GitHub org/team slug는 미확정이다.
- 실제 MCP server 목록과 권한 정책은 미확정이다.
- 실제 Cloud Agent enablement 범위는 미확정이다.
- 실제 auth / RBAC provider wiring은 미확정이다.

## Required before merge
1. [x] `CODEOWNERS` placeholder replacement
2. [x] actual repo command discovery
3. [ ] hook smoke test on installed Cursor version
4. [ ] MCP allowlist confirmation
5. [ ] branch protection / reviewer policy confirmation
