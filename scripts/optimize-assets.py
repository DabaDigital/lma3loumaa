"""Generate local delivery assets; originals remain editable sources.

Requires Pillow, fonttools and brotli. Run from the repository root.
"""
import base64
import hashlib
import io
import json
import re
from pathlib import Path

from PIL import Image, ImageOps
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
assets = root / "public/assets"
output = assets / "optimized"
output.mkdir(exist_ok=True)
manifest = {}
written = set()
original_bytes = delivery_bytes = 0
# Widths follow the drawn size. The logo spans 119-155 CSS px. The rotisserie
# cutout is drawn 90-150 CSS px wide (shawarmaScene.css) and is also the WebGL
# model's texture. The reveal layers are one file: hidden until scrolling opens
# them, then drawn up to ~600 device px wide.
widths = {
    "lma3louma-logo.png": [128, 256, 384],
    "rotisserie-cutout.png": [192, 256, 384, 512],
    "shawarma-exploded.png": [768],
}
for source in sorted(assets.rglob("*")):
    if source.suffix.lower() not in (".png", ".jpg", ".jpeg") or output in source.parents:
        continue
    # Tab artwork is handled separately below; menuShowcase.css draws the
    # showcase decorations from their own files.
    if source.name.startswith("lma3louma-tab") or "menu-showcase" in source.parts:
        continue
    with Image.open(source) as original:
        picture = ImageOps.exif_transpose(original).convert("RGBA")
        width, height = picture.size
        sizes = widths.get(source.name, [320, 384, 512, 768, 1280])
        variants = []
        for size in sorted({min(n, width) for n in sizes}):
            resized = picture.resize((size, round(height * size / width)), Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            # About 1/6 byte per pixel, Lighthouse's target. At their drawn
            # sizes these look the same as quality 86 with lossless alpha,
            # which is a third larger (most photos are transparent cutouts).
            resized.save(buffer, format="WEBP", quality=75, alpha_quality=60, method=6)
            data = buffer.getvalue()
            digest = hashlib.sha256(data).hexdigest()[:12]
            slug = re.sub(r"[^a-z0-9]+", "-", source.stem.lower()).strip("-")
            name = f"{slug}-{size}-{digest}.webp"
            (output / name).write_bytes(data)
            written.add(name)
            variants.append((f"/assets/optimized/{name}", size))
        manifest["/" + source.relative_to(root / "public").as_posix()] = {
            "src": variants[-1][0],
            "srcSet": ", ".join(f"{path} {size}w" for path, size in variants),
            "width": width,
            "height": height,
        }
        original_bytes += source.stat().st_size
        delivery_bytes += len(data)

(root / "src/imageAssets.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
# Versions from earlier settings, or of removed photos, are no longer referenced.
for stale in output.glob("*.webp"):
    if stale.name not in written:
        stale.unlink()

# Preserve the exact circular artwork and its clipping, at favicon resolution.
svg_source = assets / "lma3louma-tab-circle.svg"
svg = svg_source.read_text(encoding="utf-8")
embedded = re.search(r"data:image/jpeg;base64,([^\"]+)", svg)
with Image.open(io.BytesIO(base64.b64decode(embedded[1]))) as artwork:
    # Twice the largest size a tab icon is drawn at (32px).
    artwork.thumbnail((64, 64), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    artwork.save(buffer, format="PNG", optimize=True)
    svg = svg.replace(embedded[0], "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode())
(assets / "favicon.svg").write_text(svg, encoding="utf-8")

# Lossless font container compression; preserve all glyphs and shaping tables.
# A face named <source>-<subset>.woff2 (latin, arabic, punctuation) is cut from its source
# font to the unicode-range the @font-face declares, keeping every glyph and
# shaping rule those characters use, so a page downloads only what it shows.
css_path = assets / "fonts.css"
css = css_path.read_text(encoding="utf-8")


def unicodes(declared):
    points = []
    for part in declared.split(","):
        first, _, last = part.strip()[2:].partition("-")
        points.extend(range(int(first, 16), int(last or first, 16) + 1))
    return points


for block in re.findall(r"@font-face \{(.*?)\}", css, re.S):
    match = re.search(r"/assets/fonts/([^)'\"]+?)(?:-(latin|arabic|punctuation))?\.(?:ttf|otf|woff2)", block)
    if not match:
        continue
    stem, subset_name = match.groups()
    source = next((assets / "fonts").glob(f"{stem}.[to]tf"))
    font = TTFont(source, recalcTimestamp=False)
    if subset_name:
        options = subset.Options()
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.notdef_outline = True
        options.hinting = True
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=unicodes(re.search(r"unicode-range:([^;]+);", block)[1]))
        subsetter.subset(font)
    font.flavor = "woff2"
    font.save(source.with_name(f"{stem}-{subset_name}.woff2" if subset_name else f"{stem}.woff2"))
css = re.sub(r"(/assets/fonts/[^)'\"]+)\.(?:ttf|otf)\)", r"\1.woff2)", css)
css = css.replace("format('truetype')", "format('woff2')").replace("format('opentype')", "format('woff2')")
css_path.write_text(css, encoding="utf-8")
print(f"Images, largest variants: {original_bytes:,} -> {delivery_bytes:,} bytes")
print(f"Favicon: {svg_source.stat().st_size:,} -> {(assets / 'favicon.svg').stat().st_size:,} bytes")
