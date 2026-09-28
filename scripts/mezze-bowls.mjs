/**
 * Cuts the bowl out of each mezze photo for the menu's mezze strip.
 *
 * The restaurant's mezze shots share one layout: logo above the bowl, an
 * "Entrées" pill and the dish name below it, both overlapping the bowl's rim
 * and base. Cropping in CSS either shows those labels or cuts the bowl, so this
 * fits the bowl's outline (an ellipse above and below its widest row), drops
 * everything outside it, and fills the few rim and base pixels the labels hid
 * from the surrounding ceramic.
 *
 * Writes public/assets/menu/bowls/<dish>-bowl.png and WebP variants, and adds
 * them to src/imageAssets.json the way scripts/optimize-assets.py names them.
 * Like menu-images-webp.mjs, it runs in the Playwright browser's canvas.
 *
 * Usage: node scripts/mezze-bowls.mjs
 */
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const menu = join(root, "public/assets/menu");
const bowls = join(menu, "bowls");
const optimized = join(root, "public/assets/optimized");
const manifestPath = join(root, "src/imageAssets.json");
const sources = {
  houmous: "Houmous.png",
  baba: "baba ghanosh.png",
  moutabal: "moutabal.png",
  muhammara: "muhammara.png",
};

/** Runs in the page: returns the cut-out PNG and its WebP variants. */
async function cutOut({ src, sizes }) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const W = image.naturalWidth;
  const H = image.naturalHeight;
  const canvas = new OffscreenCanvas(W, H);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, W, H);
  const d = pixels.data;
  const at = (x, y) => (y * W + x) * 4;
  const median = (values) =>
    values.sort((a, b) => a - b)[Math.floor(values.length / 2)];

  // Opaque extent of each row.
  const left = new Int32Array(H).fill(-1);
  const right = new Int32Array(H).fill(-1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[at(x, y) + 3] > 128) {
        if (left[y] < 0) left[y] = x;
        right[y] = x;
      }
  const half = (y) => (right[y] - left[y]) / 2;

  // The bowl is widest across the middle of the shot; the name label below it
  // can be wider still, so only look there.
  let widest = 0;
  for (let y = Math.round(H * 0.3); y < H * 0.7; y++)
    widest = Math.max(widest, half(y));
  const plateau = [];
  for (let y = Math.round(H * 0.3); y < H * 0.7; y++)
    if (half(y) >= widest - 1.5) plateau.push(y);
  const cy = (plateau[0] + plateau[plateau.length - 1]) / 2;
  const a = widest;
  const cx = median(plateau.map((y) => (left[y] + right[y]) / 2));

  // Top of the pill: the first teal under the bowl's middle. (A light blue
  // rim, as on the houmous bowl, is bluer than the pill's teal.)
  const teal = (i) =>
    d[i + 3] > 200 &&
    d[i + 1] - d[i] > 30 &&
    d[i + 2] - d[i] > 30 &&
    Math.abs(d[i + 2] - d[i + 1]) < 25;
  let pillTop = H;
  for (let y = Math.round(cy + H * 0.12); y < H && pillTop === H; y++) {
    let count = 0;
    for (let x = Math.round(cx - W * 0.08); x < cx + W * 0.08; x++)
      if (teal(at(x, y))) count++;
    if (count >= 3) pillTop = y;
  }

  // Vertical semi-axes from the rows neither the logo nor the labels touch.
  const semiAxis = (from, to) => {
    const values = [];
    for (let y = Math.round(from); y < to; y++) {
      const ratio = half(y) / a;
      if (ratio < 0.98)
        values.push(Math.abs(y - cy) / Math.sqrt(1 - ratio * ratio));
    }
    return median(values);
  };
  const top = semiAxis(cy - H * 0.22, cy - H * 0.05);
  const bottom = semiAxis(cy + H * 0.08, pillTop - H * 0.01);

  // Signed distance to the fitted outline, in pixels (positive inside).
  const inside = (x, y) => {
    const u = (x - cx) / a;
    const v = (y - cy) / (y < cy ? top : bottom);
    const r = Math.hypot(u, v) || 1e-6;
    const gradient = Math.hypot(u / (a * r), v / ((y < cy ? top : bottom) * r));
    return (1 - r) / gradient;
  };
  const coverage = (x, y, grow) =>
    Math.min(1, Math.max(0, inside(x + 0.5, y + 0.5) + grow + 0.5));
  // Visible pixels may sit a little outside the fit.
  const slack = 4;
  // The bowl's grey. Alpha is left out so its own soft edge still counts.
  const ceramic = (i) => {
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    return max - min < 45 && d[i + 1] - d[i] < 25 && max < 185;
  };
  const logo = (i) => {
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    return (
      d[i + 3] > 40 && ((min > 200 && max - min < 40) || d[i + 1] - d[i] > 30)
    );
  };
  const opaque = (x, y) => d[at(x, y) + 3] >= 128;

  // How much of each pixel stays (0-1), and which of those the labels hid.
  const alpha = new Float32Array(W * H);
  const hidden = new Uint8Array(W * H);
  const baseFrom = pillTop - 3;

  // Above the widest row, the fitted outline drops the logo around the rim;
  // below it, nothing overlaps the bowl until the labels.
  for (let y = 0; y < baseFrom; y++)
    for (let x = 0; x < W; x++) {
      const own = d[at(x, y) + 3] / 255;
      alpha[y * W + x] = y < cy ? Math.min(own, coverage(x, y, slack)) : own;
    }
  // Where the logo reaches down onto the rim, follow its white and teal
  // outline from above.
  const rimTop = Math.round(cy - top);
  const logoFrom = rimTop - 12;
  const logoTo = Math.round(rimTop + H * 0.05);
  const stack = [];
  for (let x = 0; x < W; x++)
    if (logo(at(x, logoFrom)))
      (stack.push(logoFrom * W + x), (hidden[logoFrom * W + x] = 1));
  while (stack.length) {
    const p = stack.pop();
    const x = p % W;
    const y = (p - x) / W;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      const q = ny * W + nx;
      if (nx < 0 || nx >= W || ny < logoFrom || ny > logoTo) continue;
      if (hidden[q] || !logo(at(nx, ny))) continue;
      hidden[q] = 1;
      stack.push(q);
    }
  }

  // The base: each column keeps its own edge where the photo shows it. Where
  // the pill or name label covers it, the edge follows the fitted outline,
  // shifted to meet the visible edge on either side.
  const edge = new Float32Array(W).fill(-1); // -1: the bowl ends above the pill
  const shown = new Uint8Array(W);
  for (let x = Math.ceil(cx - a); x < cx + a; x++) {
    if (!opaque(x, baseFrom)) continue;
    let y = baseFrom;
    while (y < H - 1 && opaque(x, y) && ceramic(at(x, y))) y++;
    edge[x] = y;
    shown[x] = opaque(x, y) ? 0 : 1;
  }
  const fitted = (x) =>
    cy + bottom * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / a) ** 2));
  const offset = (x) => (shown[x] ? edge[x] - fitted(x) : 0);
  for (let x = 0; x < W; x++) {
    if (edge[x] < 0 || shown[x]) continue;
    let end = x;
    while (end + 1 < W && edge[end + 1] >= 0 && !shown[end + 1]) end++;
    const before = offset(Math.max(0, x - 1));
    const after = offset(Math.min(W - 1, end + 1));
    for (let column = x; column <= end; column++) {
      const t = (column - x + 1) / (end - x + 2);
      edge[column] = fitted(column) + before + (after - before) * t;
    }
    x = end;
  }
  for (let y = baseFrom; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const own = d[at(x, y) + 3] / 255;
      if (edge[x] < 0) alpha[p] = y < baseFrom + 3 ? own : 0;
      else if (shown[x]) alpha[p] = y <= edge[x] + 1 ? own : 0;
      else {
        const next = edge[Math.min(W - 1, x + 1)];
        const previous = edge[Math.max(0, x - 1)];
        const slope = next >= 0 && previous >= 0 ? (next - previous) / 2 : 0;
        const depth = (edge[x] - y - 0.5) / Math.hypot(1, slope);
        alpha[p] = Math.min(1, Math.max(0, depth + 0.5));
        const visible =
          ceramic(at(x, y)) && d[at(x, y) + 3] > 250 && depth > 1.5;
        if (alpha[p] > 0 && !visible) hidden[p] = 1;
      }
    }

  // Widen by a few pixels to take the labels' soft edges and shadows too.
  for (let pass = 0; pass < 4; pass++) {
    const grown = hidden.slice();
    for (let y = 1; y < H - 1; y++) {
      if (y > logoTo && y < baseFrom) continue;
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x;
        if (!hidden[p] && alpha[p] > 0)
          if (hidden[p - 1] || hidden[p + 1] || hidden[p - W] || hidden[p + W])
            grown[p] = 1;
      }
    }
    hidden.set(grown);
  }
  // On the rim, what the logo covered takes the fitted outline's edge.
  for (let y = logoFrom; y <= logoTo; y++)
    for (let x = 0; x < W; x++)
      if (hidden[y * W + x]) alpha[y * W + x] = coverage(x, y, 0);

  // Fill the hidden pixels from the ceramic around them: interpolate across
  // each row, then relax towards the neighbours' average.
  const fill = [];
  const slot = new Int32Array(W * H).fill(-1);
  for (let p = 0; p < W * H; p++)
    if (hidden[p] && alpha[p] > 0) slot[p] = fill.push(p) - 1;
  const known = (q) => slot[q] < 0 && alpha[q] > 0.98 && d[q * 4 + 3] > 250;
  const color = new Float32Array(fill.length * 3);
  fill.forEach((p, k) => {
    const x = p % W;
    const y = (p - x) / W;
    let l = x - 1;
    let r = x + 1;
    while (l >= 0 && !known(y * W + l) && x - l < 500) l--;
    while (r < W && !known(y * W + r) && r - x < 500) r++;
    const hasLeft = l >= 0 && known(y * W + l);
    const hasRight = r < W && known(y * W + r);
    let from = (y * W + (hasLeft ? l : r)) * 4;
    let to = (y * W + (hasRight ? r : l)) * 4;
    let t = hasLeft && hasRight ? (x - l) / (r - l) : 0;
    if (!hasLeft && !hasRight) {
      let v = y;
      const step = y < cy ? 1 : -1;
      while (!known(v * W + x) && v > 0 && v < H - 1) v += step;
      from = to = (v * W + x) * 4;
      t = 0;
    }
    for (let c = 0; c < 3; c++)
      color[k * 3 + c] = d[from + c] + (d[to + c] - d[from + c]) * t;
  });
  const neighbours = fill.map((p) =>
    [p - 1, p + 1, p - W, p + W].filter((q) => slot[q] >= 0 || known(q)),
  );
  for (let pass = 0; pass < 800; pass++)
    fill.forEach((_, k) => {
      const around = neighbours[k];
      if (!around.length) return;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (const q of around)
          sum += slot[q] >= 0 ? color[slot[q] * 3 + c] : d[q * 4 + c];
        color[k * 3 + c] += 1.8 * (sum / around.length - color[k * 3 + c]);
      }
    });
  // Give the filled ceramic back some grain.
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  fill.forEach((p, k) => {
    const grain = random() * 10;
    for (let c = 0; c < 3; c++) d[p * 4 + c] = color[k * 3 + c] + grain;
  });
  for (let p = 0; p < W * H; p++) d[p * 4 + 3] = Math.round(alpha[p] * 255);
  context.putImageData(pixels, 0, 0);

  // Crop to the bowl.
  let lowest = 0;
  for (let p = 0; p < W * H; p++) if (alpha[p] > 0) lowest = Math.floor(p / W);
  const x0 = Math.max(0, Math.floor(cx - a - 6));
  const x1 = Math.min(W, Math.ceil(cx + a + 6));
  const y0 = Math.max(0, Math.floor(cy - top - 6));
  const y1 = Math.min(H, lowest + 6);
  const encode = async (width, type, quality) => {
    const height = Math.round(((y1 - y0) * width) / (x1 - x0));
    const out = new OffscreenCanvas(width, height);
    const outContext = out.getContext("2d");
    outContext.imageSmoothingQuality = "high";
    outContext.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, width, height);
    const blob = await out.convertToBlob({ type, quality });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { width, height, data: btoa(binary) };
  };
  const width = x1 - x0;
  return {
    fit: { cx, cy, a, top, bottom, pillTop },
    png: await encode(width, "image/png"),
    webp: await Promise.all(
      [...new Set(sizes.map((size) => Math.min(size, width)))].map((size) =>
        encode(size, "image/webp", 0.86),
      ),
    ),
  };
}

