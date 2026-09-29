# Vyrnox Multiplayer Server (Railway)

## Deploy on Railway (phone or PC)

1. Create account at https://railway.app (login with GitHub).
2. **New Project** → **Deploy from GitHub repo**.
3. Use a repo that contains this `server/` folder, **or** upload only these files:
   - `server.js`
   - `package.json`
4. Set **Root Directory** to `server` if the repo is the full engine.
5. Railway sets `PORT` automatically — do not hardcode it.
6. After deploy, open the service → **Settings** → **Networking** → **Generate Domain**.
7. Your WebSocket URL is:

   ```text
   wss://YOUR-APP.up.railway.app
   ```

   (use **wss://**, not ws://)

8. In Vyrnox editor → Multiplayer lobby → **Server URL** paste that `wss://…` address.
9. Host on one device, Join with the same room code on another.

## Test health

Open in browser: `https://YOUR-APP.up.railway.app/health`  
Should show `{"ok":true,...}`.

## Local

```bash
cd server
npm install
npm start
```
