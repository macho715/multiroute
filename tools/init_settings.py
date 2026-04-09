from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path


def run(cmd: list[str], dry_run: bool) -> None:
    print('$', ' '.join(cmd))
    if not dry_run:
        subprocess.check_call(cmd)


def main() -> int:
    parser = argparse.ArgumentParser(description='Bootstrap validation helpers for this pack.')
    parser.add_argument('--apply-precommit', action='store_true')
    parser.add_argument('--apply-ci', action='store_true')
    parser.add_argument('--python', default='python')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    summary: dict[str, object] = {
        'precommit_requested': args.apply_precommit,
        'ci_present': Path('.github/workflows/ci.yml').exists(),
        'python': args.python,
    }

    if args.apply_precommit:
        if shutil.which('pre-commit'):
            run(['pre-commit', 'install'], dry_run=args.dry_run)
        else:
            summary['precommit_note'] = 'pre-commit not installed; run pip install -e .[dev] first.'

    if args.apply_ci:
        summary['ci_note'] = 'CI files are repo artifacts; review org-specific permissions before push.'

    print(json.dumps(summary, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
