import { useEffect, useRef, useState } from "react";

type Mesh = { vertices: Float32Array; indices: Uint16Array };
type Renderer = { draw: (progress: number) => void; dispose: () => void };

// A restrained half-turn follows the same eased progress as the sandwich layers.
const START_ANGLE = 20;
const SCROLL_ROTATION = 180;

const vertexShader = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec2 aUv;
  uniform float uAngle;
  uniform float uAspect;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    float c = cos(uAngle), s = sin(uAngle);
    vec3 p = aPosition, n = aNormal;
    p.xz = mat2(c, -s, s, c) * p.xz;
    n.xz = mat2(c, -s, s, c) * n.xz;
    float tilt = 0.09;
    p.yz = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * p.yz;
    n.yz = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * n.yz;
    vNormal = n;
    vUv = aUv;
    gl_Position = vec4(p.x / (1.42 * uAspect), p.y / 1.42, -p.z / 4.0, 1.0);
  }
`;
const fragmentShader = `
  precision mediump float;
  uniform sampler2D uTexture;
  uniform float uMetal;
  uniform vec4 uMeatBounds;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 light = normalize(vec3(-0.6, 0.8, 1.3));
    float diffuse = max(0.0, dot(n, light));
    vec2 uv = mix(uMeatBounds.xy, uMeatBounds.zw, vUv);
    float taper = max(0.0, vUv.y - 0.55) * 0.40;
    uv.x = mix(uMeatBounds.x + taper, uMeatBounds.z - taper, vUv.x);
    vec4 photo = texture2D(uTexture, uv);
    vec3 meat = mix(vec3(0.64, 0.34, 0.10), photo.rgb, photo.a);
    vec3 base = mix(meat, vec3(0.48, 0.53, 0.52), uMetal);
    float shine = pow(max(0.0, dot(n, normalize(light + vec3(0.0, 0.0, 1.0)))), 45.0);
    vec3 color = base * (0.70 + diffuse * 0.38) + vec3(1.0, 0.92, 0.76) * shine * mix(0.04, 0.75, uMetal);
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** A tapered lathe with irregular ridges models the stacked meat in the photo. */
function lathe(
  rings: number,
  segments: number,
  height: number,
  center: number,
  radius: (t: number, angle: number) => number,
): Mesh {
  const vertices: number[] = [],
    indices: number[] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    for (let segment = 0; segment <= segments; segment++) {
      const u = segment / segments,
        angle = u * Math.PI * 2;
      const r = radius(t, angle);
      const slope =
        (radius(Math.min(1, t + 0.012), angle) -
          radius(Math.max(0, t - 0.012), angle)) /
        (0.024 * height);
      const normalLength = Math.hypot(1, slope);
      vertices.push(
        r * Math.cos(angle),
        center + (t - 0.5) * height,
        r * Math.sin(angle),
        Math.cos(angle) / normalLength,
        -slope / normalLength,
        Math.sin(angle) / normalLength,
        u,
        1 - t,
      );
      if (ring < rings && segment < segments) {
        const a = ring * (segments + 1) + segment,
          b = a + segments + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  // Close the top and bottom so a full turn never exposes an empty shell.
  for (const end of [0, 1]) {
    const centerIndex = vertices.length / 8;
    vertices.push(
      0,
      center + (end - 0.5) * height,
      0,
      0,
      end ? 1 : -1,
      0,
      0.5,
      1 - end,
    );
    const row = end * rings * (segments + 1);
    for (let segment = 0; segment < segments; segment++)
      indices.push(centerIndex, row + segment, row + segment + 1);
  }
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}

function meatRadius(t: number, angle: number) {
  const profile = [
    [0, 0.13],
    [0.025, 0.27],
    [0.1, 0.34],
    [0.32, 0.43],
    [0.62, 0.53],
    [0.86, 0.56],
    [0.96, 0.49],
    [1, 0.3],
  ];
  let segment = 0;
  while (segment < profile.length - 2 && t > profile[segment + 1][0]) segment++;
  const [a, ra] = profile[segment],
    [b, rb] = profile[segment + 1];
  const shape = ra + (rb - ra) * ((t - a) / (b - a));
  const ridges =
    0.018 * Math.sin(t * Math.PI * 54 + Math.sin(angle * 7)) +
    0.012 * Math.sin(angle * 13 + t * 41) +
    0.008 * Math.cos(angle * 23 - t * 57);
  return shape + ridges;
}

function createRenderer(
  canvas: HTMLCanvasElement,
  photo: HTMLImageElement,
): Renderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });
  if (!gl) return null;
  const resources: (() => void)[] = [];
  const dispose = () =>
    resources
      .splice(0)
      .reverse()
      .forEach((release) => release());
  try {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Shader unavailable");
      resources.push(() => gl.deleteShader(shader));
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error("Shader compilation failed");
      return shader;
    };
    const program = gl.createProgram();
    if (!program) throw new Error("Program unavailable");
    resources.push(() => gl.deleteProgram(program));
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Program linking failed");
    gl.useProgram(program);
    const texture = gl.createTexture();
    if (!texture) throw new Error("Texture unavailable");
    resources.push(() => gl.deleteTexture(texture));
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photo);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const position = gl.getAttribLocation(program, "aPosition"),
      normal = gl.getAttribLocation(program, "aNormal"),
      uv = gl.getAttribLocation(program, "aUv");
    const angle = gl.getUniformLocation(program, "uAngle"),
      aspect = gl.getUniformLocation(program, "uAspect"),
      metal = gl.getUniformLocation(program, "uMetal");
    // The crop stays inside the meat, excluding the alpha surround and metal rod.
    gl.uniform4f(
      gl.getUniformLocation(program, "uMeatBounds"),
      0.27,
      0.16,
      0.73,
      0.85,
    );
    gl.uniform1i(gl.getUniformLocation(program, "uTexture"), 0);
    const upload = (mesh: Mesh, metallic: number) => {
      const vertices = gl.createBuffer(),
        indices = gl.createBuffer();
      if (!vertices || !indices) throw new Error("Buffer unavailable");
      resources.push(() => {
        gl.deleteBuffer(vertices);
        gl.deleteBuffer(indices);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      return () => {
        gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
        for (const [location, size, offset] of [
          [position, 3, 0],
          [normal, 3, 12],
          [uv, 2, 24],
        ]) {
          gl.enableVertexAttribArray(location);
          gl.vertexAttribPointer(location, size, gl.FLOAT, false, 32, offset);
        }
        gl.uniform1f(metal, metallic);
        gl.drawElements(
          gl.TRIANGLES,
          mesh.indices.length,
          gl.UNSIGNED_SHORT,
          0,
        );
      };
    };
    const body = upload(lathe(84, 64, 1.93, 0.01, meatRadius), 0);
    const rod = upload(
      lathe(2, 20, 2.65, 0.01, () => 0.024),
      1,
    );
    const collar = upload(
      lathe(4, 28, 0.065, -1.025, (t) => (t === 0 || t === 1 ? 0.025 : 0.1)),
      1,
    );
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    return {
      draw(progress) {
        const width = canvas.clientWidth,
          height = canvas.clientHeight;
        if (!width || !height || gl.isContextLost()) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const renderWidth = Math.round(width * ratio),
          renderHeight = Math.round(height * ratio);
        if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
          canvas.width = renderWidth;
          canvas.height = renderHeight;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);
        const degrees = START_ANGLE + progress * SCROLL_ROTATION;
        gl.uniform1f(angle, (degrees * Math.PI) / 180);
        gl.uniform1f(aspect, width / height);
        rod();
        collar();
        body();
        canvas.dataset.renderedProgress = progress.toFixed(4);
        canvas.dataset.angle = degrees.toFixed(2);
      },
      dispose,
    };
  } catch {
    dispose();
    return null;
  }
}

