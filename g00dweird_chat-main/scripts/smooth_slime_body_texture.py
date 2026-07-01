#!/usr/bin/env python3
"""Repaint slime body pixels without banding, flicker, or interior leaks."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

from fix_slime_sprite_transparency import fix_frame


ROOT = Path(__file__).resolve().parents[1]
SLIME_DIR = ROOT / "frontend" / "public" / "anim" / "slime"
SLIME_BASE = (73, 132, 16)
IDLE_TARGET_BODY_HEIGHT = 78
MAX_DEBRIS_PIXELS = 20
AGGRESSIVE_BODY_STATES = {"hop", "idle", "wiggle", "split", "hurt"}
CLEAN_EYE_OUTLINE = (8, 10, 7, 255)


def is_slime_body_color(color: tuple[int, int, int, int]) -> bool:
    r, g, b, a = color
    if a == 0:
        return False
    if r > 190 and g > 190 and b > 185:
        return False
    return g > 28 and g >= r + 2 and g >= b + 6


def is_sleep_symbol_color(color: tuple[int, int, int, int]) -> bool:
    r, g, b, a = color
    if a == 0:
        return False
    return b > 105 and g > 95 and r < 120


def body_bounds(body_points: set[tuple[int, int]]) -> tuple[int, int, int, int]:
    xs = [point[0] for point in body_points]
    ys = [point[1] for point in body_points]
    return min(xs), min(ys), max(xs), max(ys)


def largest_body_component(image: Image.Image) -> set[tuple[int, int]]:
    pixels = image.load()
    width, height = image.size
    seen: set[tuple[int, int]] = set()
    largest: set[tuple[int, int]] = set()

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or not is_slime_body_color(pixels[x, y]):
                continue

            queue = deque([(x, y)])
            seen.add((x, y))
            component: set[tuple[int, int]] = set()

            while queue:
                px, py = queue.popleft()
                component.add((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    if (nx, ny) in seen or not is_slime_body_color(pixels[nx, ny]):
                        continue
                    seen.add((nx, ny))
                    queue.append((nx, ny))

            if len(component) > len(largest):
                largest = component

    return largest


def alpha_components(image: Image.Image) -> list[set[tuple[int, int]]]:
    pixels = image.load()
    width, height = image.size
    seen: set[tuple[int, int]] = set()
    components: list[set[tuple[int, int]]] = []

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or pixels[x, y][3] == 0:
                continue

            queue = deque([(x, y)])
            seen.add((x, y))
            component: set[tuple[int, int]] = set()

            while queue:
                px, py = queue.popleft()
                component.add((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    if (nx, ny) in seen or pixels[nx, ny][3] == 0:
                        continue
                    seen.add((nx, ny))
                    queue.append((nx, ny))

            components.append(component)

    return sorted(components, key=len, reverse=True)


def remove_disconnected_debris(image: Image.Image, max_pixels: int = MAX_DEBRIS_PIXELS) -> int:
    pixels = image.load()
    removed = 0
    for component in alpha_components(image)[1:]:
        if len(component) > max_pixels:
            continue
        for x, y in component:
            pixels[x, y] = (0, 0, 0, 0)
            removed += 1
    return removed


def normalize_idle_pose_height(path: Path, target_height: int = IDLE_TARGET_BODY_HEIGHT) -> int:
    image = Image.open(path).convert("RGBA")
    body_points = largest_body_component(image)
    if not body_points:
        return 0

    _left, top, _right, bottom = body_bounds(body_points)
    body_height = bottom - top + 1
    if body_height <= target_height:
        return 0

    alpha_bbox = image.getchannel("A").getbbox()
    if not alpha_bbox:
        return 0

    left, crop_top, right, crop_bottom = alpha_bbox
    crop = image.crop(alpha_bbox)
    scale_y = target_height / body_height
    scaled_height = max(1, round(crop.height * scale_y))
    scaled = crop.resize((crop.width, scaled_height), Image.Resampling.NEAREST)
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    out.alpha_composite(scaled, (left, crop_bottom - scaled_height))
    out.save(path, optimize=True)
    return body_height - target_height


def clamp_channel(value: float) -> int:
    return max(0, min(255, round(value)))


def target_body_color(
    base: tuple[float, float, float],
    x: int,
    y: int,
    bounds: tuple[int, int, int, int],
) -> tuple[int, int, int]:
    left, top, right, bottom = bounds
    center_x = (left + right) / 2
    half_width = max(1, (right - left) / 2)
    body_height = max(1, bottom - top)
    nx = (x - center_x) / half_width
    y_norm = (y - top) / body_height

    side_shadow = -24 * (abs(nx) ** 1.65)
    center_lift = 13 * max(0, 1 - abs(nx)) ** 1.2
    crown_lift = 9 * max(0, 1 - y_norm)
    belly_lift = 6 * max(0, 1 - ((nx * 1.3) ** 2 + ((y_norm - 0.52) * 2.0) ** 2))
    lower_shadow = -10 * max(0, y_norm - 0.68) / 0.32
    shade = side_shadow + center_lift + crown_lift + belly_lift + lower_shadow

    return (
        clamp_channel(base[0] + shade * 0.48),
        clamp_channel(base[1] + shade),
        clamp_channel(base[2] + shade * 0.28),
    )


def nearest_opaque_color(image: Image.Image, x: int, y: int) -> tuple[int, int, int, int]:
    pixels = image.load()
    width, height = image.size
    candidates = []
    for radius in range(1, 5):
        for ny in range(max(0, y - radius), min(height, y + radius + 1)):
            for nx in range(max(0, x - radius), min(width, x + radius + 1)):
                color = pixels[nx, ny]
                if color[3] == 0:
                    continue
                distance = (nx - x) * (nx - x) + (ny - y) * (ny - y)
                candidates.append((distance, color))
        if candidates:
            candidates.sort(key=lambda item: item[0])
            return candidates[0][1]
    return (52, 88, 13, 255)


def close_alpha_chips(image: Image.Image, min_neighbors: int = 7) -> int:
    pixels = image.load()
    width, height = image.size
    total = 0

    for _pass in range(3):
        chips = []
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                if pixels[x, y][3] != 0:
                    continue
                opaque_neighbors = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        if pixels[x + dx, y + dy][3] > 0:
                            opaque_neighbors += 1
                if opaque_neighbors >= min_neighbors:
                    chips.append((x, y))

        if not chips:
            break
        for x, y in chips:
            pixels[x, y] = nearest_opaque_color(image, x, y)
        total += len(chips)

    return total


def nearby_body_count(body_points: set[tuple[int, int]], x: int, y: int, radius: int = 3) -> int:
    count = 0
    for ny in range(y - radius, y + radius + 1):
        for nx in range(x - radius, x + radius + 1):
            if (nx, ny) in body_points:
                count += 1
    return count


def transparent_row_interior_leaks(image: Image.Image, body_points: set[tuple[int, int]]) -> set[tuple[int, int]]:
    pixels = image.load()
    width, height = image.size
    leaks: set[tuple[int, int]] = set()

    for y in range(height):
        body_xs = [x for x in range(width) if (x, y) in body_points]
        if len(body_xs) < 8:
            continue
        left, right = min(body_xs), max(body_xs)
        for x in range(left, right + 1):
            if pixels[x, y][3] != 0:
                continue
            if nearby_body_count(body_points, x, y) >= 10:
                leaks.add((x, y))

    return leaks


def is_dark_pixel(color: tuple[int, int, int, int]) -> bool:
    r, g, b, a = color
    return a > 0 and r < 42 and g < 52 and b < 42


def is_outline_mud_pixel(color: tuple[int, int, int, int]) -> bool:
    r, g, b, a = color
    if a == 0 or is_slime_body_color(color) or is_white_feature(color):
        return False
    return (r < 95 and g < 90 and b < 65) or (r > 55 and g < 85 and b < 70)


def is_white_feature(color: tuple[int, int, int, int]) -> bool:
    r, g, b, a = color
    return a > 0 and r > 180 and g > 180 and b > 165


def is_soft_eye_feature(color: tuple[int, int, int, int]) -> bool:
    r, g, b, a = color
    if a == 0:
        return False
    return r > 130 and g > 130 and b > 110 and not is_slime_body_color(color)


def is_sleep_preserved_pixel(color: tuple[int, int, int, int]) -> bool:
    r, g, b, a = color
    if a == 0:
        return False
    return is_sleep_symbol_color(color) or is_dark_pixel(color) or (r > 70 and g < 80 and b < 70)


def near_white_feature(image: Image.Image, x: int, y: int, radius: int = 2) -> bool:
    pixels = image.load()
    width, height = image.size
    for ny in range(max(0, y - radius), min(height, y + radius + 1)):
        for nx in range(max(0, x - radius), min(width, x + radius + 1)):
            if is_white_feature(pixels[nx, ny]):
                return True
    return False


def near_transparency(image: Image.Image, x: int, y: int, radius: int = 5) -> bool:
    pixels = image.load()
    width, height = image.size
    for ny in range(max(0, y - radius), min(height, y + radius + 1)):
        for nx in range(max(0, x - radius), min(width, x + radius + 1)):
            if pixels[nx, ny][3] == 0:
                return True
    return False


def nearby_point_count(points: set[tuple[int, int]], x: int, y: int, radius: int = 2) -> int:
    count = 0
    for ny in range(y - radius, y + radius + 1):
        for nx in range(x - radius, x + radius + 1):
            if (nx, ny) in points:
                count += 1
    return count


def largest_feature_component(image: Image.Image, predicate) -> set[tuple[int, int]]:
    pixels = image.load()
    width, height = image.size
    seen: set[tuple[int, int]] = set()
    largest: set[tuple[int, int]] = set()

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or not predicate(pixels[x, y]):
                continue

            queue = deque([(x, y)])
            seen.add((x, y))
            component: set[tuple[int, int]] = set()

            while queue:
                px, py = queue.popleft()
                component.add((px, py))
                for nx in (px - 1, px, px + 1):
                    for ny in (py - 1, py, py + 1):
                        if nx == px and ny == py:
                            continue
                        if nx < 0 or ny < 0 or nx >= width or ny >= height:
                            continue
                        if (nx, ny) in seen or not predicate(pixels[nx, ny]):
                            continue
                        seen.add((nx, ny))
                        queue.append((nx, ny))

            if len(component) > len(largest):
                largest = component

    return largest


def slime_eye_points(image: Image.Image) -> set[tuple[int, int]]:
    white_core = largest_feature_component(image, is_white_feature)
    if not white_core:
        return set()

    pixels = image.load()
    width, height = image.size
    left, top, right, bottom = body_bounds(white_core)
    eye_points = set(white_core)

    for y in range(max(0, top - 3), min(height, bottom + 4)):
        for x in range(max(0, left - 3), min(width, right + 4)):
            if not is_soft_eye_feature(pixels[x, y]):
                continue
            if nearby_point_count(white_core, x, y, 3):
                eye_points.add((x, y))

    return eye_points


def eye_preserve_points(image: Image.Image, eye_points: set[tuple[int, int]]) -> set[tuple[int, int]]:
    if not eye_points:
        return set()

    pixels = image.load()
    width, height = image.size
    left, top, right, bottom = body_bounds(eye_points)
    preserve = set(eye_points)

    for y in range(max(0, top - 2), min(height, bottom + 3)):
        for x in range(max(0, left - 2), min(width, right + 3)):
            if is_dark_pixel(pixels[x, y]) and nearby_point_count(eye_points, x, y, 2):
                preserve.add((x, y))

    return preserve


def removable_body_intrusions(
    image: Image.Image,
    body_points: set[tuple[int, int]],
    preserve_points: set[tuple[int, int]],
) -> set[tuple[int, int]]:
    pixels = image.load()
    width, height = image.size
    removable: set[tuple[int, int]] = set()

    for y in range(height):
        body_xs = [x for x in range(width) if (x, y) in body_points]
        if len(body_xs) < 8:
            continue

        left, right = min(body_xs), max(body_xs)
        for x in range(left, right + 1):
            if (x, y) in preserve_points or is_sleep_symbol_color(pixels[x, y]):
                continue
            body_count = nearby_body_count(body_points, x, y)
            if pixels[x, y][3] == 0 and body_count >= 10:
                removable.add((x, y))
            elif (is_outline_mud_pixel(pixels[x, y]) or is_soft_eye_feature(pixels[x, y])) and body_count >= 8:
                removable.add((x, y))

    for y in range(height):
        for x in range(width):
            if (x, y) in removable or (x, y) in preserve_points:
                continue
            if not (is_outline_mud_pixel(pixels[x, y]) or is_soft_eye_feature(pixels[x, y])):
                continue
            if is_sleep_symbol_color(pixels[x, y]):
                continue
            if nearby_body_count(body_points, x, y) >= 24 and not near_transparency(image, x, y):
                removable.add((x, y))

    return removable


def draw_eye_outline(image: Image.Image, eye_points: set[tuple[int, int]]) -> int:
    if not eye_points:
        return 0

    pixels = image.load()
    width, height = image.size
    outline_points: set[tuple[int, int]] = set()

    for x, y in eye_points:
        for ny in range(y - 1, y + 2):
            for nx in range(x - 1, x + 2):
                if nx < 0 or ny < 0 or nx >= width or ny >= height:
                    continue
                if (nx, ny) in eye_points or is_sleep_symbol_color(pixels[nx, ny]):
                    continue
                if pixels[nx, ny][3] > 0:
                    outline_points.add((nx, ny))

    changed = 0
    for x, y in outline_points:
        if pixels[x, y] != CLEAN_EYE_OUTLINE:
            pixels[x, y] = CLEAN_EYE_OUTLINE
            changed += 1

    return changed


def final_interior_intrusions(
    image: Image.Image,
    body_points: set[tuple[int, int]],
    preserve_points: set[tuple[int, int]],
) -> set[tuple[int, int]]:
    pixels = image.load()
    width, height = image.size
    intrusions: set[tuple[int, int]] = set()

    for y in range(height):
        for x in range(width):
            if (x, y) in preserve_points or is_sleep_symbol_color(pixels[x, y]):
                continue

            outline_mud = is_outline_mud_pixel(pixels[x, y])
            stray_light = is_soft_eye_feature(pixels[x, y])
            if not outline_mud and not stray_light:
                continue
            if outline_mud and near_white_feature(image, x, y, 7):
                continue
            if near_transparency(image, x, y):
                continue
            if nearby_body_count(body_points, x, y) >= 16:
                intrusions.add((x, y))

    return intrusions


def fill_final_interior_intrusions(
    image: Image.Image,
    preserve_points: set[tuple[int, int]],
    max_passes: int = 8,
) -> int:
    pixels = image.load()
    changed = 0

    for _pass in range(max_passes):
        body_points = largest_body_component(image)
        if not body_points:
            break

        intrusions = final_interior_intrusions(image, body_points, preserve_points)
        if not intrusions:
            break

        bounds = body_bounds(body_points | intrusions)
        for x, y in intrusions:
            pixels[x, y] = (*target_body_color(SLIME_BASE, x, y, bounds), 255)
        changed += len(intrusions)

    return changed


def removable_dark_specks(image: Image.Image, body_points: set[tuple[int, int]]) -> set[tuple[int, int]]:
    pixels = image.load()
    width, height = image.size
    seen: set[tuple[int, int]] = set()
    removable: set[tuple[int, int]] = set()

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or not is_dark_pixel(pixels[x, y]):
                continue

            queue = deque([(x, y)])
            seen.add((x, y))
            component: list[tuple[int, int]] = []
            touches_transparency = False
            touches_white = False
            body_neighbors = 0

            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                if near_white_feature(image, px, py):
                    touches_white = True

                for ny in range(max(0, py - 2), min(height, py + 3)):
                    for nx in range(max(0, px - 2), min(width, px + 3)):
                        if (nx, ny) in body_points:
                            body_neighbors += 1
                        if pixels[nx, ny][3] == 0:
                            touches_transparency = True

                for nx, ny in (
                    (px - 1, py),
                    (px + 1, py),
                    (px, py - 1),
                    (px, py + 1),
                    (px - 1, py - 1),
                    (px + 1, py - 1),
                    (px - 1, py + 1),
                    (px + 1, py + 1),
                ):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    if (nx, ny) in seen or not is_dark_pixel(pixels[nx, ny]):
                        continue
                    seen.add((nx, ny))
                    queue.append((nx, ny))

            if len(component) <= 24 and body_neighbors >= len(component) * 2 and not touches_transparency and not touches_white:
                removable.update(component)

    return removable


def sleep_pose_body_points(image: Image.Image) -> set[tuple[int, int]]:
    pixels = image.load()
    width, height = image.size
    points: set[tuple[int, int]] = set()
    body_top = None

    for y in range(height):
        row_body_pixels = [
            x
            for x in range(width)
            if pixels[x, y][3] > 0 and not is_sleep_symbol_color(pixels[x, y]) and not is_sleep_preserved_pixel(pixels[x, y])
        ]
        if y > 35 and len(row_body_pixels) >= 16:
            body_top = y
            break

    if body_top is None:
        return largest_body_component(image)

    for y in range(body_top, height):
        row_silhouette = [x for x in range(width) if pixels[x, y][3] > 0 and not is_sleep_symbol_color(pixels[x, y])]
        if len(row_silhouette) < 8:
            continue
        left, right = min(row_silhouette), max(row_silhouette)
        if right - left < 14:
            continue
        for x in range(left, right + 1):
            if is_sleep_preserved_pixel(pixels[x, y]):
                continue
            points.add((x, y))

    return points


def sleep_symbol_components(image: Image.Image) -> list[list[tuple[int, int]]]:
    pixels = image.load()
    width, height = image.size
    seen = set()
    components = []

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or pixels[x, y][3] == 0:
                continue
            queue = deque([(x, y)])
            seen.add((x, y))
            points = []
            has_symbol = False

            while queue:
                px, py = queue.popleft()
                points.append((px, py))
                if is_sleep_symbol_color(pixels[px, py]):
                    has_symbol = True
                for nx in (px - 1, px, px + 1):
                    for ny in (py - 1, py, py + 1):
                        if nx == px and ny == py:
                            continue
                        if nx < 0 or ny < 0 or nx >= width or ny >= height:
                            continue
                        if (nx, ny) in seen or pixels[nx, ny][3] == 0:
                            continue
                        seen.add((nx, ny))
                        queue.append((nx, ny))

            if has_symbol:
                components.append(points)

    return components


def repair_sleep_pose() -> int:
    # The sleep frame has its own lower, wider pose. Keep that pose intact;
    # repainting happens in smooth_frame like the other states.
    return 0


def smooth_frame(path: Path) -> int:
    total_changed = normalize_idle_pose_height(path) if path.name.startswith("idle_") else 0
    state = path.name.split("_")[0]

    for _iteration in range(2):
        fix_frame(path)
        image = Image.open(path).convert("RGBA")
        pixels = image.load()
        changed = remove_disconnected_debris(image)
        body_points = sleep_pose_body_points(image) if path.name == "emote_d_0.png" else largest_body_component(image)
        if not body_points:
            if changed:
                image.save(path, optimize=True)
                total_changed += changed
            continue

        for _pass in range(8):
            before = len(body_points)
            body_points.update(transparent_row_interior_leaks(image, body_points))
            if len(body_points) == before:
                break
        eye_points = slime_eye_points(image) if path.name != "emote_d_0.png" else set()
        preserve_points = eye_preserve_points(image, eye_points)
        if state in AGGRESSIVE_BODY_STATES:
            for _intrusion_pass in range(4):
                intrusions = removable_body_intrusions(image, body_points, preserve_points)
                if not intrusions:
                    break
                before = len(body_points)
                body_points.update(intrusions)
                if len(body_points) == before:
                    break
        body_points.update(removable_dark_specks(image, body_points))

        bounds = body_bounds(body_points)
        base = SLIME_BASE

        for x, y in body_points:
            if (x, y) in preserve_points:
                continue
            target_r, target_g, target_b = target_body_color(base, x, y, bounds)
            pixels[x, y] = (
                target_r,
                target_g,
                target_b,
                255,
            )
            changed += 1
        changed += close_alpha_chips(image)
        if state in AGGRESSIVE_BODY_STATES:
            changed += fill_final_interior_intrusions(image, preserve_points)
        changed += draw_eye_outline(image, eye_points)
        changed += remove_disconnected_debris(image)

        if changed:
            image.save(path, optimize=True)
            fix_frame(path)
        total_changed += changed

    return total_changed


def smooth_all() -> int:
    total = 0
    for path in sorted(SLIME_DIR.glob("*.png")):
        if path.name == "emote_d_0.png":
            continue
        fixed = smooth_frame(path)
        total += fixed
        if fixed:
            print(f"{path.name}: smoothed {fixed} body pixels")
    sleep_symbols = repair_sleep_pose()
    if sleep_symbols:
        print(f"emote_d_0.png: rebuilt sleep pose with {sleep_symbols} symbol pixels")
    sleep_fixed = smooth_frame(SLIME_DIR / "emote_d_0.png")
    total += sleep_symbols + sleep_fixed
    if sleep_fixed:
        print(f"emote_d_0.png: smoothed {sleep_fixed} body pixels")
    print(f"smoothed {total} slime body pixels")
    return total


def main() -> None:
    smooth_all()


if __name__ == "__main__":
    main()
