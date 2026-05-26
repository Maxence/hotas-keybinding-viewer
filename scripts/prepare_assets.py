from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCEFILES_DIR = ROOT / "sourcefiles"
OUTPUT_DIR = ROOT / "public" / "assets" / "devices"


def remove_background_and_crop(
    source_path: Path,
    crop_box: tuple[int, int, int, int],
    output_path: Path,
    low_threshold: float = 8.0,
    high_threshold: float = 34.0,
    padding: int = 16,
) -> None:
    image = Image.open(source_path).convert("RGBA")
    image_crop = image.crop(crop_box)
    pixels = np.array(image_crop, dtype=np.uint8)
    rgb = pixels[:, :, :3].astype(np.float32)

    # White background is inferred from border pixels to keep this script resilient
    # if source brightness changes slightly.
    border = np.concatenate(
        [rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]], axis=0
    )
    bg = np.median(border, axis=0)

    dist = np.linalg.norm(rgb - bg, axis=2)
    alpha = ((dist - low_threshold) / (high_threshold - low_threshold) * 255).clip(0, 255)

    # Hard clear very bright pixels to avoid light halos.
    lightness = rgb.mean(axis=2)
    alpha[lightness > 245] = 0
    pixels[:, :, 3] = alpha.astype(np.uint8)

    out = Image.fromarray(pixels, mode="RGBA")
    bbox = out.getbbox()
    if bbox:
        left, top, right, bottom = bbox
        bbox = (
            max(0, left - padding),
            max(0, top - padding),
            min(out.width, right + padding),
            min(out.height, bottom + padding),
        )
        out = out.crop(bbox)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(output_path)


def copy_reference_image(source_name: str, destination_relative_path: str) -> None:
    source_path = SOURCEFILES_DIR / source_name
    destination_path = OUTPUT_DIR / destination_relative_path
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    destination_path.write_bytes(source_path.read_bytes())


def main() -> None:
    source_main = SOURCEFILES_DIR / "oc_whitebg-solr4-1-1000x1000.webp"

    remove_background_and_crop(
        source_path=source_main,
        crop_box=(0, 220, 470, 900),
        output_path=OUTPUT_DIR / "throttle" / "throttle-main.png",
    )
    remove_background_and_crop(
        source_path=source_main,
        crop_box=(430, 80, 1000, 940),
        output_path=OUTPUT_DIR / "joystick" / "joystick-main.png",
    )

    # Additional reference angles.
    copy_reference_image(
        source_name="oc_lifestyletextes-solr4-8-fr-1000x1000.webp",
        destination_relative_path="throttle/throttle-angle-top.webp",
    )
    copy_reference_image(
        source_name="oc_lifestyletextes-solr4-3-fr-1000x1000.webp",
        destination_relative_path="joystick/joystick-angle-base-top.webp",
    )
    copy_reference_image(
        source_name="oc_lifestyletextes-solr4-2-fr-1000x1000.webp",
        destination_relative_path="joystick/joystick-angle-grip.webp",
    )
    copy_reference_image(
        source_name="oc_whitebg-solr4-7-1000x1000.webp",
        destination_relative_path="overview-dimensions.webp",
    )

    print("Assets generated in:", OUTPUT_DIR)


if __name__ == "__main__":
    main()
