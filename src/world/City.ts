import { createRng, hashSeed } from '../core/rng';
import { makeNoise2D, fbm, type Noise2D } from '../core/noise';
import type { BiomeDef } from './biome';
import type { Aabb } from '../systems/Collision';
import { SpatialGrid } from '../systems/SpatialGrid';
import type { PropType, FacadeStyle } from './biome';

export interface Building {
  cx: number; cz: number;
  width: number; depth: number; height: number;
  color: number; style: FacadeStyle;
}
export interface Lane {
  axis: 'x' | 'z';
  fixed: number;
  dir: 1 | -1;
}
export interface Streetlight { x: number; z: number; }
export interface Prop { x: number; z: number; type: PropType; rot: number; }
export interface ParkingSpot { x: number; z: number; heading: number; }

export interface RoadSegment {
  x1: number; z1: number; x2: number; z2: number;
  width: number;
  name: string;
}

export interface CityConfig {
  seed: number;
  grid: number;
  blockSize: number;
  roadWidth: number;
  chunkBlocks: number;
}

export interface City {
  config: CityConfig;
  cell: number;
  extent: number;
  half: number;
  roadCenters: number[];
  roadSegments: RoadSegment[];
  laneOffset: number;
  buildings: Building[];
  colliders: Aabb[];
  grid: SpatialGrid;
  lanes: Lane[];
  streetlights: Streetlight[];
  props: Prop[];
  parkingSpots: ParkingSpot[];
  center: { x: number; z: number };
}

export const DEFAULT_CITY: CityConfig = {
  seed: 1971,
  // Westminster is compact but extremely dense. These legacy fields remain for
  // compatibility with the rest of the engine; the actual map is road-segment based.
  grid: 1,
  blockSize: 300,
  roadWidth: 12,
  chunkBlocks: 1,
};

// The original beta city is ~1.54 km²; use ~1/5 of that footprint for Westminster.
// 560m × 560m ≈ 0.31 km², while retaining comfortable game-scale streets.
const HALF = 280;
const ROAD_W = 11;
const MAP_SCALE = HALF / 620;
const sx = (v:number):number => v * MAP_SCALE;

const R = (x1:number,z1:number,x2:number,z2:number,width=ROAD_W,name=''): RoadSegment =>
  ({x1:sx(x1),z1:sx(z1),x2:sx(x2),z2:sx(z2),width,name});

/*
 * Westminster-inspired central London street plan. Coordinates are deliberately
 * metres, with north = -Z. The layout follows the real hierarchy: Thames to the
 * south, Hyde Park/Green Park/St James's Park as large open spaces, and the
 * dense West End/Whitehall streets between them.
 *
 * Major real streets represented here include Oxford Street, Regent Street,
 * Piccadilly, Pall Mall, The Mall, Whitehall, Strand, Victoria Street,
 * Buckingham Palace Road, Birdcage Walk, Millbank and Victoria Embankment.
 */
const ROADS: RoadSegment[] = [
  R(-620,-500,620,-500,14,'Coast Road'),
  R(-620,-250,620,-250,10,'North Avenue'),
  R(-620,0,620,0,11,'Central Avenue'),
  R(-620,250,620,250,10,'South Avenue'),
  R(-500,-620,-500,620,11,'West Road'),
  R(-250,-620,-250,620,10,'Market Road'),
  R(0,-620,0,620,12,'Station Road'),
  R(250,-620,250,620,10,'East Road'),
  R(500,-620,500,620,11,'Harbour Road'),
  R(-500,-350,500,350,8,'Park Link'),
  R(-420,350,420,-350,8,'River Link'),
];

// Major Westminster areas represented across the playable map. The council's
// neighbourhood map includes many of these communities; these are used as named
// districts for map generation rather than as arbitrary procedural zones.
export interface WestminsterArea { name:string; x:number; z:number; radius:number; character:'historic'|'retail'|'residential'|'civic'|'park'; }
const PARKS = [
  {x1:sx(-300),z1:sx(-470),x2:sx(300),z2:sx(-390),name:"Seafront"},
  {x1:sx(-240),z1:sx(35),x2:sx(-105),z2:sx(155),name:"West Park"},
  {x1:sx(105),z1:sx(60),x2:sx(250),z2:sx(170),name:"East Park"},
];

function roadLanes(): Lane[] {
  const lanes: Lane[] = [];
  for (const r of ROADS) {
    if (Math.abs(r.x2-r.x1) > Math.abs(r.z2-r.z1)) {
      lanes.push({axis:'x',fixed:r.z1-r.width*0.25,dir:1},{axis:'x',fixed:r.z1+r.width*0.25,dir:-1});
    } else {
      lanes.push({axis:'z',fixed:r.x1-r.width*0.25,dir:-1},{axis:'z',fixed:r.x1+r.width*0.25,dir:1});
    }
  }
  return lanes;
}

