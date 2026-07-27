import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const lines = code.split('\n');
console.log(lines.slice(2090, 2110).join('\n'));
