export const OBSTACLES = [
  { x: -16, z: -4, hx: 4.1, hz: 3.5, name: "house" },
  { x: 16, z: -3, hx: 4.1, hz: 3.5, name: "house" },
  { x: -16, z: 16, hx: 4.1, hz: 3.5, name: "house" },
  { x: 16, z: 16, hx: 4.1, hz: 3.5, name: "house" },
  { x: -12, z: -12, hx: 4.8, hz: 3.8, name: "shop" },
  { x: 12, z: -12, hx: 4.8, hz: 3.8, name: "shop" },
  { x: -12, z: 13, hx: 4.8, hz: 3.8, name: "shop" },
  { x: 12, z: 13, hx: 4.8, hz: 3.8, name: "shop" },
  { x: -9.6, z: -1, hx: 0.5, hz: 0.5, name: "palm" },
  { x: 9.6, z: -1, hx: 0.5, hz: 0.5, name: "palm" },
  { x: -9.6, z: 6, hx: 0.5, hz: 0.5, name: "palm" },
  { x: 9.6, z: 6, hx: 0.5, hz: 0.5, name: "palm" },
  { x: -7.2, z: 3, hx: 0.8, hz: 0.4, name: "bench" },
  { x: 7.4, z: 4, hx: 0.4, hz: 0.4, name: "bin" }
];

export const ROUTES = [
  [[4.2, -46], [4.2, -4.2], [46, -4.2], [46, 4.2], [-46, 4.2], [-46, -4.2], [-4.2, -4.2], [-4.2, 46], [4.2, 46], [4.2, 4.2], [46, 4.2]],
  [[-4.2, 46], [-4.2, 4.2], [-46, 4.2], [-46, -4.2], [46, -4.2], [46, 4.2], [4.2, 4.2], [4.2, -46], [-4.2, -46], [-4.2, -4.2]],
  [[-40, 4.2], [40, 4.2], [40, -4.2], [-40, -4.2]]
];

export function hits(x, z, radius = 0.42, extra = []) {
  const boxes = OBSTACLES.concat(extra);
  return boxes.some((o) => Math.abs(x - o.x) < o.hx + radius && Math.abs(z - o.z) < o.hz + radius);
}

export function slide(x, z, nx, nz, radius = 0.42, extra = []) {
  if (!hits(nx, nz, radius, extra)) return { x: nx, z: nz };
  if (!hits(nx, z, radius, extra)) return { x: nx, z };
  if (!hits(x, nz, radius, extra)) return { x, z: nz };
  return { x, z };
}
