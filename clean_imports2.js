import fs from 'fs';
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
code = code.replace("import { buildHighQualityFirstPersonWeapon } from '../game/WeaponBuilder';\n", "");
fs.writeFileSync('src/components/GameCanvas.tsx', code);
