import React,{useEffect,useMemo,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import{Canvas,useFrame,useThree}from"@react-three/fiber";
import{Text}from"@react-three/drei";
import{GLTFLoader}from"three/examples/jsm/loaders/GLTFLoader.js";
import*as THREE from"three";
import{A}from"./assets";
import"./style.css";

const buildings=[[-30,-30],[-18,-30],[18,-30],[30,-30],[-30,30],[-18,30],[18,30],[30,30],[-30,-18],[30,-18],[-30,18],[30,18]];
const homes=[[-25,-10],[-25,10],[25,-10],[25,10],[-10,-25],[10,-25],[-10,25],[10,25]];
const shops=[[-12,-12,"LUCKY SHOP"],[12,-12,"DARTS BAR"],[-12,12,"POOL HOUSE"],[12,12,"ARCADE"]];

function loadScene(src,onLoad,onError){
  const loader=new GLTFLoader();
  loader.load(src,g=>onLoad(g),undefined,onError);
}

function Model({src,position=[0,0,0],rotation=[0,0,0],scale=1}){
  const r=useRef();
  useEffect(()=>{
    let live=true;
    loadScene(src,g=>{
      if(!live||!r.current)return;
      g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material.envMapIntensity=.65}});
      r.current.clear();r.current.add(g.scene);
    },()=>{});
    return()=>{live=false};
  },[src]);
  return <group ref={r}position={position}rotation={rotation}scale={scale}/>;
}

function Human({src,position=[0,0,0],scale=1.02,moving=true,run=false,phase=0}){
  const r=useRef(),bones=useRef({});
  useEffect(()=>{
    let live=true;
    loadScene(src,g=>{
      if(!live||!r.current)return;
      g.scene.traverse(o=>{
        if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material.envMapIntensity=.8}
        if(o.isBone)bones.current[o.name]=o;
      });
      r.current.clear();r.current.add(g.scene);
    },()=>{});
    return()=>{live=false};
  },[src]);
  useFrame(({clock})=>{
    if(!r.current||!moving)return;
    const t=clock.elapsedTime*(run?9:6)+phase,amp=run?.62:.38;
    const b=bones.current;
    if(b.thigh_l&&b.thigh_r){b.thigh_l.rotation.x=Math.sin(t)*amp;b.thigh_r.rotation.x=-Math.sin(t)*amp}
    if(b.calf_l&&b.calf_r){b.calf_l.rotation.x=Math.max(0,-Math.sin(t))*amp*.7;b.calf_r.rotation.x=Math.max(0,Math.sin(t))*amp*.7}
    if(b.upperarm_l&&b.upperarm_r){b.upperarm_l.rotation.x=-Math.sin(t)*amp*.55;b.upperarm_r.rotation.x=Math.sin(t)*amp*.55}
    if(b.lowerarm_l&&b.lowerarm_r){b.lowerarm_l.rotation.x=-Math.sin(t)*amp*.22;b.lowerarm_r.rotation.x=Math.sin(t)*amp*.22}
    if(b.spine_03)b.spine_03.rotation.z=Math.sin(t*.5)*.025;
    r.current.position.y=position[1]+Math.abs(Math.sin(t))* (run?.018:.009);
  });
  return <group ref={r}position={position}scale={scale}/>;
}

function Player({input,out,onNear,cameraState}){
  const r=useRef(),v=useRef(new THREE.Vector3());
  useEffect(()=>{out.current=r.current},[out]);
  useFrame((_,dt)=>{
    if(!r.current)return;
    const ix=input.current.x,iz=input.current.z;
    if(ix||iz){
      const yaw=cameraState.current.yaw;
      const n=new THREE.Vector3(ix,0,iz).normalize();
      const x=n.x*Math.cos(yaw)-n.z*Math.sin(yaw);
      const z=n.x*Math.sin(yaw)+n.z*Math.cos(yaw);
      const dir=new THREE.Vector3(x,0,z);
      const speed=input.current.run?7.5:4.6;
      v.current.lerp(dir.multiplyScalar(speed),1-Math.pow(.00001,dt));
      r.current.rotation.y=Math.atan2(v.current.x,v.current.z);
    }else v.current.lerp(new THREE.Vector3(),1-Math.pow(.0005,dt));
    const next=r.current.position.clone().addScaledVector(v.current,dt);
    const blocked=buildings.some(([bx,bz])=>Math.abs(next.x-bx)<4.1&&Math.abs(next.z-bz)<4.1)||homes.some(([hx,hz])=>Math.abs(next.x-hx)<3.6&&Math.abs(next.z-hz)<3.6);
    if(!blocked){
      r.current.position.copy(next);
      r.current.position.x=THREE.MathUtils.clamp(r.current.position.x,-38,38);
      r.current.position.z=THREE.MathUtils.clamp(r.current.position.z,-38,38);
    }
    cameraState.current.speed=v.current.length();
    let near=null,min=999;
    shops.forEach(([sx,sz,name])=>{const d=Math.hypot(r.current.position.x-sx,r.current.position.z-sz);if(d<4&&d<min){min=d;near=name}});
    onNear(near);
  });
  return <group ref={r}position={[0,0,12]}><Human src={A.people[0]} moving={cameraState.current.speed>.15} run={input.current.run} scale={1.02}/></group>;
}

