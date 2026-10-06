import React,{useEffect,useMemo,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import{Canvas,useFrame,useThree}from"@react-three/fiber";
import{Text,Sky}from"@react-three/drei";
import{GLTFLoader}from"three/examples/jsm/loaders/GLTFLoader.js";
import*as THREE from"three";
import{A}from"./assets";
import"./style.css";

const buildings=[
 [-31,-31],[-31,-18],[-31,18],[-31,31],
 [31,-31],[31,-18],[31,18],[31,31],
 [-18,-31],[18,-31],[-18,31],[18,31]
];
const shops=[[-31,-5,"LUCKY SHOP"],[31,-5,"DARTS BAR"],[-5,31,"POOL HOUSE"],[5,-31,"ARCADE"]];

const loader=new GLTFLoader();
const cache=new Map();

function loadModel(src){
 if(cache.has(src))return cache.get(src);
 const p=loader.loadAsync(src).catch(e=>{console.warn("Asset failed:",src,e);return null});
 cache.set(src,p);return p;
}

function Model({src,position=[0,0,0],rotation=[0,0,0],scale=1}){
 const r=useRef();
 useEffect(()=>{let live=true;loadModel(src).then(gltf=>{
   if(!live||!gltf||!r.current)return;
   const clone=gltf.scene.clone(true);
   clone.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material.envMapIntensity=.8}});
   r.current.clear();r.current.add(clone);
 });return()=>{live=false}},[src]);
 return <group ref={r}position={position}rotation={rotation}scale={scale}/>;
}

function Human({src,position=[0,0,0],scale=1,moving=true,run=false,phase=0}){
 const r=useRef(),mixer=useRef(),actions=useRef({});
 useEffect(()=>{let live=true;loadModel(src).then(gltf=>{
   if(!live||!gltf||!r.current)return;
   const clone=gltf.scene.clone(true);
   clone.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
   r.current.clear();r.current.add(clone);
   if(gltf.animations?.length){
     mixer.current=new THREE.AnimationMixer(clone);
     gltf.animations.forEach(clip=>actions.current[clip.name]=mixer.current.clipAction(clip));
     const names=Object.keys(actions.current);
     const find=n=>names.find(k=>k.toLowerCase().includes(n));
     const idle=find("idle"),walk=find("jog")||find("walk"),sprint=find("sprint")||find("run");
     const act=moving?(run?sprint:walk)||idle:idle;
     if(act){act.reset().fadeIn(.18).play()}
   }
 });return()=>{live=false;mixer.current?.stopAllAction()}},[src]);
 useFrame((_,dt)=>{mixer.current?.update(dt)});
 return <group ref={r}position={position}scale={scale}/>;
}

function Player({input,out,onNear,cameraState}){
 const r=useRef(),v=useRef(new THREE.Vector3());
 useEffect(()=>{out.current=r.current},[out]);
 useFrame((_,dt)=>{
   if(!r.current)return;
   const ix=input.current.x,iz=input.current.z;
   if(Math.hypot(ix,iz)>.05){
     const y=cameraState.current.yaw;
     const n=new THREE.Vector3(ix,0,iz).normalize();
     const dir=new THREE.Vector3(n.x*Math.cos(y)-n.z*Math.sin(y),0,n.x*Math.sin(y)+n.z*Math.cos(y));
     const speed=input.current.run?8:5;
     v.current.lerp(dir.multiplyScalar(speed),1-Math.pow(.000001,dt));
     r.current.rotation.y=THREE.MathUtils.lerp(r.current.rotation.y,Math.atan2(v.current.x,v.current.z),Math.min(1,dt*12));
   }else v.current.lerp(new THREE.Vector3(),1-Math.pow(.000001,dt));
   const next=r.current.position.clone().addScaledVector(v.current,dt);
   const blocked=buildings.some(([x,z])=>Math.abs(next.x-x)<5.8&&Math.abs(next.z-z)<5.8);
   if(!blocked){r.current.position.copy(next)}
   r.current.position.x=THREE.MathUtils.clamp(r.current.position.x,-40,40);
   r.current.position.z=THREE.MathUtils.clamp(r.current.position.z,-40,40);
   cameraState.current.speed=v.current.length();
   if(r.current.userData.jumping){r.current.userData.jumpT+=dt;const jt=r.current.userData.jumpT;r.current.position.y=Math.sin(Math.min(jt*5,Math.PI))*1.15;if(jt>=Math.PI/5){r.current.position.y=0;r.current.userData.jumping=false}}
   let near=null,min=999;
   shops.forEach(([x,z,name])=>{const d=Math.hypot(r.current.position.x-x,r.current.position.z-z);if(d<6&&d<min){min=d;near=name}});
   onNear(near);
 });
 return <group ref={r}position={[0,0,12]}><Human src={A.people[0]}moving={cameraState.current.speed>.15}run={input.current.run}scale={1.05}/></group>;
}

