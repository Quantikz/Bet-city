# Bet City — Godot Migration

Bet City is moving from the experimental React/Three.js prototype to a Godot 4 open-world foundation.

## Foundation

Upstream foundation: alexbieber/GTA-mini (Night Drop).

- Godot 4 project
- Third-person movement/camera
- Vehicle enter/exit
- Road-graph traffic
- Pedestrians
- Collision/physics
- Radar/HUD
- Day/night rendering
- Mobile touch controls
- MIT code + CC0 asset policy as documented by upstream

We will not copy Rockstar/GTA assets, maps, names, characters, missions, or code.

## Bet City conversion

Remove:
- weapons
- crime missions
- wanted/heat system
- police gameplay
- criminal progression

Keep and rework:
- player controller
- third-person camera
- vehicle controller
- traffic graph
- pedestrian system
- city streaming/world structure
- mobile controls
- rendering/day-night pipeline
- HUD/radar foundation

Add:
- BET wallet
- authoritative match service
- player-to-player challenges
- Darts Duel
- Lucky Shop
- betting locations
- match state machine
- transaction ledger
- multiplayer presence
- original Bet City art direction

## First playable target

Spawn in a small original town.

Player can:
1. Walk/run around freely.
2. See pedestrians and traffic.
3. Enter/exit a vehicle.
4. Open the Bet City HUD.
5. Walk into Lucky Shop.
6. See a Darts Duel terminal.
7. Challenge another player.
8. Stake test BET.
9. Play the darts match.
10. Server settles the result.

Real-money payments and cash-out are deliberately excluded from this first build.
