import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Text } from "@react-three/drei";
import * as THREE from "three";
import { io } from "socket.io-client";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { available, createWallet, settle, stake } from "./economy.js";
import { ROUTES, slide } from "./world.js";
import "./style.css";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CHANNELS = [
  { id: "news", title: "BET CITY NEWS", line: "Dusk market opens on the south strip.", color: "#14324a" },
  { id: "sports", title: "SPORTS WIRE", line: "Darts night: Kay leads the board.", color: "#3a2418" },
  { id: "odds", title: "ODDS BOARD", line: "Virtual lines only. No cash market.", color: "#1b2430" },
  { id: "nightlife", title: "NIGHTLIFE", line: "Darts Bar live. Pool House open.", color: "#3a1840" },
  { id: "street", title: "STREET CAM", line: "Downtown co-op camera feed.", color: "#102820" }
];

function paint(draw, w = 256, h = 256, repeat = 1) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function noise(g, w, h, n, a) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * a})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}

function Road() {
  const asphalt = useMemo(() => paint((g, w, h) => { g.fillStyle = "#23282e"; g.fillRect(0, 0, w, h); noise(g, w, h, 2500, 0.05); }, 512, 512, 12), []);
  const walk = useMemo(() => paint((g, w, h) => { g.fillStyle = "#6d655c"; g.fillRect(0, 0, w, h); g.strokeStyle = "#5a534c"; for (let i = 0; i < 8; i++) { g.strokeRect(i * 32, 0, 30, h); } }, 256, 256, 6), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[160, 160]} /><meshStandardMaterial map={asphalt} roughness={0.62} metalness={0.12} /></mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[14, 150]} /><meshStandardMaterial color="#2c3238" roughness={0.5} metalness={0.08} /></mesh>
      <mesh position={[0, 0.031, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[150, 14]} /><meshStandardMaterial color="#2c3238" roughness={0.5} metalness={0.08} /></mesh>
      {[-8.4, 8.4].map((x) => <mesh key={x} position={[x, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[3.4, 150]} /><meshStandardMaterial map={walk} roughness={0.9} /></mesh>)}
      {[-8.4, 8.4].map((z) => <mesh key={"z" + z} position={[0, 0.04, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[150, 3.4]} /><meshStandardMaterial map={walk} roughness={0.9} /></mesh>)}
      {[-3.6, 3.6].map((x) => <mesh key={"l" + x} position={[x, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.1, 140]} /><meshBasicMaterial color="#e7d48a" /></mesh>)}
      {Array.from({ length: 24 }).map((_, i) => <mesh key={i} position={[0, 0.055, -58 + i * 5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.2, 0.14]} /><meshBasicMaterial color="#f4f1e8" /></mesh>)}
      {Array.from({ length: 8 }).map((_, i) => <mesh key={"c" + i} position={[-5.6 + i * 1.6, 0.06, 8.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.7, 3.6]} /><meshStandardMaterial color="#eceff2" /></mesh>)}
    </group>
  );
}

function Lamp({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 2.8, 0]}><cylinderGeometry args={[0.07, 0.1, 5.6, 8]} /><meshStandardMaterial color="#1b1f24" metalness={0.75} roughness={0.28} /></mesh>
      <mesh position={[0.55, 5.45, 0]}><boxGeometry args={[1.2, 0.07, 0.07]} /><meshStandardMaterial color="#1b1f24" metalness={0.7} /></mesh>
      <mesh position={[1.05, 5.28, 0]}><boxGeometry args={[0.42, 0.1, 0.2]} /><meshStandardMaterial color="#ffe7ad" emissive="#ffb14a" emissiveIntensity={2.2} /></mesh>
    </group>
  );
}

function Palm({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 2.2, 0]}><cylinderGeometry args={[0.14, 0.26, 4.4, 7]} /><meshStandardMaterial color="#6b4630" roughness={0.9} /></mesh>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = i / 6 * Math.PI * 2;
        return <mesh key={i} castShadow position={[Math.sin(a) * 0.55, 4.35, Math.cos(a) * 0.55]} rotation={[0.8, a, 0]}><coneGeometry args={[0.16, 1.8, 5]} /><meshStandardMaterial color={i % 2 ? "#1e6840" : "#2f8b56"} /></mesh>;
      })}
    </group>
  );
}

