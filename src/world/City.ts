import { createRng, hashSeed } from '../core/rng';
import { makeNoise2D, fbm, type Noise2D } from '../core/noise';
import type { BiomeDef } from './biome';
import type { Aabb } from '../systems/Collision';
import { SpatialGrid } from '../systems/SpatialGrid';
import type { PropType, FacadeStyle } from './biome';

export interface Building { cx:number; cz:number; width:number; depth:number; height:number; color:number; style:FacadeStyle; }
export interface Lane { axis:'x'|'z'; fixed:number; dir:1|-1; }
export interface Streetlight { x:number; z:number; }
export interface Prop { x:number; z:number; type:PropType; rot:number; }
export interface ParkingSpot { x:number; z:number; heading:number; }
export interface RoadSegment { x1:number; z1:number; x2:number; z2:number; width:number; name:string; }
export interface Landmark { id:string; name:string; kind:string; x:number; z:number; width:number; depth:number; }
export interface CityConfig { seed:number; grid:number; blockSize:number; roadWidth:number; chunkBlocks:number; }
export interface City { config:CityConfig; cell:number; extent:number; half:number; roadCenters:number[]; roadSegments:RoadSegment[]; laneOffset:number; buildings:Building[]; colliders:Aabb[]; grid:SpatialGrid; lanes:Lane[]; streetlights:Streetlight[]; props:Prop[]; parkingSpots:ParkingSpot[]; center:{x:number;z:number}; landmarks:Landmark[]; }

export const DEFAULT_CITY:CityConfig={seed:1971,grid:1,blockSize:80,roadWidth:12,chunkBlocks:1};
const HALF=240;

const R=(x1:number,z1:number,x2:number,z2:number,width:number,name:string):RoadSegment=>({x1,z1,x2,z2,width,name});

/**
 * AFEC Town master plan.
 *
 * One authoritative road graph:
 * - Main Street is the widest east/west spine.
 * - North/South Avenue are collectors.
 * - West/East Roads form the neighbourhood frame.
 * - short local streets break residential super-blocks into smaller walkable blocks.
 * The civic square is deliberately kept free of through roads.
 */
export const TOWN_ROADS:RoadSegment[]=[
  R(-220,0,220,0,16,'Main Street'),
  R(-220,-90,220,-90,11,'North Avenue'),
  R(-220,95,220,95,11,'South Avenue'),
  R(-105,-205,-105,205,11,'West Road'),
  R(105,-205,105,205,11,'East Road'),
  R(-220,-190,220,-190,9,'North Ring'),
  R(-220,190,220,190,9,'South Ring'),
  R(-210,-190,-210,190,9,'West Ring'),
  R(210,-190,210,190,9,'East Ring'),

  // North residential local streets.
  R(-195,-145,-112,-145,7,'Maple Lane'),
  R(-98,-145,-12,-145,7,'Maple Lane East'),
  R(12,-145,98,-145,7,'Oak Lane'),
  R(112,-145,195,-145,7,'Oak Lane East'),
  R(-195,-120,-112,-120,7,'Cedar Lane'),
  R(112,-120,195,-120,7,'Pine Lane'),

  // South residential local streets.
  R(-195,145,-112,145,7,'Palm Lane'),
  R(-98,145,-12,145,7,'Palm Lane East'),
  R(12,145,98,145,7,'Garden Lane'),
  R(112,145,195,145,7,'Garden Lane East'),
  R(-195,165,-112,165,7,'Mango Lane'),
  R(112,165,195,165,7,'Mango Lane East'),

  // Short connectors create permeability without turning every road into a highway.
  R(-160,-88,-160,-15,7,'West Close'),
  R(160,-88,160,-15,7,'East Close'),
  R(-160,15,-160,88,7,'West Grove'),
  R(160,15,160,88,7,'East Grove'),
];

