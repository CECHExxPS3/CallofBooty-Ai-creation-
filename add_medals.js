const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

code = code.replace(
  /const \[showHackMenu, setShowHackMenu\] = useState\(false\);/,
  `const [showHackMenu, setShowHackMenu] = useState(false);
  const [medals, setMedals] = useState<{id: string, text: string, type: 'headshot' | 'noscope' | 'kill', time: number}[]>([]);`
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
