import * as pc from "playcanvas";
import "./style.css";

const canvas=document.createElement("canvas");
canvas.id="application";
document.body.innerHTML="";
document.body.appendChild(canvas);

const hud=document.createElement("div");
hud.className="pc-hud";
hud.innerHTML='<div><b>BET CITY</b><span>OPEN CITY</span></div><div>WALK · WASD / ARROWS · DRAG LOOK</div>';
document.body.appendChild(hud);

const device=await pc.createGraphicsDevice(canvas,{deviceTypes:[pc.DEVICETYPE_WEBGPU,pc.DEVICETYPE_WEBGL2]});
const options=new pc.AppOptions();
options.graphicsDevice=device;
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

const mat=(r,g,b)=>{
 const m=new pc.StandardMaterial();
 m.diffuse=new pc.Color(r,g,b);
 m.roughness=0.9;
 m.update();
 return m;
};
const materials={
 ground:mat(.20,.25,.22),road:mat(.08,.09,.085),sidewalk:mat(.48,.49,.45),
 building:[mat(.55,.48,.38),mat(.38,.46,.52),mat(.60,.52,.43),mat(.42,.42,.40)],
 roof:mat(.12,.14,.15),tree:mat(.16,.34,.18),trunk:mat(.28,.19,.11),
 car:[mat(.75,.08,.06),mat(.08,.28,.62),mat(.85,.62,.08),mat(.12,.12,.13)],
 person:mat(.08,.18,.34),window:mat(.12,.22,.28)
};

function box(name,pos,scale,material,rot=[0,0,0]){
 const e=new pc.Entity(name); e.addComponent("render",{type:"box"});
 e.setPosition(pos[0],pos[1],pos[2]); e.setLocalScale(scale[0],scale[1],scale[2]); e.setEulerAngles(rot[0],rot[1],rot[2]);
 e.render.meshInstances[0].material=material; app.root.addChild(e); return e;
}
function cylinder(name,pos,scale,material){
 const e=new pc.Entity(name); e.addComponent("render",{type:"cylinder"});
 e.setPosition(pos[0],pos[1],pos[2]); e.setLocalScale(scale[0],scale[1],scale[2]);
 e.render.meshInstances[0].material=material; app.root.addChild(e); return e;
}

box("Ground",[0,-.35,0],[180,.5,180],materials.ground);

for(let i=-4;i<=4;i++){
 box("RoadV",[i*20,.01,0],[9,.12,180],materials.road);
 box("RoadH",[0,.02,i*20],[180,.13,9],materials.road);
 box("SideV",[i*20-5,.07,0],[1.2,.12,180],materials.sidewalk);
 box("SideV",[i*20+5,.07,0],[1.2,.12,180],materials.sidewalk);
 box("SideH",[0,.07,i*20-5],[180,.12,1.2],materials.sidewalk);
 box("SideH",[0,.07,i*20+5],[180,.12,1.2],materials.sidewalk);
}

for(let x=-3;x<=3;x++) for(let z=-3;z<=3;z++){
 if(Math.abs(x)<=1&&Math.abs(z)<=1) continue;
 const bx=x*20+(z%2)*3,bz=z*20+(x%2)*3;
 const h=5+(Math.abs(x+z)%4)*2;
 box("Building",[bx,h/2,bz],[10,h,10],materials.building[(x+z+8)%materials.building.length]);
 box("Roof",[bx,h+.15,bz],[10.3,.3,10.3],materials.roof);
 for(let row=0;row<2;row++) for(let col=0;col<2;col++)
   box("Window",[bx-3.1+col*6,h*.62,bz-5.06],[1.5,1.3,.08],materials.window);
}

for(let i=0;i<45;i++){
 const x=((i*37)%160)-80,z=((i*61)%160)-80;
 if(Math.abs(x%20)<7||Math.abs(z%20)<7) continue;
 cylinder("TreeTrunk",[x,1.2,z],[.45,2.4,.45],materials.trunk);
 const crown=new pc.Entity("Tree"); crown.addComponent("render",{type:"sphere"});
 crown.setPosition(x,3,z); crown.setLocalScale(2.3,2.3,2.3); crown.render.meshInstances[0].material=materials.tree; app.root.addChild(crown);
}

