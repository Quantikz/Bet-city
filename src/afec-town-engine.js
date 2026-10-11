import * as THREE from "three";
import "./afec-town-engine.css";

/*
 * AFEC Town Engine — first integration slice.
 * Vehicle handling is an original implementation inspired by the arcade
 * velocity-vector model documented in depixeled-chris/gta7 (MIT).
 * The GTA7 repository is not modified. Replace procedural meshes with
 * licensed GLB assets from ThreeJS Assets Studio when exported assets exist.
 */
document.body.innerHTML = "";
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.background = "#b9d8e8";

const root = document.createElement("div");
root.id = "afec-root";
document.body.appendChild(root);
const canvas = document.createElement("canvas");
canvas.id = "afec-canvas";
root.appendChild(canvas);

const hud = document.createElement("div");
hud.className = "afec-hud";
hud.innerHTML = '<div class="afec-brand">AFEC <b>TOWN</b><small>FREE ROAM · ENGINE PREVIEW</small></div><div class="afec-hint">WASD / ARROWS · SHIFT SPRINT · E ENTER / EXIT CAR · DRAG TO LOOK</div><div id="afec-status">ON FOOT</div>';
root.appendChild(hud);

const touch = document.createElement("div");
touch.className = "afec-touch";
touch.innerHTML = '<div class="afec-pad"><button data-key="ArrowUp">▲</button><div><button data-key="ArrowLeft">◀</button><button data-key="ArrowDown">▼</button><button data-key="ArrowRight">▶</button></div></div><div class="afec-actions"><button data-key="Shift">RUN</button><button id="afec-enter">ENTER</button></div>';
root.appendChild(touch);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9d8e8);
scene.fog = new THREE.Fog(0xb9d8e8, 115, 280);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 700);
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
scene.add(new THREE.HemisphereLight(0xe8f5ff, 0x66744c, 2.0));
const sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
sun.position.set(-60, 100, 35); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);

const mat = (color, roughness=0.88, metalness=0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
const grassMat = mat(0x80a66a), roadMat = mat(0x3a4147), sidewalkMat = mat(0xc4c5bd), lineMat = mat(0xe9e0b7);
const buildingMats = [mat(0xd4c5a8),mat(0xc2b4a0),mat(0xe0d9c9),mat(0xb9c9c5),mat(0xd1b39a),mat(0xc3c6b4)];
const colliders = [];
const roadRects = [];
const boxGeo = new THREE.BoxGeometry(1,1,1);
function box(name,x,y,z,w,h,d,material,collide=false){
 const m=new THREE.Mesh(boxGeo,material); m.name=name; m.position.set(x,y+h/2,z); m.scale.set(w,h,d); m.castShadow=h>0.5; m.receiveShadow=true; scene.add(m);
 if(collide) colliders.push({x,z,hw:w/2,hd:d/2,name});
 return m;
}
function road(x,z,w,d){
 box("road",x,0.015,z,w,0.06,d,roadMat);
 roadRects.push({x,z,hw:w/2,hd:d/2});
 if(w>d){
  for(let p=x-w/2+5;p<x+w/2-3;p+=8) box("lane-mark",p,0.05,z,3.0,.018,.13,lineMat);
 } else {
  for(let p=z-d/2+5;p<z+d/2-3;p+=8) box("lane-mark",x,.05,p,.13,.018,3.0,lineMat);
 }
 box("sidewalk",x,0.025,z-(d/2+1.1),w,.12,1.0,sidewalkMat);
 box("sidewalk",x,0.025,z+(d/2+1.1),w,.12,1.0,sidewalkMat);
}
box("ground",0,-1,0,270,1,270,grassMat);
[-72,-36,0,36,72].forEach(z=>road(0,z,220,9));
[-72,-36,0,36,72].forEach(x=>road(x,0,9,220));

function makeTree(x,z){
 const trunk= new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,2.1,7),mat(0x76513a)); trunk.position.set(x,1.05,z); trunk.castShadow=true; scene.add(trunk);
 const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.45,1),mat([0x427849,0x527f45,0x648d4f][Math.floor(Math.random()*3)])); crown.position.set(x,2.9,z); crown.scale.set(1,1.15,1); crown.castShadow=true; scene.add(crown);
}
function makeBuilding(name,x,z,w,d,h,colorIndex=0,opts={}){
 const base=box(name,x,0,z,w,h,d,buildingMats[colorIndex%buildingMats.length],true);
 box(name+"-roof",x,h,z,w+.3,.25,d+.3,mat(0x555954),false).position.y=h+.12;
 const frontZ=z+d/2+.035;
 const floors=Math.max(1,Math.floor(h/3.1));
 for(let f=0;f<floors;f++){
  for(let wx=x-w/2+1.5;wx<x+w/2-1;wx+=2.7){
   if(Math.abs(wx-x)<1.2 && f===0 && opts.door!==false) continue;
   box("window",wx,1.05+f*3.0,frontZ,.9,1.15,.08,mat(0x547b89,.38,.15),false).position.y=1.05+f*3;
  }
 }
 if(opts.shop){
  box("shop-sign",x,Math.min(h-0.7,3.1),frontZ+.07,Math.min(w-1,6),.6,.12,mat(opts.sign||0x275b56),false);
  const txt=document.createElement("div"); txt.className="afec-world-label"; txt.textContent=name; txt.style.transform="translate(-50%,-50%)"; txt.dataset.x=x;txt.dataset.y=h+1;txt.dataset.z=z;root.appendChild(txt);
 }
 return base;
}

