from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

domain_contract = (ROOT / 'config/domain_contract.yaml').read_text(encoding='utf-8')
route_doc = (ROOT / 'docs/route-contract-summary.md').read_text(encoding='utf-8')
layout_doc = (ROOT / 'docs/workbench-layout-summary.md').read_text(encoding='utf-8')
agents = (ROOT / 'AGENTS.md').read_text(encoding='utf-8')

required_statuses = ['OK', 'REVIEW', 'AMBER', 'BLOCKED', 'ZERO']
required_routes = ['SEA_DIRECT', 'SEA_TRANSSHIP', 'SEA_LAND']
required_roles = ['OPS_ADMIN', 'LOGISTICS_APPROVER', 'LOGISTICS_REVIEWER', 'LOGISTICS_VIEWER']

for token in required_statuses + required_routes + required_roles:
    for name, text in {
        'config/domain_contract.yaml': domain_contract,
        'docs/route-contract-summary.md': route_doc,
        'AGENTS.md': agents,
    }.items():
        if token not in text:
            raise SystemExit(f'{token} missing in {name}')

for token in ['Compare Canvas', 'Decision Rail', 'Contextual Evidence Drawer', 'Approval Modal']:
    if token not in layout_doc:
        raise SystemExit(f'{token} missing in docs/workbench-layout-summary.md')

print('SSOT alignment: OK')
