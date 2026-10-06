import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Text } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SMAA, Noise } from "@react-three/postprocessing";
import * as THREE from "three";
import { io } from "socket.io-client";
import "./style.css";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CHANNELS = [
  { id: "news", title: "BET CITY NEWS", line: "Dusk market opens on the south strip." },
  { id: "sports", title: "SPORTS WIRE", line: "Darts night: Kay leads the local board." },
  { id: "odds", title: "ODDS BOARD", line: "Virtual lines only. No cash market." },
  { id: "nightlife", title: "NIGHTLIFE", line: "Darts Bar live. Pool House open late." },
  { id: "street", title: "STREET CAM", line: "Co-op cam feed from downtown." }
];

function makeAsphalt() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#1b2026";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  return tex;
}

function Road() {
  const map = useMemo(makeAsphalt, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial map={map} color="#8d97a1" roughness={0.42} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 180]} />
        <meshStandardMaterial color="#2a3036" roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[180, 16]} />
        <meshStandardMaterial color="#2a3036" roughness={0.55} metalness={0.08} />
      </mesh>
      {[-4.2, 4.2].map((x) => <mesh key={x} position={[x, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.12, 170]} /><meshBasicMaterial color="#e6d48a" /></mesh>)}
      {Array.from({ length: 28 }).map((_, i) => <mesh key={"d" + i} position={[0, 0.045, -68 + i * 5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.4, 0.16]} /><meshBasicMaterial color="#f2efe4" /></mesh>)}
      {[-9.2, 9.2].map((x) => <mesh key={"s" + x} position={[x, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3.2, 170]} /><meshStandardMaterial color="#3d4348" roughness={1} /></mesh>)}
      {Array.from({ length: 10 }).map((_, i) => <mesh key={"cw" + i} position={[-7.2 + i * 1.6, 0.05, 8]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.7, 4.6]} /><meshStandardMaterial color="#dfe5ea" /></mesh>)}
    </group>
  );
}

function Lamp({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 3.1, 0]}><cylinderGeometry args={[0.08, 0.1, 6.2, 10]} /><meshStandardMaterial color="#1c2127" metalness={0.7} roughness={0.3} /></mesh>
      <mesh position={[0.7, 6.05, 0]}><boxGeometry args={[1.5, 0.08, 0.08]} /><meshStandardMaterial color="#1c2127" metalness={0.7} /></mesh>
      <mesh position={[1.3, 5.85, 0]}><boxGeometry args={[0.45, 0.12, 0.22]} /><meshStandardMaterial color="#f6e7b2" emissive="#ffb14a" emissiveIntensity={2.4} /></mesh>
      <pointLight position={[1.3, 5.5, 0]} intensity={8} distance={14} color="#ffb14a" />
    </group>
  );
}

function Palm({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 2.4, 0]}><cylinderGeometry args={[0.16, 0.28, 4.8, 8]} /><meshStandardMaterial color="#6a4630" roughness={0.9} /></mesh>
      {Array.from({ length: 7 }).map((_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return <mesh key={i} position={[Math.sin(a) * 0.7, 4.7, Math.cos(a) * 0.7]} rotation={[0.7, a, 0]}><coneGeometry args={[0.18, 2.1, 5]} /><meshStandardMaterial color={i % 2 ? "#1f6a43" : "#2f8a58"} /></mesh>;
      })}
    </group>
  );
}

