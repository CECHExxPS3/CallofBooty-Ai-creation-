import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const lines = code.split('\n');
console.log(lines.slice(2120, 2145).join('\n'));
