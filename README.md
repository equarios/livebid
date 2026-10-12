# LiveBid

Demo B2B site for **live device auctions** and a **fixed-price marketplace**. Inspired by the flow of wholesale bidding platforms (member login, real-time lots, sealed bids, invoices) — original product, not a copy of AUCNET/GBS.

## Demo login

- Account ID: `DEMO-1001`
- Password: `livebid`

## Run

```bash
npm install
docker compose up -d          # Postgres + Redis + Silo (S3)
cp server/.env.example server/.env   # first time
npm --prefix server run db:reset
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). API health: http://localhost:8787/api/health  
See `server/README.md` for logins, smoke scripts, and scale-stack notes.
