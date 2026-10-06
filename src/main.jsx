import * as pc from "playcanvas";
import "./style.css";

const canvas=document.createElement("canvas");
canvas.id="application";
document.body.innerHTML="";
document.body.appendChild(canvas);

const hud=document.createElement("div");
hud.className="pc-hud";
hud.innerHTML=`<div class="brand"><span class="brand-mark">A</span><div><strong>AFEC CITY</strong><small>OPEN WORLD</small></div></div><div class="pc-help"><span>WASD / ARROWS</span><span>DRAG TO LOOK</span><span>WHEEL TO ZOOM</span></div><div class="status-pill"><i></i> LIVE</div>`;
document.body.appendChild(hud);

const mobileUI=document.createElement("div");
mobileUI.innerHTML=`
  <div id="joystick" class="joystick"><div class="stick"></div></div>
  <div id="lookZone" class="look-zone"></div>
  <div class="mobile-actions">
    <button id="runBtn" class="action-btn">RUN</button>
    <button id="jumpBtn" class="action-btn jump">JUMP</button>
  </div>
`;
document.body.appendChild(mobileUI);

const device=await pc.createGraphicsDevice(canvas,{
  deviceTypes:[pc.DEVICETYPE_WEBGPU,pc.DEVICETYPE_WEBGL2]
});
const options=new pc.AppOptions();
options.graphicsDevice=device;
options.mouse=new pc.Mouse(canvas);
options.touch=new pc.TouchDevice(canvas);
options.keyboard=new pc.Keyboard(window);
options.componentSystems=[
  pc.RenderComponentSystem,
  pc.CameraComponentSystem,
  pc.LightComponentSystem,
  pc.ScriptComponentSystem
];
options.resourceHandlers=[];
const app=new pc.AppBase(canvas);
app.init(options);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.start();

const color=(hex)=>{
  const c=new pc.Color();
  c.fromString(hex);
  return c;
};
const material=(hex,roughness=.82,metalness=0)=>{
  const m=new pc.StandardMaterial();
  m.diffuse=color(hex);
  m.roughness=roughness;
  m.metalness=metalness;
  m.update();
  return m;
};

const M={
  grass:material("#9fbe87"),
  grass2:material("#a9c98f"),
  road:material("#505a60"),
  roadLight:material("#626d72"),
  sidewalk:material("#b7b4a8"),
  curb:material("#d8d5cb"),
  wall:material("#e4d5bb"),
  wall2:material("#f4ead8"),
  wall3:material("#dce7e8"),
  roof:material("#8d4b39"),
  roofDark:material("#6f3b31"),
  roofBlue:material("#536d82"),
  trim:material("#f4eee0"),
  glass:material("#7da8b5",.25,.15),
  frame:material("#4b4741"),
  door:material("#5a392b"),
  wood:material("#7b5138"),
  tree:material("#3e7045"),
  tree2:material("#5c8c4d"),
  trunk:material("#6b4a32"),
  lamp:material("#24292b",.35,.2),
  gold:material("#e0bb58",.35,.2),
  car1:material("#c74a3e",.4),
  car2:material("#4d78a8",.4),
  car3:material("#e2b24b",.4),
  car4:material("#e7e5dc",.5),
  skin:material("#a86f4d"),
  shirt:material("#315d7d"),
  pants:material("#2c3542"),
  white:material("#f2eee5"),
  dark:material("#222629")
};

function box(name,pos,size,mat,rot=[0,0,0]){
  const e=new pc.Entity(name);
  e.addComponent("render",{type:"box"});
  e.setPosition(...pos);
  e.setLocalScale(...size);
  e.setEulerAngles(...rot);
  e.render.meshInstances[0].material=mat;
  app.root.addChild(e);
  return e;
}
function cyl(name,pos,size,mat){
  const e=new pc.Entity(name);
  e.addComponent("render",{type:"cylinder"});
  e.setPosition(...pos);
  e.setLocalScale(...size);
  e.render.meshInstances[0].material=mat;
  app.root.addChild(e);
  return e;
}
function sphere(name,pos,size,mat){
  const e=new pc.Entity(name);
  e.addComponent("render",{type:"sphere"});
  e.setPosition(...pos);
  e.setLocalScale(...size);
  e.render.meshInstances[0].material=mat;
  app.root.addChild(e);
  return e;
}

