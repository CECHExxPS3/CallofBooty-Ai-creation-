import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const startIndex = code.indexOf('camera.position.copy(game.playerPos);');
console.log(code.substring(startIndex - 500, startIndex + 500));