function House({ position, rotation = 0, color = "#c7b29a" }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow position={[0, 2.3, 0]}><boxGeometry args={[8.4, 4.6, 7.2]} /><meshStandardMaterial color={color} roughness={0.72} /></mesh>
      <mesh castShadow position={[0, 5.1, 0]}><boxGeometry args={[8.8, 0.35, 7.6]} /><meshStandardMaterial color="#3c4046" /></mesh>
      <mesh castShadow position={[0, 6.15, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[5.4, 2.2, 4]} /><meshStandardMaterial color="#6d3b34" roughness={0.7} /></mesh>
      <mesh position={[0, 1.2, 3.66]}><boxGeometry args={[1.5, 2.3, 0.12]} /><meshStandardMaterial color="#2a211c" /></mesh>
      <mesh position={[2.3, 1.15, 3.68]}><boxGeometry args={[2.2, 2.1, 0.08]} /><meshStandardMaterial color="#2c3338" metalness={0.3} /></mesh>
      {[-2.4, -0.6, 2.4].map((x) => <mesh key={x} position={[x, 3.15, 3.64]}><boxGeometry args={[1.15, 1.25, 0.08]} /><meshStandardMaterial color="#9fd4e2" emissive="#f2c56b" emissiveIntensity={0.35} metalness={0.4} roughness={0.15} /></mesh>)}
      <mesh position={[0, 3.4, 3.9]}><boxGeometry args={[2.4, 0.12, 0.8]} /><meshStandardMaterial color="#d7b456" /></mesh>
      <mesh position={[-3.5, 1.1, 2]}><boxGeometry args={[0.08, 1.2, 2.4]} /><meshStandardMaterial color="#8a8f93" metalness={0.5} /></mesh>
    </group>
  );
}

function Tower({ position, height = 34, width = 10, color = "#4d5966" }) {
  const floors = Math.floor(height / 2.2);
  return (
    <group position={position}>
      <mesh castShadow position={[0, height / 2, 0]}><boxGeometry args={[width, height, width * 0.8]} /><meshStandardMaterial color={color} roughness={0.45} metalness={0.22} /></mesh>
      {Array.from({ length: floors }).map((_, i) => (
        <mesh key={i} position={[0, 1.4 + i * 2.2, width * 0.4 + 0.05]}>
          <boxGeometry args={[width * 0.72, 1.05, 0.06]} />
          <meshStandardMaterial color="#16343c" emissive={i % 3 === 0 ? "#f0c27a" : "#12343c"} emissiveIntensity={i % 3 === 0 ? 0.7 : 0.15} metalness={0.5} roughness={0.12} />
        </mesh>
      ))}
    </group>
  );
}

function Shop({ position, color, name, accent, onClick }) {
  return (
    <group position={position} onClick={onClick}>
      <mesh castShadow position={[0, 2.8, 0]}><boxGeometry args={[10, 5.6, 8]} /><meshStandardMaterial color={color} roughness={0.58} /></mesh>
      <mesh position={[0, 1.7, 4.05]}><boxGeometry args={[8.4, 2.8, 0.08]} /><meshPhysicalMaterial color="#9fd7e6" metalness={0.1} roughness={0.05} transmission={0.45} opacity={0.8} transparent /></mesh>
      <mesh position={[0, 1.1, 3.2]}><boxGeometry args={[6.5, 0.9, 1.2]} /><meshStandardMaterial color="#241c16" /></mesh>
      <mesh position={[0, 4.55, 4.15]}><boxGeometry args={[8.8, 0.9, 0.18]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0, 4.55, 4.28]}><boxGeometry args={[8.2, 0.55, 0.05]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.6} /></mesh>
      <Text position={[0, 4.55, 4.36]} fontSize={0.42} color="#fff8df" anchorX="center">{name}</Text>
      <mesh position={[0, 3.15, 3.55]}><boxGeometry args={[2.2, 1.25, 0.06]} /><meshStandardMaterial color="#071018" emissive="#39d1c5" emissiveIntensity={0.45} /></mesh>
      <Text position={[0, 3.15, 3.6]} fontSize={0.18} color="#d7fff8" anchorX="center">LIVE</Text>
    </group>
  );
}