box("Terrain",[0,-.4,0],[210,.6,210],M.grass);

const ROAD=12, STEP=34;
for(let i=-3;i<=3;i++){
  const p=i*STEP;
  box("RoadV",[p,0,0],[ROAD,.16,210],M.road);
  box("RoadH",[0,.01,p],[210,.16,ROAD],M.road);
  box("CurbV",[p-7,.11,0],[1,.18,210],M.curb);
  box("CurbV",[p+7,.11,0],[1,.18,210],M.curb);
  box("CurbH",[0,.12,p-7],[210,.18,1],M.curb);
  box("CurbH",[0,.12,p+7],[210,.18,1],M.curb);

  for(let z=-96;z<=96;z+=14) box("LaneMark",[p,.091,z],[.12,.012,4.2],M.gold);
  for(let x=-96;x<=96;x+=14) box("LaneMark",[x,.096,p],[4.2,.012,.12],M.gold);
}

function windowRow(x,y,z,count,spacing,rot=0){
  for(let i=0;i<count;i++){
    const wx=x+(i-(count-1)/2)*spacing;
    box("Window",[wx,y,z],[2.2,1.45,.12],M.glass,[0,rot,0]);
    box("FrameTop",[wx,y+.82,z-.08],[2.5,.12,.18],M.frame,[0,rot,0]);
    box("FrameSide",[wx-1.08,y,z-.08],[.12,1.65,.18],M.frame,[0,rot,0]);
    box("FrameSide",[wx+1.08,y,z-.08],[.12,1.65,.18],M.frame,[0,rot,0]);
  }
}

const obstacles=[];
function addObstacle(x,z,halfX,halfZ,padding=.45){ obstacles.push({x,z,halfX:halfX+padding,halfZ:halfZ+padding}); }

const BUILDING_BASE="https://github.com/bevyengine/bevy_asset_files/raw/main/kenney";
const REAL_TREE_URLS=["https://github.com/bevyengine/bevy_asset_files/raw/main/kenney/city-kit-suburban/tree-small.glb","https://github.com/bevyengine/bevy_asset_files/raw/main/kenney/city-kit-suburban/tree-large.glb"];
const RESIDENTIAL_BUILDINGS=["b","c","d","e","f","g","h","i","k","l","o","u"];
const COMMERCIAL_BUILDINGS=["a","b","c","d","f","g","h"];

const plots=[];
for(let gx=-3;gx<=2;gx++){
  for(let gz=-3;gz<=2;gz++){
    const x=gx*STEP+17+(gz%2)*4;
    const z=gz*STEP+17+(gx%2)*4;
    if(Math.abs(x)>88||Math.abs(z)>88) continue;
    plots.push({x,z,variant:(gx+gz+9)%RESIDENTIAL_BUILDINGS.length});
  }
}

function placeGLBBuilding(entity,x,z,scale=1,rot=0,halfX=8,halfZ=7){
  entity.setPosition(x,0,z);
  entity.setEulerAngles(0,rot,0);
  entity.setLocalScale(scale,scale,scale);
  obstacles.push({x,z,halfX,halfZ});
}

const residentialPromises=RESIDENTIAL_BUILDINGS.map((id,i)=>
  loadGLB(BUILDING_BASE+"/city-kit-suburban/building-type-"+id+".glb","residential-"+i,[1,1,1])
);
const commercialPromises=COMMERCIAL_BUILDINGS.map((id,i)=>
  loadGLB(BUILDING_BASE+"/city-kit-commercial/building-"+id+".glb","commercial-"+i,[1,1,1])
);

Promise.all(residentialPromises).then(models=>{
  plots.forEach((p,i)=>{
    const source=models[i%models.length].entity;
    const building=source.clone();
    app.root.addChild(building);
    placeGLBBuilding(building,p.x,p.z,.72,(i%4)*90,7.5,6.5);
  });
  models.forEach(m=>m.entity.destroy());
}).catch(err=>console.warn("Residential assets failed to load",err));

Promise.all(commercialPromises).then(models=>{
  [[-51,-17],[51,51]].forEach((pos,i)=>{
    const source=models[i%models.length].entity;
    const building=source.clone();
    app.root.addChild(building);
    placeGLBBuilding(building,pos[0],pos[1],.9,i%2?90:0,9,7);
  });
  models.forEach(m=>m.entity.destroy());
}).catch(err=>console.warn("Commercial assets failed to load",err));

