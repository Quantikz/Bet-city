import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import "./style.css";

const skinTones = ["#8b5a3c", "#a96f4f", "#6f422f", "#c28762"];

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color="#15191e" roughness={1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[13, 90]} />
        <meshStandardMaterial color="#343b45" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[90, 13]} />
        <meshStandardMaterial color="#343b45" roughness={0.9} />
      </mesh>
      {[-6.4, 6.4].map((x) => (
        <mesh key={x} position={[x, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.11, 90]} />
          <meshBasicMaterial color="#d8bb67" />
        </mesh>
      ))}
      {Array.from({ length: 18 }).map((_, i) => (
        <mesh key={i} position={[0, 0.04, -42 + i * 5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.05, 0.13]} />
          <meshBasicMaterial color="#d8bb67" />
        </mesh>
      ))}
      <mesh position={[-9.5, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5, 90]} />
        <meshStandardMaterial color="#565b61" roughness={1} />
      </mesh>
      <mesh position={[9.5, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5, 90]} />
        <meshStandardMaterial color="#565b61" roughness={1} />
      </mesh>
      <mesh position={[0, 0.08, -9.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[90, 5]} />
        <meshStandardMaterial color="#565b61" roughness={1} />
      </mesh>
      <mesh position={[0, 0.08, 9.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[90, 5]} />
        <meshStandardMaterial color="#565b61" roughness={1} />
      </mesh>
    </group>
  );
}

function Lamp({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.055, 0.075, 4.8, 8]} />
        <meshStandardMaterial color="#171a1f" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[0, 4.75, 0]}>
        <sphereGeometry args={[0.2, 12, 8]} />
        <meshStandardMaterial color="#f7d98b" emissive="#f4bd55" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