function House({ position, color = "#cbb59a" }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 2.1, 0]}><boxGeometry args={[7.6, 4.2, 6.4]} /><meshStandardMaterial color={color} roughness={0.78} /></mesh>
      <mesh castShadow position={[0, 4.45, 0]}><boxGeometry args={[8, 0.28, 6.8]} /><meshStandardMaterial color="#3e4348" /></mesh>
      <mesh castShadow position={[0, 5.5, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[4.8, 2.1, 4]} /><meshStandardMaterial color="#6a3832" roughness={0.72} /></mesh>
      <mesh position={[1.8, 1.05, 3.28]}><boxGeometry args={[1.3, 2.1, 0.1]} /><meshStandardMaterial color="#2a211c" /></mesh>
      <mesh position={[-1.7, 1.15, 3.3]}><boxGeometry args={[2.1, 1.9, 0.08]} /><meshStandardMaterial color="#2a3338" metalness={0.25} /></mesh>
      {[-2.2, 0.2, 2.3].map((x) => <mesh key={x} position={[x, 2.9, 3.26]}><boxGeometry args={[0.9, 1.05, 0.06]} /><meshStandardMaterial color="#b7e4ee" emissive="#f2c56b" emissiveIntensity={0.28} metalness={0.35} roughness={0.12} /></mesh>)}
      <mesh position={[0, 2.55, 3.55]}><boxGeometry args={[2.2, 0.1, 0.7]} /><meshStandardMaterial color="#d7b456" /></mesh>
      <mesh position={[-3.2, 0.7, 1.4]}><boxGeometry args={[0.06, 0.9, 2.2]} /><meshStandardMaterial color="#8d9398" metalness={0.45} /></mesh>
    </group>
  );
}

function Tower({ position, height = 28, width = 9, color = "#55616c" }) {
  const floors = Math.floor(height / 2.4);
  return (
    <group position={position}>
      <mesh castShadow position={[0, height / 2, 0]}><boxGeometry args={[width, height, width * 0.72]} /><meshStandardMaterial color={color} roughness={0.48} metalness={0.18} /></mesh>
      {Array.from({ length: floors }).map((_, i) => <mesh key={i} position={[0, 1.5 + i * 2.4, width * 0.36 + 0.04]}><boxGeometry args={[width * 0.7, 0.9, 0.05]} /><meshStandardMaterial color="#12343c" emissive={i % 3 === 0 ? "#f0c27a" : "#0e2c33"} emissiveIntensity={i % 3 === 0 ? 0.55 : 0.08} metalness={0.45} roughness={0.15} /></mesh>)}
    </group>
  );
}

