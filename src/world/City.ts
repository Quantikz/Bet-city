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
const HALF=240; const ROAD_W=12;
const R=(x1:number,z1:number,x2:number,z2:number,width=ROAD_W,name=''):RoadSegment=>({x1,z1,x2,z2,width,name});
export const TOWN_ROADS:RoadSegment[]=[
 R(-220,0,220,0,14,'Main Street'),R(-210,-90,210,-90,10,'North Avenue'),R(-210,90,210,90,10,'South Avenue'),
 R(-205,-175,205,-175,9,'North Ring'),R(-205,175,205,175,9,'South Ring'),R(-110,-200,-110,200,11,'West Road'),
 R(110,-200,110,200,11,'East Road'),R(-205,-175,-205,175,9,'West Ring'),R(205,-175,205,175,9,'East Ring'),
 R(-110,-90,110,-90,8,'Station Link'),R(-110,90,110,90,8,'Market Link')
];
const LANDMARKS:Landmark[]=[
 {id:'townhall',name:'Town Hall',kind:'townhall',x:0,z:-48,width:46,depth:28},{id:'market',name:'Central Market',kind:'market',x:52,z:46,width:48,depth:34},
 {id:'clinic',name:'Community Clinic',kind:'clinic',x:154,z:-45,width:34,depth:28},{id:'police',name:'Police Station',kind:'police',x:-154,z:-45,width:34,depth:28},
 {id:'school',name:'Community School',kind:'school',x:-154,z:45,width:50,depth:32},{id:'mosque',name:'Central Mosque',kind:'mosque',x:154,z:-132,width:38,depth:32},
 {id:'church',name:'Town Church',kind:'church',x:-65,z:130,width:38,depth:30},{id:'station',name:'Bus Station',kind:'station',x:10,z:160,width:58,depth:22},
 {id:'shop-east',name:'Corner Shops',kind:'shop',x:156,z:45,width:38,depth:24},{id:'gas',name:'Fuel Station',kind:'gas',x:30,z:-132,width:38,depth:28},
 {id:'park',name:'Civic Park',kind:'park',x:0,z:-132,width:72,depth:44},{id:'field',name:'Town Football Field',kind:'field',x:150,z:132,width:76,depth:48}
];
const addBox=(a:Aabb[],x:number,z:number,w:number,d:number)=>a.push({minX:x-w/2,minZ:z-d/2,maxX:x+w/2,maxZ:z+d/2});
function B(bs:Building[],cs:Aabb[],x:number,z:number,w:number,d:number,h:number,color:number,style:FacadeStyle='concrete'){bs.push({cx:x,cz:z,width:w,depth:d,height:h,color,style});addBox(cs,x,z,w,d);}
function buildTown(){const bs:Building[]=[];const cs:Aabb[]=[];const ps:Prop[]=[];
 B(bs,cs,0,-48,46,28,9,0xd7d2c8);B(bs,cs,52,46,48,34,5.5,0xc8b99f,'brick');B(bs,cs,154,-45,34,28,7,0xe0d8cb);B(bs,cs,-154,-45,34,28,7,0xb7c1c0);
 B(bs,cs,-154,45,50,32,5,0xd0c4b4,'brick');B(bs,cs,154,-132,38,32,9,0xd8d1c4);B(bs,cs,-48,132,38,30,8,0xcfc8bb);B(bs,cs,-42,132,58,22,5,0x8d989a);
 B(bs,cs,156,45,38,24,5.5,0xc9a77d,'brick');B(bs,cs,52,-132,38,28,5.5,0xd1c6b5);
 const homes=[[-165,-135,28,22],[-125,-135,28,22],[-65,-135,28,22],[70,-135,28,22],[120,-135,24,22],[-120,-48,28,22],[120,-48,24,22],[-105,45,24,22],[120,45,22,20],[-165,132,28,22],[-105,132,28,22],[80,132,28,22],[-165,215,28,22],[-115,215,28,22],[-55,215,28,22],[10,215,28,22],[70,215,28,22],[130,215,28,22],[-165,-215,28,22],[-115,-215,28,22],[-55,-215,28,22],[5,-215,28,22],[65,-215,28,22],[125,-215,28,22]];
 homes.forEach((v,i)=>B(bs,cs,v[0],v[1],v[2],v[3],5.2+(i%3)*.8,i%2?0xb8b1a7:0xc8c0b4,i%3?'concrete':'brick'));
 ps.push({x:-92,z:-132,type:'tree',rot:0},{x:92,z:-132,type:'tree',rot:1.2},{x:-78,z:132,type:'tree',rot:.4},{x:92,z:132,type:'tree',rot:2.1},{x:-190,z:45,type:'tree',rot:0},{x:190,z:-45,type:'tree',rot:0},{x:-20,z:132,type:'bench',rot:Math.PI/2},{x:25,z:-132,type:'bench',rot:Math.PI/2});
 return {bs,cs,ps};}
function lanes(){const o:Lane[]=[];for(const r of TOWN_ROADS){const h=Math.abs(r.x2-r.x1)>=Math.abs(r.z2-r.z1);if(h)o.push({axis:'x',fixed:r.z1-r.width*.25,dir:1},{axis:'x',fixed:r.z1+r.width*.25,dir:-1});else o.push({axis:'z',fixed:r.x1-r.width*.25,dir:-1},{axis:'z',fixed:r.x1+r.width*.25,dir:1});}return o;}
function lights(){const o:Streetlight[]=[];for(const r of TOWN_ROADS){const len=Math.hypot(r.x2-r.x1,r.z2-r.z1),n=Math.max(2,Math.floor(len/36));for(let i=1;i<n;i++){const t=i/n;o.push({x:r.x1+(r.x2-r.x1)*t+r.width*.46,z:r.z1+(r.z2-r.z1)*t+r.width*.46});}}return o;}
function parking(){const o:ParkingSpot[]=[];for(const r of TOWN_ROADS){const len=Math.hypot(r.x2-r.x1,r.z2-r.z1),n=Math.floor(len/30);for(let i=2;i<n;i+=3){const t=i/n,x=r.x1+(r.x2-r.x1)*t,z=r.z1+(r.z2-r.z1)*t;if(Math.abs(r.x2-r.x1)>=Math.abs(r.z2-r.z1))o.push({x,z:z+r.width*.5+2.1,heading:Math.PI/2});else o.push({x:x+r.width*.5+2.1,z,heading:0});}}return o;}
export function generateCity(config:CityConfig=DEFAULT_CITY):City{const t=buildTown();const extent=HALF*2;const centers=TOWN_ROADS.flatMap(r=>Math.abs(r.x2-r.x1)>=Math.abs(r.z2-r.z1)?[r.z1]:[r.x1]).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);return{config,cell:80,extent,half:HALF,roadCenters:centers,roadSegments:TOWN_ROADS,laneOffset:ROAD_W/4,buildings:t.bs,colliders:t.cs,grid:new SpatialGrid(t.cs,70),lanes:lanes(),streetlights:lights(),props:t.ps,parkingSpots:parking(),center:{x:0,z:0},landmarks:LANDMARKS};}
export interface LandmarkLocations{market:{x:number;z:number};football:{x:number;z:number};playground:{x:number;z:number};supermarkets:{x:number;z:number}[];}
export function landmarkLocations(city:Pick<City,'landmarks'>):LandmarkLocations{const f=city.landmarks.find(l=>l.id==='field')!,m=city.landmarks.find(l=>l.id==='market')!;return{market:{x:m.x,z:m.z},football:{x:f.x,z:f.z},playground:{x:0,z:-132},supermarkets:[{x:52,z:-132}]};}

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
