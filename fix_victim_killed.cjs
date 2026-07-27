const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

code = code.replace(
  /const \{ killer, victim, weaponName, isHeadshot \} = msg\.payload;/,
  'const { killer, victim, weaponName, isHeadshot, isNoscope } = msg.payload;'
);

code = code.replace(
  /if \(killer && killer\.id === clientId\) \{/,
  `if (victim && victim.id === clientId) {
              if (isNoscope && isHeadshot) {
                setDeathMessage("YOU GOT NOSCOPE HEADSHOTTED!");
              } else if (isNoscope) {
                setDeathMessage("YOU GOT NOSCOPED!");
              }
            }
            
            if (killer && killer.id === clientId) {`
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