function Car({ position, color = "#1d242c", speed = 2.4, axis = "z" }) {
  const ref = useRef();
  const wheels = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position[axis] += speed * dt;
    if (ref.current.position[axis] > 78) ref.current.position[axis] = -78;
    if (wheels.current) wheels.current.rotation.x -= speed * dt * 1.6;
  });
  return (
    <group ref={ref} position={position} rotation={[0, axis === "x" ? Math.PI / 2 : 0, 0]}>
      <mesh castShadow position={[0, 0.62, 0]}><boxGeometry args={[4.4, 0.72, 1.85]} /><meshStandardMaterial color={color} metalness={0.82} roughness={0.22} /></mesh>
      <mesh castShadow position={[-0.15, 1.18, 0]}><boxGeometry args={[2.1, 0.62, 1.62]} /><meshPhysicalMaterial color="#101820" metalness={0.2} roughness={0.08} transmission={0.2} transparent opacity={0.85} /></mesh>
      <mesh position={[2.05, 0.62, 0]}><boxGeometry args={[0.12, 0.18, 1.5]} /><meshStandardMaterial color="#fff4d2" emissive="#fff1c4" emissiveIntensity={1.5} /></mesh>
      <mesh position={[-2.12, 0.55, 0]}><boxGeometry args={[0.08, 0.16, 1.4]} /><meshStandardMaterial color="#ff3b3b" emissive="#ff2a2a" emissiveIntensity={0.8} /></mesh>
      <group ref={wheels}>
        {[[-1.35, 0.32, 0.95], [1.25, 0.32, 0.95], [-1.35, 0.32, -0.95], [1.25, 0.32, -0.95]].map((p, i) => (
          <mesh key={i} position={p} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.34, 0.34, 0.22, 16]} /><meshStandardMaterial color="#111" roughness={0.7} /></mesh>
        ))}
      </group>
      <Text position={[0, 0.62, 0.96]} fontSize={0.16} color="#111" anchorX="center">BET</Text>
    </group>
  );
}

function Citizen({ position, name, shirt, player, movementRef, playerRef, onClick, female }) {
  const ref = useRef();
  const armL = useRef();
  const armR = useRef();
  const legL = useRef();
  const legR = useRef();
  useEffect(() => {
    if (player && playerRef) playerRef.current = ref.current;
  }, [player, playerRef]);
  useFrame((state, dt) => {
    if (!ref.current) return;
    if (player) {
      const m = movementRef.current;
      const input = new THREE.Vector3(m.x, 0, m.z);
      const moving = input.lengthSq() > 0.01;
      if (moving) input.normalize();
      const speed = m.sprint ? 7.6 : 4.4;
      const next = ref.current.position.clone().addScaledVector(input, speed * dt);
      next.x = clamp(next.x, -28, 28);
      next.z = clamp(next.z, -28, 28);
      ref.current.position.copy(next);
      if (moving) ref.current.rotation.y = Math.atan2(input.x, input.z);
      const walk = state.clock.elapsedTime * (m.sprint ? 11 : 8);
      const amt = moving ? 0.45 : 0;
      legL.current.rotation.x = Math.sin(walk) * amt;
      legR.current.rotation.x = -Math.sin(walk) * amt;
      armL.current.rotation.x = -Math.sin(walk) * amt;
      armR.current.rotation.x = Math.sin(walk) * amt;
    } else {
      const t = state.clock.elapsedTime + name.length;
      ref.current.position.x = position[0] + Math.sin(t * 0.35) * 0.8;
      ref.current.position.z = position[2] + Math.cos(t * 0.28) * 0.5;
      ref.current.rotation.y = Math.sin(t * 0.35);
    }
  });
  return (
    <group ref={ref} position={position} onClick={onClick}>
      <mesh castShadow position={[0, 1.25, 0]}><capsuleGeometry args={[0.42, 0.7, 8, 16]} /><meshStandardMaterial color={shirt} roughness={0.55} /></mesh>
      <mesh position={[0, 1.72, 0.18]}><boxGeometry args={[0.7, 0.18, 0.12]} /><meshStandardMaterial color="#1b1e24" /></mesh>
      <mesh castShadow position={[0, 2.15, 0]}><sphereGeometry args={[0.34, 20, 16]} /><meshStandardMaterial color="#c49a78" roughness={0.7} /></mesh>
      <mesh position={[0, 2.32, 0]}><sphereGeometry args={[0.36, 16, 10, 0, Math.PI * 2, 0, 1.2]} /><meshStandardMaterial color={female ? "#2a211c" : "#1a1716"} /></mesh>
      <group ref={armL} position={[-0.52, 1.35, 0]}><mesh castShadow><capsuleGeometry args={[0.1, 0.55, 4, 8]} /><meshStandardMaterial color="#c49a78" /></mesh></group>
      <group ref={armR} position={[0.52, 1.35, 0]}><mesh castShadow><capsuleGeometry args={[0.1, 0.55, 4, 8]} /><meshStandardMaterial color="#c49a78" /></mesh></group>
      <group ref={legL} position={[-0.16, 0.55, 0]}><mesh castShadow><capsuleGeometry args={[0.11, 0.5, 4, 8]} /><meshStandardMaterial color="#242a33" /></mesh><mesh position={[0, -0.42, 0.08]}><boxGeometry args={[0.22, 0.12, 0.34]} /><meshStandardMaterial color="#111" /></mesh></group>
      <group ref={legR} position={[0.16, 0.55, 0]}><mesh castShadow><capsuleGeometry args={[0.11, 0.5, 4, 8]} /><meshStandardMaterial color="#242a33" /></mesh><mesh position={[0, -0.42, 0.08]}><boxGeometry args={[0.22, 0.12, 0.34]} /><meshStandardMaterial color="#111" /></mesh></group>
      <Text position={[0, 2.85, 0]} fontSize={0.24} color="#fff" anchorX="center" outlineWidth={0.012} outlineColor="#111">{name}</Text>
    </group>
  );
}