function Camera({player,cameraState}){
  const{camera}=useThree(),look=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((_,dt)=>{
    const p=player.current?.position||new THREE.Vector3(0,0,12);
    const s=cameraState.current;
    const targetYaw=s.yaw,targetPitch=s.pitch;
    const radius=7.8;
    const desired=new THREE.Vector3(
      p.x-Math.sin(targetYaw)*radius*Math.cos(targetPitch),
      p.y+2.8+Math.sin(targetPitch)*radius,
      p.z-Math.cos(targetYaw)*radius*Math.cos(targetPitch)
    );
    camera.position.lerp(desired,1-Math.pow(.00005,dt));
    look.set(p.x,p.y+1.35,p.z);
    camera.lookAt(look);
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
  const lamps=[];
  for(let i=-3;i<=3;i++){
    lamps.push(<Model key={"la"+i}src={A.lamp}position={[-6.8,0,i*12]}rotation={[0,Math.PI,0]}scale={1.3}/>);
    lamps.push(<Model key={"lb"+i}src={A.lamp}position={[6.8,0,i*12]}scale={1.3}/>);
    lamps.push(<Model key={"lc"+i}src={A.lamp}position={[i*12,-0.0,-6.8]}rotation={[0,Math.PI/2,0]}scale={1.3}/>);
    lamps.push(<Model key={"ld"+i}src={A.lamp}position={[i*12,0,6.8]}rotation={[0,-Math.PI/2,0]}scale={1.3}/>);
  }
  return <>{lamps}</>;
}

function MovingNPC({src,start,index}){
  const r=useRef(),phase=useMemo(()=>index*.9,[]);
  useFrame(({clock})=>{
    if(!r.current)return;
    const t=clock.elapsedTime*.42+phase,rad=5+(index%3)*2;
    r.current.position.x=start[0]+Math.sin(t)*rad;
    r.current.position.z=start[1]+Math.cos(t*.8)*rad*.7;
    r.current.rotation.y=Math.atan2(Math.cos(t)*rad,-Math.sin(t)*rad);
  });
  return <group ref={r}position={[start[0],0,start[1]]}><Human src={src}scale={1.0}phase={phase}moving/></group>;
}

function TrafficCar({src,lane,index}){
  const r=useRef(),speed=2.5+index*.35;
  useFrame((_,dt)=>{if(!r.current)return;r.current.position.z+=speed*dt;if(r.current.position.z>42)r.current.position.z=-42});
  return <group ref={r}position={[lane,.15,-42]}rotation={[0,Math.PI,0]}><Model src={src}scale={1.35}/></group>;
}

function Town(){
  return <>
    <mesh receiveShadow rotation={[-Math.PI/2,0,0]}position={[0,-.08,0]}>
      <planeGeometry args={[90,90]}/><meshStandardMaterial color="#65705e" roughness={1}/>
    </mesh>
    <Roads/><StreetFurniture/>
    {buildings.map(([x,z],i)=><Model key={"b"+i}src={A.buildings[i%A.buildings.length]}position={[x,0,z]}rotation={[0,(i%3)*Math.PI/2,0]}scale={i%3===2?1.55:1.8}/>)}
    {homes.map(([x,z],i)=><Model key={"h"+i}src={A.homes[i%A.homes.length]}position={[x,0,z]}scale={2.2}/>)}
    {[[-35,-8],[-35,8],[35,-8],[35,8],[-8,-35],[8,-35],[-8,35],[8,35]].map(([x,z],i)=><Model key={"t"+i}src={A.trees[i%2]}position={[x,0,z]}scale={2.5}/>)}
    {[-6,6,-12,12].map((lane,i)=><TrafficCar key={"car"+i}src={A.cars[i%A.cars.length]}lane={lane}index={i}/>)}
    {[[-6,3],[5,4],[-3,-4],[4,-3],[0,7],[-8,-8],[8,8]].map((p,i)=><MovingNPC key={"n"+i}src={A.people[(i+1)%A.people.length]}start={p}index={i}/>)}
    {shops.map(([x,z,name],i)=><Text key={i}position={[x,4.1,z]}fontSize={.42}color="#fff"outlineWidth={.015}outlineColor="#000"anchorX="center">{name}</Text>)}
  </>;
}

function App(){
  const input=useRef({x:0,z:0,run:false}),player=useRef();
  const cameraState=useRef({yaw:0,pitch:.18,speed:0});
  const drag=useRef({active:false,x:0,y:0});
  const [speed,setSpeed]=useState("WALK"),[near,setNear]=useState(null),[joy,setJoy]=useState({x:0,z:0,active:false}),[time,setTime]=useState(.25);
  useEffect(()=>{
    const down=e=>{
      const k=e.key.toLowerCase();
      if(k==="w"||k==="arrowup")input.current.z=-1;
      if(k==="s"||k==="arrowdown")input.current.z=1;
      if(k==="a"||k==="arrowleft")input.current.x=-1;
      if(k==="d"||k==="arrowright")input.current.x=1;
      if(k==="shift"){input.current.run=true;setSpeed("RUN")}
    };
    const up=e=>{
      const k=e.key.toLowerCase();
      if(k==="w"||k==="s"||k==="arrowup"||k==="arrowdown")input.current.z=0;
      if(k==="a"||k==="d"||k==="arrowleft"||k==="arrowright")input.current.x=0;
      if(k==="shift"){input.current.run=false;setSpeed("WALK")}
    };
    addEventListener("keydown",down);addEventListener("keyup",up);
    return()=>{removeEventListener("keydown",down);removeEventListener("keyup",up)};
  },[]);
  useEffect(()=>{const id=setInterval(()=>setTime(t=>(t+.0015)%1),1000);return()=>clearInterval(id)},[]);
  const startLook=e=>{if(e.target.closest(".joystick"))return;drag.current={active:true,x:e.clientX,y:e.clientY}};
  const moveLook=e=>{
    if(!drag.current.active)return;
    const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;
    drag.current.x=e.clientX;drag.current.y=e.clientY;
    cameraState.current.yaw-=dx*.006;
    cameraState.current.pitch=THREE.MathUtils.clamp(cameraState.current.pitch-dy*.004,-.05,.62);
  };
  const endLook=()=>{drag.current.active=false};
  const move=e=>{
    const r=e.currentTarget.getBoundingClientRect(),p=e.touches?.[0]||e;
    input.current.x=THREE.MathUtils.clamp((p.clientX-r.left-r.width/2)/(r.width/2),-1,1);
    input.current.z=THREE.MathUtils.clamp((p.clientY-r.top-r.height/2)/(r.height/2),-1,1);
    setJoy({x:input.current.x,z:input.current.z,active:true});
  };
  const stop=()=>{input.current.x=0;input.current.z=0;setJoy({x:0,z:0,active:false})};
  const sky=Math.sin(time*Math.PI*2)*.5+.5;
  return <div className="game" onPointerDown={startLook} onPointerMove={moveLook} onPointerUp={endLook} onPointerCancel={endLook}>
    <Canvas shadows dpr={[1,1.8]} camera={{position:[0,5,20],fov:52}} gl={{antialias:true}}>
      <color attach="background" args={[new THREE.Color().setHSL(.59,.32,.22+.25*sky)]}/>
      <fog attach="fog" args={["#202b32",24,82]}/>
      <hemisphereLight intensity={.55+sky*.35} groundColor="#263126" color="#cfe4ff"/>
      <ambientLight intensity={.25+sky*.35}/>
      <directionalLight castShadow position={[-18,28,12]}intensity={1+sky*1.6}shadow-mapSize-width={2048}shadow-mapSize-height={2048}shadow-bias={-.00015}/>
      <Town/><Player input={input}out={player}onNear={setNear}cameraState={cameraState}/><Camera player={player}cameraState={cameraState}/>
    </Canvas>
    <div className="hud"><div className="brand"><b>BET CITY</b><span>FREE ROAM · SMALL TOWN</span></div><div className="controls"><strong>{speed}</strong><span>WASD / ARROWS · SHIFT RUN · DRAG LOOK</span></div><div className="status">LIVE WORLD · {String(Math.floor(time*24)).padStart(2,"0")}:00</div></div>
    {near&&<div className="interaction">ENTER {near}<small>Move closer to interact</small></div>}
    <div className="lookHint">DRAG TO LOOK</div>
    <div className="joystick" onPointerDown={e=>e.stopPropagation()} onTouchStart={move}onTouchMove={move}onTouchEnd={stop}onPointerMove={e=>e.buttons&&move(e)}onPointerUp={stop}><div className="stick" style={{transform:"translate("+joy.x*28+"px,"+joy.z*28+"px)"}}/></div>
  </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
