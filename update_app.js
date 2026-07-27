import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  '<Lobby',
  '<Lobby\n          graphicsQuality={graphicsQuality}\n          onGraphicsQualityChange={setGraphicsQuality}'
);
fs.writeFileSync('src/App.tsx', code);
