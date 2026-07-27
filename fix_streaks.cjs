const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

code = code.replace(
  /const \[medals, setMedals\] = useState<\{id: string, text: string, type: 'headshot' \| 'noscope' \| 'kill', time: number\}\[\]>\(\[\]\);/,
  `const [medals, setMedals] = useState<{id: string, text: string, type: 'headshot' | 'noscope' | 'kill' | 'streak' | 'noscope_headshot', time: number}[]>([]);
  const [killStreak, setKillStreak] = useState(0);
  const [deathMessage, setDeathMessage] = useState<string | null>(null);
  
  useEffect(() => {
    if (killStreak > 0) {
      const timer = setTimeout(() => {
        setKillStreak(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [killStreak]);`
);

code = code.replace(
  /const triggerMedal = \(text: string, type: 'headshot' \| 'noscope' \| 'kill'\) => \{/,
  `const triggerMedal = (text: string, type: 'headshot' | 'noscope' | 'kill' | 'streak' | 'noscope_headshot') => {`
);

code = code.replace(
  /const \[screenFlash, setScreenFlash\] = useState<'none' \| 'headshot' \| 'noscope'>\('none'\);/,
  `const [screenFlash, setScreenFlash] = useState<'none' | 'headshot' | 'noscope' | 'noscope_headshot' | 'streak'>('none');`
);

code = code.replace(
  /if \(type === 'noscope'\) \{/,
  `if (type === 'noscope_headshot') {
       setScreenFlash('noscope_headshot');
       setTimeout(() => setScreenFlash('none'), 300);
    } else if (type === 'streak') {
       setScreenFlash('streak');
       setTimeout(() => setScreenFlash('none'), 300);
    } else if (type === 'noscope') {`
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