function shop(x,z){
  box("Shop",[x,3.5,z],[19,7,13],M.wall3);
  box("ShopTrim",[x,7.15,z],[19.4,.35,13.4],M.gold);
  box("ShopFront",[x,3.2,z-6.58],[15,5.4,.18],M.glass);
  box("ShopDoor",[x+6,3.1,z-6.72],[2.2,5.6,.16],M.door);
  box("Awning",[x,6.3,z-7.6],[18,1,2],M.roofBlue);
  addObstacle(x,z,9.5,6.5,1);
  box("Sign",[x,7.9,z-6.7],[10,1.4,.18],M.gold);
}
shop(-51,-17);
shop(51,51);

const treePositions=[];
for(let i=0;i<55;i++){
  const x=((i*47)%190)-95,z=((i*73)%190)-95;
  if(Math.abs(x%STEP)<10||Math.abs(z%STEP)<10) continue;
  treePositions.push({x,z,scale:.92+(i%4)*.08});
}

function streetLight(x,z){
  cyl("Pole",[x,3.3,z],[.13,6.6,.13],M.lamp);
  box("Arm",[x+.7,6.25,z],[1.5,.12,.12],M.lamp,[0,0,0]);
  sphere("Lamp",[x+1.35,6.15,z],[.28,.28,.28],M.gold);
}
for(let i=-3;i<=3;i++) for(let j=-3;j<=3;j++){
  if((i+j)%2===0) streetLight(i*STEP+8,j*STEP+8);
}

const cars=[];
const npcs=[];
const playerRoot=new pc.Entity("Player");
app.root.addChild(playerRoot);

const REAL_CAR_URL="https://developer.playcanvas.com/assets/porsche-911-carrera-4s.glb";
const REAL_HUMAN_URL="https://three.ws/avatars/cesium-man.glb";

function loadGLB(url,name,scale=[1,1,1]){
  return new Promise((resolve,reject)=>{
    app.assets.loadFromUrlAndFilename(url,name,"container",(err,asset)=>{
      if(err){ console.warn("GLB load failed:",url,err); reject(err); return; }
      const entity=asset.resource.instantiateRenderEntity();
      entity.setLocalScale(...scale);
      app.root.addChild(entity);
      resolve({entity,asset});
    });
  });
}

const realCarPromise=loadGLB(REAL_CAR_URL,"real-car",[.62,.62,.62]);
const realHumanPromise=loadGLB(REAL_HUMAN_URL,"real-human",[1.0,1.0,1.0]);
Promise.all(REAL_TREE_URLS.map((url,i)=>loadGLB(url,"real-tree-"+i,[5,5,5])))
  .then(trees=>{
    treePositions.forEach((p,i)=>{
      const source=trees[i%trees.length].entity;
      const tree=source.clone();
      app.root.addChild(tree);
      tree.setPosition(p.x,0,p.z);
      tree.setLocalScale(p.scale,p.scale,p.scale);
      obstacles.push({x:p.x,z:p.z,halfX:1.1,halfZ:1.1});
    });
    trees.forEach(t=>t.entity.destroy());
  }).catch(err=>console.warn("Nature assets failed to load",err));


realCarPromise.then(({entity})=>{
  entity.setPosition(-96,.05,-5);
  cars.push({e:entity,horizontal:true,dir:1,speed:9,halfX:3.0,halfZ:1.35});
  for(let i=1;i<8;i++){
    const clone=entity.clone();
    app.root.addChild(clone);
    clone.setPosition(-96-i*26,.05, i%2===0?5:-5);
    cars.push({e:clone,horizontal:true,dir:i%2?1:-1,speed:8+(i%3),halfX:3.0,halfZ:1.35});
  }
}).catch(()=>{});

