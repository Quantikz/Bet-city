import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "./style.css";

document.body.innerHTML = "";
const app = document.createElement("main");
app.id = "world";
document.body.appendChild(app);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#9ab8c6");
scene.fog = new THREE.FogExp2("#9ab8c6", 0.0017);
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(74, 66, 88);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 7, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 12;
controls.maxDistance = 210;

scene.add(new THREE.HemisphereLight("#eaf7ff", "#42505b", 2.1));
const sun = new THREE.DirectionalLight("#fff0cf", 3.1);
sun.position.set(-45, 90, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.camera.left = -125; sun.shadow.camera.right = 125;
sun.shadow.camera.top = 125; sun.shadow.camera.bottom = -125;
sun.shadow.bias = -0.00025;
scene.add(sun);
const fill = new THREE.DirectionalLight("#9bcfff", 1.05);
fill.position.set(65, 40, -70); scene.add(fill);

const mat = (color, roughness=0.75, metalness=0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
const M = {
 grass:mat("#657e63"), lawn:mat("#8ba780"), road:mat("#252d35",0.93), asphalt:mat("#303a43"),
 concrete:mat("#aeb8b7"), curb:mat("#d0d0c5"), white:mat("#f0e9d9"),
 glass: new THREE.MeshPhysicalMaterial({color:"#78b7cb",metalness:0.25,roughness:0.18,transparent:true,opacity:0.48,side:THREE.DoubleSide}),
 darkGlass:mat("#172a38",0.24,0.3), concreteBuilding:mat("#d4d0c6"), stone:mat("#a3a69f"),
 metal:mat("#3d4a51",0.32,0.7), gold:mat("#d8ad57",0.35,0.45),
 wood:mat("#76533b"), darkWood:mat("#352d29"), leaf:mat("#456d49"), leaf2:mat("#71965d"),
 water:new THREE.MeshPhysicalMaterial({color:"#2f9ebc",roughness:0.18,metalness:0.12,transparent:true,opacity:0.91}),
 screen:mat("#10222b",0.25,0.25), whiteWall:mat("#e8e4da")
};
const boxGeo = new THREE.BoxGeometry(1,1,1);
function box(parent, material, x,y,z,w,h,d, opts={}) {
  const mesh = new THREE.Mesh(boxGeo, material);
  mesh.position.set(x,y+h/2,z); mesh.scale.set(w,h,d);
  mesh.castShadow = opts.castShadow !== false; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
function cylinder(parent, material, x,y,z, rt, rb, h, seg=10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),material);
  m.position.set(x,y+h/2,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
}
function plane(parent, material, x,y,z,w,d, rotation=0) {
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);
  m.rotation.x=-Math.PI/2; m.rotation.z=rotation; m.position.set(x,y,z); m.receiveShadow=true; parent.add(m); return m;
}
function label(text, x,y,z, size=1.4, color="#f3f0e7") {
  const c=document.createElement("canvas"); c.width=1024; c.height=256;
  const ctx=c.getContext("2d"); ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle="rgba(10,22,29,.88)"; ctx.fillRect(10,20,1004,216);
  ctx.strokeStyle="#d8ad57"; ctx.lineWidth=8; ctx.strokeRect(14,24,996,208);
  ctx.fillStyle=color; ctx.font="bold 72px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(text,512,128,950);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(size*3.5,size*.88),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));
  m.position.set(x,y,z); m.castShadow=false; scene.add(m); return m;
}
function tree(x,z,scale=1) {
  const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(scale); scene.add(g);
  cylinder(g,mat("#60452f"),0,0,0,.24,.34,2.3,8);
  const crowns=[[0,2.3,0,1.4,"#456d49"],[-.52,2.8,.1,.92,"#628452"],[.45,3,.2,.98,"#73965d"],[.05,3.55,-.1,.72,"#527b4b"]];
  for(const [x,y,z,r,c] of crowns){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);}
  return g;
}
function lamp(x,z) {
  cylinder(scene,M.metal,x,0,z,.07,.1,5.2,8);
  box(scene,M.metal,x,5.15,z+.45,.13,.12,1);
  const light=new THREE.PointLight("#ffdfa4",8,13,2); light.position.set(x,4.8,z+.6); scene.add(light);
}
function road(x,z,w,d) {
  box(scene,M.road,x,0,z,w,.12,d,{castShadow:false});
  if(w>d) {
    for(let a=x-w/2+3;a<x+w/2-2;a+=7) box(scene,M.white,a,.065,z,.0+3,.035,.12,{castShadow:false});
  } else {
    for(let a=z-d/2+3;a<z+d/2-2;a+=7) box(scene,M.white,x,.065,a,.12,.035,3,{castShadow:false});
  }
}
function officeBuilding({x,z,w,d,h,name,floors=4,hero=false}) {
  const g=new THREE.Group(); g.position.set(x,0,z); scene.add(g);
  const podiumH=hero?1.5:0.7;
  box(g,M.concreteBuilding,0,podiumH/2,0,w,podiumH,d);
  box(g,M.darkGlass,0,podiumH+h/2,0,w-1,h,d-1);
  const floorH=h/floors;
  for(let f=0;f<=floors;f++){
    box(g,hero?M.gold:M.concrete,0,podiumH+f*floorH,0,w+.12,.18,d+.12);
    for(let side of [-1,1]){
      for(let i=-Math.floor((w-2)/3);i<=Math.floor((w-2)/3);i++){
        box(g,M.glass,i*3,podiumH+f*floorH+floorH*.48,side*(d/2-.36),2.42,floorH*.66,.06,{castShadow:false});
        box(g,M.metal,i*3,podiumH+f*floorH+floorH*.48,side*(d/2-.4),.055,floorH*.72,.08,{castShadow:false});
      }
    }
    for(let side of [-1,1]){
      for(let i=-Math.floor((d-2)/3);i<=Math.floor((d-2)/3);i++){
        box(g,M.glass,side*(w/2-.36),podiumH+f*floorH+floorH*.48,i*3,.06,floorH*.66,2.42,{castShadow:false});
        box(g,M.metal,side*(w/2-.4),podiumH+f*floorH+floorH*.48,i*3,.08,floorH*.72,.055,{castShadow:false});
      }
    }
  }
  // roof parapet, mechanical plant and entrance canopy
  box(g,M.concreteBuilding,0,podiumH+h+.55,-d/2,w+.6,1.1,.55);
  box(g,M.concreteBuilding,0,podiumH+h+.55,d/2,w+.6,1.1,.55);
  box(g,M.concreteBuilding,-w/2,podiumH+h+.55,0,.55,1.1,d);
  box(g,M.concreteBuilding,w/2,podiumH+h+.55,0,.55,1.1,d);
  for(let i=-1;i<=1;i++) box(g,M.metal,i*w*.18,podiumH+h+1.25,0,w*.13,.8,d*.2);
  box(g,M.gold,0,podiumH+.15,d/2+1.1,w*.56,.24,2.1);
  box(g,M.darkGlass,0,podiumH+1.5,d/2+.6,w*.34,2.6,.12);
  // entrance glazing and columns
  for(let i=-1;i<=1;i++) cylinder(g,M.concreteBuilding,i*w*.22,podiumH,d/2+.8,.16,.16,3,12);
  const sign=document.createElement("canvas");sign.width=1024;sign.height=200;
  const c=sign.getContext("2d");c.fillStyle="#14222b";c.fillRect(0,0,1024,200);c.fillStyle="#d8ad57";c.font="bold 70px Arial";c.textAlign="center";c.fillText(name.toUpperCase(),512,125,960);
  const tx=new THREE.CanvasTexture(sign);tx.colorSpace=THREE.SRGBColorSpace;
  const sm=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w*.8,26),2.8),new THREE.MeshBasicMaterial({map:tx}));
  sm.position.set(0,podiumH+3,d/2+.09);g.add(sm);
  // interior visible through facade: floors, desks and warm partitioning
  if(hero){
    for(let f=0;f<floors;f++){
      const yy=podiumH+f*floorH+.18;
      box(g,M.wood,0,yy,0,w-1,.18,d-1);
      for(let xx=-w/2+3;xx<w/2-2;xx+=5){
        box(g,M.metal,xx,yy+1,0,.12,2,d-2);
      }
      if(f===0){
        box(g,M.darkWood,0,yy+1.2,-d*.22,w*.48,2.4,1.2);
        box(g,M.gold,0,yy+2.45,-d*.22,w*.5,.15,1.35);
        // reception backdrop
        box(g,M.darkWood,0,yy+2.1,-d*.43,w*.45,4,.18);
      } else {
        for(let row=-1;row<=1;row++){
          for(let col=-3;col<=3;col++){
            const dx=col*5, dz=row*5;
            box(g,M.wood,dx,yy+1.2,dz,3.4,.22,1.7);
            box(g,M.darkGlass,dx,yy+2.2,dz-.45,1.7,1.05,.1);
            box(g,M.screen,dx,yy+2.2,dz-.36,1.48,.82,.04,{castShadow:false});
            box(g,M.metal,dx,yy+.55,dz+1.35,.8,1.05,.8);
            cylinder(g,M.metal,dx,yy+.1,dz+1.35,.36,.36,.16,10);
          }
        }
      }
    }
  }
  return g;
}

