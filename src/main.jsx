import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Float, Text, Environment } from "@react-three/drei";
import * as THREE from "three";
import "./style.css";

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#171b22" />
      </mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 70]} />
        <meshStandardMaterial color="#262b34" />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 10]} />
        <meshStandardMaterial color="#262b34" />
      </mesh>
      {[-5, 5].map((x) => (
        <mesh key={x} position={[x, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, 70]} />
          <meshBasicMaterial color="#d4b35f" />
        </mesh>
      ))}
    </group>
  );
}

function Building({ position, color, name, onClick }) {
  return (
    <group position={position} onClick={onClick}>
      <mesh castShadow position={[0, 2.1, 0]}>
        <boxGeometry args={[8, 4.2, 7]} />
        <meshStandardMaterial color={color} roughness={0.72} />
      </mesh>
      <mesh castShadow position={[0, 4.35, 0]}>
        <coneGeometry args={[5.1, 1.6, 4]} />
        <meshStandardMaterial color="#0d1016" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.15, 3.53]}>
        <boxGeometry args={[1.55, 2.3, 0.12]} />
        <meshStandardMaterial color="#080a0e" />
      </mesh>
      <Text
        position={[0, 5.4, 0]}
        fontSize={0.72}
        color="#f5d477"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.025}
        outlineColor="#08090d"
      >
        {name}
      </Text>
    </group>
  );
}

function Character({ position, name, color, onClick }) {
  return (
    <group position={position} onClick={onClick}>
      <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.12}>
        <mesh castShadow position={[0, 1.05, 0]}>
          <capsuleGeometry args={[0.48, 1.05, 6, 12]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 2.05, 0]}>
          <icosahedronGeometry args={[0.58, 2]} />
          <meshStandardMaterial color="#a96f4f" roughness={0.7} />
        </mesh>
        <mesh position={[-0.18, 2.12, 0.49]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshBasicMaterial color="#111318" />
        </mesh>
        <mesh position={[0.18, 2.12, 0.49]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshBasicMaterial color="#111318" />
        </mesh>
      </Float>
      <Text position={[0, 2.85, 0]} fontSize={0.32} color="#ffffff" anchorX="center">
        {name}
      </Text>
    </group>
  );
}

function Town({ onShop, onDarts }) {
  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight
        castShadow
        position={[8, 15, 10]}
        intensity={2.2}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <Environment preset="city" />
      <Ground />

      <Building position={[-13, 0, -11]} color="#713b2f" name="LUCKY SHOP" onClick={onShop} />
      <Building position={[13, 0, -11]} color="#244f68" name="POOL HOUSE" />
      <Building position={[-13, 0, 12]} color="#553b75" name="ARCADE" />
      <Building position={[13, 0, 12]} color="#68482d" name="DARTS BAR" onClick={onDarts} />

      <Character position={[0, 0, 7]} name="YOU" color="#d1a647" />
      <Character position={[-4, 0, 4]} name="KAY" color="#476f9f" />
      <Character position={[4, 0, 3]} name="MUSA" color="#7e4c89" />
      <Character position={[0, 0, -4]} name="ZEE" color="#3f806c" />
    </>
  );
}

function App() {
  const [balance, setBalance] = useState(10000);
  const [modal, setModal] = useState(null);
  const [stake, setStake] = useState(1000);
  const [message, setMessage] = useState("Free roam");
  const [locked, setLocked] = useState(false);

  const openDuel = () => {
    setMessage("Darts Duel available");
    setModal("duel");
  };

  const confirmDuel = () => {
    const amount = Math.max(100, Math.floor(Number(stake) || 0));
    if (amount > balance) {
      setMessage("Insufficient BET");
      return;
    }
    setBalance((b) => b - amount);
    setLocked(true);
    setModal("playing");
    setMessage("Duel started");
  };

  const settle = (win) => {
    const amount = Math.max(100, Math.floor(Number(stake) || 0));
    if (win) setBalance((b) => b + Math.floor(amount * 1.9));
    setLocked(false);
    setModal(null);
    setMessage(win ? "You won the duel" : "You lost the duel");
  };

  return (
    <div className="app">
      <div className="scene">
        <Canvas
          shadows
          camera={{ position: [24, 22, 28], fov: 45 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={["#080b10"]} />
          <Town onShop={() => { setMessage("Lucky Shop"); setModal("info"); }} onDarts={openDuel} />
          <OrbitControls
            enablePan={false}
            minDistance={14}
            maxDistance={52}
            maxPolarAngle={Math.PI / 2.08}
          />
        </Canvas>
      </div>

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">B</span>
          <div>
            <strong>BET CITY</strong>
            <small>THE WAGER TOWN</small>
          </div>
        </div>
        <div className="wallet">
          <span>BET</span>
          <strong>{balance.toLocaleString()}</strong>
        </div>
      </header>

      <div className="status-pill">
        <i className={locked ? "live" : ""} />
        {message}
      </div>

      <div className="bottom-ui">
        <button className="glass-btn" onClick={() => setModal("map")}>TOWN MAP</button>
        <button className="primary-btn" onClick={openDuel}>CHALLENGE KAY</button>
      </div>

      {modal === "duel" && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-kicker">DARTS DUEL</div>
            <h2>Challenge KAY</h2>
            <p>Stake virtual BET and compete for the pot.</p>
            <label>YOUR STAKE</label>
            <div className="stake-row">
              <input
                value={stake}
                type="number"
                min="100"
                step="100"
                onChange={(e) => setStake(e.target.value)}
              />
              <span>BET</span>
            </div>
            <div className="modal-actions">
              <button className="glass-btn" onClick={() => setModal(null)}>CANCEL</button>
              <button className="primary-btn" onClick={confirmDuel}>START DUEL</button>
            </div>
          </div>
        </div>
      )}

      {modal === "playing" && (
        <div className="modal-backdrop">
          <div className="modal compact">
            <div className="modal-kicker">LIVE DUEL</div>
            <h2>Darts Arena</h2>
            <p>Prototype settlement controls.</p>
            <div className="duel-score">
              <div><small>YOU</small><strong>—</strong></div>
              <span>VS</span>
              <div><small>KAY</small><strong>—</strong></div>
            </div>
            <div className="modal-actions">
              <button className="glass-btn" onClick={() => settle(false)}>KAY WINS</button>
              <button className="primary-btn" onClick={() => settle(true)}>YOU WIN</button>
            </div>
          </div>
        </div>
      )}

      {modal === "info" && (
        <div className="modal-backdrop">
          <div className="modal compact">
            <div className="modal-kicker">LUCKY SHOP</div>
            <h2>Town Hub</h2>
            <p>Players will meet here, browse games and join wagers.</p>
            <button className="primary-btn full" onClick={() => setModal(null)}>ENTER TOWN</button>
          </div>
        </div>
      )}

      {modal === "map" && (
        <div className="modal-backdrop">
          <div className="modal compact">
            <div className="modal-kicker">TOWN MAP</div>
            <h2>Bet City</h2>
            <div className="map-list">
              <span>01 <b>Lucky Shop</b></span>
              <span>02 <b>Pool House</b></span>
              <span>03 <b>Arcade</b></span>
              <span>04 <b>Darts Bar</b></span>
            </div>
            <button className="glass-btn full" onClick={() => setModal(null)}>CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
