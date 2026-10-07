import { createRng, hashSeed, type Rng } from '../core/rng';
import { classify, BIOMES } from './biome';
import {
  addBlock,
  addProps,
  makeWorldFields,
  urbanityAt,
  type CityConfig,
  type Building,
  type Prop,
  type Streetlight,
  type Lane,
  type WorldFields,
} from './City';
import type { Aabb } from '../systems/Collision';

/**
 * Infinite, deterministic world generation for the streamed world (P3, see
 * docs/research/generative-world.md). Everything is a pure function of
 * `(seed, worldX, worldZ)`: each block is seeded by `hashSeed(seed, i, j)`, so a
 * block is identical regardless of which chunk loads it or when — and the biome
 * comes from the continuous `urbanity` field sampled at world coords, so the
 * gradient is seamless across chunk borders with no stitching pass.
 *
 * Coordinate model (no finite `-half` shift, unlike City): roads run along every
 * multiple of `cell` on both axes, so intersections sit at `(i*cell, j*cell)` and
 * the ORIGIN is an intersection — a clean spawn. Block (i,j) fills the square
 * between road i and road i+1; its origin (NW corner of the buildable area) is
 * `(i*cell + roadWidth/2, j*cell + roadWidth/2)` and its side is `blockSize`.
 *
 * Reuses City's block/prop builders and biome/noise sampling — one source of
 * truth for how a block looks; only the coordinate framing differs.
 */
export interface ChunkData {
  buildings: Building[];
  colliders: Aabb[];
  props: Prop[];
  streetlights: Streetlight[];
}

export const cellOf = (config: CityConfig): number => config.blockSize + config.roadWidth;

/** World-space side length of one chunk (chunkBlocks × cell). */
export const chunkSpan = (config: CityConfig): number => config.chunkBlocks * cellOf(config);

/** The chunk index a world coordinate falls in. */
export const chunkCoordOf = (world: number, config: CityConfig): number =>
  Math.floor(world / chunkSpan(config));

export const chunkKey = (cx: number, cz: number): string => `${cx}:${cz}`;

/** Build the (continuous, seed-derived) noise fields once; share across chunks. */
export { makeWorldFields };

/**
 * Generate one chunk's worth of content in absolute world coordinates. Pure and
 * deterministic: same (cx,cz,seed) ⇒ identical chunk, independent of neighbours.
 */
export function generateChunk(cx:number,cz:number,config:CityConfig,fields:WorldFields):ChunkData {
  const city=generateCity(config);
  const span=chunkSpan(config);
  const minX=cx*span,minZ=cz*span,maxX=minX+span,maxZ=minZ+span;
  const inChunk=(x:number,z:number,pad=0)=>x>=minX-pad&&x<maxX+pad&&z>=minZ-pad&&z<maxZ+pad;
  return {
    buildings:city.buildings.filter(b=>inChunk(b.cx,b.cz,Math.max(b.width,b.depth)/2)),
    colliders:city.colliders.filter(c=>c.maxX>=minX&&c.minX<=maxX&&c.maxZ>=minZ&&c.minZ<=maxZ),
    props:city.props.filter(p=>inChunk(p.x,p.z,2)),
    streetlights:city.streetlights.filter(s=>inChunk(s.x,s.z,2)),
  };
}

/** Chunk coords within Chebyshev `radius` of (cx,cz), nearest-first. */
export function chunksInRing(cx: number, cz: number, radius: number): Array<{ cx: number; cz: number }> {
  const out: Array<{ cx: number; cz: number }> = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      out.push({ cx: cx + dx, cz: cz + dz });
    }
  }
  out.sort((a, b) => Math.max(Math.abs(a.cx - cx), Math.abs(a.cz - cz)) - Math.max(Math.abs(b.cx - cx), Math.abs(b.cz - cz)));
  return out;
}

/**
 * A traffic lane near (x,z) plus a spawn position on it `ahead` metres from the
 * point (used to relocate ambient cars around the player in the streamed world).
 * Lane direction matches City's convention so cars drive on the correct side.
 */
export function spawnLaneNear(
  x: number,
  z: number,
  rng: Rng,
  config: CityConfig,
  ahead: number,
): { lane: Lane; x: number; z: number } {
  const cell = cellOf(config);
  const laneOffset = config.roadWidth / 4;
  const side = rng.chance(0.5) ? -1 : 1;
  const along = (rng.chance(0.5) ? 1 : -1) * ahead;
  if (rng.chance(0.5)) {
    const roadZ = Math.round(z / cell) * cell;
    const fixed = roadZ + side * laneOffset;
    const dir: 1 | -1 = side < 0 ? 1 : -1;
    return { lane: { axis: 'x', fixed, dir }, x: x + along, z: fixed };
  }
  const roadX = Math.round(x / cell) * cell;
  const fixed = roadX + side * laneOffset;
  const dir: 1 | -1 = side < 0 ? -1 : 1;
  return { lane: { axis: 'z', fixed, dir }, x: fixed, z: z + along };
}
