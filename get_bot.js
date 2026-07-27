import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const startIndex = code.indexOf('const spawnBot = () => {');
console.log(code.substring(startIndex, startIndex + 1500));