realHumanPromise.then(({entity,asset})=>{
  playerRoot.addChild(entity);
  entity.setLocalPosition(0,0,0);
  playerRoot.setPosition(0,0,51);
  playerRoot.setLocalScale(1.0,1.0,1.0);
  // Visual character is loaded as a real skinned GLB; movement remains script-controlled.
  const tracks=asset.resource.animations||[];
  if(tracks.length){
    playerRoot.addComponent("anim",{activate:false});
    playerRoot.anim.assignAnimation("Move",tracks[0],undefined,1,true);
    playerRoot.anim.baseLayer.play("Move");
  }
  for(let i=0;i<12;i++){
    const npc=new pc.Entity("NPC");
    const npcModel=asset.resource.instantiateRenderEntity();
    npc.addChild(npcModel);
    npc.setLocalScale(.9,.9,.9);
    npc.setPosition(((i%4)-1.5)*10,0,((Math.floor(i/4))-1)*18);
    app.root.addChild(npc);
    const npcTracks=asset.resource.animations||[];
    if(npcTracks.length){
      npc.addComponent("anim",{activate:false});
      npc.anim.assignAnimation("Move",npcTracks[0],undefined,1,true);
      npc.anim.baseLayer.play("Move");
    }
    npcs.push({e:npc,dir:i%2?1:-1,speed:1.2+(i%3)*.25,model:npcModel});
  }
}).catch(()=>{});

const camera=new pc.Entity("Camera");
camera.addComponent("camera",{
  clearColor:color("#d9edf7"),
  fov:62,
  nearClip:.35,
  farClip:500,
  gammaCorrection:2.2,
  toneMapping:pc.TONEMAP_NEUTRAL
});
app.root.addChild(camera);

const sun=new pc.Entity("Sun");
sun.addComponent("light",{
  type:"directional",
  color:color("#fff1d2"),
  intensity:5.2,
  castShadows:true,
  shadowDistance:120,
  shadowResolution:2048,
  shadowIntensity:.55,
  numCascades:3,
  cascadeDistribution:.65
});
sun.setEulerAngles(48,-28,28);
app.root.addChild(sun);

const fill=new pc.Entity("Fill");
fill.addComponent("light",{
  type:"omni",
  color:color("#b8d4df"),
  intensity:4.4,
  range:180
});
fill.setPosition(0,45,0);
app.root.addChild(fill);

const keys={};
window.addEventListener("keydown",e=>{
  keys[e.key.toLowerCase()]=true;
  if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);

let joyX=0,joyY=0,runHeld=false,jump=false;
const joystick=document.getElementById("joystick");
const stick=joystick.querySelector(".stick");
let joyPointer=null;
const setJoy=(x,y)=>{
  const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=x-cx,dy=y-cy,max=r.width*.34;
  const l=Math.hypot(dx,dy);
  if(l>max){dx=dx/l*max;dy=dy/l*max}
  joyX=dx/max;joyY=dy/max;
  stick.style.transform=`translate(${dx}px,${dy}px)`;
};
joystick.addEventListener("pointerdown",e=>{joyPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);setJoy(e.clientX,e.clientY)});
joystick.addEventListener("pointermove",e=>{if(e.pointerId===joyPointer)setJoy(e.clientX,e.clientY)});
const resetJoy=()=>{joyPointer=null;joyX=0;joyY=0;stick.style.transform="translate(0,0)"};
joystick.addEventListener("pointerup",resetJoy); joystick.addEventListener("pointercancel",resetJoy);

document.getElementById("runBtn").addEventListener("pointerdown",()=>runHeld=true);
document.getElementById("runBtn").addEventListener("pointerup",()=>runHeld=false);
document.getElementById("runBtn").addEventListener("pointercancel",()=>runHeld=false);
document.getElementById("jumpBtn").addEventListener("pointerdown",()=>jump=true);

let yaw=0,pitch=-0.16,camDistance=11.5;
let lookId=null,lastLookX=0,lastLookY=0;
const lookZone=document.getElementById("lookZone");
lookZone.addEventListener("pointerdown",e=>{
  lookId=e.pointerId; lastLookX=e.clientX; lastLookY=e.clientY; lookZone.setPointerCapture(e.pointerId);
});
lookZone.addEventListener("pointermove",e=>{
  if(e.pointerId!==lookId)return;
  yaw+=(e.clientX-lastLookX)*.004;
  pitch=Math.max(-.48,Math.min(.25,pitch-(e.clientY-lastLookY)*.0025));
  lastLookX=e.clientX;lastLookY=e.clientY;
});
const endLook=()=>lookId=null;
lookZone.addEventListener("pointerup",endLook);lookZone.addEventListener("pointercancel",endLook);

