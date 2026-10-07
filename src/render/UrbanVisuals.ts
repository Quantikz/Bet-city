import * as THREE from 'three';
import type { City, RoadSegment } from '../world/City';

const white = new THREE.MeshBasicMaterial({ color: 0xf4f1df, transparent: true, opacity: 0.82 });
const yellow = new THREE.MeshBasicMaterial({ color: 0xd9b64b, transparent: true, opacity: 0.9 });
const curbWhite = new THREE.MeshBasicMaterial({ color: 0xd7d3c7, transparent: true, opacity: 0.55 });

function horizontal(r: RoadSegment): boolean {
  return Math.abs(r.x2 - r.x1) >= Math.abs(r.z2 - r.z1);
}

function roadLength(r: RoadSegment): number {
  return Math.hypot(r.x2 - r.x1, r.z2 - r.z1);
}

function addQuad(positions: number[], x1:number,z1:number,x2:number,z2:number,width:number,y:number): void {
  const dx=x2-x1, dz=z2-z1, len=Math.hypot(dx,dz);
  if(len<0.01)return;
  const nx=-dz/len*width/2, nz=dx/len*width/2;
  positions.push(
    x1+nx,y,z1+nz, x2+nx,y,z2+nz, x2-nx,y,z2-nz,
    x1+nx,y,z1+nz, x2-nx,y,z2-nz, x1-nx,y,z1-nz,
  );
}

function meshFromPositions(positions:number[], material:THREE.Material):THREE.Mesh {
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.computeBoundingSphere();
  const mesh=new THREE.Mesh(geo,material);
  mesh.renderOrder=4;
  return mesh;
}

/**
 * Lightweight procedural street dressing inspired by the dense, readable visual
 * language of JoinAllworld: lane rhythm, junction markings and vegetation, while
 * keeping the existing AFEC CITY geometry/physics untouched.
 */
export function addUrbanVisuals(scene:THREE.Scene, city:City):void {
  const lanes:number[]=[];
  const edges:number[]=[];
  const crosswalks:number[]=[];

  for(const r of city.roadSegments){
    const len=roadLength(r);
    const horizontalRoad=horizontal(r);
    const dx=(r.x2-r.x1)/Math.max(len,1);
    const dz=(r.z2-r.z1)/Math.max(len,1);

    // Broken lane divider. Short repeated marks make long procedural roads read
    // correctly at game-camera distance without thousands of objects.
    const dash=3.2, gap=5.4;
    for(let d=7;d<len-7;d+=dash+gap){
      const d2=Math.min(d+dash,len-7);
      addQuad(lanes,r.x1+dx*d,r.z1+dz*d,r.x1+dx*d2,r.z1+dz*d2,0.12,0.031);
    }

    // Subtle outer edge lines, especially useful at night when the road lamps
    // catch the pale strip and visually frame the drivable corridor.
    const ex=horizontalRoad ? 0 : r.width*0.5-0.32;
    const ez=horizontalRoad ? r.width*0.5-0.32 : 0;
    for(const side of [-1,1]){
      addQuad(edges,r.x1+dx*5+(horizontalRoad?0:side*ex),r.z1+dz*5+(horizontalRoad?side*ez:0),
        r.x2-dx*5+(horizontalRoad?0:side*ex),r.z2-dz*5+(horizontalRoad?side*ez:0),0.07,0.032);
    }
  }

  // Generate zebra crossings where a horizontal and vertical road overlap.
  // The result is merged into one mesh, so a dense city still costs one draw call.
  const hs=city.roadSegments.filter(horizontal);
  const vs=city.roadSegments.filter(r=>!horizontal(r));
  for(const h of hs){
    for(const v of vs){
      const x=v.x1, z=h.z1;
      const insideH=x>=Math.min(h.x1,h.x2)&&x<=Math.max(h.x1,h.x2);
      const insideV=z>=Math.min(v.z1,v.z2)&&z<=Math.max(v.z1,v.z2);
      if(!insideH||!insideV)continue;
      const stripes=6;
      for(let i=0;i<stripes;i++){
        const offset=(i-(stripes-1)/2)*0.85;
        // Crosswalk bars are perpendicular to the horizontal road.
        addQuad(crosswalks,x+offset,z-h.width*0.39,x+offset,z-h.width*0.02,0.42,0.038);
      }
    }
  }

  if(lanes.length)scene.add(meshFromPositions(lanes,white));
  if(edges.length)scene.add(meshFromPositions(edges,curbWhite));
  if(crosswalks.length)scene.add(meshFromPositions(crosswalks,white));

  // Instanced low-poly greenery: enough repetition to break the procedural
  // blocks, but far cheaper than individual tree scene graphs.
  const treeGeo=new THREE.BufferGeometry();
  const trunk=new THREE.CylinderGeometry(0.12,0.18,1.25,6);
  trunk.translate(0,0.625,0);
  const crown=new THREE.ConeGeometry(1.0,2.5,7);
  crown.translate(0,2.45,0);
  const merge=(a:THREE.BufferGeometry,b:THREE.BufferGeometry)=>{
    const pa=a.attributes.position.count,pb=b.attributes.position.count;
    const pos=new Float32Array((pa+pb)*3);
    pos.set((a.attributes.position.array as Float32Array),0);
    pos.set((b.attributes.position.array as Float32Array),pa*3);
    return pos;
  };
  const pos=merge(trunk,crown);
  treeGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  treeGeo.computeVertexNormals();
  const treeMat=new THREE.MeshStandardMaterial({color:0x356846,roughness:0.9});
  const count=54;
  const trees=new THREE.InstancedMesh(treeGeo,treeMat,count);
  const dummy=new THREE.Object3D();
  let n=0;
  const rings=[[ -245, -115, 9 ],[245,-115,9],[-175,210,8],[175,210,8],[0,-155,7]];
  for(const [cx,cz,r] of rings){
    for(let i=0;i<12&&n<count;i++){
      const a=(i/12)*Math.PI*2+(n%3)*0.22;
      const rr=r+(n%4)*1.4;
      dummy.position.set(cx+Math.cos(a)*rr,0,cz+Math.sin(a)*rr);
      dummy.scale.setScalar(0.8+(n%5)*0.08);
      dummy.rotation.y=a;
      dummy.updateMatrix();
      trees.setMatrixAt(n++,dummy.matrix);
    }
  }
  trees.count=n;
  trees.castShadow=true;
  trees.receiveShadow=true;
  trees.instanceMatrix.needsUpdate=true;
  scene.add(trees);
}