function Shop({ position, color, name, accent, onClick, channelRef }) {
  const screen = useRef();
  const tex = useMemo(() => paint((g, w, h) => { g.fillStyle = "#071018"; g.fillRect(0, 0, w, h); }, 512, 288, 1), []);
  useFrame(() => {
    if (!screen.current) return;
    const ch = CHANNELS.find((c) => c.id === channelRef.current) || CHANNELS[0];
    const c = tex.image;
    const g = c.getContext("2d");
    g.fillStyle = ch.color; g.fillRect(0, 0, 512, 288);
    g.fillStyle = "#d7b456"; g.fillRect(0, 0, 512, 36);
    g.fillStyle = "#111"; g.font = "bold 22px sans-serif"; g.fillText(ch.title, 16, 26);
    g.fillStyle = "#f4f7fb"; g.font = "28px sans-serif"; g.fillText(ch.line, 16, 120);
    g.fillStyle = channelRef.scope === "city" ? "#ffb14a" : "#8fd0c8";
    g.fillRect(16, 200, 180, 34);
    g.fillStyle = "#111"; g.font = "bold 18px sans-serif";
    g.fillText(channelRef.scope === "city" ? "CITY BROADCAST" : "THIS SCREEN", 28, 223);
    tex.needsUpdate = true;
  });
  return (
    <group position={position} onClick={onClick}>
      <mesh castShadow position={[0, 2.5, 0]}><boxGeometry args={[9.2, 5, 7.2]} /><meshStandardMaterial color={color} roughness={0.62} /></mesh>
      <mesh position={[0, 1.55, 3.66]}><boxGeometry args={[7.4, 2.5, 0.08]} /><meshPhysicalMaterial color="#b7e0ea" metalness={0.05} roughness={0.08} transmission={0.35} transparent opacity={0.72} /></mesh>
      <mesh position={[0, 0.95, 2.8]}><boxGeometry args={[5.4, 0.7, 1]} /><meshStandardMaterial color="#241c16" /></mesh>
      <mesh position={[0, 3.7, 3.85]}><boxGeometry args={[7.6, 0.7, 0.12]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} /></mesh>
      <Text position={[0, 3.7, 3.96]} fontSize={0.34} color="#fff8df" anchorX="center">{name}</Text>
      <mesh position={[0, 4.25, 3.7]}><boxGeometry args={[7.8, 0.18, 1.1]} /><meshStandardMaterial color="#6a3030" /></mesh>
      <mesh ref={screen} position={[2.4, 2.15, 3.7]}><planeGeometry args={[2.2, 1.24]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    </group>
  );
}

function Car({ route = ROUTES[0], color = "#1d242c", pace = 7, offset = 0, trafficRef, playerRef }) {
  const ref = useRef();
  const wheels = useRef();
  const cursor = useRef(offset % route.length);
  useFrame((_, dt) => {
    if (!ref.current) return;
    let i = Math.floor(cursor.current) % route.length;
    let next = route[(i + 1) % route.length];
    let here = route[i];
    let tx = next[0] - here[0];
    let tz = next[1] - here[1];
    const len = Math.hypot(tx, tz) || 1;
    let speed = pace;
    const player = playerRef?.current?.position;
    if (player) {
      const aheadX = ref.current.position.x + (tx / len) * 4;
      const aheadZ = ref.current.position.z + (tz / len) * 4;
      if (Math.hypot(player.x - aheadX, player.z - aheadZ) < 2.2) speed = 0.4;
    }
    if (Math.abs(here[0]) < 6 && Math.abs(here[1]) < 6) speed *= 0.55;
    cursor.current = (cursor.current + (speed * dt) / len) % route.length;
    i = Math.floor(cursor.current) % route.length;
    next = route[(i + 1) % route.length];
    here = route[i];
    tx = next[0] - here[0];
    tz = next[1] - here[1];
    const t = cursor.current - i;
    const x = here[0] + tx * t;
    const z = here[1] + tz * t;
    ref.current.position.set(x, 0, z);
    ref.current.rotation.y = Math.atan2(tx, tz);
    if (wheels.current) wheels.current.rotation.x -= speed * dt * 1.4;
    if (trafficRef) trafficRef.current[offset] = { x, z, hx: 2.2, hz: 1 };
  });
  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.55, 0]}><boxGeometry args={[4.2, 0.62, 1.75]} /><meshStandardMaterial color={color} metalness={0.78} roughness={0.24} /></mesh>
      <mesh castShadow position={[-0.15, 1.08, 0]}><boxGeometry args={[1.9, 0.52, 1.55]} /><meshPhysicalMaterial color="#101820" roughness={0.08} metalness={0.15} transmission={0.25} transparent opacity={0.8} /></mesh>
      <mesh position={[2.02, 0.55, 0]}><boxGeometry args={[0.1, 0.16, 1.35]} /><meshStandardMaterial color="#fff4d2" emissive="#fff1c4" emissiveIntensity={1.4} /></mesh>
      <mesh position={[-2.08, 0.5, 0]}><boxGeometry args={[0.08, 0.14, 1.3]} /><meshStandardMaterial color="#ff3b3b" emissive="#ff2a2a" emissiveIntensity={0.7} /></mesh>
      <group ref={wheels}>
        {[[-1.25, 0.28, 0.9], [1.2, 0.28, 0.9], [-1.25, 0.28, -0.9], [1.2, 0.28, -0.9]].map((p, i) => <mesh key={i} position={p} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.2, 14]} /><meshStandardMaterial color="#111" /></mesh>)}
      </group>
    </group>
  );
}

