import importlib.util
import json
from pathlib import Path
import unittest

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"


def _load_generator():
    path = FRONTEND / "scripts" / "generate_thought_bubble_manifest.py"
    spec = importlib.util.spec_from_file_location("generate_thought_bubble_manifest", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _yellow_guide_pixel(pixel):
    r, g, b, a = pixel
    return a >= 8 and r > 145 and g > 110 and b < 95


def _runtime_matte_pixel(pixel):
    r, g, b, a = pixel
    matte_red = a >= 8 and r > 180 and g < 92 and b < 92 and r > g * 2.25 and r > b * 2.25
    dark_red = a >= 8 and r > 120 and g < 42 and b < 42 and r > g * 3 and r > b * 3
    guide_yellow = a >= 8 and r > 180 and g > 105 and b < 70 and r > b * 3 and g > b * 2
    guide_orange = a >= 8 and r > 180 and g > 80 and b < 45 and r > b * 4 and g > b * 2
    return matte_red or dark_red or guide_yellow or guide_orange


def _pixels(image):
    if hasattr(image, "get_flattened_data"):
        return image.get_flattened_data()
    return image.getdata()


def _rects_overlap(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1


def _component_boxes(image, slot, include_pixel):
    x1, y1, x2, y2 = slot
    crop = image.crop(slot)
    pixels = crop.load()
    seen = set()
    components = []

    for y in range(crop.height):
        for x in range(crop.width):
            if (x, y) in seen:
                continue
            r, g, b, a = pixels[x, y]
            if not include_pixel(r, g, b, a):
                continue
            stack = [(x, y)]
            seen.add((x, y))
            points = []
            while stack:
                px, py = stack.pop()
                points.append((px, py))
                for ny in (py - 1, py, py + 1):
                    for nx in (px - 1, px, px + 1):
                        if nx == px and ny == py:
                            continue
                        if not (0 <= nx < crop.width and 0 <= ny < crop.height):
                            continue
                        if (nx, ny) in seen:
                            continue
                        r, g, b, a = pixels[nx, ny]
                        if include_pixel(r, g, b, a):
                            seen.add((nx, ny))
                            stack.append((nx, ny))

            xs = [point[0] for point in points]
            ys = [point[1] for point in points]
            components.append({
                "count": len(points),
                "bbox": (min(xs) + x1, min(ys) + y1, max(xs) + x1 + 1, max(ys) + y1 + 1),
                "touches_side": min(xs) == 0 or max(xs) == crop.width - 1,
            })

    return sorted(components, key=lambda component: component["count"], reverse=True)


class ThoughtBubbleManifestTest(unittest.TestCase):
    def test_sources_stay_inside_clean_slots(self):
        generator = _load_generator()
        slots = {bubble_id: rough for bubble_id, _tier, _rank, rough in generator.SLOTS}
        manifest = json.loads((FRONTEND / "src" / "data" / "thoughtBubbles.json").read_text())

        for variant in manifest["variants"]:
            with self.subTest(variant=variant["id"]):
                x1, y1, x2, y2 = slots[variant["id"]]
                source = variant["source"]
                self.assertGreaterEqual(source["x"], x1)
                self.assertGreaterEqual(source["y"], y1)
                self.assertLessEqual(source["x"] + source["w"], x2)
                self.assertLessEqual(source["y"] + source["h"], y2)

    def test_runtime_matte_clears_sheet_labels_from_sources(self):
        image = Image.open(FRONTEND / "public" / "scenery" / "thoughtbubbles.png").convert("RGBA")
        manifest = json.loads((FRONTEND / "src" / "data" / "thoughtBubbles.json").read_text())

        for variant in manifest["variants"]:
            with self.subTest(variant=variant["id"]):
                source = variant["source"]
                crop = image.crop((
                    source["x"],
                    source["y"],
                    source["x"] + source["w"],
                    source["y"] + source["h"],
                ))
                label_pixels = sum(1 for pixel in _pixels(crop) if _yellow_guide_pixel(pixel) and not _runtime_matte_pixel(pixel))
                self.assertEqual(label_pixels, 0)

    def test_sources_do_not_overlap_side_edge_neighbor_fragments(self):
        generator = _load_generator()
        slots = {bubble_id: rough for bubble_id, _tier, _rank, rough in generator.SLOTS}
        image = Image.open(FRONTEND / "public" / "scenery" / "thoughtbubbles.png").convert("RGBA")
        manifest = json.loads((FRONTEND / "src" / "data" / "thoughtBubbles.json").read_text())

        for variant in manifest["variants"]:
            with self.subTest(variant=variant["id"]):
                source = variant["source"]
                source_rect = (
                    source["x"],
                    source["y"],
                    source["x"] + source["w"],
                    source["y"] + source["h"],
                )
                components = _component_boxes(image, slots[variant["id"]], generator.include_pixel)
                side_fragments = [
                    component
                    for component in components[1:]
                    if component["touches_side"] and component["count"] >= 8
                ]
                for fragment in side_fragments:
                    self.assertFalse(_rects_overlap(source_rect, fragment["bbox"]), fragment["bbox"])

    def test_text_boxes_are_vertically_centered_in_cloud_body(self):
        generator = _load_generator()
        image = Image.open(FRONTEND / "public" / "scenery" / "thoughtbubbles.png").convert("RGBA")
        manifest = json.loads((FRONTEND / "src" / "data" / "thoughtBubbles.json").read_text())

        for variant in manifest["variants"]:
            with self.subTest(variant=variant["id"]):
                source = variant["source"]
                _, body_top, _, body_bottom = generator.cloud_body_bbox(image, source)
                body_center = (body_top + body_bottom) / 2
                text = variant["text"]
                text_center = text["y"] + text["h"] / 2

                self.assertLessEqual(abs(text_center - body_center), 8)
