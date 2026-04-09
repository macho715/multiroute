from __future__ import annotations

import json
import re
from pathlib import Path

try:
    import yaml
except Exception as exc:  # pragma: no cover
    raise SystemExit(f'PyYAML is required: {exc}')

ROOT = Path(__file__).resolve().parent.parent
REQUIRED = [
    ROOT / 'README.md',
    ROOT / 'AGENTS.md',
    ROOT / 'plan.md',
    ROOT / '.cursor/rules',
    ROOT / '.cursor/skills',
    ROOT / '.cursor/agents',
    ROOT / '.github/workflows',
    ROOT / 'prompts',
    ROOT / 'config',
    ROOT / 'docs',
]

SECRET_PATTERNS = [
    re.compile(r'AKIA[0-9A-Z]{16}'),
    re.compile(r'sk-[A-Za-z0-9]{20,}'),
    re.compile(r'-----BEGIN [A-Z ]+PRIVATE KEY-----'),
]


def fail(message: str) -> None:
    raise SystemExit(message)


def validate_required() -> None:
    missing = [str(path.relative_to(ROOT)) for path in REQUIRED if not path.exists()]
    if missing:
        fail(f'Missing required paths: {missing}')


def load_frontmatter(path: Path) -> dict:
    text = path.read_text(encoding='utf-8')
    if not text.startswith('---\n'):
        return {}
    _, rest = text.split('---\n', 1)
    front, _sep, _body = rest.partition('\n---\n')
    return yaml.safe_load(front) or {}


def validate_skills() -> None:
    for skill_dir in (ROOT / '.cursor/skills').iterdir():
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / 'SKILL.md'
        if not skill_md.exists():
            fail(f'Missing SKILL.md in {skill_dir.relative_to(ROOT)}')
        data = load_frontmatter(skill_md)
        if data.get('name') != skill_dir.name:
            fail(f'Skill frontmatter name mismatch in {skill_md.relative_to(ROOT)}')
        if 'description' not in data:
            fail(f'Skill description missing in {skill_md.relative_to(ROOT)}')


def validate_agents() -> None:
    for agent_file in (ROOT / '.cursor/agents').glob('*.md'):
        data = load_frontmatter(agent_file)
        if not data:
            fail(f'Agent frontmatter missing in {agent_file.relative_to(ROOT)}')
        if 'description' not in data:
            fail(f'Agent description missing in {agent_file.relative_to(ROOT)}')


def validate_instructions() -> None:
    for path in (ROOT / '.github/instructions').glob('*.instructions.md'):
        data = load_frontmatter(path)
        if 'applyTo' not in data:
            fail(f'applyTo missing in {path.relative_to(ROOT)}')


def validate_hooks_json() -> None:
    path = ROOT / '.cursor/hooks.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    if data.get('version') != 1:
        fail('hooks.json version must be 1')
    if 'hooks' not in data:
        fail('hooks.json missing hooks key')


def validate_no_secrets() -> None:
    for path in ROOT.rglob('*'):
        if path.is_dir() or path.suffix in {'.png', '.jpg', '.jpeg', '.webp', '.zip'}:
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except Exception:
            continue
        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                fail(f'Possible secret detected in {path.relative_to(ROOT)}')


def main() -> int:
    validate_required()
    validate_skills()
    validate_agents()
    validate_instructions()
    validate_hooks_json()
    validate_no_secrets()
    print('Pack validation: OK')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
