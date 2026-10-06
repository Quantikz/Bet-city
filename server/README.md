# Bet City realtime server

The server owns multiplayer state. It does not handle real-money payments.

## Run

`npm install`
`node server/index.js`

Health: `/health`

## Production

Replace the in-memory Maps with PostgreSQL/Supabase transactions before persistent multiplayer or wagering. Every BET change should be an append-only ledger entry; never trust a client-provided balance.
