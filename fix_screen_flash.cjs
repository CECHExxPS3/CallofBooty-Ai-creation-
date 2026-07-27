const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

code = code.replace(
  /const \[medals, setMedals\] = useState<\{id: string, text: string, type: 'headshot' \| 'noscope' \| 'kill', time: number\}\[\]>\(\[\]\);/,
  `const [medals, setMedals] = useState<{id: string, text: string, type: 'headshot' | 'noscope' | 'kill', time: number}[]>([]);
  const [screenFlash, setScreenFlash] = useState<'none' | 'headshot' | 'noscope'>('none');`
);

code = code.replace(
  /setMedals\(prev => \[\.\.\.prev, \{ id: Math\.random\(\)\.toString\(36\), text, type, time: Date\.now\(\) \}\]\);/,
  `setMedals(prev => [...prev, { id: Math.random().toString(36), text, type, time: Date.now() }]);
    if (type === 'noscope') {
       setScreenFlash('noscope');
       setTimeout(() => setScreenFlash('none'), 200);
    } else if (type === 'headshot') {
       setScreenFlash('headshot');
       setTimeout(() => setScreenFlash('none'), 200);
    }`
);

const screenFlashJSX = `
      {/* SCREEN FLASH EFFECTS */}
      {screenFlash === 'noscope' && (
        <div className="absolute inset-0 bg-purple-500/30 mix-blend-overlay pointer-events-none z-20" />
      )}
      {screenFlash === 'headshot' && (
        <div className="absolute inset-0 bg-red-500/30 mix-blend-overlay pointer-events-none z-20" />
      )}
`;

code = code.replace(
  /\{\/\* MEDALS OVERLAY \*\/\}/,
  screenFlashJSX + '\n      {/* MEDALS OVERLAY */}'
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
