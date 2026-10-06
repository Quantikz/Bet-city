# Bet City

Browser-first 3D open-world social wagering game prototype.

## Current visual target

The game is being developed toward a cinematic AAA open-world visual language with original Bet City assets. It is not using GTA V assets, characters, maps, textures, or other copyrighted game content.

## Current 15-step development pass

1. Rebuilt the town as a larger open-world street grid.
2. Added third-person follow camera.
3. Added WASD/arrow movement.
4. Added mobile virtual joystick movement.
5. Added sprint/run input.
6. Rebuilt the player/NPC bodies with separate head, neck, torso, arms, legs, hands and shoes.
7. Added procedural walking/idle animation.
8. Added a distant high-rise skyline with window grids.
9. Added residential houses with roofs, doors and windows.
10. Added moving traffic vehicles.
11. Added traffic lights, crosswalks and road markings.
12. Added palm-lined streets, lamps and urban props.
13. Added betting billboards and stronger venue presentation.
14. Added cinematic tone mapping, fog, shadows, HDR environment lighting and vignette.
15. Added a game-style HUD with minimap, quest panel, actions, wallet and mobile controls.

## Controls

Desktop:
- WASD / Arrow keys: move
- Shift: sprint
- Click NPCs/venues: interact

Mobile:
- Left joystick: move
- RUN: sprint
- FIGHT: open Darts Duel
- MAP: open city map

## Run

```bash
npm install
npm run dev -- --host 0.0.0.0
```

This build uses virtual BET only. No real-money payment, cash-out, or unofficial token marketplace is implemented.

## Next AAA asset phase

The procedural geometry is intentionally a fallback. Reaching genuinely near-AAA visual quality requires original optimized GLB/GLTF assets for the hero character, NPCs, vehicles, houses, shops, street furniture and vegetation, plus PBR texture sets, animation clips, LODs, compressed textures and baked/real-time lighting. Those assets must be original or properly licensed; the target is GTA-like visual quality, not copied GTA content.