const cars=[];
for(let i=0;i<14;i++){
 const axis=i%2, lane=(Math.floor(i/2)%8-3.5)*20;
 const e=box("Car",axis?[ -78,.65,lane ]:[ lane,.65,-78],[axis?2.2:1.4,1.1,axis?1.4:2.2],materials.car[i%materials.car.length]);
 cars.push({e,axis,dir:i%4<2?1:-1,speed:5+(i%3)*1.5,lane});
}

const people=[];
for(let i=0;i<18;i++){
 const e=box("Person",[((i*17)%100)-50,.9,((i*29)%100)-50],[.65,1.8,.45],materials.person);
 people.push({e,phase:i*.8});
}

const player=box("Player",[0,1,10],[.8,2,.55],materials.car[2]);
const camera=new pc.Entity("Camera");
camera.addComponent("camera",{clearColor:new pc.Color(.48,.68,.82),fov:65});
camera.setPosition(0,7,18); app.root.addChild(camera);

const sun=new pc.Entity("Sun");
sun.addComponent("light",{type:"directional",color:new pc.Color(1,.94,.82),intensity:2,castShadows:true,shadowDistance:120});
sun.setEulerAngles(45,30,20); app.root.addChild(sun);
const ambient=new pc.Entity("Ambient");
ambient.addComponent("light",{type:"omni",color:new pc.Color(.55,.65,.75),intensity:1,radius:100});
ambient.setPosition(0,30,0); app.root.addChild(ambient);

camera.lookAt(player.getPosition());
const keys={};
window.addEventListener("keydown",e=>keys[e.key.toLowerCase()]=true);
window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);

let yaw=0,pitch=-.22,drag=false,lastX=0,lastY=0;
canvas.addEventListener("pointerdown",e=>{drag=true;lastX=e.clientX;lastY=e.clientY});
window.addEventListener("pointerup",()=>drag=false);
window.addEventListener("pointermove",e=>{
 if(!drag)return;
 yaw-=(e.clientX-lastX)*.004; pitch=pc.math.clamp(pitch-(e.clientY-lastY)*.003,-.75,.35);
 lastX=e.clientX;lastY=e.clientY;
});

app.on("update",dt=>{
 const speed=keys.shift?10:5;
 let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
 let dz=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
 const len=Math.hypot(dx,dz)||1; dx/=len;dz/=len;
 const cy=Math.cos(yaw),sy=Math.sin(yaw);
 player.translateLocal((dx*cy-dz*sy)*speed*dt,0,(dx*sy+dz*cy)*speed*dt);
 const p=player.getPosition(); p.x=pc.math.clamp(p.x,-86,86);p.z=pc.math.clamp(p.z,-86,86);player.setPosition(p);
 player.setEulerAngles(0,yaw*180/Math.PI,0);
 for(const c of cars){
   const p=c.e.getPosition();
   if(c.axis===0){p.x+=c.speed*c.dir*dt;if(p.x>88)p.x=-88;if(p.x<-88)p.x=88}
   else{p.z+=c.speed*c.dir*dt;if(p.z>88)p.z=-88;if(p.z<-88)p.z=88}
   c.e.setPosition(p);
 }
 for(const n of people){
   const p=n.e.getPosition();p.x+=Math.sin(app.time*.5+n.phase)*dt*1.5;p.z+=Math.cos(app.time*.4+n.phase)*dt*1.5;n.e.setPosition(p);
 }
 const pp=player.getPosition();
 const cp=Math.cos(pitch),sp=Math.sin(pitch),dist=16;
 camera.setPosition(pp.x-Math.sin(yaw)*dist*cp,pp.y+5+sp*dist,pp.z-Math.cos(yaw)*dist*cp);
 camera.lookAt(new pc.Vec3(pp.x,pp.y+1.2,pp.z));
});