// Ground and city plot: restrained fog and a deliberate campus composition.
box(scene,M.grass,0,-.48,0,260,1,260,{castShadow:false});
box(scene,M.lawn,0,-.12,0,224,.12,224,{castShadow:false});
for(let x=-100;x<=100;x+=40) road(x,0,8,220);
for(let z=-100;z<=100;z+=40) road(0,z,220,8);
// sidewalks bordering the road grid
for(let x=-100;x<=100;x+=40) for(let z=-100;z<=100;z+=40){
  box(scene,M.curb,x,.02,z,11,.08,11,{castShadow:false});
  box(scene,M.lawn,x,.075,z,8.6,.04,8.6,{castShadow:false});
}
const buildings=[
 {x:-26,z:-28,w:43,d:29,h:25,name:"GOATFUNDED HQ",floors:6,hero:true},
 {x:34,z:-52,w:23,d:19,h:14,name:"Trader Academy",floors:3},
 {x:68,z:-26,w:22,d:18,h:11,name:"Risk & Operations",floors:3},
 {x:-72,z:-56,w:19,d:16,h:9,name:"Market Data Centre",floors:2},
 {x:48,z:20,w:25,d:19,h:10,name:"Trader Lounge",floors:2},
 {x:77,z:63,w:21,d:17,h:8,name:"Wellness Pavilion",floors:2},
 {x:-65,z:22,w:25,d:20,h:12,name:"Research Institute",floors:3},
 {x:0,z:65,w:28,d:20,h:14,name:"Financial Services",floors:4}
];
for(const b of buildings) officeBuilding(b);

