# Bet City

Browser-first 3D open-world social wagering prototype. Open it in Chrome. Termux has no window of its own.

Visuals are original Bet City geometry. This project does not use GTA V assets.

## Termux

Node 20 or newer is required.

```bash
pkg update
pkg install nodejs git
git clone https://github.com/Quantikz/Bet-city.git
cd Bet-city
rm -rf node_modules package-lock.json
npm install
npm run dev
```

Leave that running. On the same phone open Chrome and go to:

`http://127.0.0.1:5173`

The realtime server is optional. The city still loads if it is off.

```bash
npm run server
```

## Desktop

```bash
npm install
npm run dev
```

Virtual BET only. No real-money payment or cash-out.
