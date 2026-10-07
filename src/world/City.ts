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
const SIDE = 5.5;
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
  R(-620,-535,620,-535,18,'Oxford Street'),
  R(-620,-445,620,-445,10,'New Oxford Street'),
  R(-620,-330,620,-330,12,'Marylebone Road'),
  R(-520,-620,-520,620,12,'Park Lane'),
  R(-390,-620,-390,620,10,'Edgware Road'),
  R(-250,-620,-250,620,9,'Baker Street'),
  R(-105,-620,-105,620,9,'Regent Street'),
  R(35,-620,35,620,10,'Charing Cross Road'),
  R(175,-620,175,620,10,'Shaftesbury Avenue'),
  R(320,-620,320,620,11,'Victoria Embankment'),
  R(455,-620,455,620,10,'Lambeth approach'),

  R(-620,-240,620,-240,10,'Great Portland Street'),
  R(-620,-115,620,-115,10,'Euston Road'),
  R(-620,20,620,20,11,'Piccadilly'),
  R(-620,105,620,105,10,'Pall Mall'),
  R(-620,185,620,185,12,'The Mall'),
  R(-620,285,620,285,11,'Birdcage Walk'),
  R(-620,390,620,390,12,'Victoria Street'),
  R(-620,500,620,500,12,'Millbank'),
  R(-620,590,620,590,14,'River Embankment'),

  R(-105,-535,-105,20,8,'Regent Street'),
  R(-105,20,15,155,8,'Regent Street'),
  R(15,155,155,185,8,'Waterloo Place'),
  R(155,185,320,185,8,'Northumberland Avenue'),
  R(320,185,455,185,8,'Whitehall'),
  R(455,185,455,390,8,'Whitehall'),
  R(455,390,620,390,8,'Parliament Street'),

  R(-390,20,-250,390,9,'Constitution Hill'),
  R(-250,285,105,285,9,'Constitution Hill / Birdcage'),
  R(-250,390,105,390,9,'Buckingham Palace Road'),
  R(105,390,320,390,9,'Victoria Street'),
  R(-390,500,-250,500,8,'Grosvenor Place'),
  R(-250,500,-105,500,8,'Belgrave Road'),
  R(-105,500,105,500,8,'Vauxhall Bridge Road'),
  R(105,500,320,500,8,'Horseferry Road'),

  R(-320,20,-320,285,8,'St James Park West'),
  R(15,20,15,105,8,'Haymarket'),
  R(15,105,15,285,8,'Whitehall Gardens'),
  R(320,-115,455,20,8,'Strand'),
  R(320,20,455,105,8,'Strand'),
  R(455,20,620,105,8,'Aldwych'),
  R(-105,105,35,285,8,'St James’s Square'),
  R(-250,105,-105,185,8,'Jermyn Street'),
  R(-390,105,-250,185,8,'Pall Mall West'),
];

