const backgrounds = new Map<string, Promise<string | null>>();

// Read the border only, so food and lettering do not set the tile colour.
function borderColour(image: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(image, 0, 0, 32, 32);
    const { data } = context.getImageData(0, 0, 32, 32);
    const colours = new Map<string, { count: number; rgb: number[] }>();
    let opaque = 0;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (x !== 0 && x !== 31 && y !== 0 && y !== 31) continue;
        const offset = (y * 32 + x) * 4;
        if (data[offset + 3] < 250) continue;
        opaque++;
        const rgb = Array.from(data.slice(offset, offset + 3));
        const key = rgb.map((value) => Math.floor(value / 24)).join(",");
        const group = colours.get(key) ?? { count: 0, rgb: [0, 0, 0] };
        group.count++;
        rgb.forEach((value, channel) => (group.rgb[channel] += value));
        colours.set(key, group);
      }
    }
    // Transparent cutouts keep the site's existing decorative background.
    if (opaque < 100) return null;
    const dominant = [...colours.values()].sort((a, b) => b.count - a.count)[0];
    if (!dominant) return null;
    return `rgb(${dominant.rgb.map((value) => Math.round(value / dominant.count)).join(", ")})`;
  } catch {
    // A remote server may allow display but disallow reading image pixels.
    return null;
  }
}

function imageBackground(image: HTMLImageElement): Promise<string | null> {
  const source = image.currentSrc || image.src;
  let result = backgrounds.get(source);
  if (!result) {
    result = new Promise((resolve) => {
      if (new URL(source).origin === window.location.origin) {
        resolve(borderColour(image));
      } else {
        // The displayed image stays untouched if the server disallows CORS.
        const sample = new Image();
        sample.crossOrigin = "anonymous";
        sample.onload = () => resolve(borderColour(sample));
        sample.onerror = () => resolve(null);
        sample.src = source;
      }
    });
    backgrounds.set(source, result);
  }
  return result;
}

export function resetFoodBackground(image: HTMLImageElement) {
  const frame = image.closest<HTMLElement>(
    ".food-stage, .family-art, .product-modal-art",
  );
  if (frame) {
    frame.style.removeProperty("--photo-background");
    delete frame.dataset.photoBackground;
  }
  return frame;
}

export async function syncFoodBackground(image: HTMLImageElement) {
  const frame = resetFoodBackground(image);
  if (!frame) return;
  // Menu cards and dish previews use the chosen shared brand colour.
  if (frame.matches(".food-stage, .product-modal-art")) return;
  const source = image.currentSrc || image.src;
  const colour = await imageBackground(image);
  if (!image.isConnected || (image.currentSrc || image.src) !== source) return;
  if (colour) {
    frame.style.setProperty("--photo-background", colour);
    frame.dataset.photoBackground = "matched";
  }
}
