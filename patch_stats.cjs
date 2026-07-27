const fs = require('fs');
const file = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const newFile = file.replace(
`      const statsList: MatchStats[] = [
        {
          id: 'player',
          name: playerName,
          isBot: false,
          classId: playerClass.id,
          kills: game.playerKills,
          deaths: game.playerDeaths,
          assists: 0,
          score: game.playerScore,
          weaponKills: game.playerWeaponKills
        },
        ...otherPlayersStats,`,
`      const statsList: MatchStats[] = [
        ...(config.spectatorMode ? [] : [{
          id: 'player',
          name: playerName,
          isBot: false,
          classId: playerClass.id,
          kills: game.playerKills,
          deaths: game.playerDeaths,
          assists: 0,
          score: game.playerScore,
          weaponKills: game.playerWeaponKills
        }]),
        ...otherPlayersStats,`
);
fs.writeFileSync('src/components/GameCanvas.tsx', newFile);
