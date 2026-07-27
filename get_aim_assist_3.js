import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const startIndex = code.indexOf('const targetPitch = Math.atan2(dir.y, xzDist);', code.indexOf('TACTICAL AIM ASSIST'));
console.log(code.substring(startIndex, startIndex + 500));
