from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCEFILES_DIR = ROOT / "sourcefiles"
JOYDESIGN_DIR = SOURCEFILES_DIR / "joydesign"
OUTPUT_DIR = ROOT / "public" / "assets" / "devices"


def crop_image(
    source_name: str,
    crop_box: tuple[int, int, int, int],
    destination_relative_path: str,
) -> None:
    source_path = JOYDESIGN_DIR / source_name
    destination_path = OUTPUT_DIR / destination_relative_path
    destination_path.parent.mkdir(parents=True, exist_ok=True)

    image = Image.open(source_path).convert("RGB")
    image.crop(crop_box).save(destination_path)


def copy_image(source_name: str, destination_relative_path: str) -> None:
    source_path = JOYDESIGN_DIR / source_name
    destination_path = OUTPUT_DIR / destination_relative_path
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    destination_path.write_bytes(source_path.read_bytes())


def main() -> None:
    # Front view composition split into two per-device panels.
    crop_image(
        source_name="ChatGPT Image 26 mai 2026, 19_45_46.png",
        crop_box=(0, 360, 720, 1130),
        destination_relative_path="throttle/throttle-front.png",
    )
    crop_image(
        source_name="ChatGPT Image 26 mai 2026, 19_45_46.png",
        crop_box=(560, 0, 1254, 1220),
        destination_relative_path="joystick/joystick-front.png",
    )

    # Angled view composition split into two per-device panels.
    crop_image(
        source_name="ChatGPT Image 26 mai 2026, 19_48_10.png",
        crop_box=(0, 300, 780, 1120),
        destination_relative_path="throttle/throttle-angled.png",
    )
    crop_image(
        source_name="ChatGPT Image 26 mai 2026, 19_48_10.png",
        crop_box=(620, 0, 1254, 1150),
        destination_relative_path="joystick/joystick-angled.png",
    )

    # Dedicated detail references.
    copy_image(
        source_name="ChatGPT Image 26 mai 2026, 19_51_11.png",
        destination_relative_path="throttle/throttle-multi-angle.png",
    )
    copy_image(
        source_name="ChatGPT Image 26 mai 2026, 20_57_35.png",
        destination_relative_path="joystick/joystick-base-top.png",
    )
    copy_image(
        source_name="ChatGPT Image 26 mai 2026, 19_55_31.png",
        destination_relative_path="joystick/joystick-grip-closeup.png",
    )

    print("Assets generated from joydesign in:", OUTPUT_DIR)


if __name__ == "__main__":
    main()