// Arrival plaza and entry gate
box(scene,M.concrete,-26,.04,-5,54,.16,16,{castShadow:false});
for(let i=-4;i<=4;i++) box(scene,M.gold,-26+i*5,.14,-5,.09,.02,12,{castShadow:false});
box(scene,M.metal,-26,3,-2,24,.3,.3);
for(let x of [-38,-14]) box(scene,M.metal,x,1.5,-2,.22,3,.22);
label("GOATFUNDED TRADER", -26,5.2,-1.7,2.8);

// Landscaped pocket parks, pathways, trees and lights
for(let x=-94;x<=94;x+=20){
 for(let z=-90;z<=90;z+=20){
  const nearBuilding=buildings.some(b=>Math.abs(x-b.x)<b.w/2+7&&Math.abs(z-b.z)<b.d/2+7);
  const nearRoad=(Math.abs((x+100)%40)<7)||(Math.abs((z+100)%40)<7);
  if(!nearBuilding&&!nearRoad) tree(x,z,.75+((Math.abs(x*3+z*7)%5)/10));
 }
}
for(let x=-100;x<=100;x+=20) for(let z=-100;z<=100;z+=40) lamp(x,z);

// Pool garden with deck, water, steps, loungers
box(scene,M.lawn,78,.02,58,38,.12,48,{castShadow:false});
box(scene,M.wood,82,.12,58,22,.22,34,{castShadow:false});
box(scene,M.concrete,82,.28,58,18,.18,29,{castShadow:false});
box(scene,M.water,82,.42,58,16.8,.12,27.8,{castShadow:false});
for(let x=72;x<=92;x+=4){
  box(scene,M.wood,x,.26,39,.09,.1,1.8,{castShadow:false});
  box(scene,M.wood,x,.26,77,.09,.1,1.8,{castShadow:false});
}
for(let z=43;z<=72;z+=8){
  for(let x of [68,96]){
    box(scene,M.whiteWall,x,.38,z,2.3,.16,4);
    box(scene,M.wood,x,.62,z,2.3,.28,2.7);
  }
}
for(const p of [[58,38],[100,38],[58,78],[100,78],[63,53],[100,58]]) tree(p[0],p[1],.9);

