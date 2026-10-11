# GOATFUNDED Private Trading Compound

A fresh single-property 3D scene built with Three.js and Vite.

## Scene
- One GOATFUNDED trading station with a single-person trading desk and four chart displays.
- A separate gaming desk with gaming screen and RGB PC tower.
- One adjacent furnished house with living room, kitchen, dining area, bedroom and bathroom.
- One red Ferrari-inspired supercar parked in the forecourt.
- Perimeter wall and gate, paving, planting, patio, pool, and warm exterior lighting.
- Orbit/zoom controls, inspection focus, top-down view, day/evening lighting, and basic walk mode.

## Run locally
```bash
npm install
npm run dev -- --host 0.0.0.0
```

## Build
```bash
npm run build
```

## Important fidelity note
The scene is currently assembled from procedural Three.js geometry and materials. The car is a Ferrari-inspired procedural model, not a licensed Ferrari CAD/GLB model. The house/station furniture and interiors are visible geometry, not a full architectural BIM model. For production-grade realism, replace these with licensed, optimized GLB assets and test performance on target devices.