function Prop({ position, kind }) {
  if (kind === "bench") return <group position={position}><mesh position={[0, 0.45, 0]}><boxGeometry args={[1.6, 0.08, 0.45]} /><meshStandardMaterial color="#6a5344" /></mesh><mesh position={[0, 0.7, -0.18]}><boxGeometry args={[1.6, 0.4, 0.08]} /><meshStandardMaterial color="#6a5344" /></mesh></group>;
  if (kind === "bin") return <mesh position={position} castShadow><cylinderGeometry args={[0.28, 0.32, 0.9, 12]} /><meshStandardMaterial color="#2c3338" metalness={0.4} /></mesh>;
  return <group position={position}><mesh position={[0, 1.4, 0]}><boxGeometry args={[2.4, 0.1, 1.2]} /><meshStandardMaterial color="#243038" /></mesh><mesh position={[0, 0.7, 0]}><boxGeometry args={[0.08, 1.4, 0.08]} /><meshStandardMaterial color="#888" /></mesh></group>;
}

function City({ onShop, onDarts, playerRef, movementRef }) {
  return (
    <>
      <hemisphereLight args={["#9eb7d8", "#2a211c", 0.7]} />
      <directionalLight castShadow position={[-24, 28, 12]} intensity={2.4} color="#ffd2a8" shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-far={120} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      <Environment preset="sunset" />
      <Road />
      <Tower position={[-34, 0, -42]} height={38} width={11} />
      <Tower position={[-16, 0, -48]} height={52} width={13} color="#5b6874" />
      <Tower position={[8, 0, -50]} height={46} width={12} color="#46525d" />
      <Tower position={[30, 0, -40]} height={58} width={14} />
      <House position={[-18, 0, -6]} color="#d2b89a" />
      <House position={[18, 0, -4]} rotation={0.08} color="#c3ad98" />
      <House position={[-18, 0, 18]} color="#b7a48f" />
      <House position={[18, 0, 18]} color="#cbb8a4" />
      <Shop position={[-14, 0, -12]} color="#6b4038" name="LUCKY SHOP" accent="#e15b4c" onClick={onShop} />
      <Shop position={[14, 0, -12]} color="#24566c" name="POOL HOUSE" accent="#49b4d4" />
      <Shop position={[-14, 0, 14]} color="#4a3d6e" name="ARCADE" accent="#9a74e0" />
      <Shop position={[14, 0, 14]} color="#6e4a2e" name="DARTS BAR" accent="#e0a15a" onClick={onDarts} />
      <Lamp position={[-11, 0, -8]} /><Lamp position={[11, 0, -8]} /><Lamp position={[-11, 0, 10]} /><Lamp position={[11, 0, 10]} />
      <Palm position={[-10.5, 0, -2]} /><Palm position={[10.5, 0, -2]} /><Palm position={[-10.5, 0, 6]} /><Palm position={[10.5, 0, 6]} />
      <Car position={[-4.5, 0, -60]} color="#8d2e2a" speed={3.1} />
      <Car position={[4.6, 0, -20]} color="#1e2833" speed={2.4} />
      <Car position={[-40, 0, 4]} color="#b08a3e" speed={2.2} axis="x" />
      <Prop position={[-8, 0, 3]} kind="bench" /><Prop position={[8, 0.4, 5]} kind="bin" /><Prop position={[0, 0, 12]} kind="stop" />
      <Citizen position={[0, 0, 6]} name="YOU" shirt="#1c222b" player movementRef={movementRef} playerRef={playerRef} />
      <Citizen position={[-4, 0, 4]} name="KAY" shirt="#3c78ad" onClick={onDarts} />
      <Citizen position={[4, 0, 3]} name="MUSA" shirt="#9b4c8f" />
      <Citizen position={[0, 0, -3]} name="ZEE" shirt="#3f8a73" female />
      <Citizen position={[-6, 0, 1]} name="AMAKA" shirt="#d05c55" female />
      <Citizen position={[6, 0, -1]} name="TUNDE" shirt="#d7b456" />
      <ContactShadows opacity={0.45} scale={90} blur={2.4} far={18} />
    </>
  );
}

