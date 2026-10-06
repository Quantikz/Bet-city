import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows, Text, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import "./style.css";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const skinTones=["#6f422f","#8b5a3c","#a96f4f","#c28762"];

function Road(){
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[150,150]}/><meshStandardMaterial color="#161a1f" roughness={0.92}/></mesh>
    <mesh position={[0,.02,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[18,150]}/><meshStandardMaterial color="#2e3339" roughness={.8}/></mesh>
    <mesh position={[0,.025,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[150,18]}/><meshStandardMaterial color="#2e3339" roughness={.8}/></mesh>
    {[[-9.15,0],[9.15,0]].map(([x])=><mesh key={x} position={[x,.04,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.12,150]}/><meshBasicMaterial color="#e4c65f"/></mesh>)}
    {Array.from({length:22}).map((_,i)=><mesh key={"v"+i} position={[0,.045,-52+i*5]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.3,.14]}/><meshBasicMaterial color="#e4c65f"/></mesh>)}
    {Array.from({length:22}).map((_,i)=><mesh key={"h"+i} position={[-52+i*5,.045,0]} rotation={[-Math.PI/2,0,Math.PI/2]}><planeGeometry args={[1.3,.14]}/><meshBasicMaterial color="#e4c65f"/></mesh>)}
    {[-10.8,10.8].map(x=><mesh key={x} position={[x,.08,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[3,150]}/><meshStandardMaterial color="#55595d" roughness={1}/></mesh>)}
    {[-10.8,10.8].map(x=>Array.from({length:30}).map((_,i)=><mesh key={x+"c"+i} position={[x,.105,-72+i*5]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.95,.08]}/><meshBasicMaterial color="#a9adb0"/></mesh>))}
  </group>;
}

function StreetLamp({position, warm=false}){
  return <group position={position}>
    <mesh castShadow position={[0,3,0]}><cylinderGeometry args={[.06,.09,6,10]}/><meshStandardMaterial color="#171b20" metalness={.7} roughness={.28}/></mesh>
    <mesh position={[.45,5.65,0]} rotation={[0,0,-.18]}><boxGeometry args={[.9,.07,.07]}/><meshStandardMaterial color="#171b20" metalness={.7}/></mesh>
    <mesh position={[.82,5.5,0]}><sphereGeometry args={[.14,12,8]}/><meshStandardMaterial color="#fff0bd" emissive={warm?"#ffb13b":"#fff1b0"} emissiveIntensity={warm?4:2}/></mesh>
  </group>;
}

function Palm({position,scale=1}){
  return <group position={position} scale={scale}>
    <mesh castShadow position={[0,2.2,0]} rotation={[.03,0,-.05]}><cylinderGeometry args={[.18,.29,4.4,12]}/><meshStandardMaterial color="#5a3b28" roughness={.9}/></mesh>
    {Array.from({length:10}).map((_,i)=>{const a=i*Math.PI*2/10;return <mesh key={i} castShadow position={[Math.sin(a)*.75,4.35,Math.cos(a)*.75]} rotation={[.65*Math.cos(a),a,.65*Math.sin(a)]}><coneGeometry args={[.2,2.3,7]}/><meshStandardMaterial color={i%2?"#216b47":"#2d8051"} roughness={.85}/></mesh>})}
  </group>;
}

function TrafficCar({position,rotation=0,color="#20242a",speed=.8}){
  const ref=useRef();
  useFrame((_,d)=>{if(!ref.current)return;ref.current.position.z+=speed*d;if(ref.current.position.z>70)ref.current.position.z=-70;});
  return <group ref={ref} position={position} rotation={[0,rotation,0]}>
    <mesh castShadow position={[0,.55,0]}><boxGeometry args={[3.5,.72,1.55]}/><meshStandardMaterial color={color} metalness={.6} roughness={.24}/></mesh>
    <mesh castShadow position={[.12,1.03,0]}><boxGeometry args={[1.8,.62,1.32]}/><meshPhysicalMaterial color="#172029" metalness={.35} roughness={.13} transmission={.05}/></mesh>
    {[[-1.15,.82],[1.15,.82],[-1.15,-.82],[1.15,-.82]].map(([x,z],i)=><mesh key={i} position={[x,.22,z]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.31,.31,.2,18]}/><meshStandardMaterial color="#080a0d" roughness={.85}/></mesh>)}
    <mesh position={[0,.7,-.79]}><boxGeometry args={[.9,.12,.03]}/><meshStandardMaterial color="#d9e4ed" emissive="#d9e4ed" emissiveIntensity={1}/></mesh>
  </group>;
}

