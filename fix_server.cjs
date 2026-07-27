const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  /const \{ targetId, damage, isHeadshot, weaponName \} = payload \|\| \{\};/,
  'const { targetId, damage, isHeadshot, weaponName, isNoscope } = payload || {};'
);

code = code.replace(
  /broadcastToRoom\(roomCode, \{\s*type: "player_killed",\s*payload: \{\s*killer:/,
  `broadcastToRoom(roomCode, {
                  type: "player_killed",
                  payload: {
                    isNoscope,
                    killer:`
);

code = code.replace(
  /const \{ killerId, killerName, killerIsBot, victimName, victimClassId, weaponName, isHeadshot \} = payload \|\| \{\};/,
  'const { killerId, killerName, killerIsBot, victimName, victimClassId, weaponName, isHeadshot, isNoscope } = payload || {};'
);

code = code.replace(
  /broadcastToRoom\(roomCode, \{\s*type: "player_killed",\s*payload: \{\s*killer: \{\s*id: killerId,/,
  `broadcastToRoom(roomCode, {
              type: "player_killed",
              payload: {
                isNoscope,
                killer: {
                  id: killerId,`
);

code = code.replace(
  /broadcastToRoom\(roomCode, \{\s*type: "player_killed",\s*payload: \{\s*killer: \{\s*name: killer\.name,/,
  `broadcastToRoom(roomCode, {
            type: "player_killed",
            payload: {
              isNoscope,
              killer: {
                name: killer.name,`
);

fs.writeFileSync('server.ts', code);