function Camera({player,state,zoom}){
 const{camera}=useThree(),look=useMemo(()=>new THREE.Vector3(),[]);
 useFrame((_,dt)=>{
   const p=player.current?.position||new THREE.Vector3(0,0,12),s=state.current,r=zoom;
   const cp=Math.cos(s.pitch),sp=Math.sin(s.pitch);
   const desired=new THREE.Vector3(
     p.x-Math.sin(s.yaw)*r*cp,
     p.y+2.2+sp*r,
     p.z-Math.cos(s.yaw)*r*cp
   );
   camera.position.lerp(desired,1-Math.pow(.00001,dt));
   look.set(p.x,p.y+1.5,p.z);camera.lookAt(look);
 });
 return null;
}

function Roads(){
 const a=[];
 for(let i=-3;i<=3;i++){
   a.push(<Model key={"v"+i}src={A.road}position={[i*12,0,0]}rotation={[0,Math.PI/2,0]}scale={2.2}/>);
   a.push(<Model key={"h"+i}src={A.road}position={[0,0,i*12]}scale={2.2}/>);
 }
 return <>{a}<Model src={A.roadCross}position={[0,0,0]}scale={2.2}/></>;
}

function StreetFurniture(){
 const a=[];
 for(let i=-3;i<=3;i++){
   a.push(<Model key={"a"+i}src={A.lamp}position={[-5.2,0,i*12]}rotation={[0,Math.PI,0]}scale={1.25}/>);
   a.push(<Model key={"b"+i}src={A.lamp}position={[5.2,0,i*12]}scale={1.25}/>);
 }
 return <>{a}</>;
}

function MovingNPC({src,start,index}){
 const r=useRef(),phase=useMemo(()=>index*.8,[]);
 useFrame(({clock})=>{
   if(!r.current)return;
   const t=clock.elapsedTime*.35+phase,rad=3.5+(index%3)*1.4;
   const x=start[0]+Math.sin(t)*rad,z=start[1]+Math.cos(t)*rad;
   const dx=x-r.current.position.x,dz=z-r.current.position.z;
   r.current.position.x=x;r.current.position.z=z;
   if(Math.hypot(dx,dz)>.001)r.current.rotation.y=THREE.MathUtils.lerp(r.current.rotation.y,Math.atan2(dx,dz),.18);
 });
 return <group ref={r}position={[start[0],0,start[1]]}><Human src={src}scale={1.03}phase={phase}/></group>;
}

function TrafficCar({src,axis,lane,index}){
 const r=useRef(),speed=5+index*.45,direction=index%2?1:-1;
 useFrame((_,dt)=>{
   if(!r.current)return;
   if(axis==="z"){
     r.current.position.z+=speed*direction*dt;
     if(r.current.position.z>42)r.current.position.z=-42;
     if(r.current.position.z<-42)r.current.position.z=42;
     r.current.rotation.y=direction>0?0:Math.PI;
   }else{
     r.current.position.x+=speed*direction*dt;
     if(r.current.position.x>42)r.current.position.x=-42;
     if(r.current.position.x<-42)r.current.position.x=42;
     r.current.rotation.y=direction>0?Math.PI/2:-Math.PI/2;
   }
 });
 return <group ref={r}position={axis==="z"?[lane,.12,-42]:[-42,.12,lane]}><Model src={src}scale={1.25}/></group>;
}


