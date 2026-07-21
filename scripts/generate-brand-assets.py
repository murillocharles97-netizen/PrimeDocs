from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SCALE = 4
BASE = 512
_HIGH_GRADIENT = None


def gradient(size):
    image = Image.new("RGBA", (size, size))
    pixels = image.load()
    stops = ((0.0, (155, 114, 255)), (0.48, (109, 93, 253)), (0.82, (86, 52, 215)), (1.0, (34, 211, 238)))
    for y in range(size):
        for x in range(size):
            t = min(1.0, max(0.0, (x * 0.44 + y * 0.56) / max(1, size - 1)))
            for index in range(len(stops) - 1):
                start, start_color = stops[index]
                end, end_color = stops[index + 1]
                if start <= t <= end:
                    amount = (t - start) / (end - start)
                    color = tuple(round(a + (b - a) * amount) for a, b in zip(start_color, end_color))
                    pixels[x, y] = (*color, 255)
                    break
    return image


def points(values, factor=1):
    return [(round(x * factor), round(y * factor)) for x, y in values]


def draw_symbol(image, color=(255, 255, 255, 255), factor=SCALE):
    draw = ImageDraw.Draw(image)
    width = round(28 * factor)
    check_width = round(25 * factor)
    outer = points([(256, 94), (404, 180), (404, 351), (256, 436), (108, 351), (108, 180), (256, 94)], factor)
    top = points([(109, 180), (256, 266), (403, 180)], factor)
    center = points([(256, 266), (256, 436)], factor)
    check = points([(286, 330), (318, 361), (384, 286)], factor)
    draw.line(outer, fill=color, width=width, joint="curve")
    draw.line(top, fill=color, width=width, joint="curve")
    draw.line(center, fill=color, width=width)
    draw.line(check, fill=color, width=check_width, joint="curve")
    radius = width // 2
    for path in (outer, top, center):
        for x, y in (path[0], path[-1]):
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    check_radius = check_width // 2
    for x, y in (check[0], check[-1]):
        draw.ellipse((x - check_radius, y - check_radius, x + check_radius, y + check_radius), fill=color)


def render_icon(size, maskable=False, transparent=False):
    global _HIGH_GRADIENT
    canvas_size = BASE * SCALE
    if transparent:
        base = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    else:
        if _HIGH_GRADIENT is None:
            _HIGH_GRADIENT = gradient(canvas_size)
        base = _HIGH_GRADIENT.copy()
    if not maskable:
        alpha = Image.new("L", (canvas_size, canvas_size), 0)
        ImageDraw.Draw(alpha).rounded_rectangle((0, 0, canvas_size - 1, canvas_size - 1), radius=116 * SCALE, fill=255)
        base.putalpha(alpha)
        border = ImageDraw.Draw(base)
        border.rounded_rectangle((14 * SCALE, 14 * SCALE, 498 * SCALE, 498 * SCALE), radius=104 * SCALE, outline=(255, 255, 255, 46), width=6 * SCALE)
    draw_symbol(base)
    return base.resize((size, size), Image.Resampling.LANCZOS)


def save_png(name, size, **options):
    render_icon(size, **options).save(ASSETS / name, optimize=True)


save_png("icon-192.png", 192)
save_png("icon-512.png", 512)
save_png("icon-maskable-192.png", 192, maskable=True)
save_png("icon-maskable-512.png", 512, maskable=True)
save_png("icon-adaptive-foreground.png", 512, transparent=True)
gradient(512).save(ASSETS / "icon-adaptive-background.png", optimize=True)
save_png("apple-touch-icon.png", 180, maskable=True)
save_png("favicon-32.png", 32)
save_png("splash-icon-512.png", 512)

favicon_images = [render_icon(size) for size in (16, 32, 48)]
favicon_images[0].save(ASSETS / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=favicon_images[1:])

mono = Image.new("RGBA", (512 * SCALE, 512 * SCALE), (0, 0, 0, 0))
draw_symbol(mono)
mono.resize((512, 512), Image.Resampling.LANCZOS).save(ASSETS / "icon-monochrome-512.png", optimize=True)

print("PrimeDocs brand assets generated.")
