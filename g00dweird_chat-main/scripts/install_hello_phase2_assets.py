#!/usr/bin/env python3
"""Install the Hello Phase 2 scene assets from the exported zip.

The sprite strips use pure red (#ff0000) as a key color. The browser cannot
chroma-key PNGs by itself, so this converts those pixels to real transparency.
"""

from __future__ import annotations

import argparse
import binascii
import os
import struct
import zipfile
import zlib
from pathlib import Path


ZIP_ROOT = "hello_iso_phase2_living_scene"
BACKGROUND = f"{ZIP_ROOT}/assets/background/hello_iso_world_bg.png"
SPRITE_PREFIX = f"{ZIP_ROOT}/assets/sprites/"
SCENE_JSON = f"{ZIP_ROOT}/scene.phase2.json"
PNG_SIG = b"\x89PNG\r\n\x1a\n"


def png_chunks(data: bytes):
    if data[:8] != PNG_SIG:
        raise ValueError("not a PNG")
    pos = 8
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        kind = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        yield kind, chunk
        pos += length + 12


def paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def decode_rgba_png(data: bytes) -> tuple[int, int, bytes]:
    chunks = list(png_chunks(data))
    ihdr = next(chunk for kind, chunk in chunks if kind == b"IHDR")
    width, height, bit_depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", ihdr)
    if bit_depth != 8 or color_type != 6 or interlace != 0:
        raise ValueError(
            f"unsupported PNG format: bit_depth={bit_depth}, "
            f"color_type={color_type}, interlace={interlace}"
        )

    payload = zlib.decompress(b"".join(chunk for kind, chunk in chunks if kind == b"IDAT"))
    stride = width * 4
    out = bytearray()
    prev = bytearray(stride)
    pos = 0

    for _ in range(height):
        filter_type = payload[pos]
        pos += 1
        row = bytearray(payload[pos : pos + stride])
        pos += stride

        for i, value in enumerate(row):
            left = row[i - 4] if i >= 4 else 0
            up = prev[i]
            up_left = prev[i - 4] if i >= 4 else 0
            if filter_type == 1:
                row[i] = (value + left) & 255
            elif filter_type == 2:
                row[i] = (value + up) & 255
            elif filter_type == 3:
                row[i] = (value + ((left + up) // 2)) & 255
            elif filter_type == 4:
                row[i] = (value + paeth(left, up, up_left)) & 255
            elif filter_type != 0:
                raise ValueError(f"unsupported PNG filter: {filter_type}")

        out.extend(row)
        prev = row

    return width, height, bytes(out)


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + kind
        + data
        + struct.pack(">I", binascii.crc32(kind + data) & 0xFFFFFFFF)
    )


def encode_rgba_png(width: int, height: int, rgba: bytes) -> bytes:
    stride = width * 4
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return PNG_SIG + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + png_chunk(b"IEND", b"")


def chroma_key_red(data: bytes) -> tuple[bytes, int]:
    pixels = bytearray(data)
    changed = 0
    for i in range(0, len(pixels), 4):
        if pixels[i] == 255 and pixels[i + 1] == 0 and pixels[i + 2] == 0 and pixels[i + 3] != 0:
            pixels[i + 3] = 0
            changed += 1
    return bytes(pixels), changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()

    worlds_dir = args.repo / "frontend/public/worlds"
    scene_dir = args.repo / "frontend/public/scenery/hello_phase2"
    scene_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(args.zip_path) as zf:
        (worlds_dir / "hello.png").write_bytes(zf.read(BACKGROUND))
        (scene_dir / "scene.phase2.json").write_bytes(zf.read(SCENE_JSON))

        for name in zf.namelist():
            if not name.startswith(SPRITE_PREFIX) or not name.endswith(".png"):
                continue
            width, height, rgba = decode_rgba_png(zf.read(name))
            keyed, changed = chroma_key_red(rgba)
            out = encode_rgba_png(width, height, keyed)
            target = scene_dir / os.path.basename(name)
            target.write_bytes(out)
            print(f"{target.name}: {width}x{height}, transparentized {changed} red pixels")

    print("installed Hello Phase 2 background and sprites")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