function TownDetails(){
 const sidewalks=[];
 for(let i=-3;i<=3;i++){
   sidewalks.push(<mesh key={"sv"+i} position={[7.1,.01,i*12]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[1.35,10.8]}/><meshStandardMaterial color="#8a8d86" roughness={.9}/></mesh>);
   sidewalks.push(<mesh key={"sv2"+i} position={[-7.1,.01,i*12]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[1.35,10.8]}/><meshStandardMaterial color="#8a8d86" roughness={.9}/></mesh>);
   sidewalks.push(<mesh key={"sh"+i} position={[i*12,.012,7.1]} rotation={[-Math.PI/2,0,Math.PI/2]} receiveShadow><planeGeometry args={[1.35,10.8]}/><meshStandardMaterial color="#8a8d86" roughness={.9}/></mesh>);
   sidewalks.push(<mesh key={"sh2"+i} position={[i*12,.012,-7.1]} rotation={[-Math.PI/2,0,Math.PI/2]} receiveShadow><planeGeometry args={[1.35,10.8]}/><meshStandardMaterial color="#8a8d86" roughness={.9}/></mesh>);
 }
 const drains=[];
 [-36,-24,-12,0,12,24,36].forEach((p,i)=>{
   drains.push(<mesh key={"d"+i} position={[-8.05,.025,p]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.35,8]}/><meshStandardMaterial color="#303735" roughness={1}/></mesh>);
   drains.push(<mesh key={"d2"+i} position={[8.05,.025,p]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.35,8]}/><meshStandardMaterial color="#303735" roughness={1}/></mesh>);
 });
 const markings=[];
 for(let i=-3;i<=3;i++){
   for(let j=-4;j<=4;j++) markings.push(<mesh key={"m"+i+"-"+j} position={[i*12,.025,j*3]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.12,1.4]}/><meshStandardMaterial color="#ded8bd" roughness={.8}/></mesh>);
 }
 const community=[
   ["NORTHSIDE",0,-43],
   ["RIVERSIDE",-43,0],
   ["MARKET DISTRICT",43,0]
 ];
 return <group>
   {sidewalks}{drains}{markings}
   {community.map(([name,x,z],i)=><group key={name} position={[x,0,z]}>
     <mesh position={[0,1.1,0]} castShadow><boxGeometry args={[9,.16,.28]}/><meshStandardMaterial color="#1b2425" metalness={.15}/></mesh>
     <Text position={[0,1.25,.18]} fontSize={.48} color="#e5c65c" anchorX="center">{name}</Text>
     <mesh position={[-4,.5,0]}><cylinderGeometry args={[.18,.18,1,10]}/><meshStandardMaterial color="#222"/></mesh>
     <mesh position={[4,.5,0]}><cylinderGeometry args={[.18,.18,1,10]}/><meshStandardMaterial color="#222"/></mesh>
   </group>)}
   {[[-14,-20],[14,-20],[-14,20],[14,20]].map((p,i)=><group key={"stall"+i} position={[p[0],0,p[1]]}>
     <mesh position={[0,1.45,0]} castShadow><boxGeometry args={[2.8,.16,2.1]}/><meshStandardMaterial color="#d1b36a"/></mesh>
     <mesh position={[0,.75,0]}><boxGeometry args={[2.35,1.2,1.7]}/><meshStandardMaterial color="#75513b"/></mesh>
     <mesh position={[0,1.6,0]}><boxGeometry args={[3.1,.12,2.35]}/><meshStandardMaterial color="#9b4b35"/></mesh>
   </group>)}
 </group>;
}

function Town(){
 const tallScale=[2.35,2.7,3.1,2.5,3.25,2.8];
 return <group>
  <mesh receiveShadow rotation={[-Math.PI/2,0,0]}position={[0,-.1,0]}><planeGeometry args={[150,150]}/><meshStandardMaterial color="#55605b"roughness={.95}/></mesh>
  <Roads/><StreetFurniture/><TownDetails/>
  {buildings.map(([x,z],i)=><Model key={"b"+i}src={A.buildings[i%A.buildings.length]}position={[x,0,z]}rotation={[0,(i%4)*Math.PI/2,0]}scale={tallScale[i%tallScale.length]}/>)}
  {[[-38,-36],[-38,36],[38,-36],[38,36]].map(([x,z],i)=><Model key={"t"+i}src={A.trees[i%2]}position={[x,0,z]}scale={2.7}/>)}
  {[-24,0,24].map((lane,i)=><TrafficCar key={"vz"+i}src={A.cars[i%A.cars.length]}axis="z"lane={lane}index={i}/>)}
  {[-24,12,36].map((lane,i)=><TrafficCar key={"hx"+i}src={A.cars[(i+1)%A.cars.length]}axis="x"lane={lane}index={i+3}/>)}
  {[[-16,-16],[16,-16],[-16,16],[16,16],[0,-18],[0,18],[-18,0],[18,0]].map((p,i)=><MovingNPC key={"n"+i}src={A.people[i%2]}start={p}index={i}/>)}
  {shops.map(([x,z,name],i)=><Text key={i}position={[x,7,z]}fontSize={.5}color="#fff"outlineWidth={.018}outlineColor="#000"anchorX="center">{name}</Text>)}
 </group>;
}

