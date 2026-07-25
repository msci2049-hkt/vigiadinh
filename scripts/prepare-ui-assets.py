from pathlib import Path

from PIL import Image, ImageChops, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "fe" / "apps" / "web" / "public" / "assets"
SOURCE = ASSETS / "source"
PAPER = (253, 252, 247, 255)


def cell(image: Image.Image, column: int, row: int, columns: int, rows: int) -> Image.Image:
    left = round(image.width * column / columns)
    top = round(image.height * row / rows)
    right = round(image.width * (column + 1) / columns)
    bottom = round(image.height * (row + 1) / rows)
    return image.crop((left, top, right, bottom)).convert("RGBA")


def subject_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    background = Image.new("RGBA", image.size, PAPER)
    difference = ImageChops.difference(image, background).convert("L")
    mask = difference.point(lambda value: 255 if value > 16 else 0)
    return mask.getbbox() or (0, 0, image.width, image.height)


def normalize(image: Image.Image, size: tuple[int, int], fill: float = 0.88) -> Image.Image:
    cropped = image.crop(subject_bbox(image))
    max_width = round(size[0] * fill)
    max_height = round(size[1] * fill)
    scale = min(max_width / cropped.width, max_height / cropped.height)
    resized = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    cropped = cropped.resize(resized, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, PAPER)
    left = (size[0] - cropped.width) // 2
    top = (size[1] - cropped.height) // 2
    canvas.alpha_composite(cropped, (left, top))
    return canvas


def save_people() -> None:
    sheet = Image.open(SOURCE / "banker-pose-sheet.png")
    poses = [
        ("banker-open-left.png", 0, 0),
        ("banker-present-right.png", 1, 0),
        ("banker-half-arms.png", 2, 0),
        ("banker-point-up.png", 3, 0),
        ("banker-seated.png", 1, 1),
        ("banker-walk.png", 2, 1),
        ("banker-tablet.png", 3, 1),
    ]
    target = ASSETS / "people"
    target.mkdir(parents=True, exist_ok=True)
    for name, column, row in poses:
        normalized = normalize(cell(sheet, column, row, 4, 2), (960, 1280))
        normalized.convert("RGB").save(target / name, optimize=True, quality=94)
    portrait = normalize(cell(sheet, 0, 1, 4, 2), (1254, 1254), fill=0.96)
    portrait.convert("RGB").save(target / "banker-portrait.png", optimize=True, quality=94)


def save_mascot() -> None:
    sheet = Image.open(SOURCE / "mascot-pose-sheet.png")
    names = ["mascot-wave", "mascot-fingerprint", "mascot-wait", "mascot-comfort"]
    target = ASSETS / "mascot"
    target.mkdir(parents=True, exist_ok=True)
    for column, name in enumerate(names):
        normalized = normalize(cell(sheet, column, 0, 4, 1), (640, 640), fill=0.84)
        normalized.convert("RGB").save(target / f"{name}.png", optimize=True, quality=94)


def save_avatars() -> None:
    sheet = Image.open(SOURCE / "guardian-sheet.png")
    names = ["mom", "brother", "aunt", "uncle", "sister", "grandfather"]
    target = ASSETS / "avatars"
    target.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(names):
        portrait = normalize(cell(sheet, index % 3, index // 3, 3, 2), (512, 512), fill=0.96)
        for size in (52, 104, 160):
            output = ImageOps.fit(portrait.convert("RGB"), (size, size), Image.Resampling.LANCZOS)
            output.save(target / f"{name}-{size}.webp", "WEBP", quality=90, method=6)


if __name__ == "__main__":
    save_people()
    save_mascot()
    save_avatars()
