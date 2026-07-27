import fs from 'fs';
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

code = code.replace(
  'interface GameHUDProps {',
  `interface GameHUDProps {
  graphicsQuality: 'POTATO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
  onGraphicsChange: (q: 'POTATO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA') => void;`
);

fs.writeFileSync('src/components/GameHUD.tsx', code);
console.log("Added graphics props to HUD");
