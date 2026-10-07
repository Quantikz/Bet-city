import * as THREE from 'three';
import type { City, RoadSegment } from '../world/City';

const white=new THREE.MeshBasicMaterial({color:0xf4f1df,transparent:true,opacity:.82});
const curbWhite=new THREE.MeshBasicMaterial({color:0xd7d3c7,transparent:true,opacity:.55});
function horizontal(r:RoadSegment):boolean{return Math.abs(r.x2-r.x1)>=Math.abs(r.z2-r.z1);}
function roadLength(r:RoadSegment):number{return Math.hypot(r.x2-r.x1,r.z2-r.z1);}
function addQuad(p:number[],x1:number,z1:number,x2:number,z2:number,w:number,y:number):void{const dx=x2-x1,dz=z2-z1,l=Math.hypot(dx,dz);if(l<.01)return;const nx=-dz/l*w/2,nz=dx/l*w/2;p.push(x1+nx,y,z1+nz,x2+nx,y,z2+nz,x2-nx,y,z2-nz,x1+nx,y,z1+nz,x2-nx,y,z2-nz,x1-nx,y,z1-nz);}
function mesh(p:number[],m:THREE.Material):THREE.Mesh{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeBoundingSphere();const x=new THREE.Mesh(g,m);x.renderOrder=4;return x;}
export function addUrbanVisuals(scene:THREE.Scene,city:City):void{
  const lanes:number[]=[],edges:number[]=[],cross:number[]=[];
  for(const r of city.roadSegments){
    const len=roadLength(r),h=horizontal(r),dx=(r.x2-r.x1)/Math.max(len,1),dz=(r.z2-r.z1)/Math.max(len,1);
    for(let d=7;d<len-7;d+=8.6){const d2=Math.min(d+3.2,len-7);addQuad(lanes,r.x1+dx*d,r.z1+dz*d,r.x1+dx*d2,r.z1+dz*d2,.12,.031);}
    const ex=h?0:r.width*.5-.32,ez=h?r.width*.5-.32:0;
    for(const side of[-1,1])addQuad(edges,r.x1+dx*5+(h?0:side*ex),r.z1+dz*5+(h?side*ez:0),r.x2-dx*5+(h?0:side*ex),r.z2-dz*5+(h?side*ez:0),.07,.032);
  }
  const hs=city.roadSegments.filter(horizontal),vs=city.roadSegments.filter(r=>!horizontal(r));
  for(const h of hs)for(const v of vs){const x=v.x1,z=h.z1;if(x<Math.min(h.x1,h.x2)||x>Math.max(h.x1,h.x2)||z<Math.min(v.z1,v.z2)||z>Math.max(v.z1,v.z2))continue;for(let i=0;i<6;i++){const o=(i-2.5)*.85;addQuad(cross,x+o,z-h.width*.39,x+o,z-h.width*.02,.42,.038);}}
  if(lanes.length)scene.add(mesh(lanes,white));if(edges.length)scene.add(mesh(edges,curbWhite));if(cross.length)scene.add(mesh(cross,white));
  // Only use tree/bench props from the authoritative map. No hidden hard-coded
  // coordinates are allowed in the visual dressing layer.
  const trees=city.props.filter(p=>p.type==='tree');
  if(trees.length){
    const trunk=new THREE.CylinderGeometry(.12,.18,1.25,6);trunk.translate(0,.625,0);
    const crown=new THREE.ConeGeometry(1,2.5,7);crown.translate(0,2.45,0);
    const pa=trunk.attributes.position.count,pb=crown.attributes.position.count,pos=new Float32Array((pa+pb)*3);
    pos.set(trunk.attributes.position.array as Float32Array,0);pos.set(crown.attributes.position.array as Float32Array,pa*3);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.computeVertexNormals();
    const inst=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color:0x356846,roughness:.9}),trees.length);
    const d=new THREE.Object3D();
    trees.forEach((p,i)=>{d.position.set(p.x,0,p.z);d.rotation.y=p.rot;d.scale.setScalar(.85+(i%4)*.08);d.updateMatrix();inst.setMatrixAt(i,d.matrix);});
    inst.castShadow=true;inst.receiveShadow=true;inst.instanceMatrix.needsUpdate=true;scene.add(inst);
  }
}
