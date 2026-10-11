import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "./style.css";

document.title = "GOATFUNDED | Private Trading Compound";
document.body.innerHTML = '<main id="world"><div id="boot">BUILDING YOUR WORLD…</div></main>';
const root=document.querySelector("#world");
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.info.autoReset=true;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
root.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color("#172237");scene.fog=new THREE.Fog("#172237",95,240);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,500);
camera.position.set(27,22,31);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,3,0);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=4;controls.maxDistance=100;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight("#c9dcff","#43372c",1.65));
const moon=new THREE.DirectionalLight("#d3ddff",2.0);moon.position.set(-20,35,20);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);moon.shadow.camera.left=-45;moon.shadow.camera.right=45;moon.shadow.camera.top=45;moon.shadow.camera.bottom=-45;moon.shadow.bias=-0.00025;scene.add(moon);
const warm=new THREE.PointLight("#ffbd71",100,52,2);warm.position.set(-5,8,-3);scene.add(warm);
const fill=new THREE.PointLight("#6b8dff",42,48,2);fill.position.set(13,5,1);scene.add(fill);
const mat=(color,roughness=.7,metalness=0,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
const M={
 ground:mat("#293b39"),grass:mat("#426047"),stone:mat("#8c8a82"),paver:mat("#b6b0a2"),dark:mat("#151a21"),black:mat("#080b10",.22,.25),
 concrete:mat("#777a7a"),wall:mat("#c9c2b4"),inner:mat("#e1d6c2"),wood:mat("#6e4931"),woodLight:mat("#a47a50"),gold:mat("#d5ad61",.35,.5),
 glass:mat("#5f91a1",.16,.25,{transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide}),window:mat("#172b3b",.16,.35),
 red:mat("#b50920",.22,.62),rubber:mat("#111318",.95),chrome:mat("#b6c4c9",.2,.85),leather:mat("#252b31",.65),screen:mat("#06131d",.24,.1),
 green:mat("#315c3d"),leaf:mat("#476c48"),leaf2:mat("#70885a"),water:mat("#1689a6",.14,.22,{transparent:true,opacity:.9,depthWrite:false}),
 white:mat("#eee8dd"),rug:mat("#333b43"),sofa:mat("#b7aa98"),tile:mat("#c9c6bc",.34),light:mat("#ffe2a1",.25,0,{emissive:"#ffc76a",emissiveIntensity:1.5})
};
const geo=new THREE.BoxGeometry(1,1,1);
function box(parent,m,x,y,z,w,h,d,opts={}){const o=new THREE.Mesh(geo,m);o.position.set(x,y+h/2,z);o.scale.set(w,h,d);o.castShadow=opts.cast!==false;o.receiveShadow=true;parent.add(o);return o;}
function sphere(parent,m,x,y,z,sx,sy,sz){const o=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;parent.add(o);return o;}
function cyl(parent,m,x,y,z,r,h,segments=16){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),m);o.position.set(x,y+h/2,z);o.castShadow=true;parent.add(o);return o;}
function tube(parent,m,points,r=.035){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const o=new THREE.Mesh(new THREE.TubeGeometry(curve,40,r,8,false),m);parent.add(o);return o;}
function screen(parent,x,y,z,w,h,chart=false){box(parent,M.black,x,y,z,w+.18,h+.18,.14);box(parent,M.screen,x,y,z+.078,w,h,.018,{cast:false});if(chart){for(let i=0;i<4;i++)box(parent,mat(["#1c4b59","#d5ad61","#5c9f83","#b85c54"][i]),x-w*.35+i*w*.22,y-h*.28,z+.092,w*.11,.018,.008,{cast:false});const pts=[];for(let i=0;i<18;i++)pts.push([x-w*.43+i*w*.05,y-h*.05+Math.sin(i*1.15)*h*.2+Math.cos(i*.43)*h*.12,z+.104]);tube(parent,mat("#56d4bd",.35),pts,.012);}}
function tree(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);cyl(g,mat("#5a3f2a"),0,0,0,.16,1.7,9);for(const a of [[0,1.9,0,.8],[.35,2.25,.1,.55],[-.35,2.25,-.1,.52],[0,2.65,.05,.48]])sphere(g,M.leaf,a[0],a[1],a[2],a[3],a[3]*.85,a[3]);}
function lightStrip(parent,x,y,z,w){box(parent,M.light,x,y,z,w,.035,.055,{cast:false});}
function textPanel(text,x,y,z,w,h){const c=document.createElement("canvas");c.width=1024;c.height=256;const ctx=c.getContext("2d");ctx.fillStyle="#111820";ctx.fillRect(0,0,1024,256);ctx.strokeStyle="#d5ad61";ctx.lineWidth=9;ctx.strokeRect(8,8,1008,240);ctx.fillStyle="#d5ad61";ctx.font="bold 74px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,512,128,950);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t}));o.position.set(x,y,z);scene.add(o);return o;}

// Site shell: one private compound, no city blocks.
box(scene,M.ground,0,-.35,0,76,.6,62,{cast:false});
box(scene,M.grass,0,-.03,0,72,.12,58,{cast:false});
box(scene,M.paver,0,.025,5,72,.12,30,{cast:false}); // stone forecourt
// paver joints
for(let x=-34;x<=34;x+=3.5)box(scene,M.stone,x,.09,5,.035,.012,29,{cast:false});
for(let z=-8;z<=19;z+=3.5)box(scene,M.stone,0,.09,z,71,.012,.035,{cast:false});
// perimeter walls and sliding gate
for(let x=-35;x<=35;x+=1.4){box(scene,M.dark,x,1.15,-27,.1,2.3,.16);box(scene,M.dark,x,1.15,27,.1,2.3,.16);}
box(scene,M.wall,0,.9,-27,72,1.8,.45);box(scene,M.wall,-36,.9,0,.45,1.8,54);box(scene,M.wall,36,.9,0,.45,1.8,54);
box(scene,M.dark,-12,1.2,27,19,2.4,.3);for(let x=-21;x<=-3;x+=.8)box(scene,M.chrome,x,1.2,27,.055,2.3,.12);
box(scene,M.wall,0,2.1,27,4,.35,.7);textPanel("GOATFUNDED",0,3.5,26.79,7.2,1.8);
// stepping stones, shrubs and planting
for(let x=-32;x<=32;x+=4){box(scene,M.stone,x,.11,-22,2.8,.16,2.2);if(x%8===0){tree(x,-18,.7);sphere(scene,M.leaf,x+1,.5,-20,.6,.35,.5);}}
for(let z=-20;z<=20;z+=5){tree(-32,z,.8);tree(32,z,.8);}
for(let x=-28;x<=28;x+=7){cyl(scene,M.dark,x,.1,-25,.08,.18);sphere(scene,M.light,x,.3,-25,.12,.12,.12);}

// TRADING STATION: single room, cutaway glazing, one trading desk + one gaming desk.
const sx=-17,sz=-7,sw=19,sd=17,sh=4.8;
box(scene,M.concrete,sx,.16,sz,sw+.7,.3,sd+.7);
box(scene,M.inner,sx,.34,sz,sw,.12,sd);
// open glass front; solid side walls and rear wall, flat roof frame
box(scene,M.wall,sx-sw/2+.12, .35+sh/2,sz,.24,sh,sd);
box(scene,M.wall,sx+sw/2-.12,.35+sh/2,sz,.24,sh,sd);
box(scene,M.wall,sx,.35+sh-.12,sz-sd/2+.12,sw, .24,.24);
const stationFront=box(scene,M.glass,sx,.35+sh/2,sz+sd/2-.14,sw-.5,sh-.25,.08,{cast:false});
const stationRoof=box(scene,M.dark,sx,.35+sh,sz,sw+.5,.28,sd+.5);
box(scene,M.dark,sx,.35+sh+.18,sz+sd/2,sw+.8,.18,.7);
lightStrip(scene,sx,.35+sh-.22,sz+sd/2-.5,sw-1);
textPanel("GOATFUNDED TRADING STATION",sx,.35+sh-1.0,sz-sd/2-.14,8.2,1.35);
// Trading desk: single seat, four trading screens on one wide desk
const ty=.48,tz=sz-1.6,tx=sx-2.3;
box(scene,M.darkWood||M.wood,tx,ty+.75,tz,7.4,.16,2.05);
for(const x of [tx-3.25,tx+3.25])for(const z of [tz-.65,tz+.65])box(scene,M.dark,x,ty+.15,z,.12,1.2,.12);
for(let i=0;i<4;i++)screen(scene,tx-2.55+i*1.7,ty+2.15,tz-.55,1.5,1.0,true);
box(scene,M.dark,tx,ty+1.45,tz-.47,2.5,.12,.65);
cyl(scene,M.dark,tx,ty+.75,tz+1.05,.43,.12,20);cyl(scene,M.dark,tx,ty+.35,tz+1.05,.08,.65,12);
box(scene,M.leather,tx,ty+1.0,tz+1.05,.85,.95,.8);
box(scene,M.leather,tx,ty+1.75,tz+1.34,.85,.8,.18);
// gaming desk separate at right side, single chair and RGB PC
const gx=sx+5.3,gz=sz+1.5;
box(scene,M.wood,gx,ty+.75,gz,4.5,.15,1.6);
screen(scene,gx,ty+2.0,gz-.45,1.9,1.15,false);
box(scene,M.dark,gx+1.55,ty+1.05,gz-.15,.62,.85,.62);
for(let i=0;i<3;i++)cyl(scene,mat(["#4f77ff","#d447cf","#37d8da"][i]),gx+1.55,ty+1.2+i*.19,gz+.18,.13,.035,12);
cyl(scene,M.dark,gx,ty+.78,gz+1.0,.42,.12,20);cyl(scene,M.dark,gx,ty+.3,gz+1.0,.08,.55,12);box(scene,M.leather,gx,ty+1.0,gz+1.0,.82,.9,.72);box(scene,M.leather,gx,ty+1.68,gz+1.27,.82,.68,.18);
box(scene,M.dark,sx+7,.4,sz-5,2.4,.18,1.2);box(scene,M.woodLight,sx+7,.52,sz-5,2.3,.08,1.1);
// compact lounge corner in station
box(scene,M.rug,sx-6,.25,sz+4,4.8,.08,4.2);box(scene,M.sofa,sx-6,.75,sz+5.1,3.4,.85,1.1);box(scene,M.sofa,sx-7.5,.75,sz+3.8,1.0,.85,2.5);
box(scene,M.dark,sx-5,.58,sz+2.6,1.4,.15,.9);
for(const [x,z] of [[sx-8,sz-6],[sx+8,sz-6],[sx-8,sz+6],[sx+8,sz+6]]){cyl(scene,M.dark,x,.35,z,.3,.15);sphere(scene,M.leaf,x,.75,z,.35,.5,.35);}

// HOUSE: connected rooms, furniture and visible cutaway interiors.
const hx=16,hz=-5,hw=22,hd=20,hh=4.6;
box(scene,M.concrete,hx,.15,hz,hw+.6,.3,hd+.6);box(scene,M.tile,hx,.33,hz,hw,.12,hd);
// exterior walls intentionally cut away on front and right for interior visibility
box(scene,M.wall,hx,.34+hh/2,hz-hd/2,hw,hh,.25);
box(scene,M.wall,hx-hw/2,.34+hh/2,hz,.25,hh,hd);
box(scene,M.wall,hx+hw/2,.34+hh/2,hz,.25,hh,hd);
const houseFront=box(scene,M.glass,hx,.34+hh/2,hz+hd/2-.14,hw-.4,hh-.3,.08,{cast:false});
const houseRoof=box(scene,M.wall,hx,.34+hh,hz,hw+.5,.22,hd+.5);
// interior room dividers (leave door gaps)
box(scene,M.wall,hx+1,.4+hh/2,hz-2, .18,hh-0.2,hd*.8);
box(scene,M.wall,hx+5,.4+hh/2,hz-5,8,hh-.2,.18);
box(scene,M.wall,hx+5,.4+hh/2,hz+4,8,hh-.2,.18);
// living room
box(scene,M.rug,hx-5,.42,hz+4,8, .05,6);
box(scene,M.sofa,hx-6,.9,hz+5,5,.95,1.35);box(scene,M.sofa,hx-8,.9,hz+2,1.3,.95,3.4);
box(scene,M.dark,hx-5,.58,hz+1,3.5,.2,1.7);box(scene,M.woodLight,hx-5,.7,hz+1,3.4,.08,1.6);
box(scene,M.dark,hx-9,1.8,hz-1,3,.1,.12);box(scene,M.black,hx-9,2.6,hz-1,2.8,1.55,.12);
// kitchen island and cabinets
for(let i=0;i<5;i++)box(scene,M.dark,hx+3+i*1.35,.95,hz-7,1.2,1.2,.7);
box(scene,M.wall,hx+5.7,1.62,hz-7,7.2,.15,1.05);box(scene,M.dark,hx+5.5,1.0,hz-3.9,5.2,1.4,1.2);box(scene,M.white,hx+5.5,1.75,hz-3.9,5.4,.16,1.35);
// dining table + chairs
box(scene,M.woodLight,hx+3,.95,hz+1.5,4.2,.18,2.2);
for(let x of [hx+1.5,hx+4.5])for(let z of [hz+.4,hz+2.6]){box(scene,M.dark,x,.65,z,.65,.8,.65);box(scene,M.dark,x,.95,z,.72,.1,.72);}
// bedroom at rear-right
box(scene,M.rug,hx+6,.4,hz+7,7,.06,5.8);
box(scene,M.dark,hx+6, .85,hz+7,4.6,.8,3.5);box(scene,M.white,hx+6,1.32,hz+7,4.5,.18,3.35);
box(scene,M.white,hx+4.7,1.5,hz+5.9,1.2,.25,1);box(scene,M.white,hx+7.3,1.5,hz+5.9,1.2,.25,1);
box(scene,M.wood,hx+9,1.1,hz+4.8,1.2,1.5,.75);box(scene,M.light,hx+9,1.9,hz+4.8,.65,.04,.4);
// bathroom fixtures in front right
box(scene,M.white,hx+7,.52,hz+1.3,5,.1,4);
box(scene,M.white,hx+8,.9,hz+1.3,1.5,.8,1.5);box(scene,M.wall,hx+9.2,1.5,hz+1.3,.08,1.4,1.5);
cyl(scene,M.white,hx+5.5,.65,hz+2.2,.45,.35,18);box(scene,M.dark,hx+5.5,1.0,hz+2.2,.65,.55,.6);
lightStrip(scene,hx,.34+hh-.18,hz+9,hw-1);
// outdoor patio and pool
box(scene,M.woodLight,15,.18,10,25,.22,9,{cast:false});
box(scene,M.stone,16,.25,17,20,.28,9,{cast:false});
box(scene,M.water,16,.46,17,17,.1,6.2,{cast:false});
for(let x=7;x<=25;x+=3)box(scene,M.wood,x,.32,13,.08,.05,4,{cast:false});
for(let x=5;x<=27;x+=5){box(scene,M.white,x,.45,11,2.2,.15,.8);box(scene,M.woodLight,x,.62,11,2.1,.25,.55);}
for(const [x,z] of [[3,11],[28,12],[3,21],[29,21]])tree(x,z,.75);

// Ferrari-style red mid-engine supercar, detailed exterior and readable cabin.
const car=new THREE.Group();car.position.set(1,.16,12);car.rotation.y=-.24;scene.add(car);
box(car,M.red,0,.65,0,2.45,.62,4.8);
sphere(car,M.red,0,.8,-1.45,1.18,.43,1.2);
sphere(car,M.red,0,.78,1.6,1.18,.38,1.15);
box(car,M.black,0,1.08,-.2,1.62,.55,2.15);
const wind=new THREE.Mesh(new THREE.BoxGeometry(1.52,.08,1.12),M.glass);wind.position.set(0,1.35,-.42);wind.rotation.x=-.36;car.add(wind);
box(car,M.black,0,1.32,.62,1.5,.08,1.05);
// Visible cockpit equipment: bucket seats, center console, dashboard, wheel and pedals.
for(const x of [-.43,.43]){box(car,M.leather,x,1.02,.1,.48,.22,.58);box(car,M.leather,x,1.3,.34,.45,.58,.18);box(car,M.dark,x,1.58,.39,.43,.08,.12);}
box(car,M.dark,0,1.2,-.68,1.42,.28,.28);box(car,M.black,0,1.34,-.52,1.15,.16,.08);
box(car,M.screen,-.37,1.43,-.47,.42,.22,.025);box(car,M.screen,.22,1.43,-.47,.36,.18,.025);
const steering=new THREE.Mesh(new THREE.TorusGeometry(.19,.035,8,24),M.black);steering.position.set(-.43,1.34,-.15);steering.rotation.y=.25;car.add(steering);
box(car,M.dark,0,.91,.66,.32,.12,.68);box(car,M.chrome,0,.98,.65,.09,.24,.1);
for(let i=0;i<3;i++)box(car,M.chrome,-.32+i*.2,.76,-.38,.08,.035,.14);
box(car,M.leather,0,1.13,.98,.72,.13,.2);
for(const x of [-1,1]){box(car,M.black,x*.78,1.02,-1.25,.22,.08,.65);box(car,M.chrome,x*.92,.84,-2.18,.32,.1,.07);box(car,M.light,x*.91,.91,-2.2,.28,.08,.04);box(car,M.black,x*1.22,.7,0,.1,.22,2.2);}
for(const x of [-1,1])for(const z of [-1.55,1.55]){
 const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.28,24),M.rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(x*1.17,.5,z);car.add(wheel);
 const rim=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.3,16),M.chrome);rim.rotation.z=Math.PI/2;rim.position.set(x*1.18,.5,z);car.add(rim);
 const hub=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.31,16),M.dark);hub.rotation.z=Math.PI/2;hub.position.set(x*1.19,.5,z);car.add(hub);
 for(let i=0;i<5;i++){const spoke=box(car,M.chrome,x*1.2,.5,z,.045,.48,.05);spoke.rotation.z=i*Math.PI/5;}
}
box(car,M.black,0,.43,-2.36,1.8,.12,.25);box(car,M.dark,0,.41,2.38,1.8,.13,.25);
for(let x of [-.58,.58])box(car,M.light,x,.72,-2.38,.45,.12,.04);
box(car,M.dark,0,.7,2.42,.8,.1,.05);
textPanel("FERRARI",1,3.6,10.2,3.6,.85);