function House({position,rotation=0,scale=1,color="#d0b08c",roof="#38343a"}){
  return <group position={position} rotation={[0,rotation,0]} scale={scale}>
    <mesh castShadow position={[0,2,0]}><boxGeometry args={[7,4,6]}/><meshStandardMaterial color={color} roughness={.76}/></mesh>
    <mesh castShadow position={[0,4.55,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[4.8,2.2,4]}/><meshStandardMaterial color={roof} roughness={.7}/></mesh>
    <mesh position={[0,1.15,3.03]}><boxGeometry args={[1.15,2.3,.12]}/><meshStandardMaterial color="#241d1a" roughness={.5}/></mesh>
    {[-2.15,2.15].map(x=><mesh key={x} position={[x,2.1,3.04]}><boxGeometry args={[1.35,1.15,.1]}/><meshStandardMaterial color="#27424a" metalness={.25} roughness={.18}/></mesh>)}
    <mesh position={[0,.15,3.35]}><boxGeometry args={[7.5,.25,.7]}/><meshStandardMaterial color="#77726b" roughness={1}/></mesh>
  </group>;
}

function Tower({position,width=9,height=28,depth=9,color="#4c5661",accent="#71808e"}){
  const cols=Math.max(3,Math.floor(width/1.6)), rows=Math.max(6,Math.floor(height/2.2));
  return <group position={position}>
    <mesh castShadow position={[0,height/2,0]}><boxGeometry args={[width,height,depth]}/><meshStandardMaterial color={color} roughness={.56} metalness={.08}/></mesh>
    <mesh castShadow position={[0,height+.8,0]}><boxGeometry args={[width*.78,1.6,depth*.78]}/><meshStandardMaterial color={accent} roughness={.5}/></mesh>
    {Array.from({length:rows}).flatMap((_,r)=>Array.from({length:cols}).map((__,c)=><mesh key={r+"-"+c} position={[-width/2+.9+c*(width-1.8)/(cols-1),1.7+r*2.05,depth/2+.025]}><boxGeometry args={[.82,1.05,.045]}/><meshStandardMaterial color={r%4===0?"#1b343d":"#243b44"} metalness={.55} roughness={.12} emissive={r%5===0?"#152f35":"#000000"} emissiveIntensity={r%5===0?.5:0}/></mesh>))}
    <mesh position={[0,height*.62,depth/2+.04]}><boxGeometry args={[width*.72,.18,.05]}/><meshStandardMaterial color="#d7b456" emissive="#d7b456" emissiveIntensity={.35}/></mesh>
  </group>;
}

function Shop({position,color,accent,name,onClick}){
  return <group position={position} onClick={onClick}>
    <mesh castShadow position={[0,2.6,0]}><boxGeometry args={[9,5.2,7]}/><meshStandardMaterial color={color} roughness={.62}/></mesh>
    <mesh position={[0,3.2,3.54]}><boxGeometry args={[8.2,1.35,.1]}/><meshStandardMaterial color="#10151a" roughness={.25}/></mesh>
    <mesh position={[0,1.15,3.57]}><boxGeometry args={[1.55,2.3,.12]}/><meshStandardMaterial color="#090c10" roughness={.2}/></mesh>
    {[-2.7,0,2.7].map(x=><mesh key={x} position={[x,1.75,3.56]}><boxGeometry args={[1.85,1.8,.08]}/><meshStandardMaterial color="#29434a" metalness={.2} roughness={.15}/></mesh>)}
    <mesh castShadow position={[0,4.35,3.75]}><boxGeometry args={[8.5,.32,.7]}/><meshStandardMaterial color={accent} roughness={.55}/></mesh>
    <Text position={[0,4.8,3.92]} fontSize={.62} color="#fff2b5" anchorX="center" outlineWidth={.025} outlineColor="#111">{name}</Text>
  </group>;
}


function TrafficLight({position,rotation=0}){
  return <group position={position} rotation={[0,rotation,0]}>
    <mesh castShadow position={[0,2.9,0]}><cylinderGeometry args={[.08,.11,5.8,8]}/><meshStandardMaterial color="#171a1d" metalness={.6} roughness={.35}/></mesh>
    <mesh castShadow position={[0,5.1,0]}><boxGeometry args={[.55,1.45,.4]}/><meshStandardMaterial color="#111417" roughness={.5}/></mesh>
    {[.38,0,-.38].map((y,i)=><mesh key={i} position={[0,5.1+y,.22]}><sphereGeometry args={[.13,12,8]}/><meshStandardMaterial color={i===1?"#e6bd3e":"#351b1b"} emissive={i===1?"#e6bd3e":"#000"} emissiveIntensity={i===1?1.4:0}/></mesh>)}
  </group>;
}
function Billboard({position,rotation=0,title="BET CITY",accent="#d7b456"}){
  return <group position={position} rotation={[0,rotation,0]}>
    <mesh castShadow position={[0,2.4,0]}><boxGeometry args={[4.8,2.8,.18]}/><meshStandardMaterial color="#11151b" metalness={.25} roughness={.32}/></mesh>
    <Text position={[0,2.65,.12]} fontSize={.46} color={accent} anchorX="center" outlineWidth={.018} outlineColor="#050608">{title}</Text>
    <Text position={[0,2.05,.12]} fontSize={.18} color="#e7ebef" anchorX="center">PLAY • CHALLENGE • WIN</Text>
    <mesh position={[-1.9,.65,0]}><boxGeometry args={[.1,1.5,.1]}/><meshStandardMaterial color="#20242a" metalness={.6}/></mesh>
    <mesh position={[1.9,.65,0]}><boxGeometry args={[.1,1.5,.1]}/><meshStandardMaterial color="#20242a" metalness={.6}/></mesh>
  </group>;
}
function Crosswalk({position,rotation=0}){
  return <group position={position} rotation={[0,rotation,0]}>
    {Array.from({length:9}).map((_,i)=><mesh key={i} position={[-6.4+i*1.6,.055,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.9,5.2]}/><meshStandardMaterial color="#d9dde0" roughness={.9}/></mesh>)}
  </group>;
}
function Rooftop({position}){
  return <group position={position}>
    <mesh position={[0,1.3,0]}><boxGeometry args={[3.2,2.6,2.1]}/><meshStandardMaterial color="#77746f" roughness={.9}/></mesh>
    <mesh position={[0,3.15,0]}><cylinderGeometry args={[.05,.05,3.2,8]}/><meshStandardMaterial color="#24272b" metalness=".7"/></mesh>
    <mesh position={[0,4.75,0]} rotation={[0,Math.PI/2,0]}><boxGeometry args={[1.2,.08,.08]}/><meshStandardMaterial color="#24272b" metalness=".7"/></mesh>
  </group>;
}

function DetailedCharacter({position,name,shirt,skin=skinTones[1],hair=0,onClick,female=false,player=false,movementRef,playerRef}){
  const ref=useRef(), torso=useRef(), lArm=useRef(),rArm=useRef(),lLeg=useRef(),rLeg=useRef();
  useEffect(()=>{if(player&&playerRef){playerRef.current=ref.current;return()=>{if(playerRef.current===ref.current)playerRef.current=null;};}},[player,playerRef]);
  const velocity=useRef(new THREE.Vector3());
  useFrame((state,dt)=>{
    if(!ref.current)return;
    if(player){
      const m=movementRef.current;
      const input=new THREE.Vector3(m.x,0,m.z);
      const moving=input.lengthSq()>.01;
      if(moving) input.normalize();
      const speed=m.sprint?7.2:4.4;
      velocity.current.lerp(input.multiplyScalar(speed),1-Math.pow(.001,dt));
      const next=ref.current.position.clone().addScaledVector(velocity.current,dt);
      next.x=clamp(next.x,-8.1,8.1);next.z=clamp(next.z,-8.1,8.1);next.y=0;
      ref.current.position.copy(next);
      if(velocity.current.lengthSq()>.08) ref.current.rotation.y=THREE.MathUtils.lerp(ref.current.rotation.y,Math.atan2(velocity.current.x,velocity.current.z),1-Math.pow(.001,dt));
      const walk=state.clock.elapsedTime*(m.sprint?12:9);
      const amount=moving?(m.sprint?.62:.38):0;
      lLeg.current.rotation.x=Math.sin(walk)*amount;rLeg.current.rotation.x=-Math.sin(walk)*amount;
      lArm.current.rotation.x=-Math.sin(walk)*amount*.72;rArm.current.rotation.x=Math.sin(walk)*amount*.72;
      torso.current.rotation.z=moving?Math.sin(walk)*.018:0;
    }else{
      const t=state.clock.elapsedTime+(name.length*.73);
      ref.current.position.y=position[1]+Math.sin(t*1.5)*.025;
      lArm.current.rotation.x=Math.sin(t*1.2)*.06;rArm.current.rotation.x=-Math.sin(t*1.2)*.06;
    }
  });
  const limb=(x,y,z,rot,material)=> <mesh castShadow position={[x,y,z]} rotation={rot}><capsuleGeometry args={[.16,.72,7,12]}/><meshStandardMaterial {...material}/></mesh>;
  return <group ref={ref} position={position} onClick={onClick}>
    <group ref={torso}>
      <mesh castShadow position={[0,1.28,0]}><capsuleGeometry args={[.5,.92,10,18]}/><meshStandardMaterial color={shirt} roughness={.66} metalness={.04}/></mesh>
      <mesh castShadow position={[0,2.08,0]}><cylinderGeometry args={[.28,.31,.22,16]}/><meshStandardMaterial color={skin} roughness={.72}/></mesh>
      <mesh castShadow position={[0,2.55,0]}><sphereGeometry args={[.5,24,18]}/><meshStandardMaterial color={skin} roughness={.76}/></mesh>
      <mesh castShadow position={[0,2.68,-.02]}><sphereGeometry args={[.515,24,12,0,Math.PI*2,0,Math.PI*.43]}/><meshStandardMaterial color="#171417" roughness={.88}/></mesh>
      {hair===1&&<mesh castShadow position={[0,2.72,.02]}><torusGeometry args={[.34,.09,8,20]}/><meshStandardMaterial color="#171417" roughness={.9}/></mesh>}
      {hair===2&&<mesh castShadow position={[0,2.77,0]}><coneGeometry args={[.45,.5,16]}/><meshStandardMaterial color="#171417" roughness={.9}/></mesh>}
      <mesh position={[-.18,2.54,.46]}><sphereGeometry args={[.045,10,10]}/><meshStandardMaterial color="#141010"/></mesh>
      <mesh position={[.18,2.54,.46]}><sphereGeometry args={[.045,10,10]}/><meshStandardMaterial color="#141010"/></mesh>
      <mesh position={[0,2.38,.47]}><sphereGeometry args={[.055,10,8]}/><meshStandardMaterial color="#75432f"/></mesh>
      <group ref={lArm} position={[-.58,1.42,0]}>{limb(0,0,0,[0,0,.06],{color:skin,roughness:.8})}<mesh position={[0,-.48,.02]}><sphereGeometry args={[.19,12,10]}/><meshStandardMaterial color={skin}/></mesh></group>
      <group ref={rArm} position={[.58,1.42,0]}>{limb(0,0,0,[0,0,-.06],{color:skin,roughness:.8})}<mesh position={[0,-.48,.02]}><sphereGeometry args={[.19,12,10]}/><meshStandardMaterial color={skin}/></mesh></group>
      <group ref={lLeg} position={[-.27,.52,0]}>{limb(0,0,0,[0,0,0],{color:female?"#272d38":"#20252d",roughness:.75})}<mesh position={[0,-.55,.15]} scale={[1.05,.55,1.55]}><sphereGeometry args={[.2,14,10]}/><meshStandardMaterial color="#101318" roughness={.65}/></mesh></group>
      <group ref={rLeg} position={[.27,.52,0]}>{limb(0,0,0,[0,0,0],{color:female?"#272d38":"#20252d",roughness:.75})}<mesh position={[0,-.55,.15]} scale={[1.05,.55,1.55]}><sphereGeometry args={[.2,14,10]}/><meshStandardMaterial color="#101318" roughness={.65}/></mesh></group>
      {player&&<mesh position={[0,1.55,-.52]}><boxGeometry args={[.75,.2,.05]}/><meshStandardMaterial color="#d7b456" emissive="#d7b456" emissiveIntensity={.25}/></mesh>}
    </group>
    <Text position={[0,3.22,0]} fontSize={.27} color="#fff" anchorX="center" outlineWidth={.01} outlineColor="#0b0d10">{name}</Text>
  </group>;
}

function City({onShop,onDarts,playerRef,movementRef}){
  return <>
    <ambientLight intensity={.58}/>
    <hemisphereLight args={["#a9c9e5","#1c1511",1.05]}/>
    <directionalLight castShadow position={[-18,28,14]} intensity={3.1} shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45}/>
    <pointLight position={[0,5,0]} intensity={18} distance={24} color="#d7b456"/>
    <Environment preset="city"/>
    <Road/>
    <Tower position={[-27,0,-34]} width={10} height={35} color="#46515d"/>
    <Tower position={[-12,0,-40]} width={13} height={45} color="#53616c"/>
    <Tower position={[5,0,-42]} width={11} height={52} color="#3e4854"/>
    <Tower position={[22,0,-36]} width={15} height={39} color="#59636d"/>
    <Tower position={[34,0,-30]} width={10} height={57} color="#434e59"/>
    <Tower position={[-34,0,28]} width={14} height={34} color="#59636d"/>
    <Tower position={[34,0,28]} width={12} height={42} color="#46515e"/>
    <House position={[-17,0,-5]} rotation={.08} color="#c8aa83"/>
    <House position={[17,0,-3]} rotation={-.06} color="#b7a18e"/>
    <House position={[-18,0,17]} rotation={.12} color="#b99a78"/>
    <House position={[18,0,17]} rotation={-.12} color="#c1b0a0"/>
    <Rooftop position={[-27,35,-34]}/><Rooftop position={[-12,45,-40]}/><Rooftop position={[5,52,-42]}/>
    <Billboard position={[-21,0,-8]} rotation={Math.PI/2} title="LUCKY SHOP"/>
    <Billboard position={[21,0,8]} rotation={-Math.PI/2} title="DARTS DUEL" accent="#d09358"/>
    <Crosswalk position={[0,.0,-9]} />
    <Crosswalk position={[9,.0,0]} rotation={Math.PI/2}/>
    <TrafficLight position={[-9.8,0,-9.8]} rotation={Math.PI/2}/>
    <TrafficLight position={[9.8,0,9.8]} rotation={-Math.PI/2}/>
    <Shop position={[-13,0,-11]} color="#673a35" accent="#d05a4e" name="LUCKY SHOP" onClick={onShop}/>
    <Shop position={[13,0,-11]} color="#23556b" accent="#4ba4c5" name="POOL HOUSE"/>
    <Shop position={[-13,0,12]} color="#493b69" accent="#8c67c6" name="ARCADE"/>
    <Shop position={[13,0,12]} color="#70492e" accent="#d09358" name="DARTS BAR" onClick={onDarts}/>
    {[-7.8,7.8].map(x=><><StreetLamp key={x+"a"} position={[x,0,-6]} warm/><StreetLamp key={x+"b"} position={[x,0,6]}/></>)}
    <Palm position={[-8.8,0,-6]} scale={1.05}/><Palm position={[8.8,0,-6]} scale={.95}/>
    <Palm position={[-8.8,0,7]} scale={.9}/><Palm position={[8.8,0,7]} scale={1}/>
    <TrafficCar position={[-5,0,-65]} color="#20262e" speed={3.4}/>
    <TrafficCar position={[5,0,-20]} color="#8e3e38" speed={2.7}/>
    <TrafficCar position={[0,0,-5]} rotation={Math.PI/2} color="#315a70" speed={1.8}/>
    <TrafficCar position={[0,0,32]} rotation={Math.PI/2} color="#b38a3d" speed={2.2}/>
    <DetailedCharacter position={[0,0,5]} name="YOU" shirt="#171a20" skin="#8b5a3c" hair={1} player movementRef={movementRef} playerRef={playerRef}/>
    <DetailedCharacter position={[-4,0,4]} name="KAY" shirt="#3d76a8" skin="#a96f4f" hair={0} onClick={onDarts}/>
    <DetailedCharacter position={[4,0,3]} name="MUSA" shirt="#9b4c8f" skin="#6f422f" hair={2}/>
    <DetailedCharacter position={[0,0,-4]} name="ZEE" shirt="#3f8a73" skin="#c28762" hair={1} female/>
    <DetailedCharacter position={[-6.2,0,.2]} name="AMAKA" shirt="#d05c55" skin="#8b5a3c" hair={2} female/>
    <DetailedCharacter position={[6.1,0,-.8]} name="TUNDE" shirt="#d7b456" skin="#a96f4f" hair={0}/>
    <DetailedCharacter position={[-2.5,0,-7]} name="JAY" shirt="#b58a45" skin="#6f422f" hair={0}/>
    <DetailedCharacter position={[3.5,0,-6.4]} name="RAY" shirt="#4e687c" skin="#a96f4f" hair={2}/>
    <ContactShadows position={[0,.03,0]} opacity={.5} scale={80} blur={2.6} far={22}/>
    <Sparkles count={90} scale={[70,18,70]} size={.35} speed={.12} opacity={.18} color="#d9e7ee"/>
  </>;
}