// Parking with marked bays, lanes, and recognizable low-poly cars
box(scene,M.asphalt,-67,.01,73,54,.12,30,{castShadow:false});
for(let i=0;i<14;i++){
 const x=-92+i*3.8;
 box(scene,M.white,x,.085,61,.08,.025,10,{castShadow:false});
 box(scene,M.white,x,.085,85,.08,.025,10,{castShadow:false});
}
function car(x,z,color){
 const body=mat(color,.35,.18), tire=mat("#171b20",.9), glass=mat("#8eb9c6",.22,.15);
 const g=new THREE.Group();g.position.set(x,.1,z);scene.add(g);
 box(g,body,0,.7,0,2.1,.75,4.1);
 box(g,body,0,1.25,-.15,1.65,.62,2.15);
 box(g,glass,0,1.31,-.15,1.48,.43,1.93,{castShadow:false});
 for(const xx of [-.92,.92]) for(const zz of [-1.25,1.25]) cylinder(g,tire,xx,.42,zz,.34,.34,.18,12).rotation.z=Math.PI/2;
 box(g,M.white,0,.67,2.08,.65,.18,.08,{castShadow:false});
 return g;
}
["#263d52","#9a9b95","#7e3430","#e1d4b8","#334b42","#27323b","#c1c4c2"].forEach((c,i)=>car(-89+i*7.3,66,c));
["#384e60","#b2a68f","#5d3935","#d3d5cf","#32404c"].forEach((c,i)=>car(-87+i*8,79,c));

// Walkable human-scale plaza objects and benches
function bench(x,z,rot=0){
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);
 box(g,M.wood,0,.52,0,2.6,.18,.65);
 for(const xx of [-.9,.9]) box(g,M.metal,xx,.25,0,.12,.5,.55);
 box(g,M.wood,0,.95,-.26,2.6,.72,.16);
}
bench(-45,-8,.1);bench(-8,-7,-.4);bench(57,42,.3);bench(60,74,-.4);

