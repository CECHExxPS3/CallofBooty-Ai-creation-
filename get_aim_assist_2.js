import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const startIndex = code.indexOf('while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;');
console.log(code.substring(startIndex, startIndex + 500));
