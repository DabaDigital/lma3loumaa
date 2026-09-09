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
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
assets = root / "public/assets"
output = assets / "optimized"
output.mkdir(exist_ok=True)
manifest = {}
original_bytes = delivery_bytes = 0
for source in sorted(assets.rglob("*")):
    if source.suffix.lower() not in (".png", ".jpg", ".jpeg") or output in source.parents:
        continue
    # Tab artwork is handled separately below.
    if source.name.startswith("lma3louma-tab"):
        continue
    with Image.open(source) as original:
        picture = ImageOps.exif_transpose(original).convert("RGBA")
        width, height = picture.size
        sizes = [128, 256, 384] if source.name == "lma3louma-logo.png" else [384, 768, 1280]
        variants = []
        for size in sorted({min(n, width) for n in sizes}):
            resized = picture.resize((size, round(height * size / width)), Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            resized.save(buffer, format="WEBP", quality=86, method=6)
            data = buffer.getvalue()
            digest = hashlib.sha256(data).hexdigest()[:12]
            slug = re.sub(r"[^a-z0-9]+", "-", source.stem.lower()).strip("-")
            name = f"{slug}-{size}-{digest}.webp"
            (output / name).write_bytes(data)
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

# Preserve the exact circular artwork and its clipping, at favicon resolution.
svg_source = assets / "lma3louma-tab-circle.svg"
svg = svg_source.read_text(encoding="utf-8")
embedded = re.search(r"data:image/jpeg;base64,([^\"]+)", svg)
with Image.open(io.BytesIO(base64.b64decode(embedded[1]))) as artwork:
    artwork.thumbnail((128, 128), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    artwork.save(buffer, format="PNG", optimize=True)
    svg = svg.replace(embedded[0], "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode())
(assets / "favicon.svg").write_text(svg, encoding="utf-8")

# Lossless font container compression; preserve all glyphs and shaping tables.
css_path = assets / "fonts.css"
css = css_path.read_text(encoding="utf-8")
font_sources = sorted(set(re.findall(r"/assets/fonts/([^)'\"]+)\.(?:ttf|otf|woff2)", css)))
for stem in font_sources:
    source = next((assets / "fonts").glob(f"{stem}.[to]tf"))
    font = TTFont(source, recalcTimestamp=False)
    font.flavor = "woff2"
    font.save(source.with_suffix(".woff2"))
    css = re.sub(rf"{re.escape(stem)}\.(?:ttf|otf)", stem + ".woff2", css)
css = css.replace("format('truetype')", "format('woff2')").replace("format('opentype')", "format('woff2')")
css_path.write_text(css, encoding="utf-8")
print(f"Images, largest variants: {original_bytes:,} -> {delivery_bytes:,} bytes")
print(f"Favicon: {svg_source.stat().st_size:,} -> {(assets / 'favicon.svg').stat().st_size:,} bytes")
