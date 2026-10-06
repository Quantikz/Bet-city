# Bet City realtime server

The server owns multiplayer presence, co-op camera hints, and television broadcast state. It does not handle real-money payments.

## Run

```bash
npm install
node server/index.js
```

Health: `/health`

Events:
- `player:move` position sync
- `tv:set` choose a channel and scope (`screen` or `city`)
- `tv:state` current city broadcast

## Production

Replace the in-memory Maps with PostgreSQL/Supabase transactions before persistent multiplayer or wagering. Every BET change should be an append-only ledger entry; never trust a client-provided balance.
