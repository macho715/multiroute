# Evidence Log

## SSOT Sources & Contracts
- **Primary Spec**: `Spec.md` v1.0.0
- **Agent Contract**: `AGENTS.md`
- **UI Layout Contract**: `ROUTE_WORKBENCH_LAYOUT_SPEC_v2026.04.md` (via `layout.md`)
- **Narrative Plan**: `plan.md`

## SSOT Mismatch Notes
- **Mismatch**: `AGENTS.md` references `plan.patched.final.v2026.04.md`, but the uploaded file is named `plan.md`. This naming mismatch has been noted.
- **Resolution**: `plan.md` is treated as the designated narrative source and effectively functions as `plan.patched.final.v2026.04.md`.

## Repo Command Discovery
Based on `pyproject.toml` in the repository, the following commands have been identified and mapped:
- **install**: `pip install -e .[dev]` and `pre-commit install`
- **dev/build**: N/A (Pack repo focus)
- **test**: `pytest -q --maxfail=1`
- **lint**: `ruff check .` and `bandit -r .`
- **format**: `black .` and `isort .`

## Reviewer Sign-off
- **Reviewer Note**: Initial task constraints and phase checkpoints successfully established. SSOT mismatch acknowledged. This document patch supersedes the draft version.
- **Approval Record**: Contract alignment complete.
