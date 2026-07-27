const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

code = code.replace(
  /isNoscope: game\.activeWeapon\.type === "sniper" && !game\.isADS,\n                  isNoscope: game\.activeWeapon\.type === "sniper" && !game\.isADS/,
  'isNoscope: game.activeWeapon.type === "sniper" && !game.isADS'
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
