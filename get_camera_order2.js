import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const startIndex = code.indexOf('const checkEntity = (pos: THREE.Vector3, health: number, maxHealth: number) => {');
console.log(code.substring(startIndex - 500, startIndex + 1500));
