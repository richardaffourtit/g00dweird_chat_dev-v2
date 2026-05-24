#!/usr/bin/env python3
"""Rebuild sprite audit reports from cleaned sprite descriptors."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import sprite_cleaner


def load_descriptors(root: Path, output_dir: str) -> List[Dict[str, Any]]:
    descriptors = []
    descriptor_dir = root / output_dir / "descriptors"
    if not descriptor_dir.exists():
        return descriptors
    for path in sorted(descriptor_dir.glob("*.json")):
        try:
            descriptors.append(json.loads(path.read_text()))
        except Exception as exc:
            descriptors.append(
                {
                    "id": path.stem,
                    "source": "",
                    "outputSheet": "",
                    "frameCount": 0,
                    "frames": [],
                    "warnings": [f"descriptor-read-error: {exc}"],
                }
            )
    return descriptors


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=Path(__file__).resolve().parents[1].as_posix())
    parser.add_argument("--config", default=sprite_cleaner.DEFAULT_CONFIG_PATH)
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    config = sprite_cleaner.load_config(root, args.config)
    descriptors = load_descriptors(root, config["outputDir"])
    sprite_cleaner.build_manifest(descriptors, root, config["outputDir"])
    report = sprite_cleaner.build_reports(descriptors, root)
    print(f"audited {report['spriteCount']} sprite descriptors")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
