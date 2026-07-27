const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

code = code.replace(
  /isHeadshot\n\s*\}\n\s*\}\)\);/,
  `isHeadshot,
              isNoscope: game.activeWeapon.type === "sniper" && !game.isADS
            }
          }));`
);

code = code.replace(
  /isHeadshot\n\s*\}\)\);/,
  `isHeadshot,
            isNoscope: false // Bots don't noscope
          }));`
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