const LANDMARKS:Landmark[]=[
  {id:'townhall',name:'Town Hall',kind:'townhall',x:0,z:-69,width:40,depth:22},
  {id:'park',name:'Civic Park',kind:'park',x:0,z:-42,width:64,depth:36},
  {id:'market',name:'Central Market',kind:'market',x:58,z:-38,width:34,depth:28},
  {id:'police',name:'Police Station',kind:'police',x:-72,z:-38,width:30,depth:24},
  {id:'clinic',name:'Community Clinic',kind:'clinic',x:150,z:-42,width:32,depth:24},
  {id:'school',name:'Community School',kind:'school',x:-155,z:48,width:48,depth:34},
  {id:'mosque',name:'Central Mosque',kind:'mosque',x:155,z:-135,width:38,depth:32},
  {id:'church',name:'Town Church',kind:'church',x:-58,z:140,width:36,depth:28},
  {id:'station',name:'Bus Station',kind:'station',x:28,z:145,width:52,depth:22},
  {id:'shop-east',name:'Corner Shops',kind:'shop',x:155,z:45,width:38,depth:24},
  {id:'gas',name:'Fuel Station',kind:'gas',x:48,z:42,width:38,depth:28},
  {id:'field',name:'Town Football Field',kind:'field',x:150,z:145,width:74,depth:46},
];

const addBox=(a:Aabb[],x:number,z:number,w:number,d:number)=>a.push({minX:x-w/2,minZ:z-d/2,maxX:x+w/2,maxZ:z+d/2});
const reserved=(x:number,z:number,w:number,d:number,lm=LANDMARKS)=>lm.some(l=>Math.abs(x-l.x)<(w+l.width)/2+4&&Math.abs(z-l.z)<(d+l.depth)/2+4);

function B(bs:Building[],cs:Aabb[],x:number,z:number,w:number,d:number,h:number,color:number,style:FacadeStyle='concrete'):void{
  bs.push({cx:x,cz:z,width:w,depth:d,height:h,color,style}); addBox(cs,x,z,w,d);
}

function homeRow(bs:Building[],cs:Aabb[],startX:number,endX:number,z:number,count:number,seed:number):void{
  const rng=createRng(hashSeed(seed,startX,z));
  const span=(endX-startX)/count;
  for(let i=0;i<count;i++){
    const w=Math.min(25,span-7),d=18+rng.range(0,5);
    const x=startX+span*(i+.5);
    if(reserved(x,z,w,d))continue;
    const brick=i%3===0;
    B(bs,cs,x,z,w,d,4.8+rng.range(0,1.6),brick?0xb9a897:0xc9c3b9,brick?'brick':'concrete');
  }
}

function buildTown(){
  const bs:Building[]=[];const cs:Aabb[]=[];const ps:Prop[]=[];

  // Main-street frontage: slightly larger, closer-set buildings.
  const shops=[
    [-190, -18,26,20],[-158,-18,26,20],[-126,-18,26,20],
    [126,-18,26,20],[158,-18,26,20],[190,-18,26,20],
    [-190,18,26,20],[-158,18,26,20],[-126,18,26,20],
    [126,18,26,20],[158,18,26,20],[190,18,26,20],
  ] as const;
  shops.forEach((v,i)=>{if(!reserved(v[0],v[1],v[2],v[3]))B(bs,cs,v[0],v[1],v[2],v[3],5.5+(i%2)*1.2,i%2?0xc4b8aa:0xb9a58f,i%3?'concrete':'brick');});

  // North neighbourhood: two-sided blocks with clear garden setbacks.
  homeRow(bs,cs,-195,-115,-165,4,101);
  homeRow(bs,cs,-95,-15,-165,3,102);
  homeRow(bs,cs,15,95,-165,3,103);
  homeRow(bs,cs,115,195,-165,4,104);
  homeRow(bs,cs,-195,-115,-110,4,105);
  homeRow(bs,cs,115,195,-110,4,106);

  // South neighbourhood: lower-density, greener edge.
  homeRow(bs,cs,-195,-115,115,4,201);
  homeRow(bs,cs,-95,-15,115,3,202);
  homeRow(bs,cs,15,95,115,3,203);
  homeRow(bs,cs,115,195,115,4,204);
  homeRow(bs,cs,-195,-115,175,4,205);
  homeRow(bs,cs,-95,-15,175,3,206);
  homeRow(bs,cs,15,95,175,3,207);
  homeRow(bs,cs,115,195,175,4,208);

  // Civic/special buildings are not duplicated as ordinary houses.
  LANDMARKS.forEach(l=>{
    if(['park','field'].includes(l.kind))return;
    addBox(cs,l.x,l.z,l.width,l.depth);
  });

  // Deliberate landscape: trees define parks and residential edges, not roads.
  const tree=(x:number,z:number,r=0)=>ps.push({x,z,type:'tree',rot:r});
  const bench=(x:number,z:number,r=0)=>ps.push({x,z,type:'bench',rot:r});
  [-25,0,25].forEach(x=>{tree(x,-25);tree(x,-59);});
  [-52,-26,26,52].forEach(x=>tree(x,-78));
  [-198,-170,-142,-114,114,142,170,198].forEach(x=>{tree(x,-196);tree(x,196);});
  [-175,-145,-115,115,145,175].forEach(x=>{tree(x,105);tree(x,-105);});
  bench(-25,-42,Math.PI/2);bench(25,-42,Math.PI/2);

  return {bs,cs,ps};
}

