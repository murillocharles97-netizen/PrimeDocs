from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"


def interpolate(start, end, amount):
    return tuple(round(a + (b - a) * amount) for a, b in zip(start, end))


def rounded_gradient(size, safe_padding=0):
    scale = 2
    canvas_size = size * scale
    image = Image.new("RGBA", (canvas_size, canvas_size), (7, 11, 31, 255))
    pixels = image.load()
    purple = (139, 92, 246)
    blue = (59, 130, 246)
    cyan = (34, 211, 238)

    for y in range(canvas_size):
        for x in range(canvas_size):
            amount = (x + y) / (2 * (canvas_size - 1))
            first = interpolate(purple, blue, min(amount * 2, 1))
            color = interpolate(first, cyan, max((amount - 0.5) * 2, 0))
            pixels[x, y] = (*color, 255)

    mask = Image.new("L", (canvas_size, canvas_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = round(canvas_size * 0.22)
    inset = safe_padding * scale
    mask_draw.rounded_rectangle(
        (inset, inset, canvas_size - inset - 1, canvas_size - inset - 1),
        radius=radius,
        fill=255,
    )

    background = Image.new("RGBA", image.size, (7, 11, 31, 255))
    background.alpha_composite(Image.composite(image, Image.new("RGBA", image.size), mask))

    draw = ImageDraw.Draw(background)
    center = canvas_size // 2
    cube_radius = round(canvas_size * 0.245)
    top = (center, center - cube_radius)
    right = (center + cube_radius, center - round(cube_radius * 0.48))
    bottom_right = (center + cube_radius, center + round(cube_radius * 0.55))
    bottom = (center, center + cube_radius)
    bottom_left = (center - cube_radius, center + round(cube_radius * 0.55))
    left = (center - cube_radius, center - round(cube_radius * 0.48))
    line_width = max(6, round(canvas_size * 0.035))
    glow_width = line_width * 3

    edges = [
        (top, right, bottom_right, bottom, bottom_left, left, top),
        (left, (center, center), right),
        ((center, center), bottom),
    ]

    for points in edges:
        draw.line(points, fill=(34, 211, 238, 55), width=glow_width, joint="curve")
    for points in edges:
        draw.line(points, fill=(255, 255, 255, 245), width=line_width, joint="curve")

    return background.resize((size, size), Image.Resampling.LANCZOS)


def main():
    ASSETS.mkdir(exist_ok=True)
    rounded_gradient(192).save(ASSETS / "icon-192.png", optimize=True)
    rounded_gradient(512).save(ASSETS / "icon-512.png", optimize=True)
    rounded_gradient(512, safe_padding=52).save(
        ASSETS / "icon-maskable-512.png",
        optimize=True,
    )


if __name__ == "__main__":
    main()
