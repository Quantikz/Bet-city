# Bet City

Browser-first 3D open-world social wagering prototype.

Visuals are original Bet City assets and procedural geometry. This project does not use GTA V characters, maps, textures, vehicles, UI, or other copyrighted game content. The target is cinematic open-world quality, not a copy of another game.

## This graphics pass

- Dusk city with wet asphalt, lane markings, crosswalks, lamps, palms, bins, benches and a bus shelter
- Detailed houses with balconies, roofs, garage doors and lit windows
- Storefront shops with awnings, neon signs and interior glow
- Original cars: sedan, SUV and coupe, with glass, plates, spinning wheels and headlights
- Original citizens with jackets, hair and shoes. Not likenesses from any shipped game
- Selectable cameras: follow, shoulder, hood, cinematic, co-op
- Selectable television channels, and a choosable scope: this screen only, or city broadcast synced through the realtime server

## Controls

- WASD / arrows: move
- Shift or RUN: sprint
- Top selectors: camera, TV channel, broadcast scope
- PHONE: television panel
- FIGHT / CHALLENGE KAY: virtual BET darts duel

## Run

```bash
npm install
npm run dev -- --host 0.0.0.0
npm run server
```

The client talks to `http://localhost:3001` for co-op presence and city TV broadcast. If the server is down, the city still runs locally.

Virtual BET only. No real-money payment, cash-out, or token marketplace.
