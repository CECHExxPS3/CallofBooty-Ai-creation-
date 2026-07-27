const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

code = code.replace(
  /const \{ killer, victim, weaponName, isHeadshot, isNoscope \} = msg\.payload;/,
  `const { killer, victim, weaponName, isHeadshot, isNoscope } = msg.payload;
            
            // Prevent double-counting AI kills (already processed locally in damageBot)
            if (killer && killer.id === clientId && victim && victim.isBot) {
              return;
            }`
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
