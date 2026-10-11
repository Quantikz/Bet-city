# AFEC 3D World

A standalone experimental 3D town project inside this repository. This directory is isolated from the existing Bet City app so the original project files remain untouched.

## Run in Termux

From the repository root:

```bash
cd 3d-world
npm install
npm run dev -- --host 0.0.0.0
```

Open the local URL Vite prints, usually `http://localhost:5173/` (if the port is already occupied, Vite may choose another port).

## Current status

This is a procedural Three.js prototype with third-person movement, a basic vehicle preview, touch controls, and a drag-to-look camera. It does not yet contain exported ThreeJS Assets Studio models or the full GTA7 vehicle physics implementation. Those should be integrated in this folder as separate, tested steps.