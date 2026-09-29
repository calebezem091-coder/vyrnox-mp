/**
 * Vyrnox Multiplayer Room Server — Railway / LAN ready
 *
 * Railway: deploy this folder → use wss://YOUR-APP.up.railway.app
 * LAN:     npm start → ws://YOUR_LAN_IP:9080
 */
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { networkInterfaces } from 'os'

const PORT = Number(process.env.PORT) || 9080

/** @type {Map<string, import('ws').WebSocket & { meta?: any, isAlive?: boolean }>} */
const clients = new Map()
/** @type {Map<string, Set<string>>} */
const rooms = new Map()

const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        ok: true,
        service: 'vyrnox-mp',
        rooms: rooms.size,
        players: clients.size,
        time: new Date().toISOString(),
      })
    )
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Vyrnox MP — connect with WebSocket (wss:// on Railway)')
})

const wss = new WebSocketServer({ server: httpServer })

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj))
}

function broadcastRoom(room, obj, exceptId = null) {
  const members = rooms.get(room)
  if (!members) return
  const raw = JSON.stringify(obj)
  for (const id of members) {
    if (id === exceptId) continue
    const c = clients.get(id)
    if (c && c.readyState === 1) c.send(raw)
  }
}

function leaveRoom(playerId) {
  const ws = clients.get(playerId)
  if (!ws?.meta?.room) return
  const room = ws.meta.room
  const set = rooms.get(room)
  if (set) {
    set.delete(playerId)
    broadcastRoom(room, { type: 'leave', id: playerId })
    if (set.size === 0) rooms.delete(room)
  }
  ws.meta.room = null
}

wss.on('connection', (ws, req) => {
  let playerId = null
  ws.isAlive = true
  ws.on('pong', () => {
    ws.isAlive = true
  })

  console.log('[conn]', req.socket.remoteAddress)

  ws.on('message', (data) => {
    let msg
    try {
      msg = JSON.parse(String(data))
    } catch {
      return
    }

    if (msg.type === 'ping') {
      send(ws, { type: 'pong' })
      return
    }

    if (msg.type === 'join') {
      playerId = msg.id || `p_${Math.random().toString(36).slice(2, 9)}`
      const room = String(msg.room || 'DEFAULT').toUpperCase().slice(0, 12)
      const name = String(msg.name || 'Player').slice(0, 24)

      leaveRoom(playerId)
      ws.meta = { id: playerId, room, name, x: 0, y: 1.6, z: 0, ry: 0 }
      clients.set(playerId, ws)

      if (!rooms.has(room)) rooms.set(room, new Set())
      rooms.get(room).add(playerId)

      const others = []
      for (const id of rooms.get(room)) {
        if (id === playerId) continue
        const o = clients.get(id)?.meta
        if (o) others.push({ id, name: o.name, x: o.x, y: o.y, z: o.z, ry: o.ry })
      }

      send(ws, { type: 'welcome', id: playerId, room, others })
      broadcastRoom(
        room,
        { type: 'join', id: playerId, name, x: 0, y: 1.6, z: 0, ry: 0 },
        playerId
      )
      console.log(`[join] ${name} → ${room} (${rooms.get(room).size} in room)`)
      return
    }

    if (!playerId || !ws.meta) return

    if (msg.type === 'state') {
      ws.meta.x = msg.x ?? ws.meta.x
      ws.meta.y = msg.y ?? ws.meta.y
      ws.meta.z = msg.z ?? ws.meta.z
      ws.meta.ry = msg.ry ?? ws.meta.ry
      broadcastRoom(
        ws.meta.room,
        {
          type: 'state',
          id: playerId,
          name: ws.meta.name,
          x: ws.meta.x,
          y: ws.meta.y,
          z: ws.meta.z,
          ry: ws.meta.ry,
        },
        playerId
      )
      return
    }

    if (msg.type === 'event') {
      broadcastRoom(
        ws.meta.room,
        { type: 'event', id: playerId, event: msg.event, data: msg.data },
        playerId
      )
    }
  })

  ws.on('close', () => {
    if (playerId) {
      leaveRoom(playerId)
      clients.delete(playerId)
      console.log(`[leave] ${playerId}`)
    }
  })
})

// Heartbeat — drop dead connections
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate()
    ws.isAlive = false
    ws.ping()
  })
}, 30000)
wss.on('close', () => clearInterval(interval))

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Vyrnox Multiplayer Server`)
  console.log(`  ========================`)
  console.log(`  Port:    ${PORT}`)
  console.log(`  Local:   ws://127.0.0.1:${PORT}`)
  const nets = networkInterfaces()
  for (const name of Object.keys(nets || {})) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  LAN:     ws://${net.address}:${PORT}`)
      }
    }
  }
  console.log(`  Health:  /health`)
  console.log(`  Railway: wss://YOUR-APP.up.railway.app\n`)
})
