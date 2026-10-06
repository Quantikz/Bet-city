import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Environment, ContactShadows } from "@react-three/drei";
import "./style.css";

const skinTones = ["#8b5a3c", "#a96f4f", "#6f422f", "#c28762"];

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#171b20" roughness={1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 80]} />
        <meshStandardMaterial color="#343b45" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 12]} />
        <meshStandardMaterial color="#343b45" roughness={0.9} />
      </mesh>
      {[-6, 6].map((x) => (
        <mesh key={x} position={[x, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.13, 80]} />
          <meshBasicMaterial color="#d8bb67" />
        </mesh>
      ))}
      {Array.from({ length: 15 }).map((_, i) => (
        <mesh key={i} position={[0, 0.04, -35 + i * 5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.1, 0.14]} />
          <meshBasicMaterial color="#d8bb67" />
        </mesh>
      ))}
    </group>
  );
}

function Lamp({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 4.8, 8]} />
        <meshStandardMaterial color="#171a1f" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 4.75, 0]}>
        <sphereGeometry args={[0.22, 12, 8]} />
        <meshStandardMaterial color="#f5d989" emissive="#f5c85a" emissiveIntensity={1.4} />
      </mesh>
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
      <mesh position={[0, 3.25, 3.46]}>
        <boxGeometry args={[6.6, 1.1, 0.08]} />
        <meshStandardMaterial color="#171a1e" />
      </mesh>
      <mesh position={[0, 1.15, 3.5]}>
        <boxGeometry args={[1.55, 2.3, 0.16]} />
        <meshStandardMaterial color="#090b0e" />
      </mesh>
      <mesh position={[-2.3, 1.55, 3.51]}>
        <boxGeometry args={[1.45, 1.65, 0.12]} />
        <meshStandardMaterial color="#23333a" metalness={0.15} roughness={0.25} />
      </mesh>
      <mesh position={[2.3, 1.55, 3.51]}>
        <boxGeometry args={[1.45, 1.65, 0.12]} />
        <meshStandardMaterial color="#23333a" metalness={0.15} roughness={0.25} />
      </mesh>
      <mesh position={[0, 3.25, 3.57]}>
        <boxGeometry args={[6.9, 0.12, 0.1]} />
        <meshStandardMaterial color="#e6c76d" />
      </mesh>
      <Text position={[0, 5.65, 0]} fontSize={0.7} color="#f3d67f" anchorX="center" outlineWidth={0.025} outlineColor="#08090b">
        {name}
      </Text>
    </group>
  );
}

function Hair({ style = 0 }) {
  if (style === 1) {
    return <mesh castShadow position={[0, 2.58, 0]}><sphereGeometry args={[0.61, 12, 8]} /><meshStandardMaterial color="#171313" roughness={0.9} /></mesh>;
  }
  if (style === 2) {
    return <mesh castShadow position={[0, 2.62, 0]}><coneGeometry args={[0.52, 0.62, 10]} /><meshStandardMaterial color="#201616" roughness={0.85} /></mesh>;
  }
  return (
    <mesh castShadow position={[0, 2.54, 0]}>
      <sphereGeometry args={[0.59, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
      <meshStandardMaterial color="#171313" roughness={0.9} />
    </mesh>
  );
}

function Character({ position, name, shirt, skin = skinTones[0], hair = 0, onClick, female = false }) {
  return (
    <group position={position} onClick={onClick}>
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
        <mesh position={[-0.2, 2.38, 0.5]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial color="#16100e" />
        </mesh>
        <mesh position={[0.2, 2.38, 0.5]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial color="#16100e" />
        </mesh>
        <mesh position={[0, 2.2, 0.52]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#75432f" />
        </mesh>
        <mesh castShadow position={[-0.73, 1.25, 0]}>
          <capsuleGeometry args={[0.15, 0.72, 6, 10]} />
          <meshStandardMaterial color={skin} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0.73, 1.25, 0]}>
          <capsuleGeometry args={[0.15, 0.72, 6, 10]} />
          <meshStandardMaterial color={skin} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[-0.28, 0.38, 0]}>
          <capsuleGeometry args={[0.2, 0.75, 6, 10]} />
          <meshStandardMaterial color={female ? "#262a32" : "#1d222a"} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0.28, 0.38, 0]}>
          <capsuleGeometry args={[0.2, 0.75, 6, 10]} />
          <meshStandardMaterial color={female ? "#262a32" : "#1d222a"} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[-0.28, -0.08, 0.12]}>
          <sphereGeometry args={[0.25, 12, 8]} />
          <meshStandardMaterial color="#111318" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0.28, -0.08, 0.12]}>
          <sphereGeometry args={[0.25, 12, 8]} />
          <meshStandardMaterial color="#111318" roughness={0.7} />
        </mesh>
      </group>
      <Text position={[0, 3.25, 0]} fontSize={0.32} color="#ffffff" anchorX="center" outlineWidth={0.012} outlineColor="#101216">
        {name}
      </Text>
    </group>
  );
}

function Town({ onShop, onDarts }) {
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight castShadow position={[12, 18, 10]} intensity={2.8} shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[0, 7, 4]} intensity={12} distance={18} color="#f0c76c" />
      <Environment preset="city" />
      <Ground />
      <Building position={[-13, 0, -11]} color="#7d4034" accent="#c95f55" name="LUCKY SHOP" onClick={onShop} />
      <Building position={[13, 0, -11]} color="#255c77" accent="#4b9fc4" name="POOL HOUSE" />
      <Building position={[-13, 0, 12]} color="#503e72" accent="#8d67c4" name="ARCADE" />
      <Building position={[13, 0, 12]} color="#754b2e" accent="#c48752" name="DARTS BAR" onClick={onDarts} />
      <Lamp position={[-6.8, 0, -3]} />
      <Lamp position={[6.8, 0, -3]} />
      <Lamp position={[-6.8, 0, 7]} />
      <Lamp position={[6.8, 0, 7]} />
      <Character position={[0, 0, 7]} name="YOU" shirt="#d7a92e" skin="#8b5a3c" hair={1} />
      <Character position={[-4, 0, 4]} name="KAY" shirt="#3d76a8" skin="#a96f4f" hair={0} onClick={onDarts} />
      <Character position={[4, 0, 3]} name="MUSA" shirt="#9b4c8f" skin="#6f422f" hair={2} />
      <Character position={[0, 0, -4]} name="ZEE" shirt="#3f8a73" skin="#c28762" hair={1} female />
      <ContactShadows position={[0, 0.03, 0]} opacity={0.42} scale={55} blur={2.5} far={15} />
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
        <Canvas shadows dpr={[1, 1.7]} camera={{ position: [24, 20, 29], fov: 43 }} gl={{ antialias: true }}>
          <color attach="background" args={["#070a0e"]} />
          <Town onShop={() => { setMessage("Lucky Shop"); setModal("info"); }} onDarts={openDuel} />
          <OrbitControls enablePan={false} minDistance={14} maxDistance={52} maxPolarAngle={Math.PI / 2.08} />
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
