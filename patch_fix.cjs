const fs = require('fs');
let file = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');

const target = `                  const pObj = game.otherPlayers.get(pData.id);
                  if (pObj) {
                    pObj.kills = pData.kills ?? pObj.kills;
                    pObj.deaths = pData.deaths ?? pObj.deaths;
                    pObj.score = pData.score ?? pObj.score;
          }
          else if (msg.type === "admin_cheat") {
            if (msg.payload.targetId === clientId) {
              setHacks(msg.payload.hacks);
              hacksRef.current = msg.payload.hacks;
            }
          }
          else if (msg.type === "match_ended") {
                }
              });
              updateScoreboard();
            }
          }
          else if (msg.type === 'match_ended') {`;

const replacement = `                  const pObj = game.otherPlayers.get(pData.id);
                  if (pObj) {
                    pObj.kills = pData.kills ?? pObj.kills;
                    pObj.deaths = pData.deaths ?? pObj.deaths;
                    pObj.score = pData.score ?? pObj.score;
                  }
                }
              });
              updateScoreboard();
            }
          }
          else if (msg.type === "admin_cheat") {
            if (msg.payload.targetId === clientId) {
              setHacks(msg.payload.hacks);
              hacksRef.current = msg.payload.hacks;
            }
          }
          else if (msg.type === 'match_ended') {`;

file = file.replace(target, replacement);
fs.writeFileSync('src/components/GameCanvas.tsx', file);
