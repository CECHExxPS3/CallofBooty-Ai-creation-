import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const lines = code.split('\n');
console.log(lines.slice(1335, 1345).join('\n'));
