import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const startIndex = code.indexOf('const targetFOV');
console.log(code.substring(startIndex - 200, startIndex + 200));
