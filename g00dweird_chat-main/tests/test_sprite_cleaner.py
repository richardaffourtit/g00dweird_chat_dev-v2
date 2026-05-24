import json
from pathlib import Path

from PIL import Image

from scripts import sprite_cleaner


def _make_sheet(path: Path) -> None:
    image = Image.new("RGBA", (8, 4), (255, 0, 0, 255))
    pixels = image.load()
    for x in (1, 2):
        for y in (1, 2):
            pixels[x, y] = (0, 0, 0, 255)
    for x in (5, 6):
        for y in (1, 2):
            pixels[x, y] = (0, 0, 255, 255)
    pixels[4, 0] = (255, 8, 5, 255)
    image.save(path)


def test_cleaner_keys_red_background_and_writes_descriptor(tmp_path):
    source_dir = tmp_path / "assets"
    source_dir.mkdir()
    source = source_dir / "hero_4x4.png"
    _make_sheet(source)

    config = sprite_cleaner.default_config()
    config.update(
        {
            "inputDirs": [str(source_dir)],
            "outputDir": str(tmp_path / "public" / "assets" / "cleaned-sprites"),
            "padding": 1,
            "frameSizeOverrides": {"hero_4x4.png": {"w": 4, "h": 4}},
            "manualOverridesFile": str(tmp_path / "manual-overrides.json"),
        }
    )

    result = sprite_cleaner.run_cleaner(config, root=tmp_path)

    assert result["processed"] == 1
    descriptor_path = tmp_path / "public" / "assets" / "cleaned-sprites" / "descriptors" / "hero_4x4.json"
    sheet_path = tmp_path / "public" / "assets" / "cleaned-sprites" / "hero_4x4.png"
    descriptor = json.loads(descriptor_path.read_text())
    cleaned = Image.open(sheet_path).convert("RGBA")

    assert descriptor["frameCount"] == 2
    assert descriptor["frameWidth"] == 4
    assert descriptor["frameHeight"] == 4
    assert descriptor["frames"][0]["bbox"] == {"x": 1, "y": 1, "w": 2, "h": 2}
    assert cleaned.getpixel((0, 0))[3] == 0
    assert all(frame["duplicateOf"] is None for frame in descriptor["frames"])


def test_manual_overrides_replace_bbox_and_pivot(tmp_path):
    source_dir = tmp_path / "assets"
    source_dir.mkdir()
    source = source_dir / "hero_4x4.png"
    _make_sheet(source)
    overrides = {
        "hero_4x4": {
            "source": str(source),
            "frames": {
                "1": {
                    "bbox": {"x": 4, "y": 0, "w": 4, "h": 4},
                    "pivot": {"x": 0.25, "y": 0.75},
                    "disabled": False,
                }
            },
        }
    }
    override_path = tmp_path / "manual-overrides.json"
    override_path.write_text(json.dumps(overrides))

    config = sprite_cleaner.default_config()
    config.update(
        {
            "inputDirs": [str(source_dir)],
            "outputDir": str(tmp_path / "public" / "assets" / "cleaned-sprites"),
            "frameSizeOverrides": {"hero_4x4.png": {"w": 4, "h": 4}},
            "manualOverridesFile": str(override_path),
        }
    )

    sprite_cleaner.run_cleaner(config, root=tmp_path)

    descriptor_path = tmp_path / "public" / "assets" / "cleaned-sprites" / "descriptors" / "hero_4x4.json"
    descriptor = json.loads(descriptor_path.read_text())

    assert descriptor["frames"][1]["bbox"] == {"x": 4, "y": 0, "w": 4, "h": 4}
    assert descriptor["frames"][1]["pivot"] == {"x": 0.25, "y": 0.75}