// Major Westminster areas represented across the playable map. The council's
// neighbourhood map includes many of these communities; these are used as named
// districts for map generation rather than as arbitrary procedural zones.
export interface WestminsterArea { name:string; x:number; z:number; radius:number; character:'historic'|'retail'|'residential'|'civic'|'park'; }
const WESTMINSTER_AREAS: WestminsterArea[] = [
  ['Paddington',-535,-300,'residential'], ['Bayswater',-500,-120,'residential'], ['Queensway',-500,20,'retail'],
  ['Notting Hill East',-500,170,'residential'], ['Westbourne',-430,300,'residential'], ['Queen\'s Park',-420,470,'residential'],
  ['Maida Hill',-300,430,'residential'], ['Maida Vale',-165,465,'residential'], ['Little Venice',-30,470,'park'],
  ['St John\'s Wood',145,470,'residential'], ['Church Street',-300,300,'retail'], ['Marylebone',-175,315,'residential'],
  ['Fitzrovia West',-40,300,'retail'], ['Soho',55,300,'retail'], ['Mayfair',-105,170,'historic'],
  ['St James\'s',55,170,'historic'], ['Covent Garden',180,180,'retail'], ['Strand',290,180,'retail'],
  ['West End',35,55,'retail'], ['Hyde Park',-350,55,'park'], ['Knightsbridge',-175,55,'historic'],
  ['Belgravia',-170,210,'historic'], ['Victoria',170,300,'civic'], ['Pimlico',175,430,'residential'],
  ['Millbank',300,430,'civic'], ['Westminster',300,285,'civic'], ['Whitehall',350,145,'civic'],
  ['Trafalgar Square',35,115,'civic'], ['Buckingham Palace',-30,275,'historic'], ['St James\'s Park',-145,300,'park'],
  ['Green Park',-230,200,'park'], ['Vincent Square',130,380,'park'], ['Ebury Bridge',70,440,'residential'],
  ['Churchill Gardens',300,500,'residential'], ['Harrow Road',-480,350,'residential'], ['Lisson Grove',-260,180,'residential'],
  ['Regent\'s Park',-260,500,'park'], ['Lancaster Gate',-380,-80,'residential'], ['Hyde Park and Paddington',-400,-230,'park'],
];
const AREA_SCALE = MAP_SCALE;
const AREA_POINTS = WESTMINSTER_AREAS.map(a => ({...a,x:a.x*AREA_SCALE,z:a.z*AREA_SCALE}));
function areaAt(x:number,z:number):WestminsterArea {
  let best=AREA_POINTS[0],d=Infinity;
  for(const a of AREA_POINTS){const dx=x-a.x,dz=z-a.z,d2=dx*dx+dz*dz;if(d2<d){d=d2;best=a;}}
  return best;
}

const PARKS = [
  {x1:sx(-390),z1:sx(120),x2:sx(-115),z2:sx(285),name:"Green Park"},
  {x1:sx(-320),z1:sx(205),x2:sx(35),z2:sx(375),name:"St James's Park"},
  {x1:sx(-620),z1:sx(-535),x2:sx(-390),z2:sx(-240),name:"Hyde Park edge"},
  {x1:sx(-620),z1:sx(285),x2:sx(-390),z2:sx(500),name:"Belgravia gardens"},
];

const LANDMARKS = [
  {x:sx(-30),z:sx(275),w:sx(150),d:sx(90),h:28,color:0xb8a994,style:'concrete' as FacadeStyle},
  {x:sx(390),z:sx(320),w:sx(95),d:sx(75),h:24,color:0xb0a28f,style:'concrete' as FacadeStyle},
  {x:sx(430),z:sx(250),w:sx(50),d:sx(45),h:96,color:0x9b8a72,style:'concrete' as FacadeStyle},
  {x:sx(285),z:sx(270),w:sx(70),d:sx(55),h:32,color:0xc5b9a4,style:'concrete' as FacadeStyle},
  {x:sx(35),z:sx(115),w:sx(115),d:sx(90),h:18,color:0xbdb3a0,style:'concrete' as FacadeStyle},
];

function intersects(a:{x1:number;z1:number;x2:number;z2:number}, b:{x1:number;z1:number;x2:number;z2:number}, pad=0):boolean {
  return !(a.x2 < b.x1-pad || a.x1 > b.x2+pad || a.z2 < b.z1-pad || a.z1 > b.z2+pad);
}

function pointInPark(x:number,z:number):boolean {
  return PARKS.some(p => x > p.x1 && x < p.x2 && z > p.z1 && z < p.z2);
}
function nearRoad(x:number,z:number,pad=7):boolean {
  for (const r of ROADS) {
    const minX=Math.min(r.x1,r.x2)-r.width/2-pad, maxX=Math.max(r.x1,r.x2)+r.width/2+pad;
    const minZ=Math.min(r.z1,r.z2)-r.width/2-pad, maxZ=Math.max(r.z1,r.z2)+r.width/2+pad;
    if (x>minX&&x<maxX&&z>minZ&&z<maxZ) return true;
  }
  return false;
}

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