// Zone hotspots for selection, and compact touch-friendly interface
const hotspots=[];
for(const b of buildings){
 const hit=new THREE.Mesh(new THREE.BoxGeometry(b.w,b.h+4,b.d),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
 hit.position.set(b.x,(b.h+4)/2,b.z);hit.userData.building=b;scene.add(hit);hotspots.push(hit);
}
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
const hud=document.createElement("section");hud.id="hud";
hud.innerHTML=`<header class="brand"><span class="brand-mark">♞</span><div><b>GOATFUNDED</b><small>TRADER CAMPUS · FINANCIAL DISTRICT</small></div></header>
<div class="stats"><span>BUILDINGS <b>8</b></span><span>WORLD <b>220m²</b></span><span>MARKET <b>FX · GOLD</b></span></div>
<nav class="controls">
<button data-mode="orbit" class="active">◎ Orbit campus</button><button data-mode="walk">⌖ Explore campus</button><button data-mode="map">▦ Site plan</button><button data-mode="hq">⌂ Trading HQ</button><button data-mode="garden">✳ Garden & pool</button><button data-mode="parking">▤ Parking</button><button data-mode="light">☼ Day / evening</button><button data-mode="reset">↻ Reset view</button>
</nav>
<div id="info" class="info"><b>GOATFUNDED CAMPUS</b><p>Drag to orbit · pinch to zoom · tap a building to inspect it.</p></div>`;
app.appendChild(hud);
const info=hud.querySelector("#info");
function focus(x,y,z,dist=34){
 controls.target.set(x,y,z);
 const dir=new THREE.Vector3(1,.8,1).normalize();camera.position.copy(new THREE.Vector3(x,y,z).addScaledVector(dir,dist));
 controls.update();
}
function setInfo(title,desc){info.innerHTML="<b>"+title+"</b><p>"+desc+"</p>";}
function setActive(btn){hud.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===btn));}
hud.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
 setActive(btn);
 switch(btn.dataset.mode){
  case "orbit":controls.enabled=true;camera.position.set(74,66,88);controls.target.set(0,7,0);setInfo("CAMPUS OVERVIEW","Orbit, zoom, and tap a building to inspect it.");break;
  case "walk":controls.enabled=true;camera.position.set(-26,3,0);controls.target.set(-10,3,-8);setInfo("CAMPUS EXPLORATION","Use drag to look around and tap buildings for details.");break;
  case "map":camera.position.set(0,185,.01);controls.target.set(0,0,0);controls.maxPolarAngle=Math.PI/2;setInfo("SITE PLAN","Top-down view of the buildings, roads, green spaces and pool.");break;
  case "hq":focus(-26,10,-28,40);setInfo("GOATFUNDED TRADING HQ","Multi-floor headquarters with visible workstations, screens, reception and glazed facade.");break;
  case "garden":focus(82,2,58,35);setInfo("GARDEN & POOL","Pool deck, loungers, landscape trees and outdoor seating.");break;
  case "parking":focus(-67,2,73,35);setInfo("PARKING AREA","Marked bays, circulation space and parked vehicles.");break;
  case "light":sun.intensity=sun.intensity>2?0.5:3.1;scene.background.set(sun.intensity>2?"#9ab8c6":"#172b43");scene.fog.color.copy(scene.background);renderer.toneMappingExposure=sun.intensity>2?1.05:.72;setInfo(sun.intensity>2?"DAY LIGHTING":"EVENING LIGHTING","Lighting preset changed.");break;
  case "reset":controls.maxPolarAngle=Math.PI*.48;camera.position.set(74,66,88);controls.target.set(0,7,0);setInfo("CAMPUS OVERVIEW","Camera reset.");break;
 }
 controls.update();
}));
renderer.domElement.addEventListener("pointerdown",e=>{
 pointer.x=e.clientX/window.innerWidth*2-1;pointer.y=-(e.clientY/window.innerHeight)*2+1;
 raycaster.setFromCamera(pointer,camera);
 const hit=raycaster.intersectObjects(hotspots,false)[0];
 if(hit){const b=hit.object.userData.building;setInfo(b.name,b.hero?"Main headquarters: multi-floor trading office, reception and workstations.":"Campus facility with glazed office floors and an accessible entrance.");focus(b.x,b.h/2,b.z,Math.max(b.w,b.d)*2.3);}
});
let walkKeys={};
window.addEventListener("keydown",e=>{walkKeys[e.key.toLowerCase()]=true;});
window.addEventListener("keyup",e=>{walkKeys[e.key.toLowerCase()]=false;});
function animate(){
 requestAnimationFrame(animate);
 if(walkKeys.w||walkKeys.s||walkKeys.a||walkKeys.d){
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
  const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();
  const speed=.35;
  if(walkKeys.w)camera.position.addScaledVector(forward,speed);
  if(walkKeys.s)camera.position.addScaledVector(forward,-speed);
  if(walkKeys.a)camera.position.addScaledVector(right,-speed);
  if(walkKeys.d)camera.position.addScaledVector(right,speed);
  controls.target.copy(camera.position).add(forward.multiplyScalar(8));
 }
 controls.update();renderer.render(scene,camera);
}
animate();
window.addEventListener("resize",()=>{
 camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
});