function Citizen({ position, name, shirt, player, movementRef, playerRef, trafficRef, onClick }) {
  const ref = useRef();
  const armL = useRef(); const armR = useRef(); const legL = useRef(); const legR = useRef();
  const velocity = useRef(new THREE.Vector3());
  useEffect(() => { if (player && playerRef) playerRef.current = ref.current; }, [player, playerRef]);
  useFrame((state, dt) => {
    if (!ref.current) return;
    if (!player) return;
    const m = movementRef.current;
    const yaw = m.yaw || 0;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const wish = new THREE.Vector3();
    if (m.z) wish.addScaledVector(forward, -m.z);
    if (m.x) wish.addScaledVector(right, m.x);
    const moving = wish.lengthSq() > 0.01;
    if (moving) wish.normalize();
    const target = wish.multiplyScalar(m.sprint ? 7.4 : 4.3);
    velocity.current.lerp(target, 1 - Math.pow(0.001, dt));
    const step = velocity.current.clone().multiplyScalar(dt);
    const extra = Object.values(trafficRef?.current || {});
    const next = slide(ref.current.position.x, ref.current.position.z, ref.current.position.x + step.x, ref.current.position.z + step.z, 0.42, extra);
    ref.current.position.x = clamp(next.x, -24, 24);
    ref.current.position.z = clamp(next.z, -24, 24);
    if (velocity.current.lengthSq() > 0.2) ref.current.rotation.y = Math.atan2(velocity.current.x, velocity.current.z);
    const walk = state.clock.elapsedTime * (m.sprint ? 11 : 8);
    const amt = moving ? 0.5 : 0;
    if (legL.current) legL.current.rotation.x = Math.sin(walk) * amt;
    if (legR.current) legR.current.rotation.x = -Math.sin(walk) * amt;
    if (armL.current) armL.current.rotation.x = -Math.sin(walk) * amt;
    if (armR.current) armR.current.rotation.x = Math.sin(walk) * amt;
  });
  return (
    <group ref={ref} position={position} onClick={onClick}>
      <mesh castShadow position={[0, 1.2, 0]}><capsuleGeometry args={[0.38, 0.62, 6, 12]} /><meshStandardMaterial color={shirt} roughness={0.55} /></mesh>
      <mesh position={[0, 1.62, 0.16]}><boxGeometry args={[0.62, 0.14, 0.1]} /><meshStandardMaterial color="#171b20" /></mesh>
      <mesh castShadow position={[0, 2.05, 0]}><sphereGeometry args={[0.32, 18, 14]} /><meshStandardMaterial color="#c49a78" roughness={0.7} /></mesh>
      <mesh position={[0, 2.22, -0.02]}><sphereGeometry args={[0.33, 12, 8, 0, Math.PI * 2, 0, 1.1]} /><meshStandardMaterial color="#1a1716" /></mesh>
      <group ref={armL} position={[-0.48, 1.28, 0]}><mesh castShadow><capsuleGeometry args={[0.09, 0.48, 4, 8]} /><meshStandardMaterial color="#c49a78" /></mesh></group>
      <group ref={armR} position={[0.48, 1.28, 0]}><mesh castShadow><capsuleGeometry args={[0.09, 0.48, 4, 8]} /><meshStandardMaterial color="#c49a78" /></mesh></group>
      <group ref={legL} position={[-0.15, 0.5, 0]}><mesh castShadow><capsuleGeometry args={[0.1, 0.42, 4, 8]} /><meshStandardMaterial color="#242a33" /></mesh><mesh position={[0, -0.36, 0.06]}><boxGeometry args={[0.2, 0.1, 0.3]} /><meshStandardMaterial color="#111" /></mesh></group>
      <group ref={legR} position={[0.15, 0.5, 0]}><mesh castShadow><capsuleGeometry args={[0.1, 0.42, 4, 8]} /><meshStandardMaterial color="#242a33" /></mesh><mesh position={[0, -0.36, 0.06]}><boxGeometry args={[0.2, 0.1, 0.3]} /><meshStandardMaterial color="#111" /></mesh></group>
      <Text position={[0, 2.7, 0]} fontSize={0.22} color="#fff" anchorX="center" outlineWidth={0.01} outlineColor="#111">{name}</Text>
    </group>
  );
}

function City({ onShop, onDarts, playerRef, movementRef, channelRef, trafficRef }) {
  return (
    <>
      <hemisphereLight args={["#9eb7d8", "#2a211c", 0.65]} />
      <directionalLight castShadow position={[-18, 24, 10]} intensity={2.2} color="#ffd2a8" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <Environment preset="sunset" />
      <Road />
      <Tower position={[-28, 0, -36]} height={32} />
      <Tower position={[-12, 0, -42]} height={44} width={11} color="#687480" />
      <Tower position={[14, 0, -40]} height={38} color="#4c5864" />
      <Tower position={[30, 0, -32]} height={48} width={12} />
      <House position={[-16, 0, -4]} /><House position={[16, 0, -3]} color="#b7a48f" />
      <House position={[-16, 0, 16]} color="#c3ad98" /><House position={[16, 0, 16]} />
      <Shop position={[-12, 0, -12]} color="#6b4038" name="LUCKY SHOP" accent="#e15b4c" onClick={onShop} channelRef={channelRef} />
      <Shop position={[12, 0, -12]} color="#24566c" name="POOL HOUSE" accent="#49b4d4" channelRef={channelRef} />
      <Shop position={[-12, 0, 13]} color="#4a3d6e" name="ARCADE" accent="#9a74e0" channelRef={channelRef} />
      <Shop position={[12, 0, 13]} color="#6e4a2e" name="DARTS BAR" accent="#e0a15a" onClick={onDarts} channelRef={channelRef} />
      <Lamp position={[-10, 0, -7]} /><Lamp position={[10, 0, -7]} /><Lamp position={[-10, 0, 9]} /><Lamp position={[10, 0, 9]} />
      <Palm position={[-9.6, 0, -1]} /><Palm position={[9.6, 0, -1]} /><Palm position={[-9.6, 0, 6]} /><Palm position={[9.6, 0, 6]} />
      <Car route={ROUTES[0]} color="#8d2e2a" pace={8} offset={0} trafficRef={trafficRef} playerRef={playerRef} />
      <Car route={ROUTES[1]} color="#1e2833" pace={6.5} offset={1} trafficRef={trafficRef} playerRef={playerRef} />
      <Car route={ROUTES[2]} color="#b08a3e" pace={7.2} offset={2} trafficRef={trafficRef} playerRef={playerRef} />
      <mesh position={[-7.2, 0.4, 3]} castShadow><boxGeometry args={[1.5, 0.08, 0.4]} /><meshStandardMaterial color="#6a5344" /></mesh>
      <mesh position={[7.4, 0.45, 4]} castShadow><cylinderGeometry args={[0.26, 0.3, 0.8, 10]} /><meshStandardMaterial color="#2c3338" metalness={0.4} /></mesh>
      <Citizen position={[0, 0, 6]} name="YOU" shirt="#1c222b" player movementRef={movementRef} playerRef={playerRef} trafficRef={trafficRef} />
      <Citizen position={[-4, 0, 4]} name="KAY" shirt="#3c78ad" onClick={onDarts} />
      <Citizen position={[4, 0, 3]} name="MUSA" shirt="#9b4c8f" />
      <Citizen position={[0, 0, -3]} name="ZEE" shirt="#3f8a73" />
      <Citizen position={[-6, 0, 1]} name="AMAKA" shirt="#d05c55" />
      <Citizen position={[6, 0, -1]} name="TUNDE" shirt="#d7b456" />
      <mesh position={[12, 1.6, 16.2]}><cylinderGeometry args={[0.7, 0.7, 0.08, 20]} /><meshStandardMaterial color="#b34b3d" /></mesh>
      <Text position={[12, 2.4, 16.2]} fontSize={0.2} color="#fff" anchorX="center">E TO THROW</Text>
      <StandIn url="/assets/vehicles/sedan.glb" position={[4.2, 0.6, 8]} scale={1} />
      {peers.map((p) => <RemoteAvatar key={p.id} peer={p} />)}
    </>
  );
}

