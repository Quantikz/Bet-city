# Bet City asset pipeline

Place original or properly licensed optimized GLB/GLTF assets here.

Recommended structure:
- characters/player.glb
- characters/npc.glb
- vehicles/sedan.glb
- buildings/house.glb
- buildings/shop.glb
- props/*

Target pipeline:
Blender -> clean topology -> UVs -> PBR textures -> Draco/KTX2 compression -> LODs -> GLB.

The game currently falls back to procedural geometry when these assets are absent.
