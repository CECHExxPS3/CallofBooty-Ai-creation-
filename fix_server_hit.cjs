const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  /const \{ targetId, damage, isHeadshot, weaponName \} = payload;/,
  'const { targetId, damage, isHeadshot, weaponName, isNoscope } = payload;'
);

fs.writeFileSync('server.ts', code);