// Defined road blocks. Building footprints are deliberately kept inside parcels.
const blocks=[-54,-18,18,54];
for(let ix=0;ix<blocks.length;ix++) for(let iz=0;iz<blocks.length;iz++){
 const x=blocks[ix],z=blocks[iz];
 if(Math.abs(x)<1 && Math.abs(z)<1) continue;
 if(ix===1&&iz===1){ // football field parcel
  box("football pitch",x,0.09,z,27,.08,23,mat(0x3f8b4e));
  box("pitch line",x,0.14,z,24,.02,.12,mat(0xf4f2d9));
  box("pitch line",x,0.14,z-10.5, .12,.02,21,mat(0xf4f2d9));
  box("pitch line",x,0.14,z+10.5, .12,.02,21,mat(0xf4f2d9));
  box("goal",x,0.8,z-10,5,1.6,.18,mat(0xf4f2d9));
  box("goal",x,0.8,z+10,5,1.6,.18,mat(0xf4f2d9));
  continue;
 }
 if(ix===2&&iz===1){
  makeBuilding("AFEC COMMUNITY CLINIC",x-4,z,12,13,8,2,{shop:true,sign:0x287e88});
  continue;
 }
 if(ix===1&&iz===2){
  makeBuilding("AFEC PRIMARY SCHOOL",x,z,22,14,7,0,{shop:true,sign:0x285b8a});
  continue;
 }
 if(ix===2&&iz===2){
  makeBuilding("FUEL STATION",x,z,18,12,4,4,{shop:true,sign:0x246d54});
  for(let p=-5;p<=5;p+=5) box("fuel-pump",x+p,0,z-1,1.1,1.5,1.1,mat(0xf2eee3),true);
  continue;
 }
 makeBuilding(["Corner Shop","Family House","Market Store","Town House","Cafe","Local Office"][(ix+iz)%6],x,z,11+(ix%2)*2,10+(iz%2)*2,5+(ix*iz)%3*2,(ix+iz)%buildingMats.length,{shop:(ix+iz)%2===0});
}
for(let x=-95;x<=95;x+=18){ makeTree(x,-94); makeTree(x,94); }
for(let z=-80;z<=80;z+=24){ makeTree(-96,z); makeTree(96,z); }