function CameraRig({ playerRef, mode, partnerRef, movementRef }) {
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, dt) => {
    const p = playerRef.current?.position || new THREE.Vector3(0, 0, 6);
    const yaw = playerRef.current?.rotation.y || 0;
    const partner = partnerRef.current?.position;
    let desired = new THREE.Vector3(p.x - Math.sin(yaw) * 7.4, 4.8, p.z - Math.cos(yaw) * 8.6);
    if (mode === "shoulder") desired.set(p.x - Math.sin(yaw) * 2.8 + Math.cos(yaw), 2.2, p.z - Math.cos(yaw) * 3.1 - Math.sin(yaw));
    if (mode === "hood") desired.set(p.x + Math.sin(yaw) * 1.3, 1.45, p.z + Math.cos(yaw) * 1.3);
    if (mode === "cinematic") desired.set(p.x + Math.sin(state.clock.elapsedTime * 0.15) * 12, 7, p.z + Math.cos(state.clock.elapsedTime * 0.15) * 12);
    if (mode === "coop" && partner) { const mid = p.clone().add(partner).multiplyScalar(0.5); desired.set(mid.x - 9, 7.5, mid.z - 11); look.copy(mid); }
    else look.set(p.x, p.y + 1.35, p.z);
    state.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    state.camera.lookAt(look);
    if (movementRef) movementRef.current.yaw = Math.atan2(state.camera.position.x - p.x, state.camera.position.z - p.z) + Math.PI;
  });
  return null;
}

function StandIn({ url, position = [0, 0, 0], scale = 1 }) {
  const ref = useRef();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    new GLTFLoader().load(url, (gltf) => {
      if (!alive || !ref.current) return;
      const root = gltf.scene;
      root.scale.setScalar(scale);
      ref.current.add(root);
      setReady(true);
    }, undefined, () => setReady(false));
    return () => { alive = false; };
  }, [url, scale]);
  return <group ref={ref} position={position} visible={ready} />;
}

function RemoteAvatar({ peer }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.lerp(new THREE.Vector3(peer.x, 0, peer.z), 0.35);
    ref.current.rotation.y = peer.rotation || 0;
  });
  return (
    <group ref={ref}>
      <StandIn url="/assets/characters/player.glb" scale={1} />
      <mesh castShadow position={[0, 1.2, 0]}><capsuleGeometry args={[0.38, 0.62, 6, 12]} /><meshStandardMaterial color="#d7b456" /></mesh>
      <mesh position={[0, 2.05, 0]}><sphereGeometry args={[0.32, 16, 12]} /><meshStandardMaterial color="#c49a78" /></mesh>
      <Text position={[0, 2.7, 0]} fontSize={0.22} color="#fff" anchorX="center">{peer.name || "PLAYER"}</Text>
    </group>
  );
}