function CameraRig({ playerRef, mode, partnerRef }) {
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, dt) => {
    const p = playerRef.current?.position || new THREE.Vector3(0, 0, 6);
    const yaw = playerRef.current?.rotation.y || 0;
    const partner = partnerRef.current?.position;
    let desired = new THREE.Vector3(p.x - Math.sin(yaw) * 8.2, 5.4, p.z - Math.cos(yaw) * 9.4);
    if (mode === "shoulder") desired.set(p.x - Math.sin(yaw) * 3.2 + Math.cos(yaw) * 1.1, 2.4, p.z - Math.cos(yaw) * 3.4 - Math.sin(yaw) * 1.1);
    if (mode === "hood") desired.set(p.x + Math.sin(yaw) * 1.4, 1.5, p.z + Math.cos(yaw) * 1.4);
    if (mode === "cinematic") desired.set(p.x + Math.sin(state.clock.elapsedTime * 0.15) * 14, 8, p.z + Math.cos(state.clock.elapsedTime * 0.15) * 14);
    if (mode === "coop" && partner) {
      const mid = p.clone().add(partner).multiplyScalar(0.5);
      desired.set(mid.x - 10, 8.5, mid.z - 12);
      look.copy(mid);
    } else look.set(p.x, p.y + 1.4, p.z);
    state.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    state.camera.lookAt(look);
  });
  return null;
}

function DartsBoard({ throws, onThrow }) {
  const [aim, setAim] = useState({ x: 0.1, y: -0.1 });
  return (
    <div className="darts-game">
      <div className="darts-board">
        <div className="aim-dot" style={{ left: `${50 + aim.x * 38}%`, top: `${50 + aim.y * 38}%` }} />
      </div>
      <div className="darts-hud"><span>THROW {throws + 1}/3</span><b>AIM</b></div>
      <button className="primary-btn" onClick={() => { const accuracy = Math.max(0, 1 - Math.hypot(aim.x, aim.y)); onThrow(Math.round((accuracy > 0.75 ? 50 : 18) * (0.7 + Math.random() * 0.4))); setAim({ x: (Math.random() - 0.5) * 0.7, y: (Math.random() - 0.5) * 0.7 }); }}>THROW</button>
    </div>
  );
}