function lanes():Lane[]{
  const o:Lane[]=[];
  for(const r of TOWN_ROADS){
    const h=Math.abs(r.x2-r.x1)>=Math.abs(r.z2-r.z1);
    if(h)o.push({axis:'x',fixed:r.z1-r.width*.25,dir:1},{axis:'x',fixed:r.z1+r.width*.25,dir:-1});
    else o.push({axis:'z',fixed:r.x1-r.width*.25,dir:-1},{axis:'z',fixed:r.x1+r.width*.25,dir:1});
  }
  return o;
}

function lights():Streetlight[]{
  const o:Streetlight[]=[];
  for(const r of TOWN_ROADS){
    const len=Math.hypot(r.x2-r.x1,r.z2-r.z1);
    const spacing=r.width>=14?32:42;
    const n=Math.max(2,Math.floor(len/spacing));
    for(let i=1;i<n;i++){
      const t=i/n;
      const dx=r.x2-r.x1,dz=r.z2-r.z1,l=Math.max(.001,Math.hypot(dx,dz));
      const nx=-dz/l,nz=dx/l;
      o.push({x:r.x1+dx*t+nx*(r.width*.44),z:r.z1+dz*t+nz*(r.width*.44)});
    }
  }
  return o;
}

function parking():ParkingSpot[]{
  const o:ParkingSpot[]=[];
  // Main Street on-street parking is intentionally concentrated near shops.
  for(const x of [-190,-160,-130,130,160,190])o.push({x,z:11.5,heading:Math.PI/2},{x,z:-11.5,heading:-Math.PI/2});
  // Civic square perimeter parking, leaving the park interior pedestrian.
  for(const x of [-70,-45,45,70])o.push({x,z:-4,heading:Math.PI/2});
  return o;
}

export function generateCity(config:CityConfig=DEFAULT_CITY):City{
  const t=buildTown();
  const centers=TOWN_ROADS.flatMap(r=>Math.abs(r.x2-r.x1)>=Math.abs(r.z2-r.z1)?[r.z1]:[r.x1]).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
  return {
    config,cell:80,extent:HALF*2,half:HALF,roadCenters:centers,roadSegments:TOWN_ROADS,
    laneOffset:12/4,buildings:t.bs,colliders:t.cs,grid:new SpatialGrid(t.cs,70),
    lanes:lanes(),streetlights:lights(),props:t.ps,parkingSpots:parking(),
    center:{x:0,z:0},landmarks:LANDMARKS
  };
}

export interface LandmarkLocations{market:{x:number;z:number};football:{x:number;z:number};playground:{x:number;z:number};supermarkets:{x:number;z:number}[];}
export function landmarkLocations(city:Pick<City,'landmarks'>):LandmarkLocations{
  const f=city.landmarks.find(l=>l.id==='field')!,m=city.landmarks.find(l=>l.id==='market')!;
  return{market:{x:m.x,z:m.z},football:{x:f.x,z:f.z},playground:{x:0,z:-42},supermarkets:[{x:48,z:42}]};
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