function facadeFor(rng:ReturnType<typeof createRng>, z:number):{style:FacadeStyle;color:number;h:[number,number]} {
  if (z < -300) return {style:'brick',color:rng.pick([0x9b6654,0xb27a62,0x7e4f43,0xc0a58d]),h:[12,24]};
  if (z < 80) return {style:'concrete',color:rng.pick([0x8e8b84,0xa59d91,0xb7aea0,0x777a7d]),h:[14,32]};
  if (z < 260) return {style:'concrete',color:rng.pick([0x8f8475,0xb2a38e,0xc1b39c,0x6d6b68]),h:[10,27]};
  return {style:'brick',color:rng.pick([0x8a5545,0x9b624d,0xb07b61,0x6f4c43]),h:[9,22]};
}

function makeWestminsterBuildings(seed:number):{buildings:Building[];colliders:Aabb[];props:Prop[]} {
  const rng=createRng(hashSeed(seed,'westminster-buildings'));
  const buildings:Building[]=[];
  const colliders:Aabb[]=[];
  const props:Prop[]=[];
  const xs=[-620,-520,-390,-250,-105,35,175,320,455,620].map(sx);
  const zs=[-620,-535,-445,-330,-240,-115,20,105,185,285,390,500,590].map(sx);

  // Dense frontage blocks between the major road lines. Lots are deliberately
  // narrow/deep, matching the terraced/mansion-block character of Westminster.
  for(let xi=0;xi<xs.length-1;xi++){
    for(let zi=0;zi<zs.length-1;zi++){
      const x1=xs[xi]+SIDE, x2=xs[xi+1]-SIDE;
      const z1=zs[zi]+SIDE, z2=zs[zi+1]-SIDE;
      if(x2-x1<12||z2-z1<12) continue;
      const cx=(x1+x2)/2, cz=(z1+z2)/2;
      if(pointInPark(cx,cz)||nearRoad(cx,cz,2)) continue;
      if(LANDMARKS.some(l=>intersects({x1,z1,x2,z2},{x1:l.x-l.w/2,z1:l.z-l.d/2,x2:l.x+l.w/2,z2:l.z+l.d/2},4))) continue;

      const lotsX=Math.max(1,Math.min(4,Math.floor((x2-x1)/18)));
      const lotsZ=Math.max(1,Math.min(3,Math.floor((z2-z1)/22)));
      const lotW=(x2-x1)/lotsX;
      const lotD=(z2-z1)/lotsZ;
      for(let ix=0;ix<lotsX;ix++) for(let iz=0;iz<lotsZ;iz++){
        const bx=x1+lotW*(ix+0.5);
        const bz=z1+lotD*(iz+0.5);
        const width=Math.max(7,lotW-5.5);
        const depth=Math.max(7,lotD-5.5);
        const area=areaAt(bx,bz);
        const f=facadeFor(rng,bz);
        let h=rng.range(f.h[0],f.h[1]);
        if (area.character==='civic') h=rng.range(12,28);
        if (area.character==='historic') h=rng.range(10,24);
        if (area.character==='residential') h=rng.range(8,20);
        if (Math.abs(bx)<90 && Math.abs(bz)<60) h=rng.range(12,26);
        if (Math.abs(bz-8)<28) h=rng.range(16,34);
        buildings.push({cx:bx,cz:bz,width,depth,height:h,color:f.color,style:f.style});
        addBoxCollider(colliders,bx,bz,width,depth);
        if(rng.chance(0.28)) props.push({x:bx-width/2+2,z:bz+depth/2+1.4,type:rng.pick(['tree','bench','hydrant'] as PropType[]),rot:0});
      }
    }
  }

  // Hand-authored iconic structures use the same building collision/asset path.
  for(const l of LANDMARKS){
    buildings.push({cx:l.x,cz:l.z,width:l.w,depth:l.d,height:l.h,color:l.color,style:l.style});
    addBoxCollider(colliders,l.x,l.z,l.w,l.d);
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