function Tree({ position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.18, 0.26, 2.7, 8]} />
        <meshStandardMaterial color="#50382a" roughness={1} />
      </mesh>
      <mesh castShadow position={[0, 3.15, 0]}>
        <icosahedronGeometry args={[1.25, 1]} />
        <meshStandardMaterial color="#236044" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0.65, 3.45, 0.15]}>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial color="#2c7650" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Bench({ position, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.65, 0]}>
        <boxGeometry args={[2.1, 0.18, 0.52]} />
        <meshStandardMaterial color="#6c452c" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 1.15, -0.22]}>
        <boxGeometry args={[2.1, 0.85, 0.14]} />
        <meshStandardMaterial color="#6c452c" roughness={0.8} />
      </mesh>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} castShadow position={[x, 0.32, 0]}>
          <boxGeometry args={[0.14, 0.65, 0.14]} />
          <meshStandardMaterial color="#25292d" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Car({ position, rotation = 0, color = "#8d3e38" }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.65, 0]}>
        <boxGeometry args={[3.4, 0.75, 1.55]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0.1, 1.12, 0]}>
        <boxGeometry args={[1.75, 0.62, 1.35]} />
        <meshStandardMaterial color="#202a31" roughness={0.25} metalness={0.2} />
      </mesh>
      {[[-1.15, 0.3], [1.15, 0.3]].map(([x, z]) => (
        <group key={x} position={[x, 0.18, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.31, 0.31, 0.18, 16]} />
            <meshStandardMaterial color="#111318" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {[[-1.15, -0.65], [1.15, -0.65]].map(([x, z]) => (
        <group key={x} position={[x, 0.18, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.31, 0.31, 0.18, 16]} />
            <meshStandardMaterial color="#111318" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Building({ position, color, accent, name, onClick }) {
  return (
    <group position={position} onClick={onClick}>
      <mesh castShadow position={[0, 2.2, 0]}>
        <boxGeometry args={[8, 4.4, 6.8]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      <mesh castShadow position={[0, 4.7, 0]}>
        <boxGeometry args={[8.25, 0.45, 7.05]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 3.1, 3.5]}>
        <boxGeometry args={[6.7, 1.15, 0.12]} />
        <meshStandardMaterial color="#171a1e" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.15, 3.54]}>
        <boxGeometry args={[1.5, 2.3, 0.16]} />
        <meshStandardMaterial color="#090b0e" />
      </mesh>
      <mesh position={[-2.3, 1.55, 3.56]}>
        <boxGeometry args={[1.5, 1.65, 0.12]} />
        <meshStandardMaterial color="#30434a" metalness={0.15} roughness={0.2} />
      </mesh>
      <mesh position={[2.3, 1.55, 3.56]}>
        <boxGeometry args={[1.5, 1.65, 0.12]} />
        <meshStandardMaterial color="#30434a" metalness={0.15} roughness={0.2} />
      </mesh>
      <mesh castShadow position={[0, 3.25, 3.7]}>
        <boxGeometry args={[7.05, 0.15, 0.1]} />
        <meshStandardMaterial color="#e6c76d" emissive="#b28c35" emissiveIntensity={0.2} />
      </mesh>
      <Text position={[0, 5.65, 0]} fontSize={0.7} color="#f3d67f" anchorX="center" outlineWidth={0.025} outlineColor="#08090b">
        {name}
      </Text>
    </group>
  );
}

function Hair({ style = 0 }) {
  if (style === 1) return <mesh castShadow position={[0, 2.58, 0]}><sphereGeometry args={[0.61, 12, 8]} /><meshStandardMaterial color="#171313" roughness={0.9} /></mesh>;
  if (style === 2) return <mesh castShadow position={[0, 2.62, 0]}><coneGeometry args={[0.52, 0.62, 10]} /><meshStandardMaterial color="#201616" roughness={0.85} /></mesh>;
  return <mesh castShadow position={[0, 2.54, 0]}><sphereGeometry args={[0.59, 14, 10]} /><meshStandardMaterial color="#171313" roughness={0.9} /></mesh>;
}

function Character({ position, name, shirt, skin = skinTones[0], hair = 0, onClick, female = false, delay = 0 }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + delay;
    ref.current.position.y = Math.sin(t * 1.7) * 0.035;
    ref.current.rotation.y = Math.sin(t * 0.65) * 0.025;
  });

  return (
    <group ref={ref} position={position} onClick={onClick}>
      <group>
        <mesh castShadow position={[0, 1.25, 0]}>
          <capsuleGeometry args={[0.58, 0.92, 8, 16]} />
          <meshStandardMaterial color={shirt} roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0, 2.38, 0]}>
          <sphereGeometry args={[0.56, 20, 16]} />
          <meshStandardMaterial color={skin} roughness={0.8} />
        </mesh>
        <Hair style={hair} />
        <mesh position={[-0.2, 2.38, 0.5]}><sphereGeometry args={[0.055, 10, 10]} /><meshStandardMaterial color="#16100e" /></mesh>
        <mesh position={[0.2, 2.38, 0.5]}><sphereGeometry args={[0.055, 10, 10]} /><meshStandardMaterial color="#16100e" /></mesh>
        <mesh position={[0, 2.2, 0.52]}><sphereGeometry args={[0.055, 8, 8]} /><meshStandardMaterial color="#75432f" /></mesh>
        <mesh castShadow position={[-0.73, 1.25, 0]}><capsuleGeometry args={[0.15, 0.72, 6, 10]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
        <mesh castShadow position={[0.73, 1.25, 0]}><capsuleGeometry args={[0.15, 0.72, 6, 10]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
        <mesh castShadow position={[-0.28, 0.38, 0]}><capsuleGeometry args={[0.2, 0.75, 6, 10]} /><meshStandardMaterial color={female ? "#262a32" : "#1d222a"} roughness={0.8} /></mesh>
        <mesh castShadow position={[0.28, 0.38, 0]}><capsuleGeometry args={[0.2, 0.75, 6, 10]} /><meshStandardMaterial color={female ? "#262a32" : "#1d222a"} roughness={0.8} /></mesh>
        <mesh castShadow position={[-0.28, -0.08, 0.12]}><sphereGeometry args={[0.25, 12, 8]} /><meshStandardMaterial color="#111318" roughness={0.7} /></mesh>
        <mesh castShadow position={[0.28, -0.08, 0.12]}><sphereGeometry args={[0.25, 12, 8]} /><meshStandardMaterial color="#111318" roughness={0.7} /></mesh>
      </group>
      <Text position={[0, 3.25, 0]} fontSize={0.32} color="#ffffff" anchorX="center" outlineWidth={0.012} outlineColor="#101216">{name}</Text>
    </group>
  );
}

function Town({ onShop, onDarts }) {
  return (
    <>
      <ambientLight intensity={1.05} />
      <directionalLight castShadow position={[12, 18, 10]} intensity={2.7} shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[0, 7, 4]} intensity={10} distance={20} color="#f0c76c" />
      <Environment preset="city" />
      <fog attach="fog" args={["#11151b", 28, 82]} />
      <Ground />

      <Building position={[-13, 0, -11]} color="#7d4034" accent="#c95f55" name="LUCKY SHOP" onClick={onShop} />
      <Building position={[13, 0, -11]} color="#255c77" accent="#4b9fc4" name="POOL HOUSE" />
      <Building position={[-13, 0, 12]} color="#503e72" accent="#8d67c4" name="ARCADE" />
      <Building position={[13, 0, 12]} color="#754b2e" accent="#c48752" name="DARTS BAR" onClick={onDarts} />

      <Lamp position={[-6.8, 0, -3]} /><Lamp position={[6.8, 0, -3]} />
      <Lamp position={[-6.8, 0, 7]} /><Lamp position={[6.8, 0, 7]} />
      <Tree position={[-10, 0, -2]} scale={0.85} /><Tree position={[10, 0, 2]} scale={0.75} />
      <Tree position={[-10, 0, 8]} scale={0.7} /><Tree position={[10, 0, -8]} scale={0.85} />
      <Bench position={[-7.9, 0, 2.2]} rotation={Math.PI / 2} />
      <Bench position={[7.9, 0, -2.2]} rotation={-Math.PI / 2} />
      <Car position={[-8.2, 0, -6.8]} rotation={Math.PI / 2} color="#8d3e38" />
      <Car position={[8.2, 0, 6.8]} rotation={-Math.PI / 2} color="#35627a" />

      <Character position={[0, 0, 7]} name="YOU" shirt="#d7a92e" skin="#8b5a3c" hair={1} delay={0} />
      <Character position={[-4, 0, 4]} name="KAY" shirt="#3d76a8" skin="#a96f4f" hair={0} onClick={onDarts} delay={1.2} />
      <Character position={[4, 0, 3]} name="MUSA" shirt="#9b4c8f" skin="#6f422f" hair={2} delay={2.4} />
      <Character position={[0, 0, -4]} name="ZEE" shirt="#3f8a73" skin="#c28762" hair={1} female delay={3.6} />

      <ContactShadows position={[0, 0.03, 0]} opacity={0.42} scale={58} blur={2.5} far={18} />
    </>
  );
}

function App() {
  const [balance, setBalance] = useState(10000);
  const [modal, setModal] = useState(null);
  const [stake, setStake] = useState(1000);
  const [message, setMessage] = useState("Free roam");
  const [locked, setLocked] = useState(false);

  const openDuel = () => { setMessage("Darts Duel available"); setModal("duel"); };
  const confirmDuel = () => {
    const amount = Math.max(100, Math.floor(Number(stake) || 0));
    if (amount > balance) { setMessage("Insufficient BET"); return; }
    setBalance((b) => b - amount); setLocked(true); setModal("playing"); setMessage("Duel started");
  };
  const settle = (win) => {
    const amount = Math.max(100, Math.floor(Number(stake) || 0));
    if (win) setBalance((b) => b + Math.floor(amount * 1.9));
    setLocked(false); setModal(null); setMessage(win ? "You won the duel" : "You lost the duel");
  };

  return (
    <div className="app">
      <div className="scene">
        <Canvas shadows dpr={[1, 1.75]} camera={{ position: [17, 9, 18], fov: 50 }} gl={{ antialias: true }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.12; }}>
          <color attach="background" args={["#070a0e"]} />
          <Town onShop={() => { setMessage("Lucky Shop"); setModal("info"); }} onDarts={openDuel} />
          <OrbitControls enablePan={false} minDistance={10} maxDistance={42} maxPolarAngle={Math.PI / 2.12} minPolarAngle={0.72} target={[0, 1.2, 1]} />
        </Canvas>
      </div>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">B</span><div><strong>BET CITY</strong><small>THE WAGER TOWN</small></div></div>
        <div className="wallet"><span>BET</span><strong>{balance.toLocaleString()}</strong></div>
      </header>
      <div className="status-pill"><i className={locked ? "live" : ""} />{message}</div>
      <div className="bottom-ui">
        <button className="glass-btn" onClick={() => setModal("map")}>TOWN MAP</button>
        <button className="primary-btn" onClick={openDuel}>CHALLENGE KAY</button>
      </div>

      {modal === "duel" && <div className="modal-backdrop"><div className="modal">
        <div className="modal-kicker">DARTS DUEL</div><h2>Challenge KAY</h2><p>Stake virtual BET and compete for the pot.</p>
        <label>YOUR STAKE</label><div className="stake-row"><input value={stake} type="number" min="100" step="100" onChange={(e) => setStake(e.target.value)} /><span>BET</span></div>
        <div className="modal-actions"><button className="glass-btn" onClick={() => setModal(null)}>CANCEL</button><button className="primary-btn" onClick={confirmDuel}>START DUEL</button></div>
      </div></div>}

      {modal === "playing" && <div className="modal-backdrop"><div className="modal compact">
        <div className="modal-kicker">LIVE DUEL</div><h2>Darts Arena</h2><p>Prototype settlement controls.</p>
        <div className="duel-score"><div><small>YOU</small><strong>—</strong></div><span>VS</span><div><small>KAY</small><strong>—</strong></div></div>
        <div className="modal-actions"><button className="glass-btn" onClick={() => settle(false)}>KAY WINS</button><button className="primary-btn" onClick={() => settle(true)}>YOU WIN</button></div>
      </div></div>}

      {modal === "info" && <div className="modal-backdrop"><div className="modal compact">
        <div className="modal-kicker">LUCKY SHOP</div><h2>Town Hub</h2><p>Players will meet here, browse games and join wagers.</p>
        <button className="primary-btn full" onClick={() => setModal(null)}>ENTER TOWN</button>
      </div></div>}

      {modal === "map" && <div className="modal-backdrop"><div className="modal compact">
        <div className="modal-kicker">TOWN MAP</div><h2>Bet City</h2>
        <div className="map-list"><span>01 <b>Lucky Shop</b></span><span>02 <b>Pool House</b></span><span>03 <b>Arcade</b></span><span>04 <b>Darts Bar</b></span></div>
        <button className="glass-btn full" onClick={() => setModal(null)}>CLOSE</button>
      </div></div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