// subtle garden uplights
for(const [x,z] of [[-28,-20],[-27,18],[28,-20],[29,19],[0,23]]){const l=new THREE.PointLight("#ffbf72",14,9,2);l.position.set(x,.8,z);scene.add(l);}

// Overlay controls similar to requested reference
const ui=document.createElement("div");ui.id="ui";
ui.innerHTML=`<div class="panel station"><span class="glyph">▣</span><div><strong>Trading Station</strong><small>1× Trading Desk<br>1× Gaming Desk</small></div></div>
<div class="panel house"><span class="glyph">⌂</span><div><strong>House</strong><small>Living Room<br>Kitchen<br>Bedroom<br>Bathroom<br>Real Interior</small></div></div>
<div class="panel carinfo"><span class="glyph">▰</span><div><strong>Ferrari 488</strong><small>Detailed Exterior</small></div></div>
<div class="topbuttons"><button data-action="light" aria-label="Lighting">☼</button><button data-action="map" aria-label="Overview">◫</button><button data-action="reset" aria-label="Reset view">⚙</button></div>
<div class="navpad"><button data-move="forward">⌃</button><div><button data-move="left">‹</button><button data-move="back">⌄</button><button data-move="right">›</button></div></div>
<button class="walk" data-action="walk" aria-label="Walk mode">♟</button>
<button class="enter" data-action="enter" hidden>ENTER</button><div class="bottomhint">Tap a building or the Ferrari, then choose ENTER · drag to orbit</div>`;
root.appendChild(ui);
const zones=[
 {name:"Trading Station",x:sx,z:sz,r:13,desc:"One dedicated trading desk with four chart displays, plus a separate gaming desk and RGB PC."},
 {name:"House",x:hx,z:hz,r:14,desc:"Open-front walkthrough house with living room, kitchen, dining area, bedroom and bathroom."},
 {name:"Ferrari 488",x:1,z:12,r:6,desc:"Red mid-engine supercar with sculpted body, wheels, cabin glass and illuminated details."}
];
const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();
let walking=false,keys={},evening=true,selectedZone=null,inside=null,previousView=null;
function moveCamera(x,y,z,dist=20){controls.target.set(x,y,z);const dir=new THREE.Vector3(.95,.72,1).normalize();camera.position.set(x+dir.x*dist,y+dir.y*dist,z+dir.z*dist);controls.update();}
function selectZone(z){selectedZone=z;document.querySelectorAll(".panel").forEach(p=>p.classList.remove("selected"));const cls=z.name.startsWith("Trading")?".station":z.name==="House"?".house":".carinfo";ui.querySelector(cls).classList.add("selected");const hint=ui.querySelector(".bottomhint");hint.textContent=z.name+" — "+z.desc+" Tap ENTER to explore inside.";ui.querySelector(".enter").hidden=false;moveCamera(z.x,z.name==="Ferrari 488"?1.1:2.4,z.z,z.r);}
function enterSelected(){if(!selectedZone||inside)return;previousView={p:camera.position.clone(),t:controls.target.clone(),enabled:controls.enabled};inside=selectedZone.name.startsWith("Trading")?"station":selectedZone.name==="House"?"house":"car";walking=inside!=="car";ui.querySelector(".enter").textContent="EXIT";ui.querySelector(".enter").dataset.action="exit";
if(inside==="house"){houseRoof.visible=false;houseFront.visible=false;stationRoof.visible=true;camera.position.set(hx-5,1.75,hz+5);controls.target.set(hx-4,1.65,hz+1);controls.minDistance=.15;controls.maxDistance=14;controls.maxPolarAngle=Math.PI*.88;ui.querySelector(".bottomhint").textContent="HOUSE INTERIOR · drag to look · WASD / arrow keys to walk · EXIT to return";}
else if(inside==="station"){stationRoof.visible=false;stationFront.visible=false;camera.position.set(sx-4,1.75,sz+5);controls.target.set(sx-4,1.65,sz);controls.minDistance=.15;controls.maxDistance=13;controls.maxPolarAngle=Math.PI*.88;ui.querySelector(".bottomhint").textContent="TRADING STATION INTERIOR · inspect the trading and gaming desks · WASD to walk";}
else{walking=false;controls.minDistance=.05;controls.maxDistance=4;camera.position.set(car.position.x,car.position.y+1.28,car.position.z+.1);controls.target.set(car.position.x,car.position.y+1.25,car.position.z-4);ui.querySelector(".bottomhint").textContent="FERRARI COCKPIT · dashboard, steering wheel and cabin view · EXIT to return";}
controls.update();}
function exitInterior(){if(!inside||!previousView)return;if(inside==="house"){houseRoof.visible=true;houseFront.visible=true;}if(inside==="station"){stationRoof.visible=true;stationFront.visible=true;}camera.position.copy(previousView.p);controls.target.copy(previousView.t);controls.enabled=previousView.enabled;controls.minDistance=4;controls.maxDistance=100;controls.maxPolarAngle=Math.PI*.49;inside=null;walking=false;previousView=null;ui.querySelector(".enter").hidden=true;ui.querySelector(".enter").textContent="ENTER";ui.querySelector(".enter").dataset.action="enter";controls.update();}
let pressStart=null;
renderer.domElement.addEventListener("pointerdown",e=>{pressStart={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener("pointerup",e=>{
 if(!pressStart)return;
 const moved=Math.hypot(e.clientX-pressStart.x,e.clientY-pressStart.y);pressStart=null;
 if(moved>8)return; // Orbit/zoom gestures must not trigger object selection.
 ptr.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ptr,camera);
 const carHits=ray.intersectObject(car,true);
 if(carHits.length){selectZone(zones[2]);return;}
 const p=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=new THREE.Vector3();
 if(!ray.ray.intersectPlane(p,point))return;
 if(Math.abs(point.x-sx)<sw/2&&Math.abs(point.z-sz)<sd/2)selectZone(zones[0]);
 else if(Math.abs(point.x-hx)<hw/2&&Math.abs(point.z-hz)<hd/2)selectZone(zones[1]);
});
ui.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.action==="enter"){enterSelected();}if(b.dataset.action==="exit"){exitInterior();}if(b.dataset.action==="reset"){if(inside)exitInterior();walking=false;ui.querySelector(".enter").hidden=true;moveCamera(0,3,0,43);ui.querySelector(".bottomhint").textContent="Drag to orbit · pinch to zoom · tap the station, house or Ferrari to inspect";}if(b.dataset.action==="map"){camera.position.set(0,70,.1);controls.target.set(0,0,0);controls.update();}if(b.dataset.action==="light"){evening=!evening;scene.background.set(evening?"#172237":"#a9c4ce");scene.fog.color.copy(scene.background);moon.intensity=evening?1.15:2.1;warm.intensity=evening?100:28;renderer.toneMappingExposure=evening?1.22:1.4;}if(b.dataset.action==="walk"){if(inside==="car")return;walking=!walking;controls.enabled=true;ui.querySelector(".bottomhint").textContent=walking?"Walk mode: use the arrow pad or WASD to move around the compound":"Orbit mode enabled";}if(b.dataset.move){walking=true;const v={forward:[0,-.8],back:[0,.8],left:[-.8,0],right:[.8,0]}[b.dataset.move];tryMove(v[0],v[1]);}}}));
function blocked(x,z){if(!inside){const hit=(cx,cz,w,d)=>Math.abs(x-cx)<w/2&&Math.abs(z-cz)<d/2;const stationWall=(Math.abs(x-sx)<sw/2&&Math.abs(z-(sz+sd/2))<.45&&Math.abs(x-sx)>1.45)||(Math.abs(x-sx)<sw/2&&Math.abs(z-(sz-sd/2))<.45)||(Math.abs(z-sz)<sd/2&&Math.abs(x-(sx-sw/2))<.45)||(Math.abs(z-sz)<sd/2&&Math.abs(x-(sx+sw/2))<.45);const houseWall=(Math.abs(x-hx)<hw/2&&Math.abs(z-(hz+hd/2))<.45&&Math.abs(x-hx)>1.5)||(Math.abs(x-hx)<hw/2&&Math.abs(z-(hz-hd/2))<.45)||(Math.abs(z-hz)<hd/2&&Math.abs(x-(hx-hw/2))<.45)||(Math.abs(z-hz)<hd/2&&Math.abs(x-(hx+hw/2))<.45);return stationWall||houseWall||hit(1,12,2.8,5.1);}if(inside==="house"){const left=hx-hw/2+.65,right=hx+hw/2-.65,back=hz-hd/2+.65,front=hz+hd/2-.65;if(x<left||x>right||z<back||z>front)return true;if(Math.abs(x-(hx+1))<.38&&Math.abs(z-hz)<7.4)return true;if(Math.abs(z-(hz-2))<.38&&x>hx+1.6&&x<hx+hw/2-1)return true;if(Math.abs(z-(hz-5))<.38&&x>hx+1&&x<hx+hw/2-.5)return true;return false;}
if(inside==="station"){return x<sx-sw/2+.5||x>sx+sw/2-.5||z<sz-sd/2+.5||z>sz+sd/2-.5;}return false;}
function tryMove(dx,dz){const nx=controls.target.x+dx,nz=controls.target.z+dz;if(inside!=="car"&&blocked(nx,nz))return;camera.position.x+=dx;camera.position.z+=dz;controls.target.x=nx;controls.target.z=nz;}
window.addEventListener("keydown",e=>keys[e.key.toLowerCase()]=true);window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
function animate(){requestAnimationFrame(animate);if(walking&&inside!=="car"){const speed=.09;if(keys.w||keys.arrowup)tryMove(0,-speed);if(keys.s||keys.arrowdown)tryMove(0,speed);if(keys.a||keys.arrowleft)tryMove(-speed,0);if(keys.d||keys.arrowright)tryMove(speed,0);}controls.update();renderer.render(scene,camera);}
moveCamera(0,3,0,43);animate();document.querySelector("#boot")?.remove();
window.addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));});
