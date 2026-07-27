const fs = require('fs');
const file = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const newFile = file.replace(
`        const toggleHack = (hackName) => {
          if (!targetPlayer) return;
          const currentCheats = adminTargetCheats[targetPlayer.id] || { 
            godMode: false, speedHack: false, flyHack: false, insaneSpeed: false, superJump: false, aimbotMode: 'OFF' 
          };`,
`        const toggleHack = (hackName) => {
          if (!targetPlayer) return;
          const currentCheats = adminTargetCheats[targetPlayer.id] || { 
            espMode: 'OFF', wallhack: false, tracerLines: false, oneShot: false, rapidFire: false, fullAuto: false,
            noRecoil: false, unlimitedAmmo: false, godMode: false, autoHeal: false, speedHack: false, insaneSpeed: false,
            superJump: false, flyHack: false, aimbotMode: 'OFF', aimbotTarget: 'HEAD', fovVisibility: 'OBVIOUS'
          };`
);
fs.writeFileSync('src/components/GameCanvas.tsx', newFile);