function App() {
  const [balance, setBalance] = useState(10000);
  const [modal, setModal] = useState(null);
  const [stake, setStake] = useState(1000);
  const [message, setMessage] = useState("FREE ROAM");
  const [locked, setLocked] = useState(false);
  const [sprinting, setSprinting] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [npcScore, setNpcScore] = useState(0);
  const [throws, setThrows] = useState(0);
  const [cameraMode, setCameraMode] = useState("follow");
  const [channel, setChannel] = useState("news");
  const [scope, setScope] = useState("screen");
  const playerRef = useRef(null);
  const partnerRef = useRef({ position: new THREE.Vector3(-4, 0, 4) });
  const movementRef = useRef({ x: 0, z: 0, sprint: false });
  const keys = useRef({});
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io("http://localhost:3001", { autoConnect: true, timeout: 2000 });
    socketRef.current = socket;
    socket.on("tv:state", (state) => {
      if (state?.scope === "city") {
        setChannel(state.channel);
        setScope("city");
        setMessage(`CITY BROADCAST · ${state.title || state.channel}`);
      }
    });
    socket.on("player:move", (p) => { partnerRef.current = { position: new THREE.Vector3(p.x, 0, p.z) }; });
    return () => socket.close();
  }, []);

  useEffect(() => {
    const down = (e) => { keys.current[e.key.toLowerCase()] = true; if (e.key === "Shift") setSprinting(true); };
    const up = (e) => { keys.current[e.key.toLowerCase()] = false; if (e.key === "Shift") setSprinting(false); };
    const id = setInterval(() => {
      const k = keys.current;
      movementRef.current = { x: (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0), z: (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0), sprint: sprinting || !!k.shift };
      const p = playerRef.current;
      if (p && socketRef.current?.connected) socketRef.current.emit("player:move", { x: p.position.x, y: 0, z: p.position.z, rotation: p.rotation.y, name: "YOU" });
    }, 50);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); clearInterval(id); };
  }, [sprinting]);

  const applyTv = (nextChannel, nextScope) => {
    setChannel(nextChannel);
    setScope(nextScope);
    const found = CHANNELS.find((c) => c.id === nextChannel);
    setMessage(nextScope === "city" ? `CITY BROADCAST · ${found.title}` : found.title);
    socketRef.current?.emit("tv:set", { channel: nextChannel, scope: nextScope, title: found.title });
  };
  const openDuel = () => { setMessage("DARTS DUEL READY"); setModal("duel"); };
  const confirmDuel = () => {
    const a = Math.max(100, Math.floor(Number(stake) || 0));
    if (a > balance) { setMessage("INSUFFICIENT BET"); return; }
    setBalance((b) => b - a); setPlayerScore(0); setNpcScore(0); setThrows(0); setLocked(true); setModal("playing");
  };
  const finishDuel = (win) => {
    const a = Math.max(100, Math.floor(Number(stake) || 0));
    if (win) setBalance((b) => b + Math.floor(a * 1.9));
    setLocked(false); setModal(null); setMessage(win ? "YOU WON" : "YOU LOST");
  };
  const playerThrow = (score) => {
    const nextThrows = throws + 1;
    const nextPlayer = playerScore + score;
    setPlayerScore(nextPlayer); setThrows(nextThrows);
    const npc = Math.round(12 + Math.random() * 48);
    const nextNpc = npcScore + npc;
    setNpcScore(nextNpc);
    if (nextThrows >= 3) setTimeout(() => finishDuel(nextPlayer >= nextNpc), 160);
  };
  const current = CHANNELS.find((c) => c.id === channel);

  return (
    <div className="app">
      <div className="scene">
        <Canvas shadows dpr={[1, 1.5]} camera={{ position: [16, 8, 18], fov: 48 }} gl={{ antialias: true }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}>
          <color attach="background" args={["#f0b27a"]} />
          <fog attach="fog" args={["#e7c3a2", 28, 120]} />
          <City onShop={() => setModal("info")} onDarts={openDuel} playerRef={playerRef} movementRef={movementRef} />
          <CameraRig playerRef={playerRef} partnerRef={partnerRef} mode={cameraMode} />
          <EffectComposer>
            <SMAA />
            <Bloom intensity={0.35} luminanceThreshold={0.75} mipmapBlur />
            <Noise opacity={0.025} />
            <Vignette eskil={false} offset={0.15} darkness={0.55} />
          </EffectComposer>
        </Canvas>
      </div>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">B</span><div><strong>BET CITY</strong><small>ORIGINAL CITY · DUSK</small></div></div>
        <div className="pickers">
          <label>CAMERA<select value={cameraMode} onChange={(e) => setCameraMode(e.target.value)}><option value="follow">Follow</option><option value="shoulder">Shoulder</option><option value="hood">Hood</option><option value="cinematic">Cinematic</option><option value="coop">Co-op</option></select></label>
          <label>TELE<select value={channel} onChange={(e) => applyTv(e.target.value, scope)}>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
          <label>BROADCAST<select value={scope} onChange={(e) => applyTv(channel, e.target.value)}><option value="screen">This screen</option><option value="city">City broadcast</option></select></label>
        </div>
        <div className="wallet"><span>BET</span><strong>{balance.toLocaleString()}</strong></div>
      </header>
      <div className="status-pill"><i className={locked || scope === "city" ? "live" : ""} />{message}</div>
      <div className="hud-left"><div className="mini-map"><span /><b style={{ left: 12, top: 18 }}>SHOP</b><b style={{ right: 12, top: 18 }}>POOL</b><b style={{ left: 18, bottom: 16 }}>DARTS</b></div><div className="quest"><b>LIVE TV</b><span>{current.title}</span><small>{current.line}</small></div></div>
      <div className="hud-right"><button className={cameraMode === "coop" ? "on" : ""} onClick={() => setCameraMode(cameraMode === "coop" ? "follow" : "coop")}>CO-OP</button><button className="on" onClick={() => setModal("tv")}>TELE</button><button onClick={() => setModal("map")}>MAP</button><button>INV</button></div>
      <div className="joystick" onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={(e) => { if (!e.buttons) return; const r = e.currentTarget.getBoundingClientRect(); movementRef.current = { ...movementRef.current, x: clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.42), -1, 1), z: clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.42), -1, 1) }; }} onPointerUp={() => { movementRef.current = { ...movementRef.current, x: 0, z: 0 }; }}><div className="stick" /></div>
      <div className="action-pad"><button onPointerDown={() => setSprinting(true)} onPointerUp={() => setSprinting(false)}>RUN</button><button onClick={openDuel}>FIGHT</button><button onClick={() => setModal("tv")}>TELE</button><button onClick={() => setModal("map")}>MAP</button></div>
      <div className="bottom-ui"><button className="glass-btn" onClick={() => setModal("tv")}>TELEVISION</button><button className="primary-btn" onClick={openDuel}>CHALLENGE KAY</button></div>
      {modal === "duel" && <div className="modal-backdrop"><div className="modal"><div className="modal-kicker">DARTS DUEL</div><h2>Challenge Kay</h2><p>Stake virtual BET. Winner takes the pot minus the house cut.</p><label>YOUR STAKE</label><div className="stake-row"><input value={stake} type="number" min="100" step="100" onChange={(e) => setStake(e.target.value)} /><span>BET</span></div><div className="modal-actions"><button className="glass-btn" onClick={() => setModal(null)}>CANCEL</button><button className="primary-btn" onClick={confirmDuel}>START</button></div></div></div>}
      {modal === "playing" && <div className="modal-backdrop"><div className="modal compact"><div className="modal-kicker">LIVE DUEL</div><h2>Darts Arena</h2><div className="duel-score"><div><small>YOU</small><strong>{playerScore}</strong></div><span>VS</span><div><small>KAY</small><strong>{npcScore}</strong></div></div><DartsBoard throws={throws} onThrow={playerThrow} /></div></div>}
      {modal === "info" && <div className="modal-backdrop"><div className="modal compact"><div className="modal-kicker">LUCKY SHOP</div><h2>Town hub</h2><p>Original storefront. Find opponents and wager virtual BET.</p><button className="primary-btn full" onClick={() => setModal(null)}>CLOSE</button></div></div>}
      {modal === "map" && <div className="modal-backdrop"><div className="modal compact"><div className="modal-kicker">CITY MAP</div><h2>Bet City</h2><p>Lucky Shop, Pool House, Arcade, Darts Bar, downtown towers.</p><button className="glass-btn full" onClick={() => setModal(null)}>CLOSE</button></div></div>}
      {modal === "tv" && <div className="modal-backdrop"><div className="modal"><div className="modal-kicker">TELEVISION</div><h2>{current.title}</h2><p>{current.line}</p><div className="channel-grid">{CHANNELS.map((c) => <button key={c.id} className={c.id === channel ? "on" : ""} onClick={() => applyTv(c.id, scope)}>{c.title}</button>)}</div><div className="scope-row"><button className={scope === "screen" ? "on" : ""} onClick={() => applyTv(channel, "screen")}>This screen</button><button className={scope === "city" ? "on" : ""} onClick={() => applyTv(channel, "city")}>City broadcast</button></div><div className="tv-readout">{scope === "city" ? "Broadcasting to every connected player." : "Only your screen changes."}</div><button className="glass-btn full" onClick={() => setModal(null)}>CLOSE</button></div></div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