function CameraRig({playerRef}){
  const current=new THREE.Vector3(),look=new THREE.Vector3();
  useFrame((state,dt)=>{
    const p=playerRef.current?.position||new THREE.Vector3(0,0,5);
    const yaw=playerRef.current?.rotation.y||0;
    const desired=current.set(p.x-Math.sin(yaw)*8,6.1,p.z-Math.cos(yaw)*9);
    state.camera.position.lerp(desired,1-Math.pow(.0008,dt));
    look.set(p.x,p.y+1.45,p.z);
    state.camera.lookAt(look);
  });
  return null;
}

function App(){
  const [balance,setBalance]=useState(10000),[modal,setModal]=useState(null),[stake,setStake]=useState(1000),[message,setMessage]=useState("FREE ROAM"),[locked,setLocked]=useState(false),[sprinting,setSprinting]=useState(false);
  const playerRef=useRef(null),movementRef=useRef({x:0,z:0,sprint:false}),keys=useRef({});
  useEffect(()=>{
    const down=e=>{keys.current[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==="shift")setSprinting(true)};
    const up=e=>{keys.current[e.key.toLowerCase()]=false;if(e.key.toLowerCase()==="shift")setSprinting(false)};
    const tick=()=>{const k=keys.current;movementRef.current={x:(k.d||k.arrowright?1:0)-(k.a||k.arrowleft?1:0),z:(k.s||k.arrowdown?1:0)-(k.w||k.arrowup?1:0),sprint:sprinting||!!k.shift};};
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    const id=setInterval(tick,16);return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);clearInterval(id)};
  },[sprinting]);
  const joystick=(x,z)=>{movementRef.current={...movementRef.current,x,z}};
  const openDuel=()=>{setMessage("DARTS DUEL READY");setModal("duel")};
  const confirmDuel=()=>{const a=Math.max(100,Math.floor(Number(stake)||0));if(a>balance){setMessage("INSUFFICIENT BET");return}setBalance(b=>b-a);setLocked(true);setModal("playing");setMessage("LIVE DARTS DUEL")};
  const settle=win=>{const a=Math.max(100,Math.floor(Number(stake)||0));if(win)setBalance(b=>b+Math.floor(a*1.9));setLocked(false);setModal(null);setMessage(win?"YOU WON":"YOU LOST")};
  return <div className="app">
    <div className="scene"><Canvas shadows dpr={[1,1.5]} camera={{position:[14,7,17],fov:54}} gl={{antialias:true,powerPreference:"high-performance"}} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.18;gl.outputColorSpace=THREE.SRGBColorSpace}}>
      <color attach="background" args={["#93b8d5"]}/><fog attach="fog" args={["#93b8d5",42,110]}/>
      <City onShop={()=>{setMessage("LUCKY SHOP");setModal("info")}} onDarts={openDuel} playerRef={playerRef} movementRef={movementRef}/>
      <CameraRig playerRef={playerRef}/>
    </Canvas></div>
    <header className="topbar"><div className="brand"><span className="brand-mark">B</span><div><strong>BET CITY</strong><small>OPEN WORLD • LIVE TOWN</small></div></div><div className="wallet"><span>BET</span><strong>{balance.toLocaleString()}</strong></div></header>
    <div className="status-pill"><i className={locked?"live":""}/>{message}</div>
    <div className="hud-left"><div className="mini-map"><span>◈</span><i>LUCKY</i><i>POOL</i><i>DARTS</i></div><div className="quest"><b>MAIN QUEST</b><span>Explore Bet City</span><small>Walk to Lucky Shop</small></div></div>
    <div className="hud-right"><button onClick={()=>setModal("map")}>MAP</button><button>PHONE</button><button>INV</button><button>⚙</button></div>
    <div className="joystick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(e.buttons){const r=e.currentTarget.getBoundingClientRect();joystick(clamp((e.clientX-(r.left+r.width/2))/(r.width*.42),-1,1),clamp((e.clientY-(r.top+r.height/2))/(r.height*.42),-1,1))}}} onPointerUp={()=>joystick(0,0)}><div className="stick"/></div>
    <div className="action-pad"><button onPointerDown={()=>setSprinting(true)} onPointerUp={()=>setSprinting(false)}>RUN</button><button onClick={openDuel}>FIGHT</button><button>ACT</button><button onClick={()=>setModal("map")}>MAP</button></div>
    <div className="bottom-ui"><button className="glass-btn" onClick={()=>setModal("map")}>TOWN MAP</button><button className="primary-btn" onClick={openDuel}>CHALLENGE KAY</button></div>
    {modal==="duel"&&<div className="modal-backdrop"><div className="modal"><div className="modal-kicker">DARTS DUEL</div><h2>Challenge KAY</h2><p>Stake virtual BET and compete for the pot.</p><label>YOUR STAKE</label><div className="stake-row"><input value={stake} type="number" min="100" step="100" onChange={e=>setStake(e.target.value)}/><span>BET</span></div><div className="modal-actions"><button className="glass-btn" onClick={()=>setModal(null)}>CANCEL</button><button className="primary-btn" onClick={confirmDuel}>START DUEL</button></div></div></div>}
    {modal==="playing"&&<div className="modal-backdrop"><div className="modal compact"><div className="modal-kicker">LIVE DUEL</div><h2>Darts Arena</h2><p>Prototype settlement controls.</p><div className="duel-score"><div><small>YOU</small><strong>—</strong></div><span>VS</span><div><small>KAY</small><strong>—</strong></div></div><div className="modal-actions"><button className="glass-btn" onClick={()=>settle(false)}>KAY WINS</button><button className="primary-btn" onClick={()=>settle(true)}>YOU WIN</button></div></div></div>}
    {modal==="info"&&<div className="modal-backdrop"><div className="modal compact"><div className="modal-kicker">LUCKY SHOP</div><h2>Town Hub</h2><p>Enter the shop to find opponents and wager with virtual BET.</p><button className="primary-btn full" onClick={()=>setModal(null)}>ENTER TOWN</button></div></div>}
    {modal==="map"&&<div className="modal-backdrop"><div className="modal compact"><div className="modal-kicker">CITY MAP</div><h2>Bet City</h2><div className="map-list"><span>01 <b>Lucky Shop</b></span><span>02 <b>Pool House</b></span><span>03 <b>Arcade</b></span><span>04 <b>Darts Bar</b></span><span>05 <b>Downtown Towers</b></span></div><button className="glass-btn full" onClick={()=>setModal(null)}>CLOSE</button></div></div>}
  </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
