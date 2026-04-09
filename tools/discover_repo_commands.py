from __future__ import annotations

import json
from pathlib import Path


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}


def discover_package_json(root: Path) -> dict[str, object] | None:
    path = root / 'package.json'
    if not path.exists():
        return None
    data = read_json(path)
    return {
        'source': 'package.json',
        'packageManager': data.get('packageManager'),
        'scripts': data.get('scripts', {}),
    }


def discover_pyproject(root: Path) -> dict[str, object] | None:
    path = root / 'pyproject.toml'
    if not path.exists():
        return None
    return {
        'source': 'pyproject.toml',
        'note': 'Inspect [project.scripts], tool-specific sections, and task runners manually if needed.',
    }


def discover_makefile(root: Path) -> dict[str, object] | None:
    path = root / 'Makefile'
    if not path.exists():
        return None
    targets = []
    for line in path.read_text(encoding='utf-8').splitlines():
        if ':' in line and not line.startswith(('	', '#', '.', ' ')):
            target = line.split(':', 1)[0].strip()
            if target:
                targets.append(target)
    return {'source': 'Makefile', 'targets': targets}


def main() -> int:
    root = Path('.').resolve()
    discoveries = [
        discover_package_json(root),
        discover_pyproject(root),
        discover_makefile(root),
    ]
    payload = [item for item in discoveries if item]
    print(json.dumps({'root': str(root), 'discoveries': payload}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