function ActivityModal({place,onClose,wallet,setWallet}){const[stake,setStake]=useState(100);const[result,setResult]=useState("");const play=()=>{const s=Math.min(Math.max(Number(stake)||0,10),wallet);if(s<10){setResult("Minimum stake is 10 BET.");return}setWallet(w=>w-s);const win=Math.random()<(place==="DARTS BAR"?.58:.5);if(win){const payout=Math.round(s*1.9);setWallet(w=>w+payout);setResult("WIN +"+payout+" BET");}else setResult("LOSS -"+s+" BET");};return <div className="activityModal"><div className="activityCard"><button className="closeActivity"onClick={onClose}>×</button><span>BET CITY ACTIVITY</span><h2>{place}</h2><p>Virtual wager prototype. Choose your stake and play.</p><div className="stakeRow"><input type="number"min="10"value={stake}onChange={e=>setStake(e.target.value)}/><b>BET</b></div><button className="playButton"onClick={play}>PLAY</button><div className="activityResult">{result||"Ready"}</div><small>Virtual BET only · no cashout</small></div></div>}

function App(){
 const input=useRef({x:0,z:0,run:false}),keys=useRef(new Set()),player=useRef(),state=useRef({yaw:0,pitch:.28,speed:0}),drag=useRef({active:false,x:0,y:0});
 const[speed,setSpeed]=useState("WALK"),[near,setNear]=useState(null),[joy,setJoy]=useState({x:0,z:0}),[time,setTime]=useState(.28),[zoom,setZoom]=useState(8.5),[wallet,setWallet]=useState(()=>Number(localStorage.getItem("betcity_wallet")||10000)),[activity,setActivity]=useState(null),[stamina,setStamina]=useState(100);
 useEffect(()=>{
   const sync=()=>{const k=keys.current;input.current.x=(k.has("a")||k.has("arrowleft")?-1:0)+(k.has("d")||k.has("arrowright")?1:0);input.current.z=(k.has("w")||k.has("arrowup")?-1:0)+(k.has("s")||k.has("arrowdown")?1:0);input.current.run=k.has("shift")&&stamina>3;setSpeed(input.current.run?"RUN":"WALK")};
   const down=e=>{keys.current.add(e.key.toLowerCase());sync()};const up=e=>{keys.current.delete(e.key.toLowerCase());sync()};
   addEventListener("keydown",down);addEventListener("keyup",up);return()=>{removeEventListener("keydown",down);removeEventListener("keyup",up)}
 },[]);
 useEffect(()=>{const id=setInterval(()=>setTime(t=>(t+.0015)%1),1000);return()=>clearInterval(id)},[]);
 useEffect(()=>{localStorage.setItem("betcity_wallet",String(wallet))},[wallet]);
 useEffect(()=>{const id=setInterval(()=>setStamina(s=>input.current.run&&input.current.z?Math.max(0,s-2):Math.min(100,s+1)),100);return()=>clearInterval(id)},[]);
 const down=e=>{if(e.target.closest(".joystick,.mobileAction"))return;if(e.clientX<window.innerWidth*.34)return;drag.current={active:true,x:e.clientX,y:e.clientY}};
 const moveLook=e=>{if(!drag.current.active)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;drag.current.x=e.clientX;drag.current.y=e.clientY;state.current.yaw-=dx*.006;state.current.pitch=THREE.MathUtils.clamp(state.current.pitch-dy*.005,-.12,1.05)};
 const up=()=>drag.current.active=false;
 const move=e=>{const r=e.currentTarget.getBoundingClientRect(),p=e.touches?.[0]||e;const x=THREE.MathUtils.clamp((p.clientX-r.left-r.width/2)/(r.width/2),-1,1),z=THREE.MathUtils.clamp((p.clientY-r.top-r.height/2)/(r.height/2),-1,1);input.current.x=x;input.current.z=z;setJoy({x,z})};
 const stop=()=>{input.current.x=0;input.current.z=0;setJoy({x:0,z:0})};
 const pressRun=()=>{if(stamina>3){input.current.run=true;setSpeed("RUN")}};
 const releaseRun=()=>{input.current.run=false;setSpeed("WALK")};
 const jump=()=>{if(player.current&&!player.current.userData.jumping){player.current.userData.jumping=true;player.current.userData.jumpT=0}};
 const wheel=e=>setZoom(z=>THREE.MathUtils.clamp(z+e.deltaY*.008,4,14));
 const pinch=useRef({d:0});
 const touchStart=e=>{if(e.touches.length===2){const a=e.touches[0],b=e.touches[1];pinch.current.d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)}};
 const touchMove=e=>{if(e.touches.length===2){e.preventDefault();const a=e.touches[0],b=e.touches[1],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);if(pinch.current.d){setZoom(z=>THREE.MathUtils.clamp(z-(d-pinch.current.d)*.025,4,14))}pinch.current.d=d}};
 const sun=Math.sin(time*Math.PI*2)*.5+.5;
 return <div className="game"onPointerDown={down}onPointerMove={moveLook}onPointerUp={up}onPointerCancel={up}onWheel={wheel}onTouchStart={touchStart}onTouchMove={touchMove}onTouchEnd={()=>pinch.current.d=0}>
  <Canvas shadows dpr={[1,1.8]}camera={{position:[0,6,20],fov:55}}gl={{antialias:true}}>
   <color attach="background"args={["#87b9df"]}/><Sky distance={450000}sunPosition={[-80,55,-30]}rayleigh={.45}turbidity={7}mieCoefficient={.008}mieDirectionalG={.82}/>
   <fog attach="fog"args={["#a7c4d4",55,150]}/><hemisphereLight intensity={.6+sun*.35}groundColor="#344238"color="#d9edff"/>
   <ambientLight intensity={.28+sun*.3}/><directionalLight castShadow position={[-30,50,20]}intensity={.9+sun*1.8}shadow-mapSize-width={2048}shadow-mapSize-height={2048}shadow-bias={-.00012}/>
   <Town/><Player input={input}out={player}onNear={setNear}cameraState={state}/><Camera player={player}state={state}zoom={zoom}/>
  </Canvas>
  <div className="hud"><div className="brand"><b>BET CITY</b><span>FREE ROAM · SMALL TOWN</span></div><div className="controls"><strong>{speed}</strong><span>WASD / ARROWS · SHIFT RUN · DRAG LOOK</span></div><div className="status">BET {wallet.toLocaleString()} · STAMINA {Math.round(stamina)}% · {String(Math.floor(time*24)).padStart(2,"0")}:00</div></div>
  {near&&<button className="interaction" onClick={()=>setActivity(near)}>ENTER {near}<small>Open activity</small></button>}
  <div className="lookHint">LEFT JOYSTICK · RIGHT SIDE CAMERA · PINCH TO ZOOM</div><div className="miniMap"><div className="mapDot"/></div>
  <div className="mobileActions"><button className="mobileAction runBtn" onPointerDown={pressRun} onPointerUp={releaseRun} onPointerCancel={releaseRun}>RUN</button><button className="mobileAction jumpBtn" onPointerDown={jump}>JUMP</button>{near&&<button className="mobileAction enterBtn" onPointerDown={()=>setActivity(near)}>ENTER</button>}</div>
  {activity&&<ActivityModal place={activity} onClose={()=>setActivity(null)} wallet={wallet} setWallet={setWallet}/>}
  <div className="joystick"onPointerDown={e=>e.stopPropagation()}onTouchStart={move}onTouchMove={move}onTouchEnd={stop}onPointerMove={e=>e.buttons&&move(e)}onPointerUp={stop}><div className="stick"style={{transform:"translate("+joy.x*28+"px,"+joy.z*28+"px)"}}/></div>
 </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
