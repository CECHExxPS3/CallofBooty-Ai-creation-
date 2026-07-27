import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'const [isMuted, setIsMuted] = useState(false);',
  `const [isMuted, setIsMuted] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<'POTATO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA'>('HIGH');`
);

code = code.replace(
  '<GameCanvas',
  `<GameCanvas
            graphicsQuality={graphicsQuality}`
);

code = code.replace(
  '<GameHUD',
  `<GameHUD
            graphicsQuality={graphicsQuality}
            onGraphicsChange={setGraphicsQuality}`
);

fs.writeFileSync('src/App.tsx', code);
console.log("Added graphics quality to App.tsx");