mkdirSync(bowls, { recursive: true });
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [dish, file] of Object.entries(sources)) {
  const src =
    "data:image/png;base64," +
    readFileSync(join(menu, file)).toString("base64");
  const { fit, png, webp } = await page.evaluate(cutOut, {
    src,
    sizes: [384, 768, 1280],
  });
  // "-bowl" keeps the WebP names apart from those of the photo it came from.
  const name = `${dish}-bowl`;
  const key = `/assets/menu/bowls/${name}.png`;
  // Replace this script's previous variants, and only those.
  for (const entry of (manifest[key]?.srcSet ?? "").split(", ").filter(Boolean))
    rmSync(join(root, "public", entry.split(" ")[0]), { force: true });
  writeFileSync(join(bowls, `${name}.png`), Buffer.from(png.data, "base64"));
  const variants = webp.map(({ width, data }) => {
    const bytes = Buffer.from(data, "base64");
    const digest = createHash("sha256")
      .update(bytes)
      .digest("hex")
      .slice(0, 12);
    const file = `${name}-${width}-${digest}.webp`;
    writeFileSync(join(optimized, file), bytes);
    return [`/assets/optimized/${file}`, width];
  });
  manifest[key] = {
    src: variants[variants.length - 1][0],
    srcSet: variants.map(([path, width]) => `${path} ${width}w`).join(", "),
    width: png.width,
    height: png.height,
  };
  const rounded = (_, value) =>
    typeof value === "number" ? Math.round(value) : value;
  console.log(name, `${png.width}x${png.height}`, JSON.stringify(fit, rounded));
}
await browser.close();
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