function ShopInterior({ onExit, peers, onChallenge, playerRef, movementRef }) {
  return (
    <group>
      <ambientLight intensity={0.8} />
      <mesh position={[0, 2, 0]}><boxGeometry args={[12, 4, 10]} /><meshStandardMaterial color="#2a241e" side={THREE.BackSide} /></mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[12, 10]} /><meshStandardMaterial color="#4a3b30" /></mesh>
      <mesh position={[0, 1.1, -3]}><boxGeometry args={[6, 1.1, 1]} /><meshStandardMaterial color="#6b4038" /></mesh>
      <Text position={[0, 2.4, -3]} fontSize={0.35} color="#f2c56b" anchorX="center">LUCKY SHOP</Text>
      <StandIn url="/assets/buildings/shop.glb" position={[0, 2.5, -4]} scale={0.25} />
      {peers.map((p, i) => <group key={p.id} position={[-3 + i * 1.6, 0, -1]} onClick={() => onChallenge(p)}><mesh><capsuleGeometry args={[0.3, 0.5, 4, 8]} /><meshStandardMaterial color="#3c78ad" /></mesh><Text position={[0, 1.5, 0]} fontSize={0.18} color="#fff" anchorX="center">{p.name}</Text></group>)}
      <Citizen position={[0, 0, 2]} name="YOU" shirt="#1c222b" player movementRef={movementRef} playerRef={playerRef} />
      <mesh position={[0, 1, 4.6]} onClick={onExit}><boxGeometry args={[1.4, 2, 0.1]} /><meshStandardMaterial color="#111" /></mesh>
      <Text position={[0, 2.2, 4.7]} fontSize={0.22} color="#fff" anchorX="center">EXIT</Text>
    </group>
  );
}
  function DartsBoard({ throws, onThrow }) {
  const [aim, setAim] = useState({ x: 0.1, y: -0.1 });
  return (
    <div className="darts-game">
      <div className="darts-board"><div className="aim-dot" style={{ left: `${50 + aim.x * 38}%`, top: `${50 + aim.y * 38}%` }} /></div>
      <div className="darts-hud"><span>THROW {throws + 1}/3</span><b>AIM</b></div>
      <button className="primary-btn" onClick={() => { const accuracy = Math.max(0, 1 - Math.hypot(aim.x, aim.y)); onThrow(Math.round((accuracy > 0.75 ? 50 : 18) * (0.7 + Math.random() * 0.4))); setAim({ x: (Math.random() - 0.5) * 0.7, y: (Math.random() - 0.5) * 0.7 }); }}>THROW</button>
    </div>
  );
}

