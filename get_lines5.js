import fs from 'fs';
const code = fs.readFileSync('src/game/WeaponBuilder.ts', 'utf8');
const lines = code.split('\n');
console.log(lines.slice(90, 160).join('\n'));
