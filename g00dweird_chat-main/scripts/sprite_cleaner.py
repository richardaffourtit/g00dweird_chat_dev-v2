#!/usr/bin/env python3
"""Clean red-keyed pixel sprite sheets into engine-ready descriptors."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from PIL import Image, ImageChops, ImageSequence

IMAGE_EXTS = {".png", ".gif", ".webp", ".bmp"}
DEFAULT_CONFIG_PATH = "sprite-clean.config.json"
REPORT_JSON = "reports/sprite-audit.json"
REPORT_MD = "reports/sprite-audit.md"


def default_config() -> Dict[str, Any]:
    return {
        "inputDirs": ["assets", "public", "sprites", "src/assets", "imported", "frontend/public", "frontend/src/assets"],
        "outputDir": "frontend/public/assets/cleaned-sprites",
        "keyColors": ["#ff0000"],
        "keyTolerance": 32,
        "padding": 2,
        "minVisiblePixels": 8,
        "duplicateThreshold": 0.995,
        "defaultFps": 8,
        "defaultPivot": {"x": 0.5, "y": 0.85},
        "frameSizeOverrides": {},
        "manualOverridesFile": "frontend/public/assets/cleaned-sprites/manual-overrides.json",
        "maxSingleSpritePixels": 1048576,
        "maxProcessPixels": 2097152,
    }


@dataclass
class FrameCandidate:
    image: Image.Image
    source_rect: Dict[str, int]
    bbox: Dict[str, int]
    visible_pixels: int
    warnings: List[str]


def slugify(path: Path) -> str:
    parts = [
        re.sub(r"[^A-Za-z0-9_.-]+", "-", part).strip("-")
        for part in path.with_suffix("").parts
        if part not in {"assets", "public", "src", "frontend", "imported"}
    ]
    return re.sub(r"-+", "-", "-".join(part for part in parts if part)) or "sprite"


def parse_hex_color(value: str) -> Tuple[int, int, int]:
    text = value.strip().lstrip("#")
    if len(text) != 6:
        raise ValueError(f"invalid color {value!r}")
    return tuple(int(text[i : i + 2], 16) for i in (0, 2, 4))


def color_distance(a: Tuple[int, int, int], b: Tuple[int, int, int]) -> float:
    return math.sqrt(sum((int(a[i]) - int(b[i])) ** 2 for i in range(3)))


def is_key_pixel(pixel: Tuple[int, int, int, int], keys: List[Tuple[int, int, int]], tolerance: int) -> bool:
    if pixel[3] == 0:
        return False
    rgb = pixel[:3]
    return any(color_distance(rgb, key) <= tolerance for key in keys)


def clean_key_color(image: Image.Image, keys: List[Tuple[int, int, int]], tolerance: int) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    key_mask = [[False for _ in range(width)] for _ in range(height)]
    for y in range(height):
        for x in range(width):
            if is_key_pixel(pixels[x, y], keys, tolerance):
                key_mask[y][x] = True
                pixels[x, y] = (0, 0, 0, 0)

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            touches_key = False
            for ny in (y - 1, y, y + 1):
                for nx in (x - 1, x, x + 1):
                    if 0 <= nx < width and 0 <= ny < height and key_mask[ny][nx]:
                        touches_key = True
                        break
                if touches_key:
                    break
            if touches_key and r > 180 and g < 90 and b < 90:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def visible_bbox(image: Image.Image) -> Optional[Tuple[int, int, int, int]]:
    alpha = image.convert("RGBA").getchannel("A")
    return alpha.getbbox()


def pixel_data(image: Image.Image):
    if hasattr(image, "get_flattened_data"):
        return image.get_flattened_data()
    return image.getdata()


def visible_count(image: Image.Image) -> int:
    return sum(1 for value in pixel_data(image.convert("RGBA").getchannel("A")) if value > 0)


def crop_with_padding(image: Image.Image, bbox: Tuple[int, int, int, int], padding: int) -> Tuple[Image.Image, Dict[str, int], Dict[str, int]]:
    width, height = image.size
    left, top, right, bottom = bbox
    padded = (
        max(0, left - padding),
        max(0, top - padding),
        min(width, right + padding),
        min(height, bottom + padding),
    )
    visible = {"x": left, "y": top, "w": right - left, "h": bottom - top}
    padded_rect = {"x": padded[0], "y": padded[1], "w": padded[2] - padded[0], "h": padded[3] - padded[1]}
    return image.crop(padded), visible, padded_rect


def find_override(config: Dict[str, Any], path: Path) -> Optional[Dict[str, int]]:
    overrides = config.get("frameSizeOverrides") or {}
    candidates = [path.name, path.stem, path.as_posix()]
    for key in candidates:
        value = overrides.get(key)
        if isinstance(value, dict):
            w = value.get("w") or value.get("width")
            h = value.get("h") or value.get("height")
            if w and h:
                return {"w": int(w), "h": int(h)}
    match = re.search(r"(\d+)x(\d+)", path.stem)
    if match:
        return {"w": int(match.group(1)), "h": int(match.group(2))}
    return None


def split_grid(image: Image.Image, frame_w: int, frame_h: int) -> List[Tuple[Image.Image, Dict[str, int]]]:
    width, height = image.size
    frames = []
    for y in range(0, height - frame_h + 1, frame_h):
        for x in range(0, width - frame_w + 1, frame_w):
            frames.append((image.crop((x, y, x + frame_w, y + frame_h)), {"x": x, "y": y, "w": frame_w, "h": frame_h}))
    return frames


def detect_frame_size(image: Image.Image, path: Path, config: Dict[str, Any]) -> Optional[Dict[str, int]]:
    override = find_override(config, path)
    if override:
        return override
    width, height = image.size
    if width > height and width % height == 0 and width // height <= 64:
        return {"w": height, "h": height}
    if height > width and height % width == 0 and height // width <= 64:
        return {"w": width, "h": width}
    for frame_w, frame_h in ((64, 64), (48, 48), (32, 32), (24, 24), (16, 16)):
        if width % frame_w == 0 and height % frame_h == 0 and (width // frame_w) * (height // frame_h) > 1:
            return {"w": frame_w, "h": frame_h}
    return None


def extract_raw_frames(path: Path, config: Dict[str, Any]) -> List[Tuple[Image.Image, Dict[str, int]]]:
    source = Image.open(path)
    if path.suffix.lower() == ".gif" or getattr(source, "is_animated", False):
        frames = []
        for index, frame in enumerate(ImageSequence.Iterator(source)):
            rgba = frame.convert("RGBA")
            frames.append((rgba, {"x": 0, "y": 0, "w": rgba.width, "h": rgba.height, "index": index}))
        return frames
    rgba = source.convert("RGBA")
    size = detect_frame_size(rgba, path, config)
    if size:
        return split_grid(rgba, size["w"], size["h"])
    return [(rgba, {"x": 0, "y": 0, "w": rgba.width, "h": rgba.height})]


def looks_like_sprite_source(path: Path, config: Dict[str, Any]) -> bool:
    override = find_override(config, path)
    name = path.as_posix().lower()
    if override or path.suffix.lower() == ".gif":
        return True
    if any(part in {"worlds", "world_icons"} for part in path.parts):
        return False
    if "source-assets" in path.parts and "worlds" in path.parts:
        return False
    if "wall" in path.parts and "glyph-sheets" not in path.parts and "glyphs" not in path.parts:
        return False
    sprite_terms = (
        "sprite",
        "sheet",
        "anim",
        "avatar",
        "creature",
        "idle_",
        "walk_",
        "run_",
        "jump_",
        "attack_",
        "action_",
        "hurt_",
        "die_",
        "emote_",
        "frame",
    )
    if any(term in name for term in sprite_terms):
        return True
    try:
        with Image.open(path) as image:
            width, height = image.size
            if detect_frame_size(image, path, config):
                return True
            if width * height <= int(config.get("maxSingleSpritePixels", 1048576)):
                excluded_parts = {"worlds", "world_icons", "wall"}
                if not any(part in excluded_parts for part in path.parts):
                    return True
    except Exception:
        return False
    return False


def hash_image(image: Image.Image) -> str:
    return hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest()


def image_similarity(a: Image.Image, b: Image.Image) -> float:
    if a.size != b.size:
        return 0.0
    diff = ImageChops.difference(a.convert("RGBA"), b.convert("RGBA"))
    changed = sum(1 for px in pixel_data(diff) if px != (0, 0, 0, 0))
    total = max(1, a.width * a.height)
    return 1.0 - (changed / total)


def leftover_red_count(image: Image.Image, keys: List[Tuple[int, int, int]], tolerance: int) -> int:
    return sum(1 for px in pixel_data(image.convert("RGBA")) if is_key_pixel(px, keys, tolerance))


def normalize_frames(frames: List[FrameCandidate], pivot: Dict[str, float]) -> Tuple[List[Image.Image], int, int]:
    max_left = max((int(round(frame.image.width * pivot["x"])) for frame in frames), default=0)
    max_right = max((frame.image.width - int(round(frame.image.width * pivot["x"])) for frame in frames), default=0)
    max_top = max((int(round(frame.image.height * pivot["y"])) for frame in frames), default=0)
    max_bottom = max((frame.image.height - int(round(frame.image.height * pivot["y"])) for frame in frames), default=0)
    canvas_w = max(1, max_left + max_right)
    canvas_h = max(1, max_top + max_bottom)
    normalized = []
    for frame in frames:
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        px = int(round(frame.image.width * pivot["x"]))
        py = int(round(frame.image.height * pivot["y"]))
        canvas.alpha_composite(frame.image, (max_left - px, max_top - py))
        normalized.append(canvas)
    return normalized, canvas_w, canvas_h


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text())
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n")


def discover_images(root: Path, config: Dict[str, Any]) -> List[Path]:
    output = (root / config["outputDir"]).resolve()
    paths: List[Path] = []
    seen = set()
    for item in config.get("inputDirs", []):
        base = (root / item).resolve() if not Path(item).is_absolute() else Path(item).resolve()
        if not base.exists() or not base.is_dir():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in IMAGE_EXTS:
                continue
            resolved = path.resolve()
            if output == resolved or output in resolved.parents:
                continue
            if "node_modules" in resolved.parts or ".git" in resolved.parts:
                continue
            if not looks_like_sprite_source(resolved, config):
                continue
            if resolved not in seen:
                seen.add(resolved)
                paths.append(resolved)
    return sorted(paths)


def apply_manual_overrides(
    sprite_id: str,
    source_path: Path,
    raw_frames: List[Tuple[Image.Image, Dict[str, int]]],
    overrides: Dict[str, Any],
    default_pivot: Dict[str, float],
) -> Tuple[List[Tuple[Image.Image, Dict[str, int], Dict[str, float], bool, Optional[Dict[str, int]]]], List[str]]:
    sheet_override = overrides.get(sprite_id) or overrides.get(source_path.stem) or {}
    warnings = []
    if sheet_override and sheet_override.get("source") and sheet_override.get("source") != source_path.as_posix():
        warnings.append("manual override source differs from current source path")
    frame_overrides = sheet_override.get("frames") or {}
    output = []
    for index, (image, source_rect) in enumerate(raw_frames):
        frame_override = frame_overrides.get(str(index)) or {}
        disabled = bool(frame_override.get("disabled", False))
        pivot = frame_override.get("pivot") or default_pivot
        bbox = frame_override.get("bbox")
        if bbox:
            original_bbox = {k: int(bbox.get(k, 0)) for k in ("x", "y", "w", "h")}
            x, y, w, h = (original_bbox[k] for k in ("x", "y", "w", "h"))
            if x >= image.width and source_rect.get("x", 0) <= x:
                x -= int(source_rect.get("x", 0))
            if y >= image.height and source_rect.get("y", 0) <= y:
                y -= int(source_rect.get("y", 0))
            x = max(0, min(image.width - 1, x))
            y = max(0, min(image.height, y))
            w = max(1, min(image.width - x, w))
            h = max(1, min(image.height - y, h))
            crop = image.crop((x, y, x + w, y + h))
            output.append((crop, source_rect, pivot, disabled, original_bbox))
        else:
            output.append((image, source_rect, pivot, disabled, None))
    return output, warnings


def process_image(path: Path, root: Path, config: Dict[str, Any], overrides: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    keys = [parse_hex_color(color) for color in config.get("keyColors", ["#ff0000"])]
    tolerance = int(config.get("keyTolerance", 32))
    padding = int(config.get("padding", 2))
    min_visible = int(config.get("minVisiblePixels", 8))
    duplicate_threshold = float(config.get("duplicateThreshold", 0.995))
    default_pivot = config.get("defaultPivot") or {"x": 0.5, "y": 0.85}
    out_dir = root / config["outputDir"]
    frames_dir = out_dir / "frames"
    descriptors_dir = out_dir / "descriptors"
    source_rel = path.relative_to(root).as_posix() if root in path.parents else path.as_posix()
    sprite_id = slugify(Path(source_rel))
    max_process_pixels = int(config.get("maxProcessPixels", 2097152))
    with Image.open(path) as probe:
        if probe.width * probe.height > max_process_pixels and not find_override(config, path):
            descriptor = {
                "id": sprite_id,
                "source": source_rel,
                "outputSheet": "",
                "frameWidth": 0,
                "frameHeight": 0,
                "frameCount": 0,
                "fps": int(config.get("defaultFps", 8)),
                "loop": True,
                "pivot": config.get("defaultPivot") or {"x": 0.5, "y": 0.85},
                "frames": [],
                "warnings": [f"skipped-large-source:{probe.width}x{probe.height}"],
            }
            write_json((root / config["outputDir"]) / "descriptors" / f"{sprite_id}.json", descriptor)
            return descriptor

    raw_frames = extract_raw_frames(path, config)
    raw_frames, override_warnings = apply_manual_overrides(sprite_id, path, raw_frames, overrides, default_pivot)

    candidates: List[FrameCandidate] = []
    source_rects: List[Dict[str, int]] = []
    frame_pivots: List[Dict[str, float]] = []
    descriptor_warnings = list(override_warnings)
    for index, (raw, source_rect, pivot, disabled, override_bbox) in enumerate(raw_frames):
        if disabled:
            descriptor_warnings.append(f"frame {index} disabled by manual override")
            continue
        cleaned = clean_key_color(raw, keys, tolerance)
        bbox_tuple = visible_bbox(cleaned)
        warnings: List[str] = []
        count = visible_count(cleaned)
        if count < min_visible:
            warnings.append("tiny-or-empty-frame")
        if leftover_red_count(cleaned, keys, max(0, tolerance // 2)) > 0:
            warnings.append("leftover-red-pixels")
        if bbox_tuple:
            cropped, visible, _padded = crop_with_padding(cleaned, bbox_tuple, padding)
            bbox = override_bbox or visible
        else:
            cropped = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
            bbox = {"x": 0, "y": 0, "w": 0, "h": 0}
        candidates.append(FrameCandidate(cropped, source_rect, bbox, count, warnings))
        source_rects.append(source_rect)
        frame_pivots.append(pivot)

    if not candidates:
        return None

    normalized, frame_w, frame_h = normalize_frames(candidates, default_pivot)
    sheet = Image.new("RGBA", (frame_w * len(normalized), frame_h), (0, 0, 0, 0))
    for index, frame in enumerate(normalized):
        sheet.alpha_composite(frame, (index * frame_w, 0))

    hashes = [hash_image(frame) for frame in normalized]
    frame_records = []
    for index, candidate in enumerate(candidates):
        duplicate_of = None
        for prior in range(index):
            if hashes[prior] == hashes[index] or (
                len(normalized) <= 128 and image_similarity(normalized[prior], normalized[index]) >= duplicate_threshold
            ):
                duplicate_of = prior
                break
        warnings = list(candidate.warnings)
        if duplicate_of is not None:
            warnings.append("duplicate-frame")
        frame_path = frames_dir / sprite_id / f"{index}.png"
        frame_path.parent.mkdir(parents=True, exist_ok=True)
        normalized[index].save(frame_path)
        frame_records.append(
            {
                "index": index,
                "x": index * frame_w,
                "y": 0,
                "w": frame_w,
                "h": frame_h,
                "bbox": candidate.bbox,
                "sourceRect": candidate.source_rect,
                "hash": hashes[index],
                "duplicateOf": duplicate_of,
                "warnings": warnings,
                "visiblePixels": candidate.visible_pixels,
                "pivot": frame_pivots[index] if index < len(frame_pivots) else default_pivot,
            }
        )

    out_dir.mkdir(parents=True, exist_ok=True)
    sheet_path = out_dir / f"{sprite_id}.png"
    sheet.save(sheet_path)
    descriptor = {
        "id": sprite_id,
        "source": source_rel,
        "outputSheet": sheet_path.relative_to(root).as_posix(),
        "frameWidth": frame_w,
        "frameHeight": frame_h,
        "frameCount": len(frame_records),
        "fps": int(config.get("defaultFps", 8)),
        "loop": True,
        "pivot": default_pivot,
        "frames": frame_records,
        "warnings": sorted(set(descriptor_warnings + [w for frame in frame_records for w in frame["warnings"]])),
    }
    write_json(descriptors_dir / f"{sprite_id}.json", descriptor)
    return descriptor


def build_reports(descriptors: List[Dict[str, Any]], root: Path) -> Dict[str, Any]:
    report = {
        "generatedBy": "scripts/sprite_cleaner.py",
        "spriteCount": len(descriptors),
        "frameCount": sum(item.get("frameCount", 0) for item in descriptors),
        "sprites": [],
    }
    for descriptor in descriptors:
        frame_warnings = [
            {
                "index": frame["index"],
                "warnings": frame.get("warnings", []),
                "visiblePixels": frame.get("visiblePixels", 0),
                "duplicateOf": frame.get("duplicateOf"),
            }
            for frame in descriptor.get("frames", [])
            if frame.get("warnings")
        ]
        report["sprites"].append(
            {
                "id": descriptor["id"],
                "source": descriptor["source"],
                "outputSheet": descriptor["outputSheet"],
                "frameCount": descriptor["frameCount"],
                "warnings": descriptor.get("warnings", []),
                "frameWarnings": frame_warnings,
            }
        )
    write_json(root / REPORT_JSON, report)
    lines = ["# Sprite Audit", "", f"- Sprites processed: {report['spriteCount']}", f"- Frames processed: {report['frameCount']}", ""]
    suspicious = [item for item in report["sprites"] if item["warnings"] or item["frameWarnings"]]
    if not suspicious:
        lines.append("No suspicious frames found.")
    else:
        lines.append("## Suspicious Frames")
        lines.append("")
        for item in suspicious:
            lines.append(f"### {item['id']}")
            lines.append(f"- Source: `{item['source']}`")
            if item["warnings"]:
                lines.append(f"- Sheet warnings: {', '.join(item['warnings'])}")
            for frame in item["frameWarnings"]:
                lines.append(
                    f"- Frame {frame['index']}: {', '.join(frame['warnings'])}; "
                    f"visible pixels: {frame['visiblePixels']}; duplicateOf: {frame['duplicateOf']}"
                )
            lines.append("")
    (root / REPORT_MD).parent.mkdir(parents=True, exist_ok=True)
    (root / REPORT_MD).write_text("\n".join(lines).rstrip() + "\n")
    return report


def build_manifest(descriptors: List[Dict[str, Any]], root: Path, output_dir: str) -> None:
    items = []
    for descriptor in descriptors:
        items.append(
            {
                "id": descriptor["id"],
                "source": descriptor["source"],
                "descriptor": f"{output_dir}/descriptors/{descriptor['id']}.json",
                "outputSheet": descriptor["outputSheet"],
                "frameCount": descriptor["frameCount"],
                "frameWidth": descriptor["frameWidth"],
                "frameHeight": descriptor["frameHeight"],
                "pivot": descriptor.get("pivot"),
                "warnings": descriptor.get("warnings", []),
            }
        )
    write_json(root / output_dir / "manifest.json", {"sprites": items})


def run_cleaner(config: Dict[str, Any], root: Path | str = ".") -> Dict[str, Any]:
    root_path = Path(root).resolve()
    out_dir = root_path / config["outputDir"]
    if out_dir.exists():
        for child in out_dir.iterdir():
            if child.name == "manual-overrides.json":
                continue
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
    (out_dir / "frames").mkdir(parents=True, exist_ok=True)
    (out_dir / "descriptors").mkdir(parents=True, exist_ok=True)
    overrides_path = root_path / config.get("manualOverridesFile", "")
    overrides = load_json(overrides_path, {})
    if not overrides_path.exists():
        write_json(overrides_path, {})
    descriptors = []
    errors = []
    for path in discover_images(root_path, config):
        try:
            descriptor = process_image(path, root_path, config, overrides)
            if descriptor:
                descriptors.append(descriptor)
        except Exception as exc:
            errors.append({"source": path.as_posix(), "error": str(exc)})
    build_manifest(descriptors, root_path, config["outputDir"])
    report = build_reports(descriptors, root_path)
    if errors:
        report["errors"] = errors
        write_json(root_path / REPORT_JSON, report)
    return {"processed": len(descriptors), "errors": errors, "report": report}


def load_config(root: Path, config_path: str) -> Dict[str, Any]:
    path = root / config_path
    config = default_config()
    if path.exists():
        config.update(load_json(path, {}))
    else:
        write_json(path, config)
    return config


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=Path(__file__).resolve().parents[1].as_posix())
    parser.add_argument("--config", default=DEFAULT_CONFIG_PATH)
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    config = load_config(root, args.config)
    result = run_cleaner(config, root=root)
    print(f"processed {result['processed']} sprite sources")
    if result["errors"]:
        print(f"errors: {len(result['errors'])}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
