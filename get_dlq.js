import fs from 'fs';
const code = fs.readFileSync('src/types.ts', 'utf8');
const startIndex = code.indexOf('dlq_sniper: {');
console.log(code.substring(startIndex, startIndex + 500));