// Car mesh faces +Z. Vehicle motion uses velocity-vector grip and angular steering.
function makeCar(color,x,z,heading=0,ai=false){
 const g=new THREE.Group(); g.position.set(x,.2,z); g.rotation.y=heading; scene.add(g);
 const body=new THREE.Mesh(new THREE.BoxGeometry(2.05,.72,4.15),mat(color,.42,.12)); body.position.y=.72; body.castShadow=true; g.add(body);
 const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.55,.7,1.8),mat(0x8ba7b1,.32,.1)); cabin.position.set(0,1.35,-.25); cabin.castShadow=true;g.add(cabin);
 const wheelMat=mat(0x202326,.9);
 for(const wx of [-1.02,1.02]) for(const wz of [-1.3,1.3]){
  const wh=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.22,10),wheelMat);wh.rotation.z=Math.PI/2;wh.position.set(wx,.4,wz);g.add(wh);
 }
 return {mesh:g, velocity:new THREE.Vector3(), heading, ai, targetSpeed:ai?7:0, color};
}
const playerCar=makeCar(0xc34e35,0,9,Math.PI,true); playerCar.ai=false;
playerCar.mesh.position.set(4,.2,8);
const traffic=[
 makeCar(0x2769a5,-35,2,Math.PI,true), makeCar(0xe0c54c,38,-2,0,true),
 makeCar(0xeeeeea,2,-34,Math.PI/2,true), makeCar(0x4c7d51,-2,35,-Math.PI/2,true)
];
const keys=new Set();
addEventListener("keydown",e=>{keys.add(e.key.toLowerCase());if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key.toLowerCase()))e.preventDefault();});
addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
document.querySelectorAll("[data-key]").forEach(b=>{
 const k=b.dataset.key.toLowerCase(); const down=e=>{e.preventDefault();keys.add(k);}; const up=e=>{e.preventDefault();keys.delete(k);};
 b.addEventListener("pointerdown",down); ["pointerup","pointercancel","pointerleave"].forEach(ev=>b.addEventListener(ev,up));
});
let onFoot=true, player=new THREE.Vector3(0,0,13), playerYaw=0, speed=0, steer=0, cameraYaw=0, dragging=false,lastX=0,lastY=0,cameraPitch=.25;
canvas.addEventListener("pointerdown",e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener("pointerup",()=>dragging=false);
canvas.addEventListener("pointermove",e=>{if(!dragging)return;cameraYaw-=(e.clientX-lastX)*.006;cameraPitch=THREE.MathUtils.clamp(cameraPitch+(e.clientY-lastY)*.003,-.1,.8);lastX=e.clientX;lastY=e.clientY;});
function nearestCar(){return [playerCar,...traffic].sort((a,b)=>a.mesh.position.distanceTo(player)-b.mesh.position.distanceTo(player))[0];}
function toggleCar(){if(onFoot){const c=nearestCar();if(c.mesh.position.distanceTo(player)<5){onFoot=false;playerCar.mesh.position.copy(c.mesh.position);playerCar.heading=c.heading;playerCar.velocity.copy(c.velocity);playerCar.mesh.rotation.y=c.heading;player=playerCar.mesh.position.clone();}}else{onFoot=true;player.copy(playerCar.mesh.position);player.x+=2.4;player.y=0;}}
document.getElementById("afec-enter").addEventListener("click",toggleCar);
addEventListener("keydown",e=>{if(e.key.toLowerCase()==="e")toggleCar();});

function blocked(x,z,r=1){
 return colliders.some(c=>Math.abs(x-c.x)<c.hw+r && Math.abs(z-c.z)<c.hd+r);
}
function drive(car,dt,throttle,turn,handbrake=false){
 const forward=new THREE.Vector3(Math.sin(car.heading),0,Math.cos(car.heading));
 const right=new THREE.Vector3(forward.z,0,-forward.x);
 const v=car.velocity; const longitudinal=v.dot(forward), lateral=v.dot(right);
 const accel=throttle>0?18:throttle<0?-14:0;
 v.addScaledVector(forward,accel*dt);
 const max=handbrake?25:31; if(v.length()>max)v.setLength(max);
 const grip=handbrake?1.0:7.5;
 v.addScaledVector(right,-lateral*Math.min(1,grip*dt));
 if(!throttle)v.multiplyScalar(Math.max(0,1-.85*dt));
 const speedFactor=THREE.MathUtils.clamp(Math.abs(longitudinal)/7,0,1);
 car.heading+=turn*speedFactor*(handbrake?2.4:1.65)*dt*Math.sign(longitudinal||1);
 const nextX=car.mesh.position.x+v.x*dt, nextZ=car.mesh.position.z+v.z*dt;
 if(blocked(nextX,nextZ,1.4)){v.multiplyScalar(-.18);return;}
 car.mesh.position.x=nextX;car.mesh.position.z=nextZ;car.mesh.rotation.y=car.heading;
 // Push-away collisions, approximated as momentum exchange.
 for(const other of [playerCar,...traffic]){if(other===car)continue;const dx=car.mesh.position.x-other.mesh.position.x,dz=car.mesh.position.z-other.mesh.position.z,dist=Math.hypot(dx,dz);if(dist<2.4&&dist>.001){const nx=dx/dist,nz=dz/dist;car.mesh.position.x+=nx*.08;car.mesh.position.z+=nz*.08;car.velocity.add(new THREE.Vector3(nx,0,nz).multiplyScalar(.9));}}
}
function isRoad(x,z){return roadRects.some(r=>Math.abs(x-r.x)<r.hw-1&&Math.abs(z-r.z)<r.hd-1);}
function animate(){
 requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);
 if(onFoot){
  const f=(keys.has("w")||keys.has("arrowup")?1:0)-(keys.has("s")||keys.has("arrowdown")?1:0);
  const s=(keys.has("d")||keys.has("arrowright")?1:0)-(keys.has("a")||keys.has("arrowleft")?1:0);
  const yaw=cameraYaw;const dx=(Math.sin(yaw)*f+Math.cos(yaw)*s),dz=(Math.cos(yaw)*f-Math.sin(yaw)*s);
  const len=Math.hypot(dx,dz)||1;const pace=keys.has("shift")?9:5;
  const nx=player.x+dx/len*pace*dt,nz=player.z+dz/len*pace*dt;
  if(!blocked(nx,player.z,.45))player.x=THREE.MathUtils.clamp(nx,-112,112);
  if(!blocked(player.x,nz,.45))player.z=THREE.MathUtils.clamp(nz,-112,112);
 }else{
  const throttle=(keys.has("w")||keys.has("arrowup")?1:0)-(keys.has("s")||keys.has("arrowdown")?1:0);
  const turn=(keys.has("d")||keys.has("arrowright")?1:0)-(keys.has("a")||keys.has("arrowleft")?1:0);
  drive(playerCar,dt,throttle,turn,keys.has(" "));
  player.copy(playerCar.mesh.position);
 }
 for(const c of traffic){
  const p=c.mesh.position;
  // Lane loops stay on the road grid; avoid any building footprint.
  const axis=Math.abs(c.velocity.x)>Math.abs(c.velocity.z)? "x" : "z";
  if(c.velocity.length()<.5){c.velocity.set(Math.sin(c.heading)*c.targetSpeed,0,Math.cos(c.heading)*c.targetSpeed);}
  const th=1,turn=0;
  drive(c,dt,th,turn,false);
  if(Math.abs(p.x)>83||Math.abs(p.z)>83){c.heading+=Math.PI;c.velocity.multiplyScalar(.4);}
  // Simple lane-route turn at grid intersections.
  if(Math.abs(p.x%36)<1.2&&Math.abs(p.z%36)<1.2){c.heading+=Math.PI/2; }
 }
 const focus=onFoot?player:playerCar.mesh.position;
 const dist=onFoot?9:13;
 const desired=new THREE.Vector3(focus.x+Math.sin(cameraYaw)*Math.cos(cameraPitch)*dist,focus.y+(onFoot?2.1:2.7)+Math.sin(cameraPitch)*dist,focus.z+Math.cos(cameraYaw)*Math.cos(cameraPitch)*dist);
 camera.position.lerp(desired,.12);camera.lookAt(focus.x,focus.y+(onFoot?1.2:1),focus.z);
 document.getElementById("afec-status").textContent=onFoot?"ON FOOT":"DRIVING · "+Math.round(playerCar.velocity.length()*3.6)+" KM/H";
 renderer.render(scene,camera);
 const labels=root.querySelectorAll(".afec-world-label");
 labels.forEach(el=>{const p=new THREE.Vector3(+el.dataset.x,+el.dataset.y,+el.dataset.z).project(camera);el.style.display=p.z<1?"block":"none";el.style.left=((p.x+1)/2*innerWidth)+"px";el.style.top=((-p.y+1)/2*innerHeight)+"px";});
}
const clock=new THREE.Clock();
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));});
animate();
