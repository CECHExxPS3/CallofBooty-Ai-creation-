const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

// 1. Multiplayer kill
code = code.replace(
  /sounds\.playKill\(\);\s*spawnKillPopup\(\s*new THREE\.Vector3\(game\.playerPos\.x, game\.playerPos\.y \+ 1, game\.playerPos\.z\),\s*isHeadshot \? "HEADSHOT!" : "KILL"\s*\);/,
  `sounds.playKill();
              const isSniper = game.activeWeapon.type === 'sniper';
              const isNoscope = isSniper && !game.isADS;
              if (isNoscope) triggerMedal("NOSCOPE", 'noscope');
              else if (isHeadshot) triggerMedal("HEADSHOT", 'headshot');
              else triggerMedal("KILL", 'kill');
              
              spawnKillPopup(
                new THREE.Vector3(game.playerPos.x, game.playerPos.y + 1, game.playerPos.z),
                isHeadshot ? "HEADSHOT!" : "KILL"
              );`
);

// 2. Bot kill
code = code.replace(
  /sounds\.playKill\(\);\s*spawnKillPopup\(bot\.position\.clone\(\)\.setY\(2\.0\), isHeadshot \? "HEADSHOT!" : "KILL"\);/,
  `sounds.playKill();
        const isSniper = game.activeWeapon.type === 'sniper';
        const isNoscope = isSniper && !game.isADS;
        if (isNoscope) triggerMedal("NOSCOPE", 'noscope');
        else if (isHeadshot) triggerMedal("HEADSHOT", 'headshot');
        else triggerMedal("KILL", 'kill');

        spawnKillPopup(bot.position.clone().setY(2.0), isHeadshot ? "HEADSHOT!" : "KILL");`
);

// 3. Melee kill
code = code.replace(
  /sounds\.playKill\(\);\s*spawnKillPopup\(b\.position\.clone\(\)\.setY\(2\.0\), "MELEE KILL"\);/,
  `sounds.playKill();
                triggerMedal("MELEE", 'kill');
                spawnKillPopup(b.position.clone().setY(2.0), "MELEE KILL");`
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