canvas.addEventListener("pointerdown",e=>{
  if(e.pointerType==="mouse"&&e.clientX>window.innerWidth*.42){
    lookId=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener("pointermove",e=>{
  if(e.pointerType!=="mouse"||e.pointerId!==lookId)return;
  yaw+=(e.clientX-lastLookX)*.003;
  pitch=Math.max(-.48,Math.min(.25,pitch-(e.clientY-lastLookY)*.002));
  lastLookX=e.clientX;lastLookY=e.clientY;
});
window.addEventListener("pointerup",()=>lookId=null);

canvas.addEventListener("wheel",e=>{
  e.preventDefault();
  camDistance=Math.max(6,Math.min(85,camDistance+e.deltaY*.035));
},{passive:false});

let pinchStart=null;
canvas.addEventListener("touchstart",e=>{
  if(e.touches.length===2){
    const a=e.touches[0],b=e.touches[1];
    pinchStart=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  }
},{passive:false});
canvas.addEventListener("touchmove",e=>{
  if(e.touches.length===2 && pinchStart!==null){
    e.preventDefault();
    const a=e.touches[0],b=e.touches[1];
    const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    camDistance=Math.max(6,Math.min(85,camDistance-(d-pinchStart)*.035));
    pinchStart=d;
  }
},{passive:false});
canvas.addEventListener("touchend",()=>{pinchStart=null;},{passive:false});

let velocityY=0,grounded=true,time=0;
const forward=new pc.Vec3(),right=new pc.Vec3();

app.on("update",dt=>{
  time+=dt;
  const keyboardX=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
  const keyboardY=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0);
  let mx=Math.abs(joyX)>.04?joyX:keyboardX;
  let my=Math.abs(joyY)>.04?-joyY:keyboardY;
  const mag=Math.hypot(mx,my);
  if(mag>1){mx/=mag;my/=mag}

  const speed=(keys.shift||runHeld)?11:6;
  const cy=Math.cos(yaw),sy=Math.sin(yaw);
  forward.set(sy,0,cy);
  right.set(cy,0,-sy);
  const moveX=right.x*mx+forward.x*my;
  const moveZ=right.z*mx+forward.z*my;
  if(mag>.08){
    const p=playerRoot.getPosition();
    const nx=Math.max(-99,Math.min(99,p.x+moveX*speed*dt));
    const nz=Math.max(-99,Math.min(99,p.z+moveZ*speed*dt));
    const canMove=(x,z)=>{
      const r=.48;
      return !obstacles.some(o=>Math.abs(x-o.x)<o.halfX+r && Math.abs(z-o.z)<o.halfZ+r);
    };
    if(canMove(nx,p.z)) p.x=nx;
    if(canMove(p.x,nz)) p.z=nz;
    playerRoot.setPosition(p);
    playerRoot.setEulerAngles(0,Math.atan2(moveX,moveZ)*180/Math.PI,0);
    if(playerRoot.anim) playerRoot.anim.speed=(keys.shift||runHeld)?1.35:1;
  }

  if((jump||keys[" "])&&grounded){velocityY=7;grounded=false;jump=false}
  velocityY-=18*dt;
  const pp=playerRoot.getPosition();
  pp.y+=velocityY*dt;
  if(pp.y<=1){pp.y=1;velocityY=0;grounded=true}
  playerRoot.setPosition(pp);

  for(const c of cars){
    const p=c.e.getPosition();
    if(c.horizontal){
      p.x+=c.speed*c.dir*dt;
      if(p.x>108)p.x=-108;
      if(p.x<-108)p.x=108;
    }else{
      p.z+=c.speed*c.dir*dt;
      if(p.z>108)p.z=-108;
      if(p.z<-108)p.z=108;
    }
    c.e.setPosition(p);
  }

  for(const n of npcs){
    const p=n.e.getPosition();
    p.x+=n.speed*n.dir*dt;
    if(p.x>82)p.x=-82;
    if(p.x<-82)p.x=82;
    n.e.setPosition(p);
  }

  const target=playerRoot.getPosition();
  const dist=camDistance;
  const cp=Math.cos(pitch),sp=Math.sin(pitch);
  const desired=new pc.Vec3(
    target.x-Math.sin(yaw)*dist*cp,
    Math.max(2.0,target.y+4.2+sp*dist),
    target.z-Math.cos(yaw)*dist*cp
  );
  const current=camera.getPosition();
  current.lerp(current,desired,.14);
  camera.setPosition(current);
  camera.lookAt(new pc.Vec3(target.x,target.y+1.35,target.z));
});
