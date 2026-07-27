import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const startIndex = code.indexOf('// Pass 5: Camera & Viewmode');
console.log(code.substring(startIndex, startIndex + 3000));
