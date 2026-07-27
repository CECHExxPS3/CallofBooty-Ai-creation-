const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

const streakUpdateCode = `
              setKillStreak(prev => {
                const next = prev + 1;
                if (next > 1) {
                  triggerMedal(\`STREAK x\${next}!\`, 'streak');
                }
                return next;
              });
`;

code = code.replace(
  /const isSniper = game\.activeWeapon\.type === 'sniper';\s*const isNoscope = isSniper && !game\.isADS;\s*if \(isNoscope\) triggerMedal\("NOSCOPE", 'noscope'\);\s*else if \(isHeadshot\) triggerMedal\("HEADSHOT", 'headshot'\);\s*else triggerMedal\("KILL", 'kill'\);/g,
  `const isSniper = game.activeWeapon.type === 'sniper';
              const isNoscope = isSniper && !game.isADS;
              if (isNoscope && isHeadshot) triggerMedal("NOSCOPE HEADSHOT!", 'noscope_headshot');
              else if (isNoscope) triggerMedal("NOSCOPE", 'noscope');
              else if (isHeadshot) triggerMedal("HEADSHOT", 'headshot');
              else triggerMedal("KILL", 'kill');
              ${streakUpdateCode}`
);

code = code.replace(
  /triggerMedal\("MELEE", 'kill'\);/,
  `triggerMedal("MELEE", 'kill');
  ${streakUpdateCode}`
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
