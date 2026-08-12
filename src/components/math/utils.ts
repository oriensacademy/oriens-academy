export type PlotDomain = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  width: number;
  height: number;
  padding?: number;
};

/** Maps a real (x, y) coordinate to pixel space within an SVG viewBox. */
export function toPixel(x: number, y: number, domain: PlotDomain): { x: number; y: number } {
  const { xMin, xMax, yMin, yMax, width, height, padding = 0 } = domain;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  return {
    x: padding + ((x - xMin) / (xMax - xMin)) * innerW,
    y: padding + innerH - ((y - yMin) / (yMax - yMin)) * innerH,
  };
}

/** Samples a real function across the domain and returns an SVG path `d` string. */
export function plotPath(fn: (x: number) => number, domain: PlotDomain, samples = 100): string {
  const { xMin, xMax } = domain;
  const points: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    const y = fn(x);
    if (!Number.isFinite(y)) continue;
    const p = toPixel(x, y, domain);
    points.push(`${points.length === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
  return points.join(" ");
}

/** Numerical derivative (central difference) — used for real tangent lines. */
export function derivative(fn: (x: number) => number, x: number, h = 0.0001): number {
  return (fn(x + h) - fn(x - h)) / (2 * h);
}