function streetlights(): Streetlight[] {
  const out:Streetlight[]=[];
  for (const r of ROADS) {
    const len=Math.hypot(r.x2-r.x1,r.z2-r.z1);
    const n=Math.max(2,Math.floor(len/42));
    for(let i=1;i<n;i++){
      const t=i/n;
      const x=r.x1+(r.x2-r.x1)*t;
      const z=r.z1+(r.z2-r.z1)*t;
      out.push({x:x+r.width*0.48,z:z+r.width*0.48});
    }
  }
  return out;
}

function addBoxCollider(out:Aabb[],cx:number,cz:number,w:number,d:number):void {
  out.push({minX:cx-w/2,minZ:cz-d/2,maxX:cx+w/2,maxZ:cz+d/2});
}

function makeWestminsterBuildings(seed:number):{buildings:Building[];colliders:Aabb[];props:Prop[]} {
  const rng=createRng(hashSeed(seed,'compact-city'));
  const buildings:Building[]=[];
  const colliders:Aabb[]=[];
  const props:Prop[]=[];

  // Five comfortable four-storey residential blocks. The gaps are intentional:
  // this is a walkable small city, not a dense downtown.
  const homes = [
    [-185,-135,42,34],[-55,-145,42,34],[105,-135,42,34],
    [-135,145,42,34],[115,145,42,34],
  ];
  for(const [x,z,w,d] of homes){
    buildings.push({cx:sx(x),cz:sx(z),width:sx(w),depth:sx(d),height:14,color:0xb8a99a,style:'brick'});
    addBoxCollider(colliders,sx(x),sx(z),sx(w),sx(d));
  }

  const special = [
    [0,-115,74,48,9,0xc7bda9,'Supermarket'],
    [-190,35,52,42,10,0xd0c7b8,'Hospital'],
    [190,45,48,38,10,0x9eaaa0,'Police Station'],
    [-70,205,34,26,9,0xd5d0c7,'Mosque'],
    [70,205,38,30,10,0xb9b0a3,'Church'],
    [-185,-35,22,18,7,0xc48b62,'Shop 1'],
    [-150,-35,22,18,7,0xc48b62,'Shop 2'],
    [155,-35,22,18,7,0xc48b62,'Shop 3'],
    [0,120,120,34,6,0x8e989e,'Train Station'],
  ] as const;
  for(const [x,z,w,d,h,color] of special){
    buildings.push({cx:sx(x),cz:sx(z),width:sx(w),depth:sx(d),height:h,color,style:'concrete'});
    addBoxCollider(colliders,sx(x),sx(z),sx(w),sx(d));
  }

  // Two football pitches are open activity zones.
  const fields=[[-175,95],[175,145]];
  for(const [x,z] of fields){
    // only perimeter obstacles; the pitches themselves remain fully walkable
    addBoxCollider(colliders,sx(x-55),sx(z-20),sx(1),sx(40));
    addBoxCollider(colliders,sx(x+55),sx(z-20),sx(1),sx(40));
  }

  // Small street furniture around the residential streets.
  for(const [x,z] of [[-215,-210],[-95,-210],[75,-210],[205,-210],[-215,210],[205,210]]){
    props.push({x:sx(x),z:sx(z),type:rng.pick(['tree','bench','hydrant'] as PropType[]),rot:0});
  }

  return {buildings,colliders,props};
}

function parking():ParkingSpot[]{
  const out:ParkingSpot[]=[];
  for(const r of ROADS){
    const len=Math.hypot(r.x2-r.x1,r.z2-r.z1);
    const n=Math.floor(len/28);
    for(let i=1;i<n;i+=2){
      const t=i/n;
      const x=r.x1+(r.x2-r.x1)*t, z=r.z1+(r.z2-r.z1)*t;
      if(Math.random()>0.24) continue;
      if(Math.abs(r.x2-r.x1)>Math.abs(r.z2-r.z1)) out.push({x,z:r.z1+r.width/2+2.2,heading:Math.PI/2});
      else out.push({x:r.x1+r.width/2+2.2,z,heading:0});
    }
  }
  return out;
}

export function generateCity(config:CityConfig=DEFAULT_CITY):City {
  const {buildings,colliders,props}=makeWestminsterBuildings(config.seed);
  // Static park/landmark boundaries are real collision objects; parks themselves
  // remain walkable open space.
  for(const p of PARKS){
    // Low perimeter collision only; this prevents building spill without boxing parks.
    addBoxCollider(colliders,(p.x1+p.x2)/2,p.z1,(p.x2-p.x1),0.5);
    addBoxCollider(colliders,(p.x1+p.x2)/2,p.z2,(p.x2-p.x1),0.5);
    addBoxCollider(colliders,p.x1,(p.z1+p.z2)/2,0.5,(p.z2-p.z1));
    addBoxCollider(colliders,p.x2,(p.z1+p.z2)/2,0.5,(p.z2-p.z1));
  }
  const lanes=roadLanes();
  const extent=HALF*2;
  const roadCenters=ROADS.flatMap(r => Math.abs(r.x2-r.x1)>Math.abs(r.z2-r.z1) ? [r.z1] : [r.x1]).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
  return {
    config,
    cell:100,
    extent,
    half:HALF,
    roadCenters,
    roadSegments:ROADS,
    laneOffset:ROAD_W/4,
    buildings,
    colliders,
    grid:new SpatialGrid(colliders,80),
    lanes,
    streetlights:streetlights(),
    props,
    parkingSpots:parking(),
    center:{x:sx(430),z:sx(360)}, // Parliament Square / Westminster
  };
}