function App() {
  const [wallet, setWallet] = useState(() => createWallet(10000));
  const walletRef = useRef(wallet);
  const [stick, setStick] = useState({ x: 0, z: 0 });
  const stakeRef = useRef(1000);
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
  const trafficRef = useRef({});
  const socketRef = useRef(null);
  const [peers, setPeers] = useState([]);
  const [interior, setInterior] = useState(null);
  const [serverOn, setServerOn] = useState(false);
  const pending = useRef({});
  const channelRef = useRef("news");
  channelRef.current = channel;
  channelRef.scope = scope;

  useEffect(() => {
    const socket = io("http://127.0.0.1:3001", { autoConnect: true, timeout: 1500, reconnectionAttempts: 1, transports: ["polling"] });
    socketRef.current = socket;
    socket.on("tv:state", (state) => {
      if (state?.scope === "city") { setChannel(state.channel); setScope("city"); setMessage(`CITY BROADCAST · ${state.title || state.channel}`); }
    });
    socket.on("connect", () => setServerOn(true));
    socket.on("disconnect", () => setServerOn(false));
    socket.on("world:init", (world) => {
      setPeers((world.players || []).filter((p) => p.id !== world.playerId));
      if (world.wallet) { walletRef.current = { ...createWallet(), ...world.wallet }; setWallet(walletRef.current); }
    });
    socket.on("player:join", (p) => setPeers((list) => [...list.filter((x) => x.id !== p.id), p]));
    socket.on("player:leave", ({ id }) => setPeers((list) => list.filter((x) => x.id !== id)));
    socket.on("player:move", (p) => {
      partnerRef.current = { position: new THREE.Vector3(p.x, 0, p.z) };
      setPeers((list) => list.map((x) => x.id === p.id ? p : x).concat(list.some((x) => x.id === p.id) ? [] : [p]));
    });
    socket.on("wallet:result", (result) => {
      const done = pending.current[result.requestId];
      if (done) { delete pending.current[result.requestId]; done(result); }
      if (result.wallet) { walletRef.current = { ...walletRef.current, ...result.wallet }; setWallet(walletRef.current); }
    });
    return () => socket.close();
  }, []);

  useEffect(() => {
    const down = (e) => { keys.current[e.key.toLowerCase()] = true; if (e.key === "Shift") setSprinting(true); };
    const up = (e) => { keys.current[e.key.toLowerCase()] = false; if (e.key === "Shift") setSprinting(false); };
    const id = setInterval(() => {
      const k = keys.current;
      movementRef.current = { ...movementRef.current, x: (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0), z: (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0), sprint: sprinting || !!k.shift };
      const p = playerRef.current;
      if (p && socketRef.current?.connected) socketRef.current.emit("player:move", { x: p.position.x, y: 0, z: p.position.z, rotation: p.rotation.y, name: "YOU" });
      if (k.e && p && !interior) {
        const nearShop = Math.hypot(p.position.x + 12, p.position.z + 12) < 4;
        const nearDarts = Math.hypot(p.position.x - 12, p.position.z - 13) < 4;
        if (nearShop) setInterior("shop");
        if (nearDarts) setModal("duel");
        keys.current.e = false;
      }
    }, 50);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); clearInterval(id); };
  }, [sprinting]);

  const applyTv = (nextChannel, nextScope) => {
    setChannel(nextChannel); setScope(nextScope);
    const found = CHANNELS.find((c) => c.id === nextChannel);
    setMessage(nextScope === "city" ? `CITY BROADCAST · ${found.title}` : found.title);
    socketRef.current?.emit("tv:set", { channel: nextChannel, scope: nextScope, title: found.title });
  };
  const openDuel = () => { setMessage("DARTS DUEL READY"); setModal("duel"); };
  const askServer = (event, payload) => new Promise((resolve) => {
    if (!socketRef.current?.connected) return resolve({ ok: false, offline: true });
    const requestId = Math.random().toString(36).slice(2);
    pending.current[requestId] = resolve;
    socketRef.current.emit(event, { ...payload, requestId });
    setTimeout(() => { if (pending.current[requestId]) { delete pending.current[requestId]; resolve({ ok: false, error: "SERVER TIMEOUT" }); } }, 2500);
  });
  const confirmDuel = async () => {
    const server = await askServer("wallet:stake", { amount: Math.floor(Number(stake) || 0) });
    if (server.offline) {
      const local = stake(walletRef.current, stake);
      if (!local.ok) { setMessage(local.error); return; }
      walletRef.current = local.wallet;
      stakeRef.current = local.stake;
      setWallet({ ...local.wallet, ledger: local.wallet.ledger.slice() });
      setMessage("OFFLINE LEDGER");
    } else {
      if (!server.ok) { setMessage(server.error || "STAKE REJECTED"); return; }
      stakeRef.current = server.stake;
      setMessage("SERVER STAKE LOCKED");
    }
    setPlayerScore(0); setNpcScore(0); setThrows(0); setLocked(true); setModal("playing");
  };
  const finishDuel = async (win) => {
    const server = await askServer("wallet:settle", { stake: stakeRef.current, won: win });
    if (server.offline) {
      const local = settle(walletRef.current, stakeRef.current, win);
      walletRef.current = local.wallet;
      setWallet({ ...local.wallet, ledger: local.wallet.ledger.slice() });
      setMessage(win ? `WON ${local.payout} BET` : "YOU LOST");
    } else if (!server.ok) setMessage(server.error || "SETTLE REJECTED");
    else setMessage(win ? `WON ${server.payout} BET` : "YOU LOST");
    setLocked(false); setModal(null);
  };
  const playerThrow = (score) => {
    const nextThrows = throws + 1; const nextPlayer = playerScore + score;
    setPlayerScore(nextPlayer); setThrows(nextThrows);
    const nextNpc = npcScore + Math.round(12 + Math.random() * 48);
    setNpcScore(nextNpc);
    if (nextThrows >= 3) setTimeout(() => finishDuel(nextPlayer >= nextNpc), 160);
  };
  const current = CHANNELS.find((c) => c.id === channel);

  return (
    <div className="app">
      <div className="scene">
        <Canvas shadows dpr={[1, 1.25]} camera={{ position: [16, 8, 18], fov: 50 }} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.08; }}>
          <color attach="background" args={["#e7b48a"]} />
          <fog attach="fog" args={["#e7c3a2", 26, 110]} />
          {interior === "shop" ? <ShopInterior peers={[{ id: "kay", name: "KAY" }, ...peers]} onExit={() => setInterior(null)} onChallenge={() => { setInterior(null); openDuel(); }} playerRef={playerRef} movementRef={movementRef} /> : <City onShop={() => setInterior("shop")} onDarts={openDuel} playerRef={playerRef} movementRef={movementRef} channelRef={channelRef} trafficRef={trafficRef} />}
          <CameraRig playerRef={playerRef} partnerRef={partnerRef} mode={interior ? "hood" : cameraMode} movementRef={movementRef} />
        </Canvas>
      </div>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">B</span><div><strong>BET CITY</strong><small>3D CITY</small></div></div>
        <div className="pickers">
          <label>CAMERA<select value={cameraMode} onChange={(e) => setCameraMode(e.target.value)}><option value="follow">Follow</option><option value="shoulder">Shoulder</option><option value="hood">Hood</option><option value="cinematic">Cinematic</option><option value="coop">Co-op</option></select></label>
          <label>TELE<select value={channel} onChange={(e) => applyTv(e.target.value, scope)}>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
          <label>BROADCAST<select value={scope} onChange={(e) => applyTv(channel, e.target.value)}><option value="screen">This screen</option><option value="city">City broadcast</option></select></label>
        </div>
        <div className="wallet"><span>{serverOn ? "SERVER" : "LOCAL"}</span><strong>{available(wallet).toLocaleString()}</strong></div>
      </header>
      <div className="status-pill"><i className={locked || scope === "city" ? "live" : ""} />{message}</div>
      <div className="hud-left"><div className="mini-map"><span /></div><div className="quest"><b>ON THE SHOP TVS</b><span>{current.title}</span><small>{current.line}</small></div></div>
      <div className="hud-right"><button className={cameraMode === "coop" ? "on" : ""} onClick={() => setCameraMode(cameraMode === "coop" ? "follow" : "coop")}>CO-OP</button><button className="on" onClick={() => setModal("tv")}>TELE</button><button onClick={() => setModal("map")}>MAP</button></div>
      <div className="joystick" onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={(e) => { if (!e.buttons) return; const r = e.currentTarget.getBoundingClientRect(); const x = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.42), -1, 1); const z = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.42), -1, 1); movementRef.current = { ...movementRef.current, x, z }; setStick({ x, z }); }} onPointerUp={() => { movementRef.current = { ...movementRef.current, x: 0, z: 0 }; setStick({ x: 0, z: 0 }); }}><div className="stick" style={{ transform: `translate(calc(-50% + ${stick.x * 28}px), calc(-50% + ${stick.z * 28}px))` }} /></div>
      <div className="action-pad"><button onPointerDown={() => setSprinting(true)} onPointerUp={() => setSprinting(false)}>RUN</button><button onClick={openDuel}>FIGHT</button><button onClick={() => setModal("tv")}>TELE</button><button onClick={() => setModal("map")}>MAP</button></div>
      <div className="bottom-ui"><button className="glass-btn" onClick={() => setModal("tv")}>TELEVISION</button><button className="primary-btn" onClick={openDuel}>CHALLENGE KAY</button></div>
      {modal === "duel" && <div className="modal-backdrop"><div className="modal"><div className="modal-kicker">DARTS DUEL</div><h2>Challenge Kay</h2><p>Stake virtual BET.</p><div className="stake-row"><input value={stake} type="number" min="100" step="100" onChange={(e) => setStake(e.target.value)} /><span>BET</span></div><div className="modal-actions"><button className="glass-btn" onClick={() => setModal(null)}>CANCEL</button><button className="primary-btn" onClick={confirmDuel}>START</button></div></div></div>}
      {modal === "playing" && <div className="modal-backdrop"><div className="modal compact"><div className="duel-score"><div><small>YOU</small><strong>{playerScore}</strong></div><span>VS</span><div><small>KAY</small><strong>{npcScore}</strong></div></div><DartsBoard throws={throws} onThrow={playerThrow} /></div></div>}
      {interior === "shop" && <div className="modal-backdrop"><div className="modal"><div className="modal-kicker">LUCKY SHOP</div><h2>Opponents</h2><div className="channel-grid"><button onClick={() => { setInterior(null); openDuel(); }}>KAY</button>{peers.map((p) => <button key={p.id} onClick={() => { setInterior(null); openDuel(); }}>{p.name}</button>)}</div><button className="glass-btn full" onClick={() => setInterior(null)}>EXIT</button></div></div>}
      {modal === "map" && <div className="modal-backdrop"><div className="modal compact"><h2>Bet City</h2><p>Shops, houses, towers. TV screens are on the storefronts.</p><button className="glass-btn full" onClick={() => setModal(null)}>CLOSE</button></div></div>}
      {modal === "tv" && <div className="modal-backdrop"><div className="modal"><div className="modal-kicker">TELEVISION</div><h2>{current.title}</h2><p>This changes the screens on the 3D shops.</p><div className="channel-grid">{CHANNELS.map((c) => <button key={c.id} className={c.id === channel ? "on" : ""} onClick={() => applyTv(c.id, scope)}>{c.title}</button>)}</div><div className="scope-row"><button className={scope === "screen" ? "on" : ""} onClick={() => applyTv(channel, "screen")}>This screen</button><button className={scope === "city" ? "on" : ""} onClick={() => applyTv(channel, "city")}>City broadcast</button></div><button className="glass-btn full" onClick={() => setModal(null)}>CLOSE</button></div></div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
