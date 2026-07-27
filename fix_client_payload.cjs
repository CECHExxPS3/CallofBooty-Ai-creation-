const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

code = code.replace(
  /weaponName: game\.activeWeapon\.name/,
  'weaponName: game.activeWeapon.name,\n                  isNoscope: game.activeWeapon.type === "sniper" && !game.isADS'
);

code = code.replace(
  /weaponName: game\.activeWeapon\.name,/,
  'weaponName: game.activeWeapon.name,\n              isNoscope: game.activeWeapon.type === "sniper" && !game.isADS,'
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