// Kept as a compatibility export for old integrations. New Westminster map does
// not use the previous market/football/supermarket landmark system.
export interface LandmarkLocations {
  market:{x:number;z:number};
  football:{x:number;z:number};
  playground:{x:number;z:number};
  supermarkets:{x:number;z:number}[];
}
export function landmarkLocations(_city:Pick<City,'half'|'roadCenters'>):LandmarkLocations {
    return {
    market:{x:sx(35),z:sx(115)},
    football:{x:sx(-220),z:sx(330)},
    playground:{x:sx(-420),z:sx(40)},
    supermarkets:[{x:sx(160),z:sx(-60)},{x:sx(520),z:sx(70)}],
  };
}


export interface WorldFields { urbanity: Noise2D; }
export function makeWorldFields(seed: number): WorldFields {
  return { urbanity: makeNoise2D(hashSeed(seed, 'urbanity')) };
}
const URBANITY_FREQ = 0.012;
export function urbanityAt(fields: WorldFields, wx: number, wz: number): number {
  const n = fbm(fields.urbanity, wx, wz, { octaves: 4, frequency: URBANITY_FREQ });
  return Math.max(0, Math.min(1, 0.5 + n * 1.35));
}
function jitterBrightness(hex:number,rng:ReturnType<typeof createRng>,amt:number):number {
  const f=1+(rng.next()*2-1)*amt;
  const ch=(s:number)=>Math.max(0,Math.min(255,Math.round(((hex>>s)&255)*f)));
  return (ch(16)<<16)|(ch(8)<<8)|ch(0);
}
function insideAnyCollider(x:number,z:number,cs:Aabb[],pad:number):boolean {
  return cs.some(c=>x>c.minX-pad&&x<c.maxX+pad&&z>c.minZ-pad&&z<c.maxZ+pad);
}
export function addBlock(originX:number,originZ:number,size:number,rng:ReturnType<typeof createRng>,biome:BiomeDef,buildings:Building[],colliders:Aabb[]):void {
  if(biome.buildingDensity<=0)return;
  const margin=biome.buildingDensity>=0.72?2.2:biome.buildingDensity>=0.48?2.7:3.2;
  const lots=biome.buildingDensity>=0.58?2:(rng.chance(0.18+biome.buildingDensity*0.42)?2:1);
  const lotSize=size/lots;
  const [hMin,hMax]=biome.heightRange;
  for(let li=0;li<lots;li++)for(let lj=0;lj<lots;lj++){
    if(!rng.chance(biome.buildingDensity))continue;
    const lotX=originX+li*lotSize,lotZ=originZ+lj*lotSize;
    const width=lotSize-margin*2,depth=lotSize-margin*2;
    if(width<4||depth<4)continue;
    const cx=lotX+lotSize/2,cz=lotZ+lotSize/2;
    buildings.push({cx,cz,width,depth,height:rng.range(hMin,hMax),color:jitterBrightness(rng.pick(biome.palette),rng,0.18),style:rng.pick(biome.facades)});
    colliders.push({minX:cx-width/2,minZ:cz-depth/2,maxX:cx+width/2,maxZ:cz+depth/2});
  }
}
export function addProps(originX:number,originZ:number,size:number,rng:ReturnType<typeof createRng>,biome:BiomeDef,colliders:Aabb[],props:Prop[]):void {
  if(biome.propDensity<=0||biome.props.length===0)return;
  const inset=1.6,slots=Math.max(2,Math.floor(size/9)),span=size-inset*2;
  for(let edge=0;edge<4;edge++)for(let k=1;k<slots;k++){
    if(!rng.chance(biome.propDensity))continue;
    const t=(k/slots)*span+inset;
    let x:number,z:number;
    if(edge===0){x=originX+inset;z=originZ+t;}else if(edge===1){x=originX+size-inset;z=originZ+t;}else if(edge===2){x=originX+t;z=originZ+inset;}else{x=originX+t;z=originZ+size-inset;}
    x+=rng.range(-0.8,0.8);z+=rng.range(-0.8,0.8);
    if(!insideAnyCollider(x,z,colliders,0.6))props.push({x,z,type:rng.pick(biome.props),rot:rng.range(0,Math.PI*2)});
  }
}
