import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const startIndex = code.indexOf('// 2. Physics & Movement Step (Player)');
console.log(code.substring(startIndex, startIndex + 2500));
