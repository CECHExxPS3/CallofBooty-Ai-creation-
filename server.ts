import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, limit } from "firebase/firestore";

const PORT = 3000;
const HOST = "0.0.0.0";

// Initialize Firestore DB using Web SDK for server API routes
let adminDb: any = null;
try {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const app = initializeApp(firebaseConfig, "adminServerApp");
    adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log("[ADMIN SERVER] Firebase Web Firestore initialized successfully.");
  }
} catch (e) {
  console.warn("[ADMIN SERVER] Notice on Firebase Web SDK initialization:", e);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // ADMIN API ROUTES
  app.get("/api/admin/users", async (req, res) => {
    try {
      if (!adminDb) {
        return res.status(500).json({ error: "Admin database not ready" });
      }
      const q = query(collection(adminDb, "users"), orderBy("createdAt", "desc"), limit(100));
      const snapshot = await getDocs(q);
      const users: any[] = [];
      snapshot.forEach((docSnap) => {
        users.push({ id: docSnap.id, ...docSnap.data() });
      });
      res.json({ users });
    } catch (err: any) {
      console.error("[ADMIN API] Error listing users:", err);
      res.status(500).json({ error: err.message || "Failed to list users" });
    }
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const updates = req.body || {};
      if (!adminDb) {
        return res.status(500).json({ error: "Admin database not ready" });
      }
      await setDoc(doc(adminDb, "users", userId), updates, { merge: true });

      // If user was banned or temp banned, kick them from active WebSocket rooms
      if (updates.isBanned || updates.banUntil) {
        wss.clients.forEach((client: any) => {
          if (client.readyState === WebSocket.OPEN && (client.clientId === userId || client.userId === userId)) {
            client.send(JSON.stringify({
              type: "chat_message",
              payload: { senderName: "SYSTEM", message: "YOUR ACCOUNT HAS BEEN BANNED BY AN ADMIN." }
            }));
            client.close();
          }
        });
      }

      res.json({ success: true, userId, updates });
    } catch (err: any) {
      console.error("[ADMIN API] Error updating user:", err);
      res.status(500).json({ error: err.message || "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      if (!adminDb) {
        return res.status(500).json({ error: "Admin database not ready" });
      }
      await deleteDoc(doc(adminDb, "users", userId));

      // Disconnect client if online
      wss.clients.forEach((client: any) => {
        if (client.readyState === WebSocket.OPEN && (client.clientId === userId || client.userId === userId)) {
          client.close();
        }
      });

      res.json({ success: true, userId });
    } catch (err: any) {
      console.error("[ADMIN API] Error deleting user:", err);
      res.status(500).json({ error: err.message || "Failed to delete user" });
    }
  });

  // Create HTTP server first to attach WebSockets to it
  const server = app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });

  // Attach WebSocket server to the same HTTP server
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    try {
      const host = request.headers.host || "localhost";
      const url = new URL(request.url || "/", `http://${host}`);
      if (url.pathname === "/ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      }
    } catch (err) {
      console.error("[MULTIPLAYER] Server upgrade error:", err);
    }
  });

  // In-memory real-time state with Room support
  interface PlayerState {
    id: string;
    roomCode: string;
    name: string;
    classId: string;
    isSpectator?: boolean;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    yaw: number;
    pitch: number;
    isFiring: boolean;
    isADS: boolean;
    isReloading: boolean;
    activeWeaponId: string;
    health: number;
    maxHealth: number;
    kills: number;
    deaths: number;
    score: number;
    ping: number;
    hacks?: any;
  }

  interface Room {
    code: string;
    name: string;
    hostId: string;
    mapId: string;
    scoreLimit: number;
    timeLimit: number;
    botCount: number;
    difficulty: string;
    players: Map<string, PlayerState>;
    matchTimeLeft: number;
    isMatchActive: boolean;
  }

  const rooms = new Map<string, Room>();

  function getOrCreateRoom(code: string, name?: string, hostId?: string): Room {
    let room = rooms.get(code);
    if (!room) {
      room = {
        code,
        name: name || `Room ${code}`,
        hostId: hostId || '',
        mapId: 'shipment',
        scoreLimit: 20,
        timeLimit: 300,
        botCount: 5,
        difficulty: 'MEDIUM',
        players: new Map(),
        matchTimeLeft: 300,
        isMatchActive: true,
      };
      rooms.set(code, room);
    }
    return room;
  }

  // HTTP endpoint for active rooms strictly returning real lobbies currently being played
  app.get("/api/rooms", (req, res) => {
    // Purge any rooms that have zero active human players
    for (const [code, r] of rooms.entries()) {
      if (r.players.size === 0) {
        rooms.delete(code);
      }
    }

    const list = Array.from(rooms.values())
      .filter(r => r.players.size > 0 && r.isMatchActive)
      .map(r => ({
        code: r.code,
        name: r.name,
        hostId: r.hostId,
        mapId: r.mapId,
        playerCount: r.players.size,
        botCount: r.botCount || 0,
        scoreLimit: r.scoreLimit,
        timeLimit: r.timeLimit,
        difficulty: r.difficulty || 'MEDIUM',
        isMatchActive: r.isMatchActive
      }));
    res.json({ rooms: list });
  });

  app.post("/api/rooms/update", (req, res) => {
    const { roomCode, mapId, scoreLimit, timeLimit, botCount, difficulty, roomName } = req.body || {};
    const target = (roomCode || 'MAIN').toUpperCase();
    let room = rooms.get(target);
    if (!room) {
      room = getOrCreateRoom(target, roomName || `Room ${target}`);
      rooms.set(target, room);
    }
    if (mapId) room.mapId = mapId;
    if (scoreLimit !== undefined) room.scoreLimit = scoreLimit;
    if (timeLimit !== undefined) {
      room.timeLimit = timeLimit;
      room.matchTimeLeft = timeLimit;
    }
    if (botCount !== undefined) room.botCount = botCount;
    if (difficulty) room.difficulty = difficulty;
    if (roomName) room.name = roomName;

    wss.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN && client.roomCode === target) {
        client.send(JSON.stringify({
          type: "room_settings_updated",
          payload: {
            mapId: room.mapId,
            scoreLimit: room.scoreLimit,
            timeLimit: room.timeLimit,
            botCount: room.botCount,
            difficulty: room.difficulty,
          }
        }));
      }
    });

    res.json({ success: true, room: { code: room.code, mapId: room.mapId, botCount: room.botCount, difficulty: room.difficulty, scoreLimit: room.scoreLimit, timeLimit: room.timeLimit } });
  });

  // Broadcaster function helper for a specific room
  const broadcastToRoom = (roomCode: string, data: any, excludeClientId?: string) => {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      const clientWs = client as any;
      if (client.readyState === WebSocket.OPEN && clientWs.roomCode === roomCode) {
        if (excludeClientId && clientWs.clientId === excludeClientId) return;
        client.send(message);
      }
    });
  };

  wss.on("connection", (ws: any) => {
    const clientId = `player_${Math.random().toString(36).substr(2, 9)}`;
    ws.clientId = clientId;
    ws.roomCode = 'MAIN';

    console.log(`New multiplayer client connected: ${clientId}`);

    ws.on("message", (messageStr: string) => {
      try {
        const data = JSON.parse(messageStr);
        const { type, payload } = data;

        switch (type) {
          case "list_rooms": {
            // Clean up empty rooms
            for (const [code, r] of rooms.entries()) {
              if (r.players.size === 0) {
                rooms.delete(code);
              }
            }
            const list = Array.from(rooms.values())
              .filter(r => r.players.size > 0 && r.isMatchActive)
              .map(r => ({
                code: r.code,
                name: r.name,
                mapId: r.mapId,
                playerCount: r.players.size,
                scoreLimit: r.scoreLimit,
                timeLimit: r.timeLimit,
              }));
            ws.send(JSON.stringify({ type: "rooms_list", payload: list }));
            break;
          }

          case "create_room": {
            const code = (payload.code || Math.random().toString(36).substr(2, 5)).toUpperCase();
            const room = getOrCreateRoom(code, payload.name || `Custom Room ${code}`, clientId);
            room.hostId = clientId;
            room.mapId = payload.mapId || 'shipment';
            room.scoreLimit = payload.scoreLimit || 20;
            room.timeLimit = payload.timeLimit || 300;
            room.botCount = payload.botCount !== undefined ? payload.botCount : 5;
            room.difficulty = payload.difficulty || 'MEDIUM';
            room.matchTimeLeft = room.timeLimit;

            ws.send(JSON.stringify({ type: "room_created", payload: { roomCode: code, isHost: true } }));
            break;
          }

          case "join": {
            const roomCode = (payload.roomCode || 'MAIN').toUpperCase();
            const room = getOrCreateRoom(roomCode);
            ws.roomCode = roomCode;

            const isFirstPlayer = room.players.size === 0;
            if (isFirstPlayer || clientId === room.hostId || !room.hostId) {
              room.hostId = clientId;
              if (payload.mapId) room.mapId = payload.mapId;
              if (payload.scoreLimit) room.scoreLimit = payload.scoreLimit;
              if (payload.timeLimit) {
                room.timeLimit = payload.timeLimit;
                room.matchTimeLeft = payload.timeLimit;
              }
              if (payload.botCount !== undefined) room.botCount = payload.botCount;
              if (payload.difficulty) room.difficulty = payload.difficulty;
              if (payload.roomName) room.name = payload.roomName;
            }

            const player: PlayerState = {
              id: clientId,
              roomCode,
              name: payload.name || "Soldier",
              classId: payload.classId || "assault",
              isSpectator: payload.isSpectator || false,
              x: payload.x || 0,
              y: payload.y || 1.5,
              z: payload.z || 0,
              vx: 0,
              vy: 0,
              vz: 0,
              yaw: payload.yaw || 0,
              pitch: payload.pitch || 0,
              isFiring: false,
              isADS: false,
              isReloading: false,
              activeWeaponId: payload.activeWeaponId || "m4_assault",
              health: payload.health || 100,
              maxHealth: payload.maxHealth || 100,
              kills: 0,
              deaths: 0,
              score: 0,
              ping: payload.ping || 5,
            };

            room.players.set(clientId, player);

            // Send initial setup to joiner
            ws.send(
              JSON.stringify({
                type: "init",
                payload: {
                  clientId,
                  roomCode,
                  roomName: room.name,
                  players: Array.from(room.players.values()),
                  isHost: clientId === room.hostId,
                  matchTimeLeft: room.matchTimeLeft,
                  scoreLimit: room.scoreLimit,
                  mapId: room.mapId,
                  botCount: room.botCount,
                  difficulty: room.difficulty,
                  timeLimit: room.timeLimit,
                },
              })
            );

            // Broadcast join to room
            broadcastToRoom(
              roomCode,
              {
                type: "player_joined",
                payload: player,
              },
              clientId
            );
            break;
          }

          case "update": {
            const roomCode = ws.roomCode || 'MAIN';
            const room = rooms.get(roomCode);
            if (room) {
              const player = room.players.get(clientId);
              if (player) {
                Object.assign(player, payload);
                broadcastToRoom(
                  roomCode,
                  {
                    type: "player_updated",
                    payload: player,
                  },
                  clientId
                );
              }
            }
            break;
          }

          case "shoot": {
            const roomCode = ws.roomCode || 'MAIN';
            broadcastToRoom(
              roomCode,
              {
                type: "player_shot",
                payload: {
                  playerId: clientId,
                  ...payload,
                },
              },
              clientId
            );
            break;
          }

          case "admin_cheat": {
            const roomCode = ws.roomCode || "MAIN";
            const room = rooms.get(roomCode);
            if (room && payload.targetId && room.players.has(payload.targetId)) {
               room.players.get(payload.targetId).hacks = payload.hacks;
            }
            broadcastToRoom(roomCode, {
              type: "admin_cheat",
              payload: {
                targetId: payload.targetId,
                hacks: payload.hacks
              }
            });
            break;
          }
          case "hit": {
            const roomCode = ws.roomCode || "MAIN";
            const room = rooms.get(roomCode);
            const { targetId, damage, isHeadshot, weaponName, isNoscope } = payload;
            
            if (room && room.players.has(targetId)) {
              const target = room.players.get(targetId)!;
              
              // Ignore damage if target has godMode
              if (target.hacks && target.hacks.godMode) break;
              
              // Do not process damage or kills if target is already dead
              if (target.health <= 0) break;

              const wasAlive = target.health > 0;
              target.health = Math.max(0, target.health - damage);
              
              broadcastToRoom(roomCode, {
                type: "player_damaged",
                payload: {
                  targetId,
                  damage,
                  health: target.health,
                  attackerId: clientId,
                }
              });

              if (wasAlive && target.health <= 0) {
                target.deaths += 1;
                const attacker = room.players.get(clientId);
                if (attacker) {
                  attacker.kills += 1;
                  attacker.score += isHeadshot ? 150 : 100;
                }

                broadcastToRoom(roomCode, {
                  type: "player_killed",
                  payload: {
                    isNoscope,
                    killer: {
                      id: clientId,
                      name: attacker ? attacker.name : "Unknown",
                      classId: attacker ? attacker.classId : "assault",
                      isBot: false,
                    },
                    victim: {
                      id: targetId,
                      name: target.name,
                      classId: target.classId,
                      isBot: false,
                    },
                    weaponName,
                    isHeadshot,
                  }
                });

                const winningKills = attacker ? attacker.kills : 0;
                if (winningKills >= room.scoreLimit) {
                  room.isMatchActive = false;
                  const playerList = Array.from(room.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    classId: p.classId,
                    kills: p.kills,
                    deaths: p.deaths,
                    score: p.score,
                    health: p.health,
                  }));
                  broadcastToRoom(roomCode, {
                    type: "match_ended",
                    payload: {
                      winnerName: attacker ? attacker.name : "Soldier",
                      players: playerList,
                      reason: "score_limit"
                    }
                  });
                }
              }
            }
            break;
          }

          case "respawn": {
            const roomCode = ws.roomCode || 'MAIN';
            const room = rooms.get(roomCode);
            if (room) {
              const player = room.players.get(clientId);
              if (player) {
                player.health = player.maxHealth || 100;
                player.x = payload.x || 0;
                player.y = payload.y || 1.5;
                player.z = payload.z || 0;
                broadcastToRoom(roomCode, {
                  type: "player_respawned",
                  payload: {
                    id: clientId,
                    health: player.health,
                    x: player.x,
                    y: player.y,
                    z: player.z
                  }
                });
              }
            }
            break;
          }

          case "bot_death_sync": {
            const roomCode = ws.roomCode || 'MAIN';
            const { killerId, killerName, killerIsBot, victimName, victimClassId, weaponName, isHeadshot, isNoscope } = payload || {};
            const room = rooms.get(roomCode);
            
            if (room && killerId && room.players.has(killerId)) {
              const attacker = room.players.get(killerId)!;
              attacker.kills += 1;
              attacker.score += isHeadshot ? 150 : 100;

              if (attacker.kills >= room.scoreLimit) {
                room.isMatchActive = false;
                const playerList = Array.from(room.players.values()).map(p => ({
                  id: p.id,
                  name: p.name,
                  classId: p.classId,
                  kills: p.kills,
                  deaths: p.deaths,
                  score: p.score,
                  health: p.health,
                }));
                broadcastToRoom(roomCode, {
                  type: "match_ended",
                  payload: {
                    winnerName: attacker.name,
                    players: playerList,
                    reason: "score_limit"
                  }
                });
              }
            }

            broadcastToRoom(roomCode, {
              type: "player_killed",
              payload: {
                isNoscope,
                killer: {
                  id: killerId,
                  name: killerName || "Soldier",
                  classId: "assault",
                  isBot: killerIsBot,
                },
                victim: {
                  name: victimName || "Target Bot",
                  classId: victimClassId || "assault",
                  isBot: true,
                },
                weaponName,
                isHeadshot,
              }
            });
            break;
          }

          case "chat": {
            const roomCode = ws.roomCode || 'MAIN';
            broadcastToRoom(roomCode, {
              type: "chat_message",
              payload: {
                senderId: clientId,
                senderName: payload.senderName || "Soldier",
                message: payload.message,
              }
            });
            break;
          }
        }
      } catch (err) {
        console.error("Failed to parse message string on WS:", err);
      }
    });

    ws.on("close", () => {
      console.log(`Multiplayer client disconnected: ${clientId}`);
      const roomCode = ws.roomCode || 'MAIN';
      const room = rooms.get(roomCode);
      if (room) {
        room.players.delete(clientId);
        broadcastToRoom(roomCode, {
          type: "player_left",
          payload: { clientId },
        });

        if (room.players.size === 0) {
          rooms.delete(roomCode);
        } else if (room.hostId === clientId) {
          const remainingIds = Array.from(room.players.keys());
          if (remainingIds.length > 0) {
            room.hostId = remainingIds[0];
          }
        }
      }
    });
  });

  // Periodically ticks down match time for active rooms
  setInterval(() => {
    rooms.forEach((room) => {
      if (room.players.size > 0 && room.isMatchActive) {
        room.matchTimeLeft = Math.max(0, room.matchTimeLeft - 1);
        const playerList = Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          classId: p.classId,
          kills: p.kills,
          deaths: p.deaths,
          score: p.score,
          health: p.health,
        }));

        if (room.matchTimeLeft <= 0) {
          room.isMatchActive = false;
          const sorted = Array.from(room.players.values()).sort((a, b) => b.score - a.score);
          const winner = sorted[0];
          broadcastToRoom(room.code, {
            type: "match_ended",
            payload: {
              winnerName: winner ? winner.name : "Time Expired",
              players: playerList,
              reason: "time_expired"
            }
          });
        } else {
          broadcastToRoom(room.code, {
            type: "time_sync",
            payload: {
              matchTimeLeft: room.matchTimeLeft,
              players: playerList
            },
          });
        }
      }
    });
  }, 1000);

  // Vite middleware for development & production static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(process.cwd(), "index.html");
        if (fs.existsSync(indexPath)) {
          let template = fs.readFileSync(indexPath, "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
          return;
        }
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
      }
      next();
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application index.html not found.");
      }
    });
  }
}

startServer().catch((e) => {
  console.error("Failed to start full-stack server:", e);
});