export function RotisserieModel({ motion }: { motion: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    photo = useRef<HTMLImageElement>(null);
  const [renderer, setRenderer] = useState("image");
  const [missing, setMissing] = useState(false);
  // A small decoration behind the sandwich: it downloads once the app runs,
  // after the prerendered page has painted, rather than alongside it.
  const [source, setSource] = useState<string>();
  useEffect(() => setSource("/assets/hero/rotisserie-cutout.webp"), []);
  useEffect(() => {
    const element = canvas.current,
      image = photo.current;
    const scene = element?.closest<HTMLElement>(".shawarma-scene");
    if (!element || !image || !scene || !motion) {
      setRenderer("image");
      return;
    }
    let instance: Renderer | null = null,
      pending = 0,
      visible = true,
      building: (() => void) | null = null,
      disposed = false;
    const draw = () => {
      pending = 0;
      if (visible && !document.hidden)
        instance?.draw(Number(scene.dataset.progress || 0));
    };
    const requestDraw = () => {
      if (!pending) pending = requestAnimationFrame(draw);
    };
    // At rest the model matches the cutout already on screen, so it is built
    // when the page is idle, from a photo decoded off the main thread, rather
    // than competing with the page load.
    const build = () => {
      building = null;
      void image
        .decode()
        .catch(() => {})
        .then(() => {
          if (disposed || instance || !image.naturalWidth) return;
          instance = createRenderer(element, image);
          if (instance) {
            draw();
            setRenderer("webgl");
          }
        });
    };
    const load = () => {
      if (!image.naturalWidth || instance || building) return;
      if (typeof requestIdleCallback === "function") {
        const id = requestIdleCallback(build, { timeout: 2000 });
        building = () => cancelIdleCallback(id);
      } else {
        const id = setTimeout(build, 200);
        building = () => clearTimeout(id);
      }
    };
    // A lost context uses the same transparent cutout instead of a blank canvas.
    const lost = () => {
      cancelAnimationFrame(pending);
      instance = null;
      setRenderer("image");
    };
    element.addEventListener("webglcontextlost", lost);
    image.addEventListener("load", load);
    if (image.complete) load();
    // Scroll already runs in rAF: paint its shared progress without a second-frame delay.
    const changes = new MutationObserver(() => {
      if (visible && !document.hidden)
        instance?.draw(Number(scene.dataset.progress || 0));
    });
    changes.observe(scene, {
      attributes: true,
      attributeFilter: ["data-progress"],
    });
    const size = new ResizeObserver(requestDraw);
    size.observe(element);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) requestDraw();
    });
    visibility.observe(element);
    document.addEventListener("visibilitychange", requestDraw);
    return () => {
      disposed = true;
      building?.();
      cancelAnimationFrame(pending);
      changes.disconnect();
      size.disconnect();
      visibility.disconnect();
      image.removeEventListener("load", load);
      element.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", requestDraw);
      instance?.dispose();
    };
  }, [motion]);
  return (
    <div
      className="shawarma-rotisserie"
      aria-hidden="true"
      data-renderer={renderer}
      hidden={missing}
    >
      <img
        ref={photo}
        src={source}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setMissing(true)}
      />
      <canvas ref={canvas} className="rotisserie-model" />
    </div>
  );
}
